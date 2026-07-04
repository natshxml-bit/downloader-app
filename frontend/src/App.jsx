import { useState, useEffect, useCallback, useRef } from 'react'

const API = 'https://downloader-app.up.railway.app/'

// Custom hook for localStorage
function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch { return initialValue }
  })
  const setValue = (value) => {
    try {
      const v = value instanceof Function ? value(stored) : value
      setStored(v)
      window.localStorage.setItem(key, JSON.stringify(v))
    } catch { console.error('localStorage error') }
  }
  return [stored, setValue]
}

// Toast Component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  
  const colors = type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-green-500/10 border-green-500/30 text-green-200'
  const icon = type === 'error' ? '⚠️' : '🎉'
  
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border backdrop-blur-xl ${colors} shadow-2xl animate-[slideIn_0.4s_ease-out] max-w-xs`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

// Waveform Animation
function Waveform() {
  return (
    <div className="flex items-center gap-1 h-8">
      {[...Array(8)].map((_, i) => (
        <div key={i} 
          className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full animate-[wave_1s_ease-in-out_infinite]"
          style={{ 
            height: '40%', 
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.8 + Math.random() * 0.4}s`
          }}
        />
      ))}
    </div>
  )
}

// Skeleton Loader
function Skeleton() {
  return (
    <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden p-5 animate-pulse">
      <div className="h-48 bg-white/10 rounded-2xl mb-4" />
      <div className="h-5 bg-white/10 rounded-lg w-3/4 mb-3" />
      <div className="h-4 bg-white/10 rounded-lg w-1/2 mb-5" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 bg-white/10 rounded-2xl" />
        <div className="h-12 bg-white/10 rounded-2xl" />
      </div>
    </div>
  )
}

