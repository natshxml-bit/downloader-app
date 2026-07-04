import os
import re
import uuid
import tempfile
import logging
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from flask import Flask, request, jsonify, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from apscheduler.schedulers.background import BackgroundScheduler
import yt_dlp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "2048"))
DOWNLOAD_TIMEOUT = int(os.environ.get("DOWNLOAD_TIMEOUT", "300"))
PORT = int(os.environ.get("PORT", "8000"))

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

executor = ThreadPoolExecutor(max_workers=4)

@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", CORS_ORIGIN)
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    return response

PHONE_DOWNLOAD = "/storage/emulated/0/Download"
DL_DIR = tempfile.gettempdir()

if os.path.exists(PHONE_DOWNLOAD):
    try:
        testfile = os.path.join(PHONE_DOWNLOAD, ".grab_test")
        with open(testfile, "w") as f:
            f.write("ok")
        os.remove(testfile)
        DL_DIR = PHONE_DOWNLOAD
        logger.info(f"Using phone download dir: {DL_DIR}")
    except PermissionError:
        logger.warning("Phone download dir not writable, using temp dir")

os.makedirs(DL_DIR, exist_ok=True)

def cleanup_old_files():
    cutoff = datetime.now() - timedelta(hours=1)
    count = 0
    for fname in os.listdir(DL_DIR):
        if fname.startswith("dl_"):
            fpath = os.path.join(DL_DIR, fname)
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                if mtime < cutoff:
                    os.remove(fpath)
                    count += 1
            except Exception as e:
                logger.warning(f"Cleanup failed for {fname}: {e}")
    if count:
        logger.info(f"Cleaned up {count} old files")

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_files, "interval", minutes=10)
scheduler.start()

FILENAME_PATTERN = re.compile(r"^dl_[a-f0-9]{8}\.(mp3|mp4|webm|mkv|m4a)$")

def validate_filename(filename):
    if not filename or not FILENAME_PATTERN.match(filename):
        return False
    if os.path.sep in filename or "/" in filename or "\\" in filename:
        return False
    return True

def run_yt_dlp(func, *args, timeout=DOWNLOAD_TIMEOUT):
    future = executor.submit(func, *args)
    try:
        return future.result(timeout=timeout)
    except FutureTimeoutError:
        raise TimeoutError("Operation timed out")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "save_to": DL_DIR,
        "max_file_size_mb": MAX_FILE_SIZE_MB,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/info", methods=["POST"])
@limiter.limit("10 per minute")
def get_info():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    if not url or not url.startswith(("http://", "https://")):
        return jsonify({"error": "Valid URL required (must start with http/https)"}), 400

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
    }

    try:
        def extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = run_yt_dlp(extract, timeout=30)

        return jsonify({
            "title": info.get("title"),
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration_string"),
            "channel": info.get("uploader"),
            "platform": info.get("extractor", "unknown"),
            "view_count": info.get("view_count"),
            "upload_date": info.get("upload_date"),
            "description": info.get("description", "")[:500] if info.get("description") else None,
        })
    except yt_dlp.utils.DownloadError as e:
        logger.warning(f"yt-dlp error for {url}: {e}")
        return jsonify({"error": "Unable to fetch video info. URL may be private, restricted, or unsupported."}), 400
    except TimeoutError:
        return jsonify({"error": "Request timed out while fetching info"}), 504
    except Exception as e:
        logger.error(f"Unexpected error in get_info: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/formats", methods=["POST"])
@limiter.limit("10 per minute")
def get_formats():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    if not url or not url.startswith(("http://", "https://")):
        return jsonify({"error": "Valid URL required"}), 400

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
    }

    try:
        def extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = run_yt_dlp(extract, timeout=30)
        formats = []

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
                "size_approx": best_audio.get("filesize") or best_audio.get("filesize_approx"),
            })

        video_groups = {}
        for f in info.get("formats", []):
            if f.get("vcodec") != "none" and f.get("height"):
                h = f.get("height")
                score = (f.get("filesize") or f.get("filesize_approx") or 0)
                if f.get("ext") == "mp4":
                    score += 1_000_000_000

                if h not in video_groups or score > video_groups[h]["score"]:
                    video_groups[h] = {
                        "format_id": f["format_id"],
                        "note": f"{h}p",
                        "type": "video",
                        "quality": h,
                        "ext": f.get("ext", "mp4"),
                        "vcodec": f.get("vcodec", ""),
                        "acodec": f.get("acodec", ""),
                        "has_audio": f.get("acodec") != "none",
                        "size_approx": f.get("filesize") or f.get("filesize_approx"),
                        "score": score,
                    }

        for h in sorted(video_groups.keys(), reverse=True):
            fm = video_groups[h]
            if fm["has_audio"]:
                formats.append({
                    "format_id": fm["format_id"],
                    "note": f"{h}p (with audio)",
                    "type": "video",
                    "quality": h,
                    "ext": fm["ext"],
                    "size_approx": fm["size_approx"],
                })
            else:
                formats.append({
                    "format_id": fm["format_id"],
                    "note": f"{h}p (video only, will merge audio)",
                    "type": "video",
                    "quality": h,
                    "ext": fm["ext"],
                    "size_approx": fm["size_approx"],
                })

        formats.sort(
            key=lambda x: (x.get("quality", 0) if isinstance(x.get("quality"), int) else 0),
            reverse=True
        )

        return jsonify({
            "formats": formats,
            "title": info.get("title"),
            "duration": info.get("duration_string"),
        })

    except yt_dlp.utils.DownloadError as e:
        logger.warning(f"yt-dlp format error for {url}: {e}")
        return jsonify({"error": "Unable to fetch formats. URL may be private or unsupported."}), 400
    except TimeoutError:
        return jsonify({"error": "Request timed out"}), 504
    except Exception as e:
        logger.error(f"Unexpected error in get_formats: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/download", methods=["POST"])
