# python3 img.py "prompt" out.png [model]  — Gemini rasm yaratadi
import json, sys, base64, subprocess
p, out = sys.argv[1], sys.argv[2]; model = sys.argv[3] if len(sys.argv) > 3 else "gemini-2.5-flash-image"
body = {"contents": [{"parts": [{"text": p}]}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "9:16"}}}
r = subprocess.run(["curl", "-sS", "-m", "300", "-H", "x-goog-api-key: proxy-dummy", "-H", "Content-Type: application/json", "-X", "POST",
    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", "-d", json.dumps(body)], capture_output=True, text=True).stdout
d = json.loads(r)
for part in d.get("candidates", [{}])[0].get("content", {}).get("parts", []):
    if "inlineData" in part:
        open(out, "wb").write(base64.b64decode(part["inlineData"]["data"])); print("ok", out); break
else: print(json.dumps(d)[:600])
