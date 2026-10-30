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
from questions import Q, CATS        # noqa: E402
from furi import furigana as F       # noqa: E402

PREFIX = {"eisei": "E", "chori": "C", "sekkyaku": "S", "unei": "U", "keisan": "K"}

bank, seq = [], {}
for c, q, ok, w1, w2, e in Q:
    seq[c] = seq.get(c, 0) + 1
    # ch[0] が正解。表示順はGASが毎回シャッフルする
    bank.append({"id": f"{PREFIX[c]}{seq[c]:02d}", "c": c, "q": F(q), "ch": [F(ok), F(w1), F(w2)], "e": F(e)})

gs = (
    "/**\n * 練習問題データ（自動生成：quiz/build/build.py）。手で編集しないでください。\n"
    f" * 全{len(bank)}問。各問題の ch[0] が正解です。\n */\n"
    f"var QUIZ_CATS = {json.dumps(CATS, ensure_ascii=False)};\n"
    "var QUIZ_BANK = [\n" + ",\n".join(json.dumps(b, ensure_ascii=False) for b in bank) + "\n];\n"
)
open(os.path.join(ROOT, "gas", "line-bot", "QuizBank.gs"), "w").write(gs)

L = {k: F(v) for k, v in {
    "title": "特定技能2号 外食業 練習問題",
    "foot": "このページの問題は、農林水産省「外食業特定技能評価試験実施要領」の出題範囲をもとにJob Change Japan（株式会社Fairly connecting）が作成したオリジナル問題です。実際の試験問題ではありません。法令や制度は変わることがあるため、最新の情報はOTAFF（外国人食品産業技能評価機構）の公式サイトと学習用テキストで確認してください。2026年10月時点の情報です。",
    "loading": "読み込み中…",
    "relogin": "もう一度LINEでログインします…",
    "notReady": "このページは準備中です。もうしばらくお待ちください。",
    "errNet": "通信できませんでした。電波のよい場所で、もう一度ためしてください。",
    "errServer": "うまく読み込めませんでした。少し時間をおいて、もう一度ためしてください。",
    "retry": "もう一度ためす",
    "gateHead": "LINEの友だち限定・無料",
    "gateBody": "Job Change Japan 公式LINEの友だちは、無料で練習問題が使えます。LINEでログインしてください。",
    "loginBtn": "LINEでログイン",
    "friendHead": "{name} さん、あと少しです",
    "friendBody": "この練習問題は、Job Change Japan 公式LINEの友だち限定です。友だち追加してから「追加しました」を押してください。",
    "friendBtn": "LINEで友だち追加する",
    "recheck": "追加しました",
    "hello": "{name} さん、こんにちは。",
    "mock": "模擬テスト",
    "mockSub": "本番の学科試験と同じ分野の配分で{n}問。最後にまとめて採点します。問題と選択肢は毎回入れかわり、前に出た問題はなるべく出しません。",
    "left": "残り", "times": "回",
    "mockStart": "模擬テストを始める",
    "mockConfirm": "1回分を使って始めます。始めると、残りは{n}回になります。途中でやめても、24時間以内なら続きから受けられます。",
    "mockGo": "始める", "cancel": "やめる",
    "resume": "途中の模擬テストを続ける",
    "price": "模擬テストは有料です。<b>{yen}円で{n}回</b>受けられます（使い切ったら、また{yen}円で{n}回）。",
    "soon": "購入の受付は準備中です。もうしばらくお待ちください。",
    "free": "無料の練習",
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
    "line": "縦の線が合格基準の65％です（本番は学科と実技の合計で判定）。",
    "byCat": "分野別の正解数", "retryWrong": "間違えた問題だけもう一度", "home": "最初の画面にもどる",
    "review": "間違えた問題の復習",
}.items()}
L["title"] = '<span class="ln">' + F("特定技能2号 外食業") + '</span> <span class="ln">' + F("練習問題") + '</span>'
L["sub"] = {k: F(v) for k, v in {
    "eisei": "食中毒・HACCP・食品衛生法",
    "chori": "食材・調理方法・調理機器・労働安全",
    "sekkyaku": "接客・アレルギー・食の多様化・クレーム対応",
    "unei": "労働基準法・雇用管理・届出・在庫管理",
    "keisan": "人時売上高・原価率・発注量などの計算",
}.items()}

html = open(os.path.join(HERE, "template.html")).read()
html = html.replace("__CATS__", json.dumps({k: F(v) for k, v in CATS.items()}, ensure_ascii=False))
html = html.replace("__LBL__", json.dumps(L, ensure_ascii=False))
open(os.path.join(ROOT, "quiz", "index.html"), "w").write(html)
print(f"QuizBank.gs: {len(bank)}問 / quiz/index.html を作成しました")
