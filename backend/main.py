import os
import re
import uuid
import tempfile
import logging
import shutil
import threading
from datetime import datetime, timedelta
from urllib.parse import urlparse
from typing import Optional, Dict, Any, List

from flask import Flask, request, jsonify, send_file, after_this_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import yt_dlp

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

class Config:
    """Centralized configuration."""
    PORT = int(os.environ.get("PORT", 8000))
    HOST = os.environ.get("HOST", "0.0.0.0")
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

    # CORS — comma-separated origins, or * for dev (NOT production!)
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "https://tokitube.vercel.app").split(",")

    # Rate limiting
    RATE_LIMIT = os.environ.get("RATE_LIMIT", "30 per minute")

    # Storage
    MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", 500))
    MIN_FREE_SPACE_MB = int(os.environ.get("MIN_FREE_SPACE_MB", 1000))
    FILE_TTL_MINUTES = int(os.environ.get("FILE_TTL_MINUTES", 30))

    # Download timeout (seconds)
    YDL_TIMEOUT = int(os.environ.get("YDL_TIMEOUT", 300))

    # Allowed platforms (SSRF protection)
    ALLOWED_HOSTS = [
        "youtube.com", "www.youtube.com", "youtu.be",
        "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
        "instagram.com", "www.instagram.com",
        "twitter.com", "x.com", "www.twitter.com", "www.x.com",
        "facebook.com", "www.facebook.com", "fb.watch",
        "soundcloud.com", "www.soundcloud.com",
        "reddit.com", "www.reddit.com",
        "pinterest.com", "www.pinterest.com",
    ]

config = Config()

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO if not config.DEBUG else logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log", encoding="utf-8") if not config.DEBUG else logging.StreamHandler()
    ]
)
logger = logging.getLogger("downloader")

# ─────────────────────────────────────────────────────────────────────────────
# APP INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────

app = Flask(__name__)

# CORS — proper configuration
CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[config.RATE_LIMIT],
    storage_uri="memory://"  # Ganti ke "redis://localhost:6379" untuk scale
)

# ─────────────────────────────────────────────────────────────────────────────
# STORAGE SETUP
# ─────────────────────────────────────────────────────────────────────────────

PHONE_DOWNLOAD = "/storage/emulated/0/Download"
DL_DIR = tempfile.gettempdir()

if os.path.exists(PHONE_DOWNLOAD):
    try:
        testfile = os.path.join(PHONE_DOWNLOAD, ".grab_test")
        with open(testfile, "w") as f:
            f.write("ok")
        os.remove(testfile)
        DL_DIR = PHONE_DOWNLOAD
        logger.info(f"Using phone storage: {DL_DIR}")
    except PermissionError:
        logger.warning(f"Cannot write to {PHONE_DOWNLOAD}, using temp dir")

os.makedirs(DL_DIR, exist_ok=True)

# Track file metadata for cleanup
file_registry: Dict[str, Dict[str, Any]] = {}

# ─────────────────────────────────────────────────────────────────────────────
# FILE CLEANUP SCHEDULER
# ─────────────────────────────────────────────────────────────────────────────

def cleanup_expired_files():
    """Remove files older than FILE_TTL_MINUTES."""
    now = datetime.utcnow()
    expired = [
        fname for fname, meta in file_registry.items()
        if now - meta["created_at"] > timedelta(minutes=config.FILE_TTL_MINUTES)
    ]
    for fname in expired:
        filepath = os.path.join(DL_DIR, fname)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Cleaned up: {fname}")
        except Exception as e:
            logger.error(f"Failed to cleanup {fname}: {e}")
        finally:
            file_registry.pop(fname, None)

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_expired_files, "interval", minutes=5)
scheduler.start()

# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION & SECURITY
# ─────────────────────────────────────────────────────────────────────────────

