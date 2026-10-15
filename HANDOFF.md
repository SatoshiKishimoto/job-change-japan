# 引き継ぎ：Job Change Japan 公式LINE 配信システム

あなたは、株式会社Fairly connecting（大阪、有料職業紹介事業 許可番号 27-ユ-304918）の代表・Satoshiさんが運営する「Job Change Japan」の公式LINE配信システムの開発を引き継ぎます。説明は専門用語を避け、日本語でわかりやすくしてください。

## 全体像
- 外国人求職者・留学生が公式LINEに友だち追加 → トーク内で登録 → スプレッドシートに保存 → 担当者にメール通知、という仕組み。
- イケハヤ氏の公式LINE（友だち追加→診断→ステップ配信）を参考に作った。

## 場所
- GitHub：SatoshiKishimoto/job-change-japan（GitHub Pages で公開）
  - LINEボットのコード：`gas/line-bot/LineBot.gs`（正本。必ずここを編集）
  - リッチメニュー画像：`line/richmenu.png`（GAS が raw.githubusercontent.com から読み込む）
  - LPサイト用GAS：`gas/Code.gs`（※まだ本番に反映されていない、下記「未解決」参照）
  - `register.html`：30秒登録Webページ（送信先GASが未対応のため現在は使っていない）
- LINE公式アカウント：Job Change Japan（ID：@022akbvw、友だち追加URL https://line.me/R/ti/p/@022akbvw）
  - 管理画面 https://manager.line.biz/ ／ 開発者 https://developers.line.biz/console/
  - 応答設定：Webhook ON、応答メッセージ OFF、あいさつメッセージ OFF
- GAS：script.google.com の単独プロジェクト（LINEボット専用。LP用GASとは別）
- スプレッドシート「Job Change Japan LINE登録者」
  https://docs.google.com/spreadsheets/d/1J45SuAo_2ZWzSv4mV4vZtJ6EBym6OVhsvu5St8P9JWI/edit
- 手順書シート「Job Change Japan 求人の登録方法」（innocentworld1221@gmail.com のドライブ。雇用形態列の説明は未追記）

## スクリプトプロパティ（値はチャットに貼らないこと）
LINE_TOKEN（必須）／NOTIFY_EMAIL（空ならGAS所有者）／SHEET_ID／ANTHROPIC_API_KEY（空ならAI応答OFF）／AI_MODEL（既定 claude-haiku-5-5）

## 機能（LineBot.gs）
1. 登録：友だち追加 → 言語選択（日本語・English・Tiếng Việt・नेपाली）→ 質問 → 名前（ローマ字）
   - 1問目で「正社員・フルタイム」か「アルバイト（留学生）」を選ぶ
   - フルタイム：職種→在留資格→日本語→勤務地→就業開始→名前
   - アルバイト：職種→資格外活動許可→日本語→勤務地→週の勤務時間→名前（在留資格は「留学」で保存。許可なしの人には注意文、完了時に週28時間ルールを添える）
   - 同じ人でも雇用形態ごとに1行。同じ雇用形態で再登録すると上書きし、旧内容を「登録履歴」タブに保存
2. リッチメニュー：登録／求人を見る／相談する／言語（setupRichMenu で作成済み）
3. ステップ配信：登録の1・3・7日後、毎朝10時（runDaily）。3日後はアルバイトの人には留学生ルール版
4. 求人：「求人」タブに1行入れると「求人を見る」に即反映、翌朝10時に条件が合う人へ自動配信。求人ID空欄なら J001… を自動採番。雇用形態列（アルバイト／正社員・フルタイム／空欄=両方）で出し分け。「応募 J001」で応募→メール通知
5. スプレッドシートのメニュー「LINE配信」：配信予定の確認／新着求人を今すぐ送る
6. AI自動応答（Claude API）：個別のビザ判断・応募・苦情などは [ESCALATE] で担当者へメール
7. 言語：日本語・English を選んだ人には全メッセージを日英併記。ベトナム語・ネパール語はその言語のみ。求人本文は LanguageApp で自動翻訳
8. 安全策：Webhook はスクリプトロックで1件ずつ処理、返信失敗時はプッシュで再送、押す順がずれても未回答の質問へ進む

## シートの列
- LINE登録：登録日時, 受付ID, LINE userId, LINE表示名, 言語, お名前, 希望職種, 在留資格, 日本語, 希望勤務地, 就業開始, 対応状況, メモ, ステップ送信済, ブロック, 最終更新, 雇用形態, 資格外活動許可, 週の勤務時間
- 求人：求人ID, 公開(空欄/○=公開, ×=非公開), 職種, 勤務地, タイトル, 給与, 内容, 詳細URL, 配信日時, 配信人数, 応募数, 雇用形態
- 登録履歴：履歴日時 ＋ LINE登録と同じ列

## 更新の手順（Satoshiさんに案内する形）
1. GASのコードを新しい LineBot.gs に丸ごと差し替えて保存
2. 列・トリガー・メニューを変えたときだけ setup を実行
3. 「デプロイ → デプロイを管理 → 鉛筆 → 新バージョン」でデプロイ（「新しいデプロイ」はURLが変わるので使わない）

## 開発のやり方
- LineBot.gs を編集したら、Node でGAS/LINE/シートをモックして4言語・両コースの流れを確認してからコミット・push
- LINEのクイックリプライのボタン文字は20文字以内（日英併記ラベルは Q の jaen で短縮版を指定）
- 配信（push/multicast）は月200通の無料枠を使う。reply は無料

## 未解決・注意
- 2026-10-14 にアルバイト登録で「資格外活動許可：あり」の後に返事が止まった報告あり。再現できず、堅牢化した版を配布済み。再発時は GAS「実行数」の doPost エラーを確認
- 既存サイトの form.html / detail_form.html / register.html は送信先GAS（LP用、doGetがLPを返すだけ）が登録を受け付けないため送信エラーになる。gas/Code.gs に受付処理を用意済みだが未反映（Satoshiさんは「既存ページは変更しなくてよい」との方針）
- 「面談日時のご予約」ページ（予約リンク無効エラー）は別のGASプロジェクトで、このリポジトリには含まれない
