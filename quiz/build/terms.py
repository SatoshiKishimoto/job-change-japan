"""練習問題サービスの利用規約（quiz/terms.html を作る）

build.py から呼ばれます。内容を変えるときは TERMS を編集して build.py を実行してください。
"""
import html as H

UPDATED = "2026年10月31日"

SUMMARY = [
    "このサービスの問題は、練習用のオリジナル問題です。実際の試験問題ではありません。",
    "練習や模擬テストで合格点に達しても、本番の試験に合格することを保証するものではありません。",
    "一度支払った代金は、回数券を使い切らなかった場合を含めて、どんな理由でも返金できません。",
    "模擬テストは、始めた時点で1回分を使います。途中でやめても、時間切れでも、1回分は戻りません。",
    "問題・解説・音声を、ほかの人に送ったり、SNSなどにのせたりしてはいけません。",
    "このサービスを使った時点で、この利用規約に同意したものとみなします。",
]

SUMMARY_EN = [
    "All questions are original practice questions. They are not actual exam questions.",
    "Reaching the passing line in practice or a mock exam does not guarantee that you will pass the real exam.",
    "Payments cannot be refunded for any reason, including unused mock exam tickets.",
    "One ticket is used when you start a mock exam, even if you stop or run out of time.",
    "Do not share, copy or post the questions, explanations or audio (including on social media).",
    "By using this service, you agree to these Terms of Use. The Japanese version is the official version.",
]

TERMS = [
    ("第1条（この規約について）", [
        "この利用規約（以下「本規約」）は、株式会社Fairly connecting（以下「当社」）が運営する「Job Change Japan 練習問題」（以下「本サービス」）を利用するときの条件を定めるものです。",
        "本規約は、本サービスを利用するすべての方（以下「利用者」）に適用されます。",
    ]),
    ("第2条（同意）", [
        "利用者は、本サービスを利用した時点で、本規約に同意したものとみなします。",
        "未成年の方は、保護者の同意を得てから本サービスを利用してください。未成年の方が本サービスを利用した場合、保護者の同意があったものとみなします。",
    ]),
    ("第3条（本サービスの内容）", [
        "本サービスは、外食業特定技能2号技能測定試験および日本語能力試験N3の対策のための練習問題を提供するものです。",
        "本サービスは、当社のLINE公式アカウント「Job Change Japan」の友だちの方が、LINEアカウントでログインして利用できます。",
        "練習問題は無料で利用できます。模擬テストは有料で、回数券を使って受験します。",
    ]),
    ("第4条（練習問題の性質と、合格を保証しないこと）", [
        "本サービスの問題・解説・音声は、公開されている出題範囲などをもとに当社が独自に作成した練習用の問題です。実際の試験問題ではありません。",
        "本サービスは、外食業特定技能2号技能測定試験の実施機関、日本語能力試験の実施機関、その他の試験の実施機関とは関係がありません。",
        "本サービスで表示する得点・正答率・合格ラインは、練習のための目安です。練習問題や模擬テストで合格点や合格ラインに達しても、本番の試験に合格することを保証するものではありません。",
        "本番の試験の出題範囲・形式・合格基準・受験資格などは変わることがあります。最新の情報は、利用者が各試験の実施機関の公式サイトで確認してください。",
        "当社は、問題・解説の内容が正確であるよう努めますが、内容の正確性・完全性・最新性を保証するものではありません。",
        "聴解の音声は合成音声で作っており、実際の試験の音声とは、話す速さや聞こえ方がちがいます。",
    ]),
    ("第5条（料金と回数券）", [
        "模擬テストの料金は、本サービスの画面で表示する金額とします。",
        "回数券は、模擬テスト（外食業特定技能2号技能測定試験、日本語能力試験N3の各科目）を始めるたびに1回分を使います。",
        "模擬テストを始めたあとに、途中でやめた場合、制限時間が過ぎた場合、通信の状態や端末の不具合で続けられなくなった場合でも、使った1回分は戻りません。",
        "支払いの方法と時期は、当社が別に案内します。",
        "回数券は、購入したLINEアカウントでのみ使えます。他の人に譲ったり、売ったり、貸したりすることはできません。",
    ]),
    ("第6条（返金できないこと）", [
        "一度支払った代金は、回数券を使い切らなかった場合を含め、いかなる理由があっても返金できません。",
    ]),
    ("第7条（LINEアカウント）", [
        "利用者は、自分のLINEアカウントで本サービスを利用し、アカウントを自分の責任で管理してください。",
        "LINEアカウントの変更・削除、当社LINE公式アカウントのブロックや友だちの解除などにより、本サービスを利用できなくなった場合や、回数券・受験記録を引き継げなくなった場合でも、当社は責任を負いません。",
    ]),
    ("第8条（してはいけないこと）", [
        "利用者は、次のことをしてはいけません。",
        "（1）本サービスの問題・解説・音声・画面の全部または一部を、コピー、録音、録画、スクリーンショットなどで保存して、他の人に送ったり、SNS・ウェブサイト・動画などにのせたり、販売したりすること",
        "（2）他の人のLINEアカウントを使うこと、または自分のLINEアカウントを他の人に使わせること",
        "（3）プログラムなどを使って、問題や答えを自動で集めること",
        "（4）本サービスのしくみに不正にアクセスすること、本サービスの運営を妨げること",
        "（5）法律や公序良俗に反すること",
        "（6）その他、当社が適切でないと判断すること",
        "当社は、利用者が前の項のことをしたと判断したときは、事前に知らせることなく、本サービスの利用を止めることができます。この場合も、支払った代金は返金しません。",
    ]),
    ("第9条（著作権）", [
        "本サービスの問題・解説・音声・画面などの著作権その他の権利は、当社または正当な権利者に帰属します。",
    ]),
    ("第10条（サービスの変更・停止・終了）", [
        "当社は、問題の追加・修正・削除、料金、画面など、本サービスの内容を変更することがあります。",
        "当社は、システムの点検、故障、通信の障害、LINEなど外部のサービスの停止、天災その他やむを得ない理由があるときは、事前に知らせることなく、本サービスの全部または一部を停止することがあります。",
        "当社は、本サービスを終了することがあります。終了するときは、本サービスの画面またはLINE公式アカウントで、できるだけ前もってお知らせします。",
    ]),
    ("第11条（責任の範囲）", [
        "当社は、本サービスを利用したこと、または利用できなかったことによって利用者に生じた損害（試験の結果、在留資格の手続き、就職・転職などに関するものを含みます）について、当社に故意または重大な過失がある場合を除き、責任を負いません。",
        "本サービスは、利用者のスマートフォン・通信の状態・LINEアプリのバージョンなどによって、正しく表示されなかったり、音声が再生されなかったりすることがあります。",
    ]),
    ("第12条（個人情報）", [
        "当社は、本サービスで取得した情報（LINEのユーザーID、表示名、受験の記録、回数券の利用状況など）を、当社のプライバシーポリシーにしたがって取り扱います。",
    ]),
    ("第13条（規約の変更）", [
        "当社は、必要に応じて本規約を変更することがあります。変更した本規約は、このページにのせた時点から効力を持ちます。",
        "本規約を変更したあとに利用者が本サービスを利用した場合、変更後の本規約に同意したものとみなします。",
    ]),
    ("第14条（言語・法律・裁判所）", [
        "本規約は、日本語版を正式なものとします。英語などの翻訳は参考のためのものです。",
        "本規約は日本の法律にしたがって解釈します。本サービスについて争いが起きたときは、大阪地方裁判所を第一審の専属的合意管轄裁判所とします。",
    ]),
    ("第15条（お問い合わせ）", [
        "本サービスについてのお問い合わせは、当社LINE公式アカウント「Job Change Japan」のトークでお送りください。",
    ]),
]


