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

## 練習問題（特定技能2号 外食業）2026-10-30 追加
- 料金（2026-10-31変更）：公式LINEの友だち限定。回数券は9回分550円・30回分1,760円・60回分3,300円（税抜500円・1,600円・3,000円。Quiz.gs の QUIZ_PACKS）。ページの「始める」で1回分を使い、そこから24時間は練習問題も模擬テストもすべて使い放題（api: pass_start。シート「模擬テスト回数」の利用期限・お試し利用列、記録は「利用記録」シート）。はじめての人は1回だけ無料で24時間お試し。利用時間が切れても、始めていた模擬テストは提出できる
- 模擬テストは本番と同じ 学科35問＋実技20問（判断3＋計画立案2 ×4分野）＝55問・70分。採点は250点満点・合格163点（学科は実施要領の配点、実技は1問6.5点の目安）
- N3（2026-10-31〜）：`quiz/build/questions_n3.py`。第1段階は文字・語彙（漢字読み20・表記15・文脈規定25・言い換え類義12・用法12）と文法（文法形式30・文の組み立て12）。問題文と選択肢はふりがななし、解説だけふりがな。4択。模擬テスト「n3moji」は35問・30分（回数券は技能と共通）。第2段階（文章の文法・読解）は `quiz/build/questions_n3_reading.py`：文章の文法2題・短文8・中文4題・長文2題・情報検索2題。文章は QUIZ_PASSAGES、問題は p（文章ID）・pi（順番）を持ち、出題は文章ごと。模擬テスト「n3bunpo」は39問・70分。第3段階（聴解）は `quiz/build/questions_n3_listening.py`：課題理解8・ポイント理解8・概要理解4・発話表現5・即時応答12。音声は `python3 quiz/build/make_audio.py`（pyopenjtalk-plus の合成音声、男性の声は ffmpeg rubberband で作成）で `quiz/audio/*.mp3` に出力。概要・発話・即時は選択肢を読み上げる形（fx：順番固定、ans：正解番号、hid：模擬テストでは文字を返さない）。模擬テスト「n3chokai」は28問・40分、音声は1回だけ再生
- 技能の問題は224問：学科（衛生39・調理26・接客38・店舗運営37）、実技・判断36問、実技・計画立案36問、実技・事例12問（3題）。元データは questions.py と questions_skill_more.py（2026-10-31追加。参考サイトはテーマだけ参考にした独自問題で、文言は使っていない）。事例問題（ID "J…"、kind "jirei"）は練習専用で、模擬テストには出さない（本番形式を保つため）
- ページ：`quiz/index.html`（LIFF。設定は `quiz/config.js`）。GAS：`Quiz.gs`（API）＋ `QuizBank.gs`（問題データ・自動生成）を同じLINEボットのプロジェクトに追加。`doPost` は `body.api` があれば `quizApi_` へ
- 問題・ふりがなの元データ：`quiz/build/`（`python3 quiz/build/build.py` で QuizBank.gs と index.html を生成）
- 確認方法：アクセストークンを LINE の verify・profile・friendship API で確認（LIFF_CHANNEL_ID と一致・友だち）。正解は模擬テストの採点時まで返さない
- シート：「模擬テスト回数」（残り回数。手で書き換え可）／「模擬テスト受験」（記録・出題データ）
- 決済：Stripe Checkout（2026-10-31〜）。GASのスクリプトプロパティ STRIPE_SECRET_KEY（制限付きキー rk_live_…、権限は Checkout Sessions の作成だけ）。api: buy で支払い画面を作り、もどったら api: buy_check でStripeに確認して回数を足す（シート「購入記録」で二重付与を防ぐ）。もどらなかった分は runDaily の quizBuyReconcile_ が直近3日を確認。ページの購入ボタンは build.py の SALES_READY で表示（2026-10-31 True）。特定商取引法の表記は quiz/tokushoho.html（元は quiz/build/tokushoho.py）
- 手動付与も可。「LINE配信」メニューの「模擬テスト：選んだ行の人に10回分を付与」で手動付与。決済連携は `addMockCredits_` を呼ぶ
- 利用規約：`quiz/terms.html`（元は `quiz/build/terms.py`、build.py で生成）。合格を保証しない・返金不可・利用で同意とみなす、などを記載。ページの下・ログイン画面・模擬テスト欄・結果画面に注意書きとリンク。プライバシーポリシーのURLは build.py の PRIVACY_URL（fairlyconnecting.blog.jp のブログ記事）
- 複製の防止（2026-10-31）：スマホのスクショはWebでは止められないため、LINE表示名と日時のすかし（`setWatermark`）で流出元が分かるようにし、コピー・切り取り・印刷・PrintScreen・Ctrl+S などで黒い画面、画面から離れたらぼかす。文字の選択は翻訳のため残している。利用規約第8条にも記載
- 設定手順：`quiz/SETUP.md`。テスト：`node gas/line-bot/test/quiz.test.js`／`node gas/line-bot/test/linebot-quiz.test.js`
- 入口：リッチメニュー（3×2、「練習問題」「サイト」はURIアクション。画像は `line/richmenu.html` → `node line/make_richmenu.js` で生成）／キーワード返信（KW_QUIZ）／5日後のステップ配信／AI応答に案内文／シートメニュー「練習問題の案内を登録者に送る（1回だけ）」（送信済みはスクリプトプロパティ QUIZ_ANNOUNCED）
- LIFF URL：https://liff.line.me/2012300446-Oe7H41c2（LINEログインチャネルID 2012300446、GASは fairlyconnecting@gmail.com のプロジェクト「Job Change Japan — 公式LINE ボット」）

## 未解決・注意
- 2026-10-14 にアルバイト登録で「資格外活動許可：あり」の後に返事が止まった報告あり。再現できず、堅牢化した版を配布済み。再発時は GAS「実行数」の doPost エラーを確認
- 既存サイトの form.html / detail_form.html / register.html は送信先GAS（LP用、doGetがLPを返すだけ）が登録を受け付けないため送信エラーになる。gas/Code.gs に受付処理を用意済みだが未反映（Satoshiさんは「既存ページは変更しなくてよい」との方針）
- 「面談日時のご予約」ページ（予約リンク無効エラー）は別のGASプロジェクトで、このリポジトリには含まれない
