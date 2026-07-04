import os
import uuid
import tempfile
import threading
from flask import Flask, request, jsonify, send_file
import yt_dlp

app = Flask(__name__)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://tokitube.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    return response


# Cek folder Download HP — exists DAN bisa ditulis
PHONE_DOWNLOAD = "/storage/emulated/0/Download"
DL_DIR = tempfile.gettempdir()

if os.path.exists(PHONE_DOWNLOAD):
    try:
        testfile = os.path.join(PHONE_DOWNLOAD, ".grab_test")
        with open(testfile, "w") as f:
            f.write("ok")
        os.remove(testfile)
        DL_DIR = PHONE_DOWNLOAD
    except PermissionError:
        pass

os.makedirs(DL_DIR, exist_ok=True)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "save_to": DL_DIR})


@app.route("/api/info", methods=["POST"])
def get_info():
    data = request.get_json()
    url = data.get("url", "")
    if not url or not url.startswith("http"):
        return jsonify({"error": "Valid URL required"}), 400

    ydl_opts = {"quiet": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return jsonify({
                "title": info.get("title"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration_string"),
                "channel": info.get("uploader"),
                "platform": info.get("extractor", "unknown"),
                "view_count": info.get("view_count"),
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/formats", methods=["POST"])
def get_formats():
    data = request.get_json()
    url = data.get("url", "")
    if not url or not url.startswith("http"):
        return jsonify({"error": "Valid URL required"}), 400

    try:
        ydl_opts = {"quiet": True, "skip_download": True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = []
            
            audio_fmts = [f for f in info.get("formats", []) if f.get("vcodec") == "none" and f.get("acodec") != "none"]
            if audio_fmts:
                best_audio = max(audio_fmts, key=lambda x: x.get("abr") or 0)
                formats.append({
                    "format_id": best_audio["format_id"],
                    "note": "Best Audio",
                    "type": "audio",
                    "quality": f"{best_audio.get('abr', '?')}kbps"
                })
            
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
                            "quality": h
                        })
            
            formats.sort(key=lambda x: x.get("quality", 0) if isinstance(x.get("quality"), int) else 0, reverse=True)
            return jsonify({"formats": formats, "title": info.get("title")})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/download", methods=["POST"])
def download_media():
    data = request.get_json()
    url = data.get("url", "")
    dtype = data.get("type", "mp4")
    format_id = data.get("format_id", "")
    
    if not url or not url.startswith("http"):
        return jsonify({"error": "Valid URL required"}), 400

    uid = uuid.uuid4().hex[:8]
    out_path = os.path.join(DL_DIR, f"dl_{uid}")

    ydl_opts = {
        "outtmpl": f"{out_path}.%(ext)s",
        "quiet": True,
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
            ydl_opts["format"] = f"{format_id}+bestaudio/bestaudio/best"
        else:
            ydl_opts["format"] = "best[ext=mp4]/best"
        ydl_opts["merge_output_format"] = "mp4"
        expected_ext = "mp4"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

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

        return jsonify({
            "file": filename,
            "title": data.get("title", "download"),
            "type": dtype,
            "saved_to": "downloads" if DL_DIR == PHONE_DOWNLOAD else "internal"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/file/<filename>", methods=["GET"])
def serve_file(filename):
    filepath = os.path.join(DL_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    
    # Hapus file setelah 5 detik (kasih waktu browser download)
    def delayed_remove(path):
        import time
        time.sleep(5)
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
    
    threading.Thread(target=delayed_remove, args=(filepath,), daemon=True).start()
    
    return send_file(filepath, as_attachment=True)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False)
