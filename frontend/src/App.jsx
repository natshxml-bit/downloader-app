import { useState, useEffect, useCallback, useRef } from 'react'
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
  const icon = type === 'error' ? '⚠' : type === 'warning' ? '⚡' : '✓'

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md ${colors} shadow-lg animate-slide-in max-w-sm`}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{icon}</span>
        <p className="text-sm">{message}</p>
        <button onClick={onClose} className="text-white/40 hover:text-white ml-auto text-xs">✕</button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-4">
      <div className="h-44 bg-white/5 rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 bg-white/5 rounded-lg w-3/4" />
        <div className="h-3 bg-white/5 rounded-lg w-1/2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-10 bg-white/5 rounded-lg" />
        <div className="h-10 bg-white/5 rounded-lg" />
      </div>
    </div>
  )
}

function ProgressBar({ progress, status }) {
  if (!status) return null
  return (
    <div className="mt-3">
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/60 transition-all duration-500 rounded-full"
          style={{ width: progress > 0 ? `${progress}%` : '100%' }}
        />
      </div>
      <p className="text-[11px] text-white/30 mt-1.5 text-center">{status}</p>
    </div>
  )
}

function HistoryPanel({ history, show, onToggle, onClear }) {
  if (!show) {
    return (
      <button onClick={onToggle}
        className="mt-6 text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1.5 mx-auto">
        <span>History</span>
        <span className="text-white/20">({history.length})</span>
      </button>
    )
  }

  return (
    <div className="mt-5 space-y-2 animate-fade-up">
      <div className="flex items-center justify-between">
        <button onClick={onToggle} className="text-xs text-white/30 hover:text-white/60 transition">
          Hide history
        </button>
        {history.length > 0 && (
          <button onClick={onClear} className="text-[11px] text-red-400/40 hover:text-red-400/70 transition">
            Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-center text-white/20 text-xs py-4">No downloads yet</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
            <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center text-xs shrink-0">
              {item.type === 'mp3' ? '♪' : '▶'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 truncate">{item.title}</p>
              <p className="text-[10px] text-white/25">{item.platform} · {item.type.toUpperCase()}</p>
            </div>
            {item.size && (
              <span className="text-[10px] text-white/25 shrink-0">{item.size}</span>
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
      showToast('Enter a valid URL', 'error')
      return
    }
    if (!isSupportedPlatform(target)) {
      showToast('Platform not supported', 'warning')
      return
    }

    abort()
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
      if (!res.ok) throw new Error(data.error || 'Failed')
      setInfo(data)

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
      if (err.name !== 'AbortError') showToast(err.message, 'error')
    } finally {
      setFetchingInfo(false)
    }
  }, [url, abort, getCtrl, showToast])

  const download = async (type) => {
    if (!info) return
    setLoading(true)
    setProgress({ value: 10, status: 'Preparing...' })

    const ctrl = getCtrl()
    try {
      const res = await fetch(`${API}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, format_id: selectedFormat, title: info?.title }),
        signal: ctrl.signal
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      setProgress({ value: 50, status: 'Downloading...' })

      const fileRes = await fetch(`${API}/api/file/${data.file}`, { signal: ctrl.signal })
      if (!fileRes.ok) throw new Error('Transfer failed')

      const blob = await fileRes.blob()
      setProgress({ value: 90, status: 'Saving...' })

      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = data.title ? `${data.title}.${type}` : data.file
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(blobUrl)

      setProgress({ value: 100, status: 'Done' })
      showToast(`Downloaded: ${data.title || data.file}`)

      const newItem = {
        id: Date.now(),
        title: info.title || 'Untitled',
        type,
        thumbnail: info.thumbnail,
        date: new Date().toLocaleDateString(),
        platform: info.platform || 'unknown',
        size: formatFileSize(blob.size)
      }
      setHistory(prev => [newItem, ...prev.slice(0, MAX_HISTORY - 1)])

      setTimeout(() => {
        setInfo(null); setUrl(''); setFormats([]); setSelectedFormat('')
        setProgress({ value: 0, status: '' })
      }, 2000)

    } catch (err) {
      if (err.name !== 'AbortError') showToast(err.message, 'error')
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
      showToast('Clipboard access denied', 'error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedText = e.dataTransfer.getData('text')
    if (droppedText) {
      setUrl(droppedText)
      if (isValidUrl(droppedText) && isSupportedPlatform(droppedText)) {
        setTimeout(() => fetchInfo(droppedText), 100)
      }
      return
    }

    const files = Array.from(e.dataTransfer.files)
    const textFile = files.find(f => f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.csv'))
    if (textFile) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const urls = ev.target.result.split(/\n/).filter(u => isValidUrl(u.trim()))
        if (urls.length > 0) {
          setUrl(urls[0])
          setTimeout(() => fetchInfo(urls[0]), 100)
          showToast(`${urls.length} URLs found`, 'success')
        } else {
          showToast('No valid URLs in file', 'warning')
        }
      }
      reader.readAsText(textFile)
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const clearHistory = () => { setHistory([]); showToast('History cleared') }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 relative selection:bg-white/20">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <div className="w-full max-w-md relative z-10 pt-10 pb-20">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-medium tracking-tight mb-1">
            TokiTube
          </h1>
          <p className="text-white/30 text-sm">Video & audio downloader</p>
        </div>

        {/* Input */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border rounded-xl p-4 transition-all duration-200 ${isDragging ? 'border-white/30 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01]'}`}
        >
          <form onSubmit={(e) => { e.preventDefault(); fetchInfo() }} className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste URL..."
                className="w-full px-3 py-3 pr-10 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none transition text-sm placeholder-white/20"
                required
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/60 transition text-xs"
                title="Paste"
              >
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={fetchingInfo}
              className="w-full py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {fetchingInfo ? 'Analyzing...' : 'Analyze'}
            </button>
          </form>

          <ProgressBar progress={progress.value} status={progress.status} />
        </div>

        {/* Skeleton */}
        {fetchingInfo && <Skeleton />}

        {/* Info Card */}
        {info && !fetchingInfo && (
          <div className="mt-5 border border-white/10 rounded-xl overflow-hidden animate-fade-up">
            <div className="relative">
              <img
                src={info.thumbnail}
                alt=""
                loading="lazy"
                className="w-full h-48 object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <h2 className="text-base font-medium leading-snug line-clamp-2">{info.title}</h2>
              </div>
              {info.duration && (
                <span className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-white/60">
                  {info.duration}
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] text-white/40 uppercase">
                  {info.platform}
                </span>
                <span className="text-xs text-white/30">{info.channel}</span>
                {info.view_count && (
                  <span className="text-[10px] text-white/20 ml-auto">{info.view_count.toLocaleString()} views</span>
                )}
              </div>

              {formats.length > 0 && (
                <div className="mb-3">
                  <label className="text-[10px] text-white/30 mb-1.5 block uppercase tracking-wider">Quality</label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-white/30 focus:outline-none text-white/70"
                  >
                    <option value="">Auto (best)</option>
                    {formats.map((f, i) => (
                      <option key={i} value={f.format_id}>
                        {f.type === 'audio' ? `Audio · ${f.note}` : `Video · ${f.note}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => download('mp3')}
                  disabled={loading}
                  className="py-3 rounded-lg bg-white/5 border border-white/10 font-medium text-sm hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.97] disabled:opacity-20"
                >
                  {loading ? '...' : 'MP3'}
                </button>
                <button
                  onClick={() => download('mp4')}
                  disabled={loading}
                  className="py-3 rounded-lg bg-white/5 border border-white/10 font-medium text-sm hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.97] disabled:opacity-20"
                >
                  {loading ? '...' : 'MP4'}
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
      <div className="fixed bottom-0 w-full text-center py-2 text-[10px] text-white/10">
        TokiTube
      </div>
    </div>
  )
}

export default App
