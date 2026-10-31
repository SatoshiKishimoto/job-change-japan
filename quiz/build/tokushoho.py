"""特定商取引法に基づく表記（quiz/tokushoho.html）。build.py から作る"""
import html as H
import re

import terms

UPDATED = "2026年10月31日"

# (項目, 内容, ふりがなを付けるか)。名前・住所・メールは読み違いを防ぐため、ふりがなを付けない
ROWS = [
    ("販売事業者", "株式会社Fairly connecting", False),
    ("代表者（運営統括責任者）", "岸本 暁", False),
    ("所在地", "〒540-0034 大阪府大阪市中央区島町2-2-3 サンハイム天満橋204", False),
    ("電話番号", "請求があった場合は、遅滞なく開示します。お問い合わせは、下記のメールアドレスまたは当社LINE公式アカウントにお願いします。", True),
    ("メールアドレス", "fairlyconnecting@gmail.com", False),
    ("商品の名称", "Job Change Japan 練習問題 回数券（外食業特定技能2号技能測定試験・日本語能力試験N3の練習問題と模擬テストを利用できる権利）", True),
    ("販売価格", "9回分 550円／30回分 1,760円／60回分 3,300円（いずれも消費税込み）。購入画面にも表示します。", True),
    ("商品代金以外に必要な料金", "インターネットの接続料金・通信料金は、お客様のご負担となります。", True),
    ("支払方法", "クレジットカード、その他Stripeの支払い画面に表示される方法", True),
    ("支払時期", "購入の手続きをした時に、お支払いが確定します。", True),
    ("商品の引渡時期", "お支払いの完了後、すぐに回数券がお客様のLINEアカウントに追加されます。", True),
    ("利用方法", "練習問題のページで「始める」を押すと回数券を1回分使い、その時から24時間、練習問題と模擬テストのすべてを利用できます。", True),
    ("返品・キャンセル・返金", "デジタルコンテンツの性質上、購入後の返品・キャンセルはできません。一度お支払いいただいた代金は、回数券を使い切らなかった場合を含め、返金できません（利用規約 第6条）。", True),
    ("動作環境", "LINEアプリ（最新版をおすすめします）を入れたスマートフォン、またはパソコンのブラウザ。当社LINE公式アカウント「Job Change Japan」の友だち追加とLINEログインが必要です。", True),
    ("その他", "回数券は、購入したLINEアカウントでのみ使えます。初めての方は、1回に限り無料で24時間お試しできます。", True),
]

EN = [
    ("Seller", "Fairly connecting Inc."),
    ("Representative", "Satoshi Kishimoto"),
    ("Address", "Sunheim Tenmabashi 204, 2-2-3 Shimamachi, Chuo-ku, Osaka 540-0034, Japan"),
    ("Phone", "Disclosed without delay upon request. Please contact us by email or via our LINE account."),
    ("Email", "fairlyconnecting@gmail.com"),
    ("Price", "9 tickets: 550 yen / 30 tickets: 1,760 yen / 60 tickets: 3,300 yen (tax included)"),
    ("Payment", "Credit card and other methods shown on the Stripe payment page. Payment is made at purchase."),
    ("Delivery", "Tickets are added to your LINE account right after payment. 1 ticket = 24 hours of full access."),
    ("Returns / refunds", "Because this is digital content, purchases cannot be cancelled or refunded, including unused tickets."),
]


def render(F):
    style = re.search(r"<style>.*?</style>", terms.render(F), re.S).group(0)
    style = style.replace("</style>", "table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:10px 8px;border-top:1px solid var(--line)}"
                          "th{width:34%;font-weight:700}tr:first-child th,tr:first-child td{border-top:0}"
                          "@media (max-width:520px){th,td{display:block;width:auto;padding:4px 0}th{padding-top:12px}td{border-top:0}}</style>")
    rows = "".join(f"<tr><th>{F(k)}</th><td>{F(v) if f else H.escape(v)}</td></tr>" for k, v, f in ROWS)
    en = "".join(f"<tr><th>{H.escape(k)}</th><td>{H.escape(v)}</td></tr>" for k, v in EN)
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>特定商取引法に基づく表記 | Job Change Japan 練習問題</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Shippori+Mincho+B1:wght@700;800&display=swap">
{style}
</head>
<body>
<div class="wrap">
  <div class="bar"><span class="eyebrow">Job Change Japan</span><label class="toggle"><input type="checkbox" id="furi" checked> ふりがな</label></div>
  <h1>{F("特定商取引法に基づく表記")}</h1>
  <p class="muted">{F("最終更新日：" + UPDATED)}</p>
  <div class="box"><table>{rows}</table></div>
  <div class="box en"><h2>Legal notice (Specified Commercial Transactions Act) — English summary</h2><table>{en}</table></div>
  <p><a href="terms.html">{F("利用規約")}</a> ／ <a href="./">{F("練習問題にもどる")}</a></p>
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
