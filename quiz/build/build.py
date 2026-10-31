"""練習問題のビルド

  python3 quiz/build/build.py

questions.py（問題）と template.html（画面）から、次の2つを作ります。
  - gas/line-bot/QuizBank.gs : GASに貼る問題データ（ふりがな付き）
  - quiz/index.html          : GitHub Pages で公開する練習問題ページ

問題を追加するときは、questions.py の各分野の「最後」に足してください。
問題IDは分野ごとの並び順で付くため、途中に入れると、それ以降のIDがずれて
「前回の模擬テストで出た問題をあとに回す」判定が一度リセットされます（害はありません）。

必要なもの: pip install fugashi unidic-lite
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from questions import Q, CATS, KINDS  # noqa: E402
from questions_skill_more import MORE, CASES as SKILL_CASES  # noqa: E402
Q = Q + MORE   # 追加分は最後に足す（前からの問題IDは変わらない）
from questions_n3 import N3, N3_KINDS, N3_SECTION, N3_SECTIONS  # noqa: E402
from questions_n3_reading import P as N3_PASSAGES, N3_READING_KINDS, N3_READING_SECTION  # noqa: E402
N3_KINDS = {**N3_KINDS, **N3_READING_KINDS}
N3_SECTION = {**N3_SECTION, **N3_READING_SECTION}
from questions_n3_listening import L as N3_LISTEN, N3_LISTEN_KINDS  # noqa: E402
from make_audio import listening_ids  # noqa: E402
N3_KINDS = {**N3_KINDS, **N3_LISTEN_KINDS}
for _k in N3_LISTEN_KINDS:
    N3_SECTION[_k] = "chokai"
N3_SECTIONS = {**N3_SECTIONS, "dokkai": "読解", "chokai": "聴解"}
from furi import furigana as F       # noqa: E402
import html as H                      # noqa: E402
import terms                          # noqa: E402

# プライバシーポリシーのURL（わかったら入れる。空なら、リンクを出さない）
SALES_READY = False   # 特定商取引法の表記ページができたら True（購入ボタンを出す）
PRIVACY_URL = "https://fairlyconnecting.blog.jp/archives/11232068.html"

# 問題ID：学科は E/C/S/U＋番号、実技・判断は H＋分野、実技・計画立案は K＋分野
LETTER = {"eisei": "E", "chori": "C", "sekkyaku": "S", "unei": "U"}
PREFIX = {"gakka": "", "handan": "H", "keikaku": "K"}

bank, seq = [], {}
for tag, q, ok, w1, w2, e in Q:
    k, c = tag.split(":") if ":" in tag else ("gakka", tag)
    key = PREFIX[k] + LETTER[c]
    seq[key] = seq.get(key, 0) + 1
    # ch[0] が正解。表示順はGASが毎回シャッフルする
    bank.append({"id": f"{key}{seq[key]:02d}", "c": c, "k": k, "q": F(q), "ch": [F(ok), F(w1), F(w2)], "e": F(e)})

# ===== 技能：事例問題（1つの事例に3〜4問。文章は QUIZ_PASSAGES に入れる。ふりがな付き） =====
PASSAGES = {}
for row in SKILL_CASES:
    c = row["c"]
    key = "J" + LETTER[c]
    seq[key] = seq.get(key, 0) + 1
    pid = f"{key}{seq[key]:02d}"
    PASSAGES[pid] = F(row["text"]).replace("\n", "<br>")
    for i, (q, ok, w1, w2, e) in enumerate(row["qs"]):
        assert len({ok, w1, w2}) == 3, q
        bank.append({"id": f"{pid}-{i + 1}", "c": c, "k": "jirei", "p": pid, "pi": i,
                     "q": F(q), "ch": [F(ok), F(w1), F(w2)], "e": F(e)})

# ===== N3（問題文・選択肢はふりがななし。〔〕は下線。解説だけふりがな） =====
def n3text(t):
    return H.escape(t).replace("〔", "<u>").replace("〕", "</u>")

N3P = {"yomi": "NY", "hyoki": "NH", "bunmyaku": "NB", "iikae": "NI", "yoho": "NU", "keishiki": "NG", "kumitate": "NK"}
n3n = 0
for row in N3:
    k = row[0]
    seq[N3P[k]] = seq.get(N3P[k], 0) + 1
    if k == "kumitate":
        _, before, after, parts, star, note = row
        blanks = ["＿＿＿＿"] * 4
        blanks[star] = "＿★＿"
        q = n3text(before) + "　" + "　".join(blanks) + "　" + n3text(after)
        ch = [parts[star]] + [p for i, p in enumerate(parts) if i != star]
        e = F("正しい順番：" + before + "".join(parts) + after + "\n★には「" + parts[star] + "」が入ります。" + note)
        bank.append({"id": f"{N3P[k]}{seq[N3P[k]]:02d}", "x": "n3", "c": N3_SECTION[k], "k": k, "q": q,
                     "ch": [H.escape(c) for c in ch], "e": e})
    else:
        _, q, ok, w1, w2, w3, e = row
        if k == "yoho":   # 用法：問題はことばだけ。選択肢が文
            q = "<b class=\"word\">" + H.escape(q) + "</b>"
        else:
            q = n3text(q)
        bank.append({"id": f"{N3P[k]}{seq[N3P[k]]:02d}", "x": "n3", "c": N3_SECTION[k], "k": k, "q": q,
                     "ch": [H.escape(c) for c in (ok, w1, w2, w3)], "e": F(e)})
    n3n += 1

# 文章つき問題（文章の文法・読解）：文章は QUIZ_PASSAGES に1回だけ入れ、問題は p（文章ID）と pi（文章の中の順番）を持つ
def passage_html(t):
    return n3text(t).replace("\n", "<br>")

PP = {"bunsho": "RB", "tanbun": "RT", "chubun": "RC", "chobun": "RL", "joho": "RJ"}
for row in N3_PASSAGES:
    k = row["k"]
    seq[PP[k]] = seq.get(PP[k], 0) + 1
    pid = f"{PP[k]}{seq[PP[k]]:02d}"
    PASSAGES[pid] = passage_html(row["text"])
    for i, (q, ok, w1, w2, w3, e) in enumerate(row["qs"]):
        assert len({ok, w1, w2, w3}) == 4, q
        bank.append({"id": f"{pid}-{i + 1}", "x": "n3", "c": N3_SECTION[k], "k": k, "p": pid, "pi": i,
                     "q": n3text(q), "ch": [H.escape(c) for c in (ok, w1, w2, w3)], "e": F(e)})
        n3n += 1

# 聴解：音声は quiz/audio/<ID>.mp3（make_audio.py で作る）。
#  kadai・point：選択肢を画面に出す（シャッフル可、ch[0]が正解）
#  gaiyo・hatsuwa・sokuji：選択肢は音声だけ（fx＝順番固定、ans＝正解の番号、hid＝画面に文字を出さない）
SPK = {"M": "男", "F": "女", "N": "ナレーター"}
NUMS = ["１", "２", "３", "４"]
for it, qid in zip(N3_LISTEN, listening_ids()):
    k = it["k"]
    assert os.path.exists(os.path.join(ROOT, "quiz", "audio", qid + ".mp3")), qid + ".mp3 がありません（make_audio.py を実行）"
    spoken = k in ("gaiyo", "hatsuwa", "sokuji")
    script = []
    if it.get("intro") or it.get("q"):
        script.append("ナレーター：" + it.get("intro", "") + it.get("q", ""))
    for spk, text in it.get("lines", []):
        script.append(SPK[spk] + "：" + text)
    if spoken:
        who = SPK.get(it.get("voice", "N"), "") if k != "gaiyo" else "ナレーター"
        for i, c in enumerate(it["ch"]):
            script.append(f"{NUMS[i]}　{who}：{c}")
    e = "【スクリプト】\n" + "\n".join(script) + "\n\n【解説】" + it["e"]
    if k == "sokuji":
        qtext = "「" + it["lines"][0][1] + "」への返事として、最もよいものはどれか。"
    else:
        qtext = it["q"]
    item = {"id": qid, "x": "n3", "c": "chokai", "k": k, "au": f"audio/{qid}.mp3",
            "q": H.escape(qtext), "ch": [H.escape(c) for c in it["ch"]], "e": F(e)}
    if spoken:
        item.update({"fx": 1, "ans": it["ans"], "hid": 1})
    if it.get("scene"):
        item["sc"] = H.escape(it["scene"])
    assert len(set(it["ch"])) == len(it["ch"]), qid
    bank.append(item)
    n3n += 1

N3_META = {"sections": N3_SECTIONS, "kinds": {k: v[0] for k, v in N3_KINDS.items()}}

gs = (
    "/**\n * 練習問題データ（自動生成：quiz/build/build.py）。手で編集しないでください。\n"
    f" * 全{len(bank)}問。各問題の ch[0] が正解です。c=分野、k=gakka（学科）/handan（実技・判断）/keikaku（実技・計画立案）\n */\n"
    f"var QUIZ_CATS = {json.dumps(CATS, ensure_ascii=False)};\n"
    f"var QUIZ_KINDS = {json.dumps(KINDS, ensure_ascii=False)};\n"
    f"var QUIZ_N3 = {json.dumps(N3_META, ensure_ascii=False)};\n"
    "var QUIZ_PASSAGES = {\n" + ",\n".join(json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) for k, v in PASSAGES.items()) + "\n};\n"
    "var QUIZ_BANK = [\n" + ",\n".join(json.dumps(b, ensure_ascii=False) for b in bank) + "\n];\n"
)
open(os.path.join(ROOT, "gas", "line-bot", "QuizBank.gs"), "w").write(gs)

L = {k: F(v) for k, v in {
    "title": "練習問題",
    "foot": "このページの問題は、農林水産省「外食業特定技能評価試験実施要領」の出題範囲をもとにJob Change Japan（株式会社Fairly connecting）が作成したオリジナル問題です。実際の試験問題ではありません。法令や制度は変わることがあるため、最新の情報はOTAFF（外国人食品産業技能評価機構）の公式サイトと学習用テキストで確認してください。2026年10月時点の情報です。",
    "loading": "読み込み中…",
    "relogin": "もう一度LINEでログインします…",
    "notReady": "このページは準備中です。もうしばらくお待ちください。",
    "errNet": "通信できませんでした。電波のよい場所で、もう一度ためしてください。",
    "errServer": "うまく読み込めませんでした。少し時間をおいて、もう一度ためしてください。",
    "retry": "もう一度ためす",
    "gateHead": "LINEの友だち限定",
    "gateBody": "Job Change Japan 公式LINEの友だちが使える練習問題です。はじめての方は、1回だけ無料で24時間お試しできます。LINEでログインしてください。",
    "loginBtn": "LINEでログイン",
    "friendHead": "{name} さん、あと少しです",
    "friendBody": "この練習問題は、Job Change Japan 公式LINEの友だち限定です。友だち追加してから「追加しました」を押してください。",
    "friendBtn": "LINEで友だち追加する",
    "recheck": "追加しました",
    "hello": "{name} さん、こんにちは。",
    "mock": "模擬テスト",
    "mockSub": "本番と同じ、学科35問＋実技20問（判断・計画立案）の{n}問・{m}分。最後にまとめて採点し、{max}点満点で合格基準{pass}点と比べます。問題と選択肢は毎回入れかわり、前に出た問題はなるべく出しません。",
    "left": "回数券 残り", "times": "回分",
    "mockStart": "模擬テストを始める",
    "mockConfirm": "制限時間は{m}分で、時間になると自動で採点されます。途中で画面を閉じても、時間内なら続きから受けられます。",
    "mockGo": "始める", "cancel": "やめる",
    "resume": "途中の模擬テストを続ける",
    "soon": "購入の受付は準備中です。もうしばらくお待ちください。",
    "free": "練習問題",
    "freeSub": "答えを選ぶと、すぐに正解と解説が出ます。問題と選択肢の順番は毎回変わります。",
    "all": "全問チャレンジ", "allSub": "すべての問題を、ランダムな順番で出します",
    "mon": "問", "q": "問題",
    "next": "次へ", "prev": "前へ", "result": "結果を見る", "quit": "やめて結果を見る",
    "right": "正解です！", "wrong": "不正解", "ans": "正解", "yours": "あなたの答え", "blank": "（答えていません）",
    "answered": "{a} / {n} 問 答えました",
    "submit": "採点する",
    "submitLeft": "まだ答えていない問題が{n}問あります。このまま採点しますか？（採点したあとは、答えを変えられません）",
    "submitAll": "すべて答えました。採点しますか？（採点したあとは、答えを変えられません）",
    "submitGo": "採点する",
    "jump": "問題の番号を押すと、その問題へ移動します",
    "grading": "採点しています…",
    "resultOf": "練習の結果", "mockResult": "模擬テストの結果",
    "correct": "問正解", "passOk": "合格ライン到達", "passNg": "合格ラインまであと少し",
    "line": "縦の線が合格基準の65％です。",
    "linePoints": "縦の線が合格基準の{pass}点（{max}点満点の65％）です。学科は本番の配点、実技は1問6.5点の目安で計算しています。",
    "ten": "点",
    "byKind": "学科・実技別の正解数",
    "timeLeft": "残り時間",
    "timeUp": "時間になりました。",
    "gakkaHead": "学科（分野別）",
    "jitsugiHead": "実技",
    "allHead": "まとめて",
    "byCat": "分野別の正解数", "retryWrong": "間違えた問題だけもう一度", "home": "最初の画面にもどる",
    "review": "間違えた問題の復習",
    "tabSkill": "技能測定試験", "tabN3": "日本語能力試験 N3",
    "skillLead": "外食業特定技能2号技能測定試験（学科・実技）の練習です。",
    "n3Lead": "日本語能力試験（JLPT）N3の練習です。本番と同じく、問題にはふりがながありません（解説にはあります）。",
    "n3Mock": "N3 模擬テスト",
    "n3MockSub": "{name}：本番と同じ{n}問・{m}分",
    "sharedCredits": "回数券は、技能測定試験とN3で共通です。利用中なら、模擬テストは何回でも受けられます。",
    "n3Soon": "",
    "audioPlay": "▶ 音声を聞く", "audioPlaying": "再生中…", "audioReplay": "▶ もう一度聞く",
    "audioOnce": "本番と同じく、音声は1回だけ聞けます。", "audioDone": "音声は聞き終わりました",
    "audioErr": "音声を読み込めませんでした。電波のよい場所で、もう一度押してください。",
    "listenQ": "質問",
    "showPassage": "文章を見る",
    "n3Line": "N3の合否は、総合得点（180点満点）が95点以上で、さらに「言語知識」「読解」「聴解」がそれぞれ19点以上必要です。本番の得点は、正答数から計算された尺度得点なので、この正答率とは一致しません。目安として使ってください。",
    "n3All": "N3 全問チャレンジ", "n3AllSub": "文字・語彙・文法・読解の問題を、ランダムな順番で出します",
    "byType": "問題の種類別の正解数",
    "terms": "利用規約", "privacy": "プライバシーポリシー",
    "agree": "このサービスを利用すると、利用規約に同意したものとみなします。",
    "noGuarantee": "練習問題や模擬テストで合格点に達しても、本番の試験の合格を保証するものではありません。",
    "noRefund": "一度お支払いいただいた代金は、回数券を使い切らなかった場合も含めて、返金できません。",
    "mockNote": "1回分は、使い始めた時点から{h}時間で終わります。使わなかった時間があっても、1回分は戻りません。",
    "passHead": "利用状況",
    "buyHead": "回数券を買う",
    "buyBtn": "{n}回分　{yen}円（税込）",
    "buyNote": "カードなどで支払えます（Stripeの安全な支払い画面に移動します）。支払いが終わると、このページにもどり、回数券が自動で増えます。",
    "buyGoing": "支払い画面に移動しています…",
    "buyChecking": "支払いを確認しています…",
    "buyDone": "{n}回分の回数券を追加しました。",
    "buyLater": "支払いの確認ができませんでした。支払いが済んでいれば、翌朝までに自動で追加されます。追加されないときは、公式LINEでお知らせください。",
    "tokusho": "特定商取引法に基づく表記",
    "passOn": "利用中です。{until}まで、練習問題も模擬テストもすべて使えます（あと{left}）。",
    "passOff": "練習問題と模擬テストを使うには、「始める」を押してください。押した時から{h}時間、すべての機能を使えます。",
    "trialNote": "はじめての方は、1回だけ無料で{h}時間お試しできます。",
    "trialBtn": "無料で{h}時間お試しする",
    "useBtn": "回数券を1回分使って始める",
    "useConfirm": "回数券を1回分使います（残りは{n}回分になります）。今から{h}時間、すべての機能を使えます。",
    "trialConfirm": "無料のお試しを始めます。お試しは1回だけです。今から{h}時間、すべての機能を使えます。",
    "goBtn": "始める",
    "needPass": "この問題を使うには、上の「利用状況」から始めてください。",
    "passEnded": "{h}時間の利用時間が終わりました。続けるには、もう一度始めてください。",
    "hr": "時間", "min": "分",
    "noPlacement": "回数券を買うかどうかは自由です。買わなくても、当社の職業紹介を受けるときに不利になることはありません。",
    "noCopy": "問題のコピー・スクリーンショット・撮影は禁止です。",
    "noCopySub": "翻訳したいときは、文字を選んで「翻訳」を使ってください。",
    "tapBack": "画面をタップすると戻ります",
}.items()}
L["price"] = F("回数券（1回分を使うと、そこから{h}時間、練習問題も模擬テストもすべて使えます）")
L["salesReady"] = SALES_READY
L["packRow"] = "<b>" + F("{n}回分") + "</b>　" + F("{yen}円（税込）")
L["title"] = '<span class="ln">' + F("外食業2号・N3") + '</span> <span class="ln">' + F("練習問題") + '</span>'
L["sub"] = {k: F(v) for k, v in {
    "eisei": "食中毒・HACCP・食品衛生法",
    "chori": "食材・調理方法・調理機器・労働安全",
    "sekkyaku": "接客・アレルギー・食の多様化・クレーム対応",
    "unei": "労働基準法・雇用管理・届出・在庫管理",
    "handan": "店の場面を読んで、正しい行動を選ぶ（4分野）",
    "keikaku": "計算して、作業の計画を立てる（4分野）",
    "jirei": "一つの事例を読んで、いくつかの問題に答える",
}.items()}

html = open(os.path.join(HERE, "template.html")).read()
html = html.replace("__CATS__", json.dumps({k: F(v) for k, v in CATS.items()}, ensure_ascii=False))
html = html.replace("__KINDS__", json.dumps({k: F(v) for k, v in KINDS.items()}, ensure_ascii=False))
L["legal"] = ('<p>' + L["noGuarantee"] + '</p><p>' + L["agree"] + '</p><p><a href="terms.html">' + L["terms"] + '</a>'
              + (' ／ <a href="' + H.escape(PRIVACY_URL) + '">' + L["privacy"] + '</a>' if PRIVACY_URL else '') + '</p>')
html = html.replace("__NOCOPY__", L["noCopy"]).replace("__NOCOPYSUB__", L["noCopySub"]).replace("__TAPBACK__", L["tapBack"])
html = html.replace("__LBL__", json.dumps(L, ensure_ascii=False))
open(os.path.join(ROOT, "quiz", "terms.html"), "w").write(terms.render(F, PRIVACY_URL))
html = html.replace("__N3__", json.dumps({"sections": {k: F(v) for k, v in N3_SECTIONS.items()},
                                          "kinds": {k: {"name": F(v[0]), "inst": H.escape(v[1]), "sec": N3_SECTION[k]} for k, v in N3_KINDS.items()}}, ensure_ascii=False))
open(os.path.join(ROOT, "quiz", "index.html"), "w").write(html)
print(f"QuizBank.gs: {len(bank)}問（うちN3 {n3n}問） / quiz/index.html を作成しました")
