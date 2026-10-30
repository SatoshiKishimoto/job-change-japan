# 練習問題（特定技能2号 外食業）の設定手順

公式LINEの友だちだけが無料で使える練習問題ページです。模擬テストは有料（500円で10回）です。

- ページ：https://satoshikishimoto.github.io/job-change-japan/quiz/
- LINEで開くURL：`https://liff.line.me/（LIFF ID）`（設定後に決まります）

## しくみ

1. 受験者がページを開く → LINEでログイン
2. 公式LINEのGAS（LINEボットと同じもの）が、ログインが本物か、公式LINEの友だちかを確認
3. 友だちなら問題を返す（問題はGASの中にあり、ページのソースには入っていません）
4. 模擬テストは「模擬テスト回数」シートの残り回数を1つ使う

## 1. LINE Developers：LINEログインチャネルとLIFFを作る

https://developers.line.biz/console/ で、公式LINE（Messaging API）と**同じプロバイダー**を開きます。

1. 「新規チャネル作成」→「LINEログイン」
   - アプリタイプ：**ウェブアプリ**
   - チャネル名：Job Change Japan 練習問題（など）
2. 作ったチャネルの「チャネル基本設定」
   - **リンクされたLINE公式アカウント**：Job Change Japan（@022akbvw）を選ぶ
   - 「チャネルID」（数字）を控える → 手順2で使う
3. 「LIFF」タブ →「追加」
   - LIFFアプリ名：練習問題
   - サイズ：**Full**
   - エンドポイントURL：`https://satoshikishimoto.github.io/job-change-japan/quiz/`
   - Scope：**profile** と **openid** にチェック
   - 友だち追加オプション：**On（Aggressive）**（ログイン時に友だち追加の画面が出ます）
   - 作成後に表示される「LIFF ID」を控える → 手順3で使う
4. チャネルのステータスを「開発中」から**「公開済み」**にする
   - 開発中のままだと、管理者以外はログインできません

## 2. GAS（公式LINEボットのプロジェクト）

1. 「プロジェクトの設定」→「スクリプト プロパティ」に追加
   - `LIFF_CHANNEL_ID` ＝ 手順1-2のチャネルID
2. エディタで次の3ファイルを用意する（＋ボタン →「スクリプト」）
   - `LineBot.gs`：丸ごと差し替え（2か所の小さな追加のみ）
   - `Quiz.gs`：新しく作って貼り付け
   - `QuizBank.gs`：新しく作って貼り付け（問題データ）
3. 関数 `setupQuiz` を1回実行（シート「模擬テスト回数」「模擬テスト受験」ができます）
4. 「デプロイ → デプロイを管理 → 鉛筆 → 新バージョン」でデプロイ
   - 「新しいデプロイ」は使わない（URLが変わり、LINEのWebhookも止まります）

## 3. ページの設定（quiz/config.js）

```js
LIFF_ID: '（手順1-3のLIFF ID）',
API_URL: '（GASのウェブアプリURL。LINEのWebhook URLと同じ …/exec）'
```

## 4. 動作確認

1. スマホのLINEで `https://liff.line.me/（LIFF ID）` を開く
2. 自分の名前と「模擬テスト 残り0回」が出ればOK
3. スプレッドシートの「模擬テスト回数」で自分の行を選び、メニュー「LINE配信 → 模擬テスト：選んだ行の人に10回分を付与」→ 模擬テストを1回受けてみる

## 毎日の運用

- **回数の付与（決済連携まで）**：「模擬テスト回数」シートで、その人の行を選んで「LINE配信 → 模擬テスト：選んだ行の人に10回分を付与」。残り回数の数字を直接書き換えてもOK
- **受験の記録**：「模擬テスト受験」シート（正解数・分野別の結果）
- **受験者への案内**：LINEのリッチメニューやステップ配信に `https://liff.line.me/（LIFF ID）` を載せる

## 問題を直す・増やす

1. `quiz/build/questions.py` を編集（増やすときは各分野の最後に追加）
2. `pip install fugashi unidic-lite` のあと `python3 quiz/build/build.py`
3. できた `gas/line-bot/QuizBank.gs` をGASに貼り直して、新バージョンでデプロイ
4. `quiz/index.html` も更新されるので、GitHubにpush

ふりがなの読みを直すときは `quiz/build/furi.py` の `OVR`（語と読みの一覧）に追加します。

## 決済をつなぐとき（未定）

`Quiz.gs` の `addMockCredits_(LINE userId, 10, メモ)` を、決済完了の通知（Stripeのwebhookなど）から呼べば、自動で10回分が付与されます。ページの「購入の受付は準備中です」の文言（`quiz/build/build.py` の `soon`）も合わせて差し替えます。
