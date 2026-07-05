import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './index.css'

// ── Config ──────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'https://downloader-app.up.railway.app'
const MAX_HISTORY = 50
const SUPPORTED_PLATFORMS = [
  'youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com',
  'twitter.com', 'x.com', 'facebook.com', 'fb.watch',
  'soundcloud.com', 'reddit.com', 'pinterest.com'
]

// ── Utilities ───────────────────────────────────────────────────────────────
const isValidUrl = (str) => {
  if (!str || typeof str !== 'string') return false
  try {
    const url = new URL(str.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch { return false }
}

const isSupportedPlatform = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return SUPPORTED_PLATFORMS.some(p => hostname.includes(p))
  } catch { return false }
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

// ── Custom Hooks ────────────────────────────────────────────────────────────
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
    } catch (e) { console.error('localStorage error:', e) }
  }
  return [stored, setValue]
}

function useAbortController() {
  const ctrlRef = useRef(null)
  const abort = useCallback(() => {
    if (ctrlRef.current) {
      ctrlRef.current.abort()
      ctrlRef.current = null
    }
  }, [])
  const getCtrl = useCallback(() => {
    abort()
    ctrlRef.current = new AbortController()
    return ctrlRef.current
  }, [abort])
  useEffect(() => abort, [abort])
  return { getCtrl, abort }
}

