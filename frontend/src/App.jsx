import { useState, useEffect, useRef } from 'react';
import './App.css';

// ── Icons (inline SVG) ─────────────────────────────────────────────────────
const IconHome = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconHistory = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>;
const IconSettings = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IconPaste = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IconMoon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IconSun = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
const IconPlay = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const IconPause = () => <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconCancel = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconOpen = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const IconRedo = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IconTrash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const IconCheck = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IconInfo = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IconChevron = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Toast System ───────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  return { toasts, add };
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-wrap">
      <div className="skeleton skeleton-thumb" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-meta" />
    </div>
  );
}

// ── Home View ────────────────────────────────────────────────────────────────
function HomeView({ toast }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [formats, setFormats] = useState([]);
  const inputRef = useRef(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.startsWith('http')) {
        setUrl(text);
        toast('Link pasted from clipboard', 'success');
        setTimeout(() => fetchInfo(text), 300);
      } else {
        toast('No valid URL in clipboard');
      }
    } catch {
      toast('Clipboard access denied');
    }
  };

  const fetchInfo = async (link) => {
    if (!link || !link.startsWith('http')) { toast('Please enter a valid URL'); return; }
    setLoading(true); setInfo(null); setFormats([]);
    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInfo(data);
      toast('Media info loaded', 'success');
      const fRes = await fetch(`${API_BASE}/api/formats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link })
      });
      const fData = await fRes.json();
      if (!fData.error) setFormats(fData.formats || []);
    } catch (e) {
      toast(e.message || 'Failed to fetch info');
    } finally { setLoading(false); }
  };

  const startDownload = async (formatId, type) => {
    toast(`Starting ${type} download…`);
    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type, format_id: formatId, title: info?.title })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast('Download ready! Check Downloads tab', 'success');
    } catch (e) {
      toast(e.message || 'Download failed');
    }
  };

  const videoFormats = formats.filter(f => f.type === 'video');
  const audioFormats = formats.filter(f => f.type === 'audio');

  return (
    <div className="home-view">
      <div className="app-header">
        <div className="app-title">Downloader</div>
        <button className="theme-toggle" onClick={() => toast('Theme toggle')} title="Toggle theme">
          <IconSun />
        </button>
      </div>

      <div className="input-section">
        <div className="url-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="url-input"
            placeholder="Paste link here…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onPaste={() => setTimeout(() => url && fetchInfo(url), 100)}
            onKeyDown={e => e.key === 'Enter' && fetchInfo(url)}
          />
          <button className="paste-btn" onClick={handlePaste} title="Paste from clipboard">
            <IconPaste />
          </button>
        </div>
        <button className="download-btn" onClick={() => fetchInfo(url)} disabled={loading}>
          <IconDownload />
          {loading ? 'Fetching…' : 'Download'}
        </button>
        <div className="helper-text">Supports YouTube, TikTok, Instagram & more</div>
      </div>

      {loading && <SkeletonCard />}

      {info && !loading && (
        <div className="preview-card show">
          <img className="preview-thumb" src={info.thumbnail || ''} alt="thumbnail" />
          <div className="preview-body">
            <div className="preview-title">{info.title}</div>
            <div className="preview-meta">
              <span className="source-icon"><IconPlay /></span>
              <span>{info.duration}</span>
              <span>{info.channel}</span>
            </div>
          </div>
        </div>
      )}

      {formats.length > 0 && !loading && (
        <div className="formats-section show">
          {videoFormats.length > 0 && (
            <>
              <div className="formats-title">Video</div>
              <div className="format-grid">
                {videoFormats.map(f => (
                  <button key={f.format_id} className="format-btn" onClick={() => startDownload(f.format_id, 'mp4')}>
                    <span className="format-label">{f.note}</span>
                    <span className="format-sub">{f.ext?.toUpperCase()} {f.size_approx ? `· ~${(f.size_approx/1024/1024).toFixed(0)} MB` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {audioFormats.length > 0 && (
            <>
              <div className="formats-title" style={{ marginTop: 16 }}>Audio</div>
              <div className="format-grid">
                {audioFormats.map(f => (
                  <button key={f.format_id} className="format-btn" onClick={() => startDownload(f.format_id, 'mp3')}>
                    <span className="format-label">{f.note}</span>
                    <span className="format-sub">{f.ext?.toUpperCase()} {f.quality ? `· ${f.quality}kbps` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Downloads View ───────────────────────────────────────────────────────────
function DownloadsView({ toast }) {
  const [downloads, setDownloads] = useState([
    { id: 1, name: 'Summer Vibes 2024.mp4', progress: 65, status: 'downloading', speed: '2.4 MB/s', eta: '12s', type: '1080p · MP4', paused: false },
    { id: 2, name: 'Podcast Interview.mp3', progress: 92, status: 'downloading', speed: '1.1 MB/s', eta: '3s', type: 'MP3 · 192 kbps', paused: false },
  ]);

  useEffect(() => {
    const iv = setInterval(() => {
      setDownloads(prev => prev.map(d => {
        if (d.paused || d.status === 'done') return d;
        const next = Math.min(100, d.progress + Math.floor(Math.random() * 3));
        return { ...d, progress: next, status: next >= 100 ? 'done' : 'downloading', speed: next >= 100 ? 'Complete' : d.speed, eta: next >= 100 ? '' : d.eta };
      }));
    }, 800);
    return () => clearInterval(iv);
  }, []);

  const togglePause = (id) => {
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, paused: !d.paused } : d));
    toast('Download paused');
  };

  const cancel = (id) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
    toast('Download cancelled');
  };

  return (
    <div className="downloads-view">
      <div className="section-title">Active Downloads</div>
      {downloads.length === 0 ? (
        <div className="empty-state">
          <IconDownload />
          <p>No active downloads</p>
        </div>
      ) : (
        <div className="downloads-list">
          {downloads.map(d => (
            <div className="download-item" key={d.id}>
              <div className="download-header">
                <div className="download-name">{d.name}</div>
                <div className={`download-status ${d.status}`}>{d.status === 'done' ? 'Done' : d.progress + '%'}</div>
              </div>
              <div className="download-meta-row">
                <span>{d.type}</span>
                <span>{d.speed}{d.eta ? ' · ' + d.eta + ' left' : ''}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: d.progress + '%' }} />
              </div>
              <div className="download-actions">
                <button className="action-btn" onClick={() => togglePause(d.id)} disabled={d.status === 'done'}>
                  {d.paused ? <IconPlay /> : <IconPause />}
                  {d.paused ? 'Resume' : 'Pause'}
                </button>
                <button className="action-btn danger" onClick={() => cancel(d.id)}>
                  <IconCancel /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History View ─────────────────────────────────────────────────────────────
function HistoryView({ toast }) {
  const [items, setItems] = useState([
    { id: 1, title: 'Tutorial React Hooks', meta: 'MP4 · 156 MB · 2 hours ago' },
    { id: 2, title: 'Lo-Fi Chill Mix', meta: 'MP3 · 12 MB · Yesterday' },
    { id: 3, title: 'Documentary: Ocean Life', meta: 'MP4 · 890 MB · 3 days ago' },
  ]);

  const remove = (id) => { setItems(prev => prev.filter(i => i.id !== id)); toast('Deleted from history'); };
  const redo = (title) => toast(`Re-download started: ${title}`);

  return (
    <div className="history-view">
      <div className="section-title">History</div>
      {items.length === 0 ? (
        <div className="empty-state">
          <IconHistory />
          <p>No download history</p>
        </div>
      ) : (
        <div className="history-list">
          {items.map(item => (
            <div className="history-item" key={item.id}>
              <div className="history-thumb" />
              <div className="history-info">
                <div className="history-title">{item.title}</div>
                <div className="history-meta">{item.meta}</div>
              </div>
              <div className="history-actions">
                <button className="icon-btn" title="Open"><IconOpen /></button>
                <button className="icon-btn" title="Re-download" onClick={() => redo(item.title)}><IconRedo /></button>
                <button className="icon-btn danger" title="Delete" onClick={() => remove(item.id)}><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings View ────────────────────────────────────────────────────────────
function SettingsView({ toast, dark, setDark }) {
  const [auto, setAuto] = useState(false);

  return (
    <div className="settings-view">
      <div className="section-title">Settings</div>
      <div className="settings-list">
        <div className="settings-item">
          <div>
            <div className="settings-label">Dark mode</div>
            <div className="settings-desc">Use dark theme throughout the app</div>
          </div>
          <button className={`toggle-switch ${dark ? 'on' : ''}`} onClick={() => { setDark(!dark); toast(dark ? 'Light mode' : 'Dark mode'); }}>
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">Auto-download</div>
            <div className="settings-desc">Start download immediately after paste</div>
          </div>
          <button className={`toggle-switch ${auto ? 'on' : ''}`} onClick={() => setAuto(!auto)}>
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">Default quality</div>
            <div className="settings-desc">Highest available</div>
          </div>
          <span className="settings-arrow">1080p <IconChevron /></span>
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">Save location</div>
            <div className="settings-desc">/storage/emulated/0/Download</div>
          </div>
          <span className="settings-arrow">Change <IconChevron /></span>
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-label">Clear history</div>
            <div className="settings-desc">Remove all download history</div>
          </div>
          <button className="icon-btn danger" onClick={() => toast('History cleared')}><IconTrash /></button>
        </div>
        <div className="settings-item" style={{ border: 'none' }}>
          <div>
            <div className="settings-label">About</div>
            <div className="settings-desc">Version 1.0.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('home');
  const [dark, setDark] = useState(true);
  const { toasts, add: toast } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const tabs = [
    { key: 'home', label: 'Home', icon: <IconHome /> },
    { key: 'downloads', label: 'Downloads', icon: <IconDownload /> },
    { key: 'history', label: 'History', icon: <IconHistory /> },
    { key: 'settings', label: 'Settings', icon: <IconSettings /> },
  ];

  return (
    <div className="downloader-app">
      <div className="toast-container">
        {toasts.map(t => (
          <div className={`toast show ${t.type}`} key={t.id}>
            {t.type === 'success' ? <IconCheck /> : <IconInfo />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {tab === 'home' && <HomeView toast={toast} />}
      {tab === 'downloads' && <DownloadsView toast={toast} />}
      {tab === 'history' && <HistoryView toast={toast} />}
      {tab === 'settings' && <SettingsView toast={toast} dark={dark} setDark={setDark} />}

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.key} className={`nav-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
