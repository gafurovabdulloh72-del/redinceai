# python3 vo2.py pov.json  — ikki ovozli dialog (Gemini multi-speaker TTS), bitta so'rov, jumlalarga bo'linadi, cfg.vo ga yoziladi.
import json, os, pathlib, sys, wave, numpy as np
import vo as V
SPK = {"c": ("Mijoz", "Kore"), "d": ("Dizayner", "Charon")}
cp = pathlib.Path(sys.argv[1]); c = json.loads(cp.read_text())
texts = [L.get("say", L["text"]) for L in c["lines"]]
script = "\n".join(f"{SPK[L['who']][0]}: {t}" for L, t in zip(c["lines"], texts))
V.STYLE = ""
orig = V.tts
def tts_multi(text):
    import hashlib, base64, subprocess, time
    key = hashlib.sha1(f"multi|{V.MODEL}|{text}".encode()).hexdigest()[:12]; out = V.VO / f"{key}.wav"
    if out.exists(): return out
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {
        "multiSpeakerVoiceConfig": {"speakerVoiceConfigs": [{"speaker": n, "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": v}}} for n, v in SPK.values()]}}}}
    r = subprocess.run(["curl", "-sS", "-m", "180", "-H", "x-goog-api-key: proxy-dummy", "-H", "Content-Type: application/json", "-X", "POST",
                        f"https://generativelanguage.googleapis.com/v1beta/models/{V.MODEL}:generateContent", "-d", json.dumps(body)], capture_output=True, text=True).stdout
    try: p = json.loads(r)["candidates"][0]["content"]["parts"][0]["inlineData"]
    except Exception: sys.exit("TTS xato: " + r[:300])
    raw = base64.b64decode(p["data"])
    if "wav" in p["mimeType"]:
        tmp = V.VO / "tmp.wav"; tmp.write_bytes(raw); w = wave.open(str(tmp)); raw = w.readframes(w.getnframes()); w.close(); tmp.unlink()
    w = wave.open(str(out), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(V.SR); w.writeframes(raw); w.close()
    print("  +", out.name); return out
take = tts_multi(script)
segs, lens = V.split_take(take, texts); print("  bo'laklar:", [float(x) for x in lens])
vo = {}
for i, seg in enumerate(segs):
    f = V.VO / f"{c['topic']}-l{i}.wav"
    w = wave.open(str(f), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(V.SR)
    w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    vo[f"l{i}"] = {"file": f.name, "dur": round(len(seg) / V.SR, 3)}
c["vo"] = vo; cp.write_text(json.dumps(c, ensure_ascii=False, indent=1)); print("OK", {k: v["dur"] for k, v in vo.items()})