def render(F, privacy_url=""):
    """F：ふりがなを付ける関数"""
    def p(t):
        return f"<p>{F(t)}</p>"
    summary = "".join(f"<li>{F(t)}</li>" for t in SUMMARY)
    summary_en = "".join(f"<li>{H.escape(t)}</li>" for t in SUMMARY_EN)
    arts = "".join(f"<section><h2>{F(h)}</h2>{''.join(p(t) for t in body)}</section>" for h, body in TERMS)
    priv = (f'<p><a href="{H.escape(privacy_url)}">{F("プライバシーポリシー")}</a></p>' if privacy_url else "")
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>利用規約 | Job Change Japan 練習問題</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Shippori+Mincho+B1:wght@700;800&display=swap">
<style>
:root{{--bg:#f3f2ee;--surface:#fff;--ink:#1d2330;--muted:#5d6472;--line:#d9d8d1;--ai:#24407a;--ai-soft:#e4e9f4;--rt:#6b7488;
  --f-display:"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho",serif;--f-body:"BIZ UDPGothic","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;color-scheme:light}}
@media (prefers-color-scheme: dark){{:root{{--bg:#14171e;--surface:#1d212b;--ink:#e8e9ec;--muted:#a3a9b6;--line:#323846;--ai:#8fa9e6;--ai-soft:#25304a;--rt:#9aa3b6;color-scheme:dark}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:2;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:24px 56px}}
.wrap{{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:18px}}
h1{{font-family:var(--f-display);font-size:1.6rem;margin:0;line-height:1.6}}
h2{{font-family:var(--f-display);font-size:1.05rem;margin:0 0 4px;line-height:1.7}}
p{{margin:0 0 6px}}
rt{{font-size:.52em;color:var(--rt)}}
body.nofuri rt{{display:none}}
.eyebrow{{font-size:.78rem;letter-spacing:.12em;color:var(--ai);font-weight:700}}
.box{{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px}}
.key{{border:2px solid var(--ai)}}
.key ul,.en ul{{margin:0;padding-left:1.2em}}
.key li{{margin-bottom:4px}}
.en{{font-size:.92rem;line-height:1.7;color:var(--muted)}}
section{{border-top:1px solid var(--line);padding-top:12px}}
a{{color:var(--ai)}}
.bar{{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}}
.toggle{{display:inline-flex;align-items:center;gap:8px;font-size:.9rem;color:var(--muted)}}
.toggle input{{width:20px;height:20px;accent-color:var(--ai)}}
.muted{{color:var(--muted);font-size:.9rem}}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar"><span class="eyebrow">Job Change Japan</span><label class="toggle"><input type="checkbox" id="furi" checked> ふりがな</label></div>
  <h1>{F("練習問題 利用規約")}</h1>
  <p class="muted">{F("制定日：" + UPDATED)}</p>
  <div class="box key"><h2>{F("大切なこと（まとめ）")}</h2><ul>{summary}</ul></div>
  <div class="box en"><h2>Summary in English</h2><ul>{summary_en}</ul></div>
  <div class="box">{arts}</div>
  {priv}
  <p class="muted">{F("株式会社Fairly connecting（有料職業紹介事業 許可番号 27-ユ-304918）")}</p>
  <p><a href="./">{F("練習問題にもどる")}</a></p>
</div>
<script>
const b = document.getElementById('furi');
try {{ if (localStorage.getItem('furi') === 'false') b.checked = false; }} catch (e) {{}}
const set = () => {{ document.body.classList.toggle('nofuri', !b.checked); try {{ localStorage.setItem('furi', JSON.stringify(b.checked)); }} catch (e) {{}} }};
b.addEventListener('change', set); set();
</script>
</body>
</html>
"""
