# python3 gem.py VIDEO "savol" [model]  — Gemini'ga video yuklab savol beradi. Kalit proksida (x-goog-api-key).
import json, os, sys, time, subprocess, mimetypes
B = "https://generativelanguage.googleapis.com"
H = ["-H", "x-goog-api-key: proxy-dummy"]
def sh(args):
    return subprocess.run(["curl", "-sS", "-m", "600"] + H + args, capture_output=True, text=True).stdout
path, q = sys.argv[1], sys.argv[2]; model = sys.argv[3] if len(sys.argv) > 3 else "gemini-2.5-flash"
size = os.path.getsize(path); mime = mimetypes.guess_type(path)[0] or "video/mp4"
r = subprocess.run(["curl", "-sS", "-m", "120", "-D", "-", "-o", "/dev/null"] + H + ["-X", "POST", f"{B}/upload/v1beta/files",
    "-H", "X-Goog-Upload-Protocol: resumable", "-H", "X-Goog-Upload-Command: start",
    "-H", f"X-Goog-Upload-Header-Content-Length: {size}", "-H", f"X-Goog-Upload-Header-Content-Type: {mime}",
    "-H", "Content-Type: application/json", "-d", json.dumps({"file": {"display_name": os.path.basename(path)}})], capture_output=True, text=True).stdout
url = [l.split(": ", 1)[1].strip() for l in r.splitlines() if l.lower().startswith("x-goog-upload-url")][0]
f = json.loads(subprocess.run(["curl", "-sS", "-m", "600", "-X", "POST", url, "-H", "X-Goog-Upload-Command: upload, finalize",
    "-H", "X-Goog-Upload-Offset: 0", "--data-binary", f"@{path}"], capture_output=True, text=True).stdout)["file"]
for _ in range(60):
    st = json.loads(sh([f"{B}/v1beta/{f['name']}"]))
    if st.get("state") == "ACTIVE": break
    time.sleep(3)
body = {"contents": [{"parts": [{"file_data": {"mime_type": mime, "file_uri": f["uri"]}}, {"text": q}]}]}
out = json.loads(sh(["-X", "POST", f"{B}/v1beta/models/{model}:generateContent", "-H", "Content-Type: application/json", "-d", json.dumps(body)]))
try: print(out["candidates"][0]["content"]["parts"][0]["text"])
except Exception: print(json.dumps(out)[:800])