@limiter.limit("5 per minute")
def download_media():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()
    dtype = data.get("type", "mp4")
    format_id = data.get("format_id", "")
    title = data.get("title", "download")

    if not url or not url.startswith(("http://", "https://")):
        return jsonify({"error": "Valid URL required"}), 400

    if dtype not in ("mp3", "mp4"):
        return jsonify({"error": "Type must be 'mp3' or 'mp4'"}), 400

    uid = uuid.uuid4().hex[:8]
    out_path = os.path.join(DL_DIR, f"dl_{uid}")

    ydl_opts = {
        "outtmpl": f"{out_path}.%(ext)s",
        "quiet": True,
        "no_warnings": True,
        "max_filesize": MAX_FILE_SIZE_MB * 1024 * 1024,
    }

    if dtype == "mp3":
        ydl_opts["format"] = format_id if format_id else "bestaudio/best"
        ydl_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }, {
            "key": "FFmpegMetadata",
            "add_metadata": True,
        }, {
            "key": "EmbedThumbnail",
        }]
        expected_ext = "mp3"
    else:
        if format_id:
            ydl_opts["format"] = f"{format_id}+bestaudio/best[ext=mp4]/best"
        else:
            ydl_opts["format"] = "best[ext=mp4]/best"
        ydl_opts["merge_output_format"] = "mp4"
        expected_ext = "mp4"

    try:
        def do_download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

        run_yt_dlp(do_download, timeout=DOWNLOAD_TIMEOUT)

        filename = f"dl_{uid}.{expected_ext}"
        filepath = os.path.join(DL_DIR, filename)

        if not os.path.exists(filepath):
            for f in os.listdir(DL_DIR):
                if f.startswith(f"dl_{uid}"):
                    filename = f
                    filepath = os.path.join(DL_DIR, f)
                    break

        if not os.path.exists(filepath):
            return jsonify({"error": "File not found after download"}), 500

        file_size = os.path.getsize(filepath)
        if file_size == 0:
            os.remove(filepath)
            return jsonify({"error": "Downloaded file is empty"}), 500

        return jsonify({
            "file": filename,
            "title": title,
            "type": dtype,
            "size_bytes": file_size,
            "saved_to": "downloads" if DL_DIR == PHONE_DOWNLOAD else "internal",
            "download_url": f"/api/file/{filename}",
        })

    except yt_dlp.utils.DownloadError as e:
        logger.warning(f"Download error: {e}")
        for f in os.listdir(DL_DIR):
            if f.startswith(f"dl_{uid}"):
                try:
                    os.remove(os.path.join(DL_DIR, f))
                except Exception:
                    pass
        return jsonify({"error": f"Download failed: {str(e)}"}), 400
    except TimeoutError:
        for f in os.listdir(DL_DIR):
            if f.startswith(f"dl_{uid}"):
                try:
                    os.remove(os.path.join(DL_DIR, f))
                except Exception:
                    pass
        return jsonify({"error": "Download timed out"}), 504
    except Exception as e:
        logger.error(f"Unexpected download error: {e}")
        for f in os.listdir(DL_DIR):
            if f.startswith(f"dl_{uid}"):
                try:
                    os.remove(os.path.join(DL_DIR, f))
                except Exception:
                    pass
        return jsonify({"error": "Internal server error during download"}), 500

@app.route("/api/file/<filename>", methods=["GET"])
@limiter.limit("30 per minute")
def serve_file(filename):
    if not validate_filename(filename):
        return jsonify({"error": "Invalid filename"}), 400

    filepath = os.path.join(DL_DIR, filename)

    real_path = os.path.realpath(filepath)
    real_dl_dir = os.path.realpath(DL_DIR)
    if not real_path.startswith(real_dl_dir):
        return jsonify({"error": "Access denied"}), 403

    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    return send_file(filepath, as_attachment=True)

@app.errorhandler(429)
def rate_limit_handler(e):
    return jsonify({"error": "Rate limit exceeded. Please slow down."}), 429

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500

import atexit
atexit.register(lambda: scheduler.shutdown())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