// ── Components ────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = type === 'error'
    ? 'bg-red-500/10 border-red-500/30 text-red-200'
    : type === 'warning'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
  const icon = type === 'error' ? '⚠️' : type === 'warning' ? '⚡' : '🎉'

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border backdrop-blur-xl ${colors} shadow-2xl animate-slide-in max-w-xs`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{icon}</span>
        <p className="text-sm leading-relaxed">{message}</p>
        <button onClick={onClose} className="text-white/40 hover:text-white ml-auto shrink-0">✕</button>
      </div>
    </div>
  )
}

function Waveform() {
  return (
    <div className="flex items-center gap-1 h-8">
      {[...Array(8)].map((_, i) => (
        <div key={i}
          className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full animate-wave"
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

function ProgressBar({ progress, status }) {
  if (!status) return null
  return (
    <div className="mt-4">
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-all duration-700 rounded-full"
          style={{ width: progress > 0 ? `${progress}%` : '100%' }}
        />
      </div>
      <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-wider">
        {status}
      </p>
    </div>
  )
}

function HistoryPanel({ history, show, onToggle, onClear }) {
  if (!show) {
    return (
      <div className="mt-8 flex justify-center">
        <button onClick={onToggle}
          className="text-xs text-gray-600 hover:text-gray-400 transition flex items-center gap-2">
          <span>▶</span> Download History ({history.length})
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between px-1">
        <button onClick={onToggle} className="text-xs text-gray-600 hover:text-gray-400 transition flex items-center gap-2">
          <span>▼</span> Download History
        </button>
        {history.length > 0 && (
          <button onClick={onClear} className="text-[10px] text-red-400/60 hover:text-red-400 transition uppercase tracking-wider">
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-center text-gray-700 text-xs py-4">No history yet</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-lg shrink-0">
              {item.type === 'mp3' ? '🎵' : '🎬'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.title}</p>
              <p className="text-[10px] text-gray-600">{item.platform} • {item.type.toUpperCase()} • {item.date}</p>
            </div>
            {item.size && (
              <span className="text-[10px] text-gray-600 shrink-0">{item.size}</span>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState(null)
  const [formats, setFormats] = useState([])
  const [selectedFormat, setSelectedFormat] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [toast, setToast] = useState(null)
  const [progress, setProgress] = useState({ value: 0, status: '' })
  const [history, setHistory] = useLocalStorage('tokitube_history', [])
  const [showHistory, setShowHistory] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)
  const { getCtrl, abort } = useAbortController()

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') clearToast()
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearToast])

  const fetchInfo = useCallback(async (linkUrl) => {
    const target = (linkUrl || url).trim()
    if (!target) return

    if (!isValidUrl(target)) {
      showToast('Please enter a valid URL (http:// or https://)', 'error')
      return
    }
    if (!isSupportedPlatform(target)) {
      showToast('URL platform not supported. Try YouTube, TikTok, Instagram, etc.', 'warning')
      return
    }

    abort() // Cancel previous request
    setFetchingInfo(true)
    setInfo(null)
    setFormats([])
    setSelectedFormat('')

    const ctrl = getCtrl()
    try {
      const res = await fetch(`${API}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
        signal: ctrl.signal
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch info')
      setInfo(data)

      // Fetch formats
      const fmtCtrl = getCtrl()
      const fmtRes = await fetch(`${API}/api/formats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
        signal: fmtCtrl.signal
      })
      const fmtData = await fmtRes.json()
      if (fmtRes.ok && fmtData.formats) {
        setFormats(fmtData.formats)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast(err.message, 'error')
      }
    } finally {
      setFetchingInfo(false)
    }
  }, [url, abort, getCtrl, showToast])

  const download = async (type) => {
    if (!info) return
    setLoading(true)
    setProgress({ value: 0, status: 'Preparing download...' })

    const ctrl = getCtrl()
    try {
      const res = await fetch(`${API}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          type,
          format_id: selectedFormat,
          title: info?.title
        }),
        signal: ctrl.signal
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Download failed')

      setProgress({ value: 50, status: 'Transferring file...' })

      const fileRes = await fetch(`${API}/api/file/${data.file}`, {
        signal: ctrl.signal
      })
      if (!fileRes.ok) throw new Error('File transfer failed')

      const blob = await fileRes.blob()
      setProgress({ value: 90, status: 'Saving to device...' })

      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = data.title ? `${data.title}.${type}` : data.file
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(blobUrl)

      setProgress({ value: 100, status: 'Complete ✓' })
      showToast(`Downloaded: ${data.title || data.file}`)

      // Add to history
      const newItem = {
        id: Date.now(),
        title: info.title || 'Untitled',
        type,
        thumbnail: info.thumbnail,
        date: new Date().toLocaleString(),
        platform: info.platform || 'unknown',
        size: formatFileSize(blob.size)
      }
      setHistory(prev => [newItem, ...prev.slice(0, MAX_HISTORY - 1)])

      // Reset after delay
      setTimeout(() => {
        setInfo(null)
        setUrl('')
        setFormats([])
        setSelectedFormat('')
        setProgress({ value: 0, status: '' })
      }, 2000)

    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast(err.message, 'error')
      }
      setProgress({ value: 0, status: '' })
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
        if (isValidUrl(text) && isSupportedPlatform(text)) {
          setTimeout(() => fetchInfo(text), 100)
        }
      }
    } catch {
      showToast('Clipboard access denied. Please paste manually.', 'error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    // Handle text drop
    const droppedText = e.dataTransfer.getData('text')
    if (droppedText) {
      setUrl(droppedText)
      if (isValidUrl(droppedText) && isSupportedPlatform(droppedText)) {
        setTimeout(() => fetchInfo(droppedText), 100)
      }
      return
    }

    // Handle file drop (.txt, .csv)
    const files = Array.from(e.dataTransfer.files)
    const textFile = files.find(f => f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.csv'))
    if (textFile) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const content = ev.target.result
        const urls = content.split(/\n/).filter(u => isValidUrl(u.trim()))
        if (urls.length > 0) {
          setUrl(urls[0])
          setTimeout(() => fetchInfo(urls[0]), 100)
          showToast(`Found ${urls.length} URLs in file`, 'success')
        } else {
          showToast('No valid URLs found in file', 'warning')
        }
      }
      reader.readAsText(textFile)
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const clearHistory = () => { setHistory([]); showToast('History cleared') }

  const progressStatus = useMemo(() => {
    if (progress.value === 0) return ''
    if (progress.value < 30) return 'Preparing...'
    if (progress.value < 70) return 'Downloading...'
    if (progress.value < 100) return 'Processing...'
    return 'Complete ✓'
  }, [progress.value])

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center p-4 relative overflow-hidden selection:bg-purple-500/30">

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px] animate-pulse-slow-delayed" />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

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
                  placeholder="Drop link here or paste (Ctrl+V)..."
                  className="w-full px-4 py-4 pl-11 pr-12 rounded-2xl bg-white/5 border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition text-sm placeholder-gray-600 group-hover:border-white/20"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔗</span>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition text-xs border border-white/10"
                  title="Paste from clipboard (Ctrl+V)"
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
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : 'Analyze Link'}
              </button>
            </form>

            {/* Progress */}
            <ProgressBar progress={progress.value} status={progress.status || progressStatus} />

            {/* Audio Visualizer */}
            {loading && progress.value > 0 && progress.value < 100 && (
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
          <div className="mt-6 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-up">
            <div className="relative">
              <img
                src={info.thumbnail}
                alt={info.title}
                loading="lazy"
                className="w-full h-52 object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
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

        {/* History */}
        <HistoryPanel
          history={history}
          show={showHistory}
          onToggle={() => setShowHistory(!showHistory)}
          onClear={clearHistory}
        />

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 w-full text-center py-3 text-[10px] text-gray-800 bg-gradient-to-t from-[#050508] to-transparent pointer-events-none">
        TokiTube • Flask + React + yt-dlp
      </div>
    </div>
  )
}

export default App
