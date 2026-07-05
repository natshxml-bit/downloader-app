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

// ── Icons (SVG) ─────────────────────────────────────────────────────────────
const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const IconMusic = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)

const IconVideo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
    <line x1="7" y1="2" x2="7" y2="22"/>
    <line x1="17" y1="2" x2="17" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="7" x2="7" y2="7"/>
    <line x1="2" y1="17" x2="7" y2="17"/>
    <line x1="17" y1="17" x2="22" y2="17"/>
    <line x1="17" y1="7" x2="22" y2="7"/>
  </svg>
)

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const IconEye = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const IconHistory = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
)

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const IconSpinner = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
)

// ── Components ────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = type === 'error'
    ? 'border-red-500/30 text-red-300'
    : type === 'warning'
    ? 'border-amber-500/30 text-amber-300'
    : 'border-emerald-500/30 text-emerald-300'

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border bg-black/80 backdrop-blur-md ${colors} shadow-2xl animate-slide-in max-w-sm`}>
      <div className="flex items-center gap-3">
        <span className="text-sm">{type === 'error' ? '⚠' : type === 'warning' ? '⚡' : '✓'}</span>
        <p className="text-sm">{message}</p>
        <button onClick={onClose} className="text-white/30 hover:text-white ml-auto"><IconX /></button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-4">
      <div className="h-48 bg-white/[0.03] rounded-xl" />
      <div className="space-y-2 px-1">
        <div className="h-4 bg-white/[0.03] rounded-lg w-3/4" />
        <div className="h-3 bg-white/[0.03] rounded-lg w-1/2" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-1">
        <div className="h-11 bg-white/[0.03] rounded-lg" />
        <div className="h-11 bg-white/[0.03] rounded-lg" />
      </div>
    </div>
  )
}

function ProgressBar({ progress, status }) {
  if (!status) return null
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-white/30">{status}</span>
        <span className="text-[11px] text-white/20 font-mono">{progress}%</span>
      </div>
      <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/50 transition-all duration-700 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function FormatSelector({ formats, selected, onChange }) {
  if (!formats || formats.length === 0) return null

  const videoFormats = formats.filter(f => f.type === 'video')
  const audioFormats = formats.filter(f => f.type === 'audio')

  return (
    <div className="mb-4">
      <label className="text-[11px] text-white/30 mb-2 block uppercase tracking-wider font-medium">Quality</label>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white/[0.03] border border-white/10 text-sm focus:border-white/25 focus:outline-none text-white/70 appearance-none cursor-pointer hover:border-white/15 transition"
        >
          <option value="">Auto (best quality)</option>
          {videoFormats.length > 0 && (
            <optgroup label="Video">
              {videoFormats.map((f, i) => (
                <option key={`v-${i}`} value={f.format_id}>
                  {f.note} · MP4
                </option>
              ))}
            </optgroup>
          )}
          {audioFormats.length > 0 && (
            <optgroup label="Audio">
              {audioFormats.map((f, i) => (
                <option key={`a-${i}`} value={f.format_id}>
                  {f.note} · {f.ext?.toUpperCase() || 'MP3'}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
          <IconChevronDown />
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({ history, show, onToggle, onClear, onReDownload }) {
  if (!show) {
    return (
      <button onClick={onToggle}
        className="mt-8 text-xs text-white/25 hover:text-white/50 transition flex items-center gap-2 mx-auto py-2">
        <IconHistory />
        <span>History</span>
        {history.length > 0 && <span className="text-white/15">({history.length})</span>}
      </button>
    )
  }

  return (
    <div className="mt-6 space-y-2 animate-fade-up">
      <div className="flex items-center justify-between px-1">
        <button onClick={onToggle} className="text-xs text-white/25 hover:text-white/50 transition flex items-center gap-2">
          <IconHistory />
          <span>History</span>
        </button>
        {history.length > 0 && (
          <button onClick={onClear} className="text-[11px] text-red-400/30 hover:text-red-400/60 transition flex items-center gap-1">
            <IconTrash />
            <span>Clear</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/15 text-xs">No downloads yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {history.map((item) => (
            <div key={item.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:border-white/10 transition">
              <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center text-white/40 shrink-0">
                {item.type === 'mp3' ? <IconMusic /> : <IconVideo />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/20 uppercase">{item.platform}</span>
                  <span className="text-white/10">·</span>
                  <span className="text-[10px] text-white/20 uppercase">{item.type}</span>
                  {item.size && (
                    <>
                      <span className="text-white/10">·</span>
                      <span className="text-[10px] text-white/20">{item.size}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => onReDownload(item)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition text-xs"
                title="Download again"
              >
                <IconDownload />
              </button>
            </div>
          ))}
        </div>
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
  const [downloadType, setDownloadType] = useState(null)
  const inputRef = useRef(null)
  const { getCtrl, abort } = useAbortController()

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        clearToast()
        if (info && !loading) {
          setInfo(null)
          setUrl('')
          setFormats([])
          setSelectedFormat('')
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearToast, info, loading])

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
    setDownloadType(null)

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
    setDownloadType(type)
    setProgress({ value: 5, status: 'Preparing...' })

    const ctrl = getCtrl()
    try {
      setProgress({ value: 15, status: 'Requesting...' })
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

      setProgress({ value: 40, status: 'Downloading...' })
      const fileRes = await fetch(`${API}/api/file/${data.file}`, {
        signal: ctrl.signal
      })
      if (!fileRes.ok) throw new Error('File transfer failed')

      setProgress({ value: 75, status: 'Processing...' })
      const blob = await fileRes.blob()

      setProgress({ value: 90, status: 'Saving...' })
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = data.title
        ? `${data.title.replace(/[^\w\s-]/g, '').trim()}.${type}`
        : data.file
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(blobUrl)

      setProgress({ value: 100, status: 'Complete' })
      showToast(`Downloaded: ${data.title || filename}`)

      const newItem = {
        id: Date.now(),
        title: info.title || 'Untitled',
        type,
        thumbnail: info.thumbnail,
        date: new Date().toLocaleDateString(),
        platform: info.platform || 'unknown',
        size: formatFileSize(blob.size),
        url: url
      }
      setHistory(prev => [newItem, ...prev.slice(0, MAX_HISTORY - 1)])

      setTimeout(() => {
        setInfo(null)
        setUrl('')
        setFormats([])
        setSelectedFormat('')
        setProgress({ value: 0, status: '' })
        setDownloadType(null)
      }, 2500)

    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast(err.message, 'error')
      }
      setProgress({ value: 0, status: '' })
    } finally {
      setLoading(false)
      setDownloadType(null)
    }
  }

  const handleReDownload = async (item) => {
    setUrl(item.url)
    setTimeout(() => fetchInfo(item.url), 100)
    showToast('Loading video info...', 'success')
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
          showToast(`${urls.length} URLs found in file`, 'success')
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

  const selectedFormatInfo = useMemo(() => {
    if (!selectedFormat) return null
    return formats.find(f => f.format_id === selectedFormat)
  }, [selectedFormat, formats])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 relative selection:bg-white/15">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      <div className="w-full max-w-md relative z-10 pt-12 pb-20">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-medium tracking-tight mb-2">
            TokiTube
          </h1>
          <p className="text-white/25 text-sm">Video & audio downloader</p>
        </div>

        {/* Input */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border rounded-2xl p-5 transition-all duration-200 ${isDragging ? 'border-white/30 bg-white/[0.02]' : 'border-white/[0.06] bg-white/[0.01]'}`}
        >
          <form onSubmit={(e) => { e.preventDefault(); fetchInfo() }} className="space-y-3">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15">
                <IconLink />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video URL..."
                className="w-full pl-9 pr-20 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-white/20 focus:outline-none transition text-sm placeholder-white/15 text-white/80"
                required
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/25 hover:text-white/50 transition text-xs border border-white/[0.06]"
              >
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={fetchingInfo}
              className="w-full py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {fetchingInfo ? (
                <span className="flex items-center justify-center gap-2">
                  <IconSpinner />
                  <span>Analyzing...</span>
                </span>
              ) : (
                <span>Analyze</span>
              )}
            </button>
          </form>

          <ProgressBar progress={progress.value} status={progress.status} />
        </div>

        {/* Skeleton */}
        {fetchingInfo && <Skeleton />}

        {/* Video Info Card */}
        {info && !fetchingInfo && (
          <div className="mt-5 border border-white/[0.06] rounded-2xl overflow-hidden animate-fade-up">
            {/* Thumbnail */}
            <div className="relative">
              <img
                src={info.thumbnail}
                alt=""
                loading="lazy"
                className="w-full h-52 object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <h2 className="text-base font-medium leading-snug line-clamp-2">{info.title}</h2>
              </div>
              {info.duration && (
                <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-mono text-white/50 flex items-center gap-1">
                  <IconClock />
                  {info.duration}
                </span>
              )}
            </div>

            <div className="p-5">
              {/* Meta */}
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.04] text-[10px] text-white/35 uppercase tracking-wider font-medium">
                  {info.platform}
                </span>
                <span className="text-xs text-white/25">{info.channel}</span>
                {info.view_count && (
                  <span className="text-[10px] text-white/15 ml-auto flex items-center gap-1">
                    <IconEye />
                    {info.view_count.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Format Selector */}
              <FormatSelector
                formats={formats}
                selected={selectedFormat}
                onChange={setSelectedFormat}
              />

              {/* Selected format info */}
              {selectedFormatInfo && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/25 uppercase">Selected:</span>
                    <span className="text-xs text-white/50">
                      {selectedFormatInfo.type === 'audio' ? 'Audio' : 'Video'} · {selectedFormatInfo.note}
                    </span>
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => download('mp3')}
                  disabled={loading}
                  className={`group py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.97] disabled:opacity-20 flex items-center justify-center gap-2 ${
                    downloadType === 'mp3' && loading
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 text-white/60 hover:text-white/80'
                  }`}
                >
                  {downloadType === 'mp3' && loading ? (
                    <IconSpinner />
                  ) : (
                    <IconMusic />
                  )}
                  <span>MP3</span>
                </button>
                <button
                  onClick={() => download('mp4')}
                  disabled={loading}
                  className={`group py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.97] disabled:opacity-20 flex items-center justify-center gap-2 ${
                    downloadType === 'mp4' && loading
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 text-white/60 hover:text-white/80'
                  }`}
                >
                  {downloadType === 'mp4' && loading ? (
                    <IconSpinner />
                  ) : (
                    <IconVideo />
                  )}
                  <span>MP4</span>
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
          onReDownload={handleReDownload}
        />

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 w-full text-center py-3 text-[10px] text-white/[0.06]">
        TokiTube
      </div>
    </div>
  )
}

export default App