def validate_url(url: str) -> Optional[str]:
    """
    Validate URL for SSRF protection.
    Returns error message if invalid, None if valid.
    """
    if not url or not isinstance(url, str):
        return "URL is required"

    url = url.strip()
    if not url.startswith(("http://", "https://")):
        return "Only HTTP/HTTPS URLs are allowed"

    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return "Invalid URL format"

        hostname_lower = hostname.lower()

        # Block IP-based URLs entirely for safety
        ip_pattern = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
        if ip_pattern.match(hostname):
            return "IP-based URLs are not allowed"

        # Block localhost variants
        if hostname_lower in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return "Localhost URLs are not allowed"

        # Block common internal TLDs
        if hostname_lower.endswith((".local", ".internal", ".lan", ".home")):
            return "Internal network URLs are not allowed"

        # Check allowed hosts
        allowed = any(hostname_lower.endswith(host) for host in config.ALLOWED_HOSTS)
        if not allowed:
            return f"URL host '{hostname}' is not in the supported platforms list"

    except Exception as e:
        logger.warning(f"URL validation error: {e}")
        return "Invalid URL"

    return None


def check_disk_space() -> Optional[str]:
    """Check if there's enough free disk space."""
    try:
        total, used, free = shutil.disk_usage(DL_DIR)
        free_mb = free / (1024 * 1024)
        if free_mb < config.MIN_FREE_SPACE_MB:
            return f"Insufficient disk space: {free_mb:.0f}MB remaining"
    except Exception as e:
        logger.error(f"Disk space check failed: {e}")
    return None


def get_file_size_mb(filepath: str) -> float:
    """Get file size in MB."""
    try:
        return os.path.getsize(filepath) / (1024 * 1024)
    except OSError:
        return 0.0


def sanitize_filename(name: str) -> str:
    """Sanitize filename for safe storage."""
    return re.sub(r"[^\w\-_.]", "_", name)[:100]


# ─────────────────────────────────────────────────────────────────────────────
# YT-DLP HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def extract_info_safe(url: str) -> Dict[str, Any]:
    """Extract video info with timeout and error handling."""
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "socket_timeout": 15,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info or {}
    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error for {url}: {e}")
        raise
    except Exception as e:
        logger.error(f"yt-dlp unexpected error for {url}: {e}")
        raise


