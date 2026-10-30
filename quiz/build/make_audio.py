"""聴解の音声（mp3）を作る

  python3 quiz/build/make_audio.py          # まだない音声だけ作る
  python3 quiz/build/make_audio.py --all    # 全部作り直す

questions_n3_listening.py のスクリプトから、quiz/audio/<問題ID>.mp3 を作ります。
声は Open JTalk（pyopenjtalk）の合成音声です。
  ナレーター：女性の声（少し低め・ゆっくり）
  女の人  ：女性の声
  男の人  ：女性の声の高さと声質を下げて作った声
必要なもの: pip install pyopenjtalk-plus numpy ／ ffmpeg（rubberband フィルター付き）
"""
import os, sys, subprocess, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "quiz", "audio")
sys.path.insert(0, HERE)
from questions_n3_listening import L  # noqa: E402

SR = 48000
# 合成音声が読みまちがえる言葉だけ、かなで読ませる
SAY = {"辛すぎ": "からすぎ", "明日行って": "あした行って"}
NUM = ["いち", "に", "さん", "よん"]
PREFIX = {"kadai": "LK", "point": "LP", "gaiyo": "LG", "hatsuwa": "LH", "sokuji": "LS"}


def listening_ids():
    """問題IDを付ける（build.py と同じ規則）"""
    seq, out = {}, []
    for it in L:
        p = PREFIX[it["k"]]
        seq[p] = seq.get(p, 0) + 1
        out.append(f"{p}{seq[p]:02d}")
    return out


def silence(sec):
    return np.zeros(int(SR * sec))


def tts(text, voice):
    import pyopenjtalk  # 音声を作るときだけ必要（build.py からは読み込まない）
    for a, b in SAY.items():
        text = text.replace(a, b)
    if voice == "N":
        x, sr = pyopenjtalk.tts(text, speed=0.92, half_tone=-1.0)
    elif voice == "F":
        x, sr = pyopenjtalk.tts(text, speed=1.0, half_tone=1.0)
    else:  # M：高さを下げてから、声質（フォルマント）ごと下げる
        x, sr = pyopenjtalk.tts(text, speed=1.0, half_tone=-2.0)
        x = male(x, sr)
    assert sr == SR
    return x


def write_wav(path, x):
    x = np.clip(x, -32767, 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(x.tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)


def male(x, sr):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        write_wav(a, x)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a, "-af", "rubberband=pitch=0.70:formant=shifted", "-ar", str(SR), b], check=True)
        return read_wav(b)


def segments(it):
    """音声の流れ（本番の形に合わせる）"""
    k, segs = it["k"], []
    lines = it.get("lines", [])
    talk = []
    for spk, text in lines:
        talk += [(spk, text), 0.5]
    if k == "kadai":
        segs = [("N", it["intro"] + it["q"]), 1.2] + talk + [0.6, ("N", it["q"]), 1.0]
    elif k == "point":
        # 質問のあと、選択肢を読む時間がある
        segs = [("N", it["intro"] + it["q"]), 6.0] + talk + [0.6, ("N", it["q"]), 1.0]
    elif k == "gaiyo":
        segs = [("N", it["intro"]), 1.0] + talk + [0.6, ("N", it["q"]), 1.2]
        for i, c in enumerate(it["ch"]):
            segs += [("N", NUM[i]), 0.3, ("N", c), 0.9]
    elif k == "hatsuwa":
        segs = [("N", it["intro"] + it["q"]), 1.2]
        for i, c in enumerate(it["ch"]):
            segs += [("N", NUM[i]), 0.3, (it["voice"], c), 0.9]
    elif k == "sokuji":
        segs = talk + [0.6]
        for i, c in enumerate(it["ch"]):
            segs += [("N", NUM[i]), 0.3, (it["voice"], c), 0.9]
    return [0.6] + segs


def render(it, path):
    parts = []
    for s in segments(it):
        parts.append(silence(s) if isinstance(s, (int, float)) else tts(s[1], s[0]))
    x = np.concatenate(parts)
    with tempfile.TemporaryDirectory() as d:
        a = os.path.join(d, "a.wav")
        write_wav(a, x)
        # 音量をそろえて、モノラル24kHz・48kbpsのmp3にする
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a, "-af", "loudnorm=I=-18:TP=-2", "-ac", "1", "-ar", "24000",
                        "-c:a", "libmp3lame", "-b:a", "48k", path], check=True)
    return len(x) / SR


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    redo = "--all" in sys.argv
    total = 0.0
    for it, qid in zip(L, listening_ids()):
        path = os.path.join(OUT, qid + ".mp3")
        if os.path.exists(path) and not redo:
            continue
        sec = render(it, path)
        total += sec
        print(f"{qid}: {sec:.1f}秒")
    print(f"完了（新しく作った音声 合計 {total / 60:.1f}分）")