function App() {
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState(null)
  const [formats, setFormats] = useState([])
  const [selectedFormat, setSelectedFormat] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [toast, setToast] = useState(null)
  const [progress, setProgress] = useState(0)
  const [history, setHistory] = useLocalStorage('tokitube_history', [])
  const [showHistory, setShowHistory] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  const fetchInfo = useCallback(async (linkUrl) => {
    const target = linkUrl || url
    if (!target.trim()) return
    setFetchingInfo(true); setInfo(null); setFormats([]); setSelectedFormat('')
    try {
      const res = await fetch(`${API}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setInfo(data)
      
      // Fetch formats
      const fmtRes = await fetch(`${API}/api/formats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target })
      })
      const fmtData = await fmtRes.json()
      if (fmtRes.ok && fmtData.formats) {
        setFormats(fmtData.formats)
      }
    } catch (err) { showToast(err.message, 'error') }
    finally { setFetchingInfo(false) }
  }, [url])

  const download = async (type) => {
    setLoading(true); setProgress(10)
    try {
      const res = await fetch(`${API}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          type, 
          format_id: selectedFormat,
          title: info?.title 
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Download failed')

      setProgress(60)
      const fileRes = await fetch(`${API}/api/file/${data.file}`)
      if (!fileRes.ok) throw new Error('Transfer failed')
      
      const blob = await fileRes.blob()
      setProgress(85)
      
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = data.file
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(blobUrl)
      
      setProgress(100)
      showToast(`Saved: ${data.file}`)
      
      // Add to history
      const newItem = {
        id: Date.now(),
        title: info.title,
        type,
        thumbnail: info.thumbnail,
        date: new Date().toLocaleString(),
        platform: info.platform
      }
      setHistory(prev => [newItem, ...prev.slice(0, 19)])
      
      setInfo(null); setUrl(''); setFormats([]); setSelectedFormat('')
    } catch (err) { showToast(err.message, 'error') }
    finally { setTimeout(() => setProgress(0), 1500); setLoading(false) }
  }

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) { setUrl(text); setTimeout(() => fetchInfo(text), 100) }
    } catch { showToast('Clipboard access denied', 'error') }
  }

  // Drag & Drop
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.getData('text')
    if (dropped) { setUrl(dropped); setTimeout(() => fetchInfo(dropped), 100) }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const clearHistory = () => { setHistory([]); showToast('History cleared') }

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center p-4 relative overflow-hidden selection:bg-purple-500/30">
      
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px] animate-[pulse_5s_ease-in-out_infinite_1s]" />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="w-full max-w-md relative z-10 pt-8 pb-20">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 mb-4 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Online
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-1">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              TokiTube
            </span>
          </h1>
          <p className="text-gray-500 text-xs tracking-wide">YouTube & TikTok Downloader</p>
        </div>

        {/* Input Area */}
        <div 
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative bg-white/[0.03] backdrop-blur-2xl border rounded-3xl p-1.5 transition-all duration-300 ${isDragging ? 'border-purple-500/50 scale-[1.02] shadow-[0_0_30px_rgba(168,85,247,0.15)]' : 'border-white/10'}`}
        >
          <div className="bg-black/20 rounded-[20px] p-5">
            <form onSubmit={(e) => { e.preventDefault(); fetchInfo() }} className="space-y-4">
              <div className="relative group">
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Drop link here or paste..."
                  className="w-full px-4 py-4 pl-11 pr-12 rounded-2xl bg-white/5 border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition text-sm placeholder-gray-600 group-hover:border-white/20"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔗</span>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition text-xs border border-white/10"
                  title="Paste from clipboard"
                >
                  📋
                </button>
              </div>
              
              <button
                type="submit"
                disabled={fetchingInfo}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 font-bold text-sm tracking-wide hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-lg shadow-purple-900/20"
              >
                {fetchingInfo ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Analyzing...
                  </span>
                ) : 'Analyze Link'}
              </button>
            </form>

            {/* Progress */}
            {progress > 0 && (
              <div className="mt-4">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-all duration-700 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-wider">
                  {progress < 30 ? 'Preparing...' : progress < 70 ? 'Downloading...' : progress < 100 ? 'Processing...' : 'Complete ✓'}
                </p>
              </div>
            )}

            {/* Audio Visualizer */}
            {loading && progress > 0 && progress < 100 && (
              <div className="mt-4 flex justify-center">
                <Waveform />
              </div>
            )}
          </div>
        </div>

        {/* Skeleton Loading */}
        {fetchingInfo && <Skeleton />}

        {/* Video Info Card */}
        {info && !fetchingInfo && (
          <div className="mt-6 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-[fadeUp_0.5s_ease-out]">
            <div className="relative">
              <img src={info.thumbnail} alt="thumb" className="w-full h-52 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <h2 className="text-lg font-bold leading-snug line-clamp-2 drop-shadow-lg">{info.title}</h2>
              </div>
              {info.duration && (
                <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/10">
                  {info.duration}
                </span>
              )}
            </div>
            
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider text-gray-400">
                    {info.platform}
                  </span>
                  <span className="text-xs text-gray-500">{info.channel}</span>
                </div>
                {info.view_count && (
                  <span className="text-[10px] text-gray-600">
                    {info.view_count.toLocaleString()} views
                  </span>
                )}
              </div>

              {/* Quality Selector */}
              {formats.length > 0 && (
                <div className="mb-4">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 block">Quality</label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-500/50 focus:outline-none text-gray-300"
                  >
                    <option value="">Auto (Best)</option>
                    {formats.map((f, i) => (
                      <option key={i} value={f.format_id}>
                        {f.type === 'audio' ? `🎵 ${f.note}` : `🎬 ${f.note}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => download('mp3')}
                  disabled={loading}
                  className="group py-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 font-semibold text-sm hover:from-emerald-500/30 hover:to-green-600/30 transition-all active:scale-[0.96] disabled:opacity-30"
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? <span className="animate-spin text-xs">⏳</span> : <span>🎵</span>} 
                    <span>MP3</span>
                  </span>
                </button>
                <button
                  onClick={() => download('mp4')}
                  disabled={loading}
                  className="group py-3.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 font-semibold text-sm hover:from-blue-500/30 hover:to-indigo-600/30 transition-all active:scale-[0.96] disabled:opacity-30"
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? <span className="animate-spin text-xs">⏳</span> : <span>🎬</span>} 
                    <span>MP4</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Toggle */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-600 hover:text-gray-400 transition flex items-center gap-2"
          >
            <span>{showHistory ? '▼' : '▶'}</span> Download History ({history.length})
          </button>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="mt-4 space-y-3 animate-[fadeUp_0.3s_ease-out]">
            {history.length === 0 ? (
              <p className="text-center text-gray-700 text-xs">No history yet</p>
            ) : (
              <>
                {history.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-lg">
                      {item.type === 'mp3' ? '🎵' : '🎬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-600">{item.platform} • {item.type.toUpperCase()} • {item.date}</p>
                    </div>
                  </div>
                ))}
                <button onClick={clearHistory} className="w-full py-2 text-[10px] text-red-400/60 hover:text-red-400 transition uppercase tracking-wider">
                  Clear History
                </button>
              </>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 w-full text-center py-3 text-[10px] text-gray-800 bg-gradient-to-t from-[#050508] to-transparent pointer-events-none">
        TokiTube • Flask + React + yt-dlp
      </div>

      {/* Global Styles for animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export default App