def build_format_list(info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build clean format list from yt-dlp info."""
    formats = []

    # Audio formats
    audio_fmts = [
        f for f in info.get("formats", [])
        if f.get("vcodec") == "none" and f.get("acodec") != "none" and f.get("abr")
    ]
    if audio_fmts:
        best_audio = max(audio_fmts, key=lambda x: x.get("abr") or 0)
        formats.append({
            "format_id": best_audio["format_id"],
            "note": f"Best Audio ({best_audio.get('abr', '?')}kbps)",
            "type": "audio",
            "quality": best_audio.get("abr", 0),
            "ext": best_audio.get("ext", "unknown"),
        })

    # Video formats — deduplicate by resolution
    seen = set()
    for f in info.get("formats", []):
        if f.get("ext") == "mp4" and f.get("vcodec") != "none":
            h = f.get("height", 0)
            if h and h not in seen:
                seen.add(h)
                formats.append({
                    "format_id": f["format_id"],
                    "note": f"{h}p",
                    "type": "video",
                    "quality": h,
                    "ext": "mp4",
                })

    formats.sort(key=lambda x: x.get("quality", 0) if isinstance(x.get("quality"), int) else 0, reverse=True)
    return formats


# ─────────────────────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    """Health check with disk info."""
    try:
        total, used, free = shutil.disk_usage(DL_DIR)
        return jsonify({
            "status": "ok",
            "save_to": DL_DIR,
            "disk_free_mb": round(free / (1024 * 1024), 2),
            "disk_total_mb": round(total / (1024 * 1024), 2),
            "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/info", methods=["POST"])
@limiter.limit("20 per minute")
def get_info():
    """Extract video metadata."""
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    error = validate_url(url)
    if error:
        return jsonify({"error": error}), 400

    try:
        info = extract_info_safe(url)
        return jsonify({
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration_string"),
            "channel": info.get("uploader"),
            "platform": info.get("extractor", "unknown"),
            "view_count": info.get("view_count"),
            "url": url,
        })
    except yt_dlp.utils.DownloadError as e:
        logger.warning(f"Info extraction failed: {e}")
        return jsonify({"error": "Could not extract info. URL may be unsupported or private."}), 400
    except Exception as e:
        logger.error(f"Unexpected error in /api/info: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/formats", methods=["POST"])
@limiter.limit("20 per minute")
def get_formats():
    """Get available formats for a URL."""
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    error = validate_url(url)
    if error:
        return jsonify({"error": error}), 400

    try:
        info = extract_info_safe(url)
        formats = build_format_list(info)
        return jsonify({
            "formats": formats,
            "title": info.get("title"),
            "duration": info.get("duration_string"),
        })
    except yt_dlp.utils.DownloadError as e:
        logger.warning(f"Format extraction failed: {e}")
        return jsonify({"error": "Could not extract formats."}), 400
    except Exception as e:
        logger.error(f"Unexpected error in /api/formats: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/download", methods=["POST"])
@limiter.limit("10 per minute")
def download_media():
    """
    Download media with disk checks, timeouts, and proper cleanup.
    NOTE: This is still synchronous. For production, use Celery + Redis.
    """
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()
    dtype = data.get("type", "mp4")
    format_id = data.get("format_id", "")
    title = data.get("title", "download")

    # ── Validation ──
    error = validate_url(url)
    if error:
        return jsonify({"error": error}), 400

    if dtype not in ("mp4", "mp3"):
        return jsonify({"error": "type must be 'mp4' or 'mp3'"}), 400

    # ── Disk space check ──
    disk_error = check_disk_space()
    if disk_error:
        return jsonify({"error": disk_error}), 507

    # ── Download ──
    uid = uuid.uuid4().hex[:12]
    out_path = os.path.join(DL_DIR, f"dl_{uid}")

    ydl_opts = {
        "outtmpl": f"{out_path}.%(ext)s",
        "quiet": True,
        "noplaylist": True,  # Safety: don't download entire playlists
        "max_filesize": config.MAX_FILE_SIZE_MB * 1024 * 1024,
    }

    if dtype == "mp3":
        ydl_opts["format"] = format_id if format_id else "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
        expected_ext = "mp3"
    else:
        if format_id:
            ydl_opts["format"] = f"{format_id}+bestaudio/best"
        else:
            ydl_opts["format"] = "best[ext=mp4]/best"
        ydl_opts["merge_output_format"] = "mp4"
        expected_ext = "mp4"

    try:
        logger.info(f"Starting download: {url} | type={dtype} | format_id={format_id}")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find the actual file
        filename = f"dl_{uid}.{expected_ext}"
        filepath = os.path.join(DL_DIR, filename)

        if not os.path.exists(filepath):
            for f in os.listdir(DL_DIR):
                if f.startswith(f"dl_{uid}"):
                    filename = f
                    filepath = os.path.join(DL_DIR, f)
                    break

        if not os.path.exists(filepath):
            logger.error(f"File not found after download: {filepath}")
            return jsonify({"error": "File not found after download"}), 500

        # Check file size
        size_mb = get_file_size_mb(filepath)
        if size_mb > config.MAX_FILE_SIZE_MB:
            os.remove(filepath)
            return jsonify({"error": f"File too large ({size_mb:.1f}MB > {config.MAX_FILE_SIZE_MB}MB limit)"}), 413

        # Register for cleanup
        file_registry[filename] = {
            "created_at": datetime.utcnow(),
            "url": url,
            "title": title,
            "size_mb": size_mb,
        }

        logger.info(f"Download complete: {filename} ({size_mb:.2f}MB)")

        return jsonify({
            "file": filename,
            "title": title,
            "type": dtype,
            "size_mb": round(size_mb, 2),
            "saved_to": "downloads" if DL_DIR == PHONE_DOWNLOAD else "internal",
            "expires_in": f"{config.FILE_TTL_MINUTES} minutes",
        })

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"Download failed for {url}: {e}")
        # Cleanup partial files
        for f in os.listdir(DL_DIR):
            if f.startswith(f"dl_{uid}"):
                try:
                    os.remove(os.path.join(DL_DIR, f))
                except Exception:
                    pass
        return jsonify({"error": "Download failed. URL may be unsupported, private, or region-blocked."}), 400
    except Exception as e:
        logger.error(f"Unexpected download error: {e}")
        return jsonify({"error": "Internal server error during download"}), 500


@app.route("/api/file/<filename>", methods=["GET"])
@limiter.limit("30 per minute")
def serve_file(filename):
    """Serve downloaded file with security checks."""
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    filepath = os.path.join(DL_DIR, filename)

    # Verify file is within DL_DIR (prevent traversal)
    real_filepath = os.path.realpath(filepath)
    real_dl_dir = os.path.realpath(DL_DIR)
    if not real_filepath.startswith(real_dl_dir):
        return jsonify({"error": "Access denied"}), 403

    if not os.path.exists(filepath):
        return jsonify({"error": "File not found or expired"}), 404

    # Schedule cleanup after response
    @after_this_request
    def remove_file(response):
        def delayed_remove(path):
            import time
            time.sleep(10)  # Give client 10s to start download
            try:
                if os.path.exists(path):
                    os.remove(path)
                    file_registry.pop(filename, None)
                    logger.info(f"Cleaned up after serve: {filename}")
            except Exception as e:
                logger.error(f"Cleanup failed for {filename}: {e}")

        threading.Thread(target=delayed_remove, args=(filepath,), daemon=True).start()
        return response

    # Guess mimetype
    mimetype = None
    if filename.endswith(".mp3"):
        mimetype = "audio/mpeg"
    elif filename.endswith(".mp4"):
        mimetype = "video/mp4"

    return send_file(filepath, as_attachment=True, mimetype=mimetype)


@app.route("/api/history", methods=["GET"])
@limiter.limit("30 per minute")
def get_history():
    """Get active download history (files not yet expired)."""
    history = []
    for fname, meta in file_registry.items():
        filepath = os.path.join(DL_DIR, fname)
        if os.path.exists(filepath):
            history.append({
                "filename": fname,
                "title": meta.get("title", "Unknown"),
                "size_mb": meta.get("size_mb", 0),
                "created_at": meta["created_at"].isoformat(),
                "expires_at": (meta["created_at"] + timedelta(minutes=config.FILE_TTL_MINUTES)).isoformat(),
            })
    return jsonify({"history": history, "count": len(history)})


@app.route("/api/stats", methods=["GET"])
@limiter.limit("60 per minute")
def get_stats():
    """Server stats for monitoring."""
    try:
        total, used, free = shutil.disk_usage(DL_DIR)
        return jsonify({
            "active_files": len(file_registry),
            "disk_free_mb": round(free / (1024 * 1024), 2),
            "disk_used_mb": round(used / (1024 * 1024), 2),
            "disk_total_mb": round(total / (1024 * 1024), 2),
            "download_dir": DL_DIR,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# ERROR HANDLERS
# ─────────────────────────────────────────────────────────────────────────────

@app.errorhandler(429)
def rate_limit_handler(e):
    logger.warning(f"Rate limit exceeded for {request.remote_addr}")
    return jsonify({"error": "Rate limit exceeded. Please slow down."}), 429


@app.errorhandler(500)
def server_error_handler(e):
    logger.error(f"Server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(Exception)
def catch_all(e):
    logger.error(f"Unhandled exception: {e}", exc_info=True)
    return jsonify({"error": "Something went wrong"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# SHUTDOWN HANDLER
# ─────────────────────────────────────────────────────────────────────────────

import atexit
atexit.register(lambda: scheduler.shutdown())


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if config.DEBUG:
        app.run(host=config.HOST, port=config.PORT, debug=True)
    else:
        # Production: use Gunicorn (pip install gunicorn)
        # Run: gunicorn -w 4 -b 0.0.0.0:8000 main:app
        logger.info(f"Starting server on {config.HOST}:{config.PORT}")
        app.run(host=config.HOST, port=config.PORT, debug=False, threaded=True)
