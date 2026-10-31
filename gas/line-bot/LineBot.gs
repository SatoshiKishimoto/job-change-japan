/**
 * Job Change Japan — 公式LINE ボット（GAS） v2
 *
 * 機能
 *  1. 登録      : 友だち追加 → 言語選択 → 5問＋名前 → シート保存・メール通知
 *  2. リッチメニュー : 登録 / 求人を見る / 練習問題 / 相談する / 言語 / サイト（setupRichMenu で作成）
 *  3. ステップ配信 : 登録の翌日・3日後・5日後（練習問題の案内）・7日後に自動配信（毎朝10時）
 *  4. 求人のお知らせ: 「求人」シートの新しい求人を、条件が合う人へ自動配信（毎朝10時）
 *  5. AI自動応答  : 質問にAI（Claude）が回答。担当者が必要な内容はメールで通知
 *
 * スクリプトプロパティ
 *   LINE_TOKEN        : チャネルアクセストークン（長期）       ※必須
 *   NOTIFY_EMAIL      : 通知先メール（空ならGASの所有者）
 *   SHEET_ID          : 保存先スプレッドシートID（空なら自動作成）
 *   ANTHROPIC_API_KEY : AI自動応答に使うキー（空ならAI応答なし）
 *   AI_MODEL          : 使うモデル（空なら claude-haiku-5-5）
 *
 * 初回だけ実行する関数
 *   setup()          : 権限の許可・シート作成・LINE接続確認・毎朝10時の自動実行を登録
 *   setupRichMenu()  : リッチメニューを作成して全員に表示
 */

var RICHMENU_IMAGE_URL = 'https://raw.githubusercontent.com/SatoshiKishimoto/job-change-japan/main/line/richmenu.png';
var DAILY_HOUR = 10;          // 毎日の自動実行（ステップ配信・求人配信）の時刻
var STEP_DAYS = [1, 3, 5, 7]; // ステップ配信：登録から何日後に送るか（5日後＝練習問題の案内）
var QUIZ_URL = 'https://liff.line.me/2012300446-Oe7H41c2';            // 練習問題（LIFF）
var SITE_URL = 'https://satoshikishimoto.github.io/job-change-japan/';  // Job Change Japan のサイト

// ============================================================
// 言語・文言
// ============================================================
var LANGS = [['ja', '日本語'], ['en', 'English'], ['vi', 'Tiếng Việt'], ['ne', 'नेपाली']];

var T = {
  ja: {
    welcome: '友だち追加ありがとうございます。\nJob Change Japan（株式会社Fairly connecting）です。\n\n日本で働きたい外国人の方の転職・就職を、無料でお手伝いしています。',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: '6つの質問に答えるだけで、30秒で登録できます。\n登録・相談はすべて無料です。',
    startBtn: '登録をはじめる',
    q1: 'どんな仕事をしたいですか？', q2: 'いまの在留資格は？', q3: '日本語のレベルは？',
    q4: 'どこで働きたいですか？', q5: 'いつから働けますか？',
    q6: '最後に、お名前をローマ字で送ってください。\n（例: NGUYEN THI LAN）',
    done: '{name} さん、登録できました！\n受付ID: {id}\n\n担当者から、このLINEで2営業日以内にご連絡します。\nあなたに合う求人が見つかったら、ここでお知らせします。\n\n下のメニューの「求人を見る」から、いまの求人も見られます。',
    updated: '{name} さん、登録内容を更新しました。',
    other: 'その他', none: '資格なし',
    nameRetry: 'お名前をローマ字（英字）で送ってください。',
    needRegister: 'まだ登録されていません。下のボタンから登録してください（30秒で終わります）。',
    noJobs: 'いま、あなたの希望に合う求人はありません。\n新しい求人が出たら、このLINEでお知らせします。',
    jobsHead: 'あなたの希望に合う求人です（{n}件）',
    newJob: '【新着求人】',
    jobFields: { role: '職種', loc: '勤務地', pay: '給与', type: '雇用形態' },
    applyHint: '応募・質問は「応募 {id}」と送ってください。',
    applied: '応募を受け付けました（求人ID: {id}）。\n担当者から、このLINEでご連絡します。',
    askPrompt: '質問をこのトークに送ってください。\nAIがすぐにお答えし、必要なときは担当者からご連絡します。',
    fallback: 'メッセージありがとうございます。担当者が確認してご返信します。',
    handoff: '\n\n（担当者にも伝えました。このLINEでご連絡します）',
    aiNote: '※AIによる自動回答です',
    quizInfo: '【特定技能2号 外食業 練習問題】\n公式LINEの友だちが使える、技能測定試験の練習問題です（ふりがな付き）。\n・学科と実技（判断・計画立案・事例）の練習\n・本番と同じ55問・70分の模擬テスト\n・日本語能力試験N3（文字・語彙・文法・読解・聴解）の練習と模擬テスト\n\n料金（回数券。1回分で24時間、すべて使い放題）\n・9回分 550円\n・30回分 1,760円\n・60回分 3,300円\n（すべて税込）\nはじめての方は、1回だけ無料で24時間お試しできます。\n\n下のリンクか、メニューの「練習問題」から開いてください。\n{url}'
  },
  en: {
    welcome: 'Thank you for adding us!\nThis is Job Change Japan (Fairly connecting Inc.).\n\nWe help foreign nationals find jobs in Japan — completely free.',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: 'Answer 6 quick questions to register in 30 seconds.\nRegistration and consultation are free.',
    startBtn: 'Start registration',
    q1: 'What kind of work do you want?', q2: 'What is your current visa status?', q3: 'What is your Japanese level?',
    q4: 'Where do you want to work?', q5: 'When can you start working?',
    q6: 'Finally, please send your full name in English letters.\n(e.g. NGUYEN THI LAN)',
    done: 'Thank you, {name}! You are registered.\nReceipt ID: {id}\n\nOur staff will contact you on this LINE within 2 business days.\nWe will let you know here when we find a job that suits you.\n\nTap "Jobs" in the menu below to see current openings.',
    updated: '{name}, your information has been updated.',
    other: 'Other', none: 'No certificate',
    nameRetry: 'Please send your name in English letters.',
    needRegister: 'You are not registered yet. Tap the button below to register (30 seconds).',
    noJobs: 'There are no openings that match your wishes right now.\nWe will let you know on this LINE when new jobs come in.',
    jobsHead: 'Jobs that match your wishes ({n})',
    newJob: '[New job]',
    jobFields: { role: 'Job type', loc: 'Location', pay: 'Salary', type: 'Employment' },
    applyHint: 'To apply or ask, send "apply {id}".',
    applied: 'We received your application (Job ID: {id}).\nOur staff will contact you on this LINE.',
    askPrompt: 'Please send your question in this chat.\nOur AI will answer right away, and our staff will follow up if needed.',
    fallback: 'Thank you for your message. Our staff will check and reply.',
    handoff: '\n\n(We have also passed this to our staff. They will contact you on this LINE.)',
    aiNote: '* Automatic answer by AI',
    quizInfo: '[Practice test: Specified Skilled Worker (ii), Food Service]\nPractice questions for the skills test, for friends of our LINE account (in Japanese with furigana).\n- Practice (written and practical)\n- Mock exam in the same format as the real test (55 questions, 70 minutes)\n- JLPT N3 practice and mock exams (vocabulary, grammar, reading and listening)\n\nPrice (tickets; 1 ticket = 24 hours of unlimited use)\n- 9 tickets: 550 yen\n- 30 tickets: 1,760 yen\n- 60 tickets: 3,300 yen\n(tax included)\nFirst-time users can try everything free for 24 hours, once.\n\nOpen the link below, or tap "Practice test" in the menu.\n{url}'
  },
  vi: {
    welcome: 'Cảm ơn bạn đã kết bạn!\nĐây là Job Change Japan (Công ty Fairly connecting).\n\nChúng tôi hỗ trợ người nước ngoài tìm việc tại Nhật Bản — hoàn toàn miễn phí.',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: 'Chỉ cần trả lời 6 câu hỏi, đăng ký trong 30 giây.\nĐăng ký và tư vấn đều miễn phí.',
    startBtn: 'Bắt đầu đăng ký',
    q1: 'Bạn muốn làm công việc gì?', q2: 'Tư cách lưu trú hiện tại?', q3: 'Trình độ tiếng Nhật?',
    q4: 'Bạn muốn làm việc ở đâu?', q5: 'Khi nào bạn có thể bắt đầu?',
    q6: 'Cuối cùng, hãy gửi họ tên bằng chữ La-tinh.\n(VD: NGUYEN THI LAN)',
    done: 'Cảm ơn {name}! Bạn đã đăng ký thành công.\nMã tiếp nhận: {id}\n\nNhân viên sẽ liên lạc qua LINE này trong vòng 2 ngày làm việc.\nKhi có việc phù hợp, chúng tôi sẽ báo tại đây.\n\nBấm "Jobs" ở menu bên dưới để xem việc làm hiện có.',
    updated: '{name}, thông tin của bạn đã được cập nhật.',
    other: 'Khác', none: 'Chưa có',
    nameRetry: 'Vui lòng gửi họ tên bằng chữ La-tinh.',
    needRegister: 'Bạn chưa đăng ký. Hãy bấm nút bên dưới để đăng ký (30 giây).',
    noJobs: 'Hiện chưa có việc phù hợp với mong muốn của bạn.\nKhi có việc mới, chúng tôi sẽ báo qua LINE này.',
    jobsHead: 'Việc làm phù hợp với bạn ({n})',
    newJob: '[Việc làm mới]',
    jobFields: { role: 'Ngành nghề', loc: 'Nơi làm việc', pay: 'Lương', type: 'Hình thức' },
    applyHint: 'Để ứng tuyển hoặc hỏi, hãy gửi "apply {id}".',
    applied: 'Chúng tôi đã nhận đơn ứng tuyển (Mã việc: {id}).\nNhân viên sẽ liên lạc qua LINE này.',
    askPrompt: 'Hãy gửi câu hỏi vào cuộc trò chuyện này.\nAI sẽ trả lời ngay, và nhân viên sẽ liên lạc nếu cần.',
    fallback: 'Cảm ơn tin nhắn của bạn. Nhân viên sẽ kiểm tra và trả lời.',
    handoff: '\n\n(Chúng tôi đã chuyển cho nhân viên. Nhân viên sẽ liên lạc qua LINE này.)',
    aiNote: '* Câu trả lời tự động bởi AI',
    quizInfo: '[Đề luyện thi Kỹ năng đặc định số 2 – Ngành dịch vụ ăn uống]\nĐề luyện thi kỹ năng dành cho bạn bè của tài khoản LINE này (tiếng Nhật có furigana).\n- Luyện tập (lý thuyết và thực hành)\n- Thi thử giống đề thật (55 câu, 70 phút)\n- Luyện tập và thi thử JLPT N3 (từ vựng, ngữ pháp, đọc hiểu, nghe hiểu)\n\nGiá (vé; 1 vé = dùng không giới hạn trong 24 giờ)\n- 9 vé: 550 yên\n- 30 vé: 1.760 yên\n- 60 vé: 3.300 yên\n(đã gồm thuế)\nLần đầu tiên được dùng thử miễn phí 24 giờ (1 lần).\n\nMở đường link bên dưới, hoặc bấm "Practice test" ở menu.\n{url}'
  },
  ne: {
    welcome: 'साथी थप्नुभएकोमा धन्यवाद!\nयो Job Change Japan (Fairly connecting Inc.) हो।\n\nहामी जापानमा काम खोज्ने विदेशीहरूलाई निःशुल्क सहयोग गर्छौं।',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: '६ वटा प्रश्नको उत्तर दिनुहोस्, ३० सेकेन्डमा दर्ता हुन्छ।\nदर्ता र परामर्श निःशुल्क छ।',
    startBtn: 'दर्ता सुरु गर्नुहोस्',
    q1: 'तपाईं कस्तो काम गर्न चाहनुहुन्छ?', q2: 'तपाईंको हालको भिसा के हो?', q3: 'जापानी भाषाको स्तर?',
    q4: 'कहाँ काम गर्न चाहनुहुन्छ?', q5: 'कहिलेदेखि काम सुरु गर्न सक्नुहुन्छ?',
    q6: 'अन्तमा, आफ्नो नाम अंग्रेजी अक्षरमा पठाउनुहोस्।\n(जस्तै: SHARMA RAM)',
    done: 'धन्यवाद {name}! दर्ता भयो।\nदर्ता नम्बर: {id}\n\nहाम्रो कर्मचारीले २ कार्य दिनभित्र यही LINE मा सम्पर्क गर्नेछ।\nउपयुक्त काम भेटिएमा यहीँ जानकारी दिनेछौं।\n\nतलको मेनुमा "Jobs" थिचेर अहिलेका कामहरू हेर्न सक्नुहुन्छ।',
    updated: '{name}, तपाईंको जानकारी अपडेट भयो।',
    other: 'अन्य', none: 'छैन',
    nameRetry: 'कृपया नाम अंग्रेजी अक्षरमा पठाउनुहोस्।',
    needRegister: 'तपाईं अझै दर्ता हुनुभएको छैन। तलको बटन थिचेर दर्ता गर्नुहोस् (३० सेकेन्ड)।',
    noJobs: 'अहिले तपाईंको इच्छा अनुसारको काम छैन।\nनयाँ काम आएमा यही LINE मा जानकारी दिनेछौं।',
    jobsHead: 'तपाईंलाई मिल्ने कामहरू ({n})',
    newJob: '[नयाँ काम]',
    jobFields: { role: 'कामको प्रकार', loc: 'स्थान', pay: 'तलब', type: 'रोजगारीको किसिम' },
    applyHint: 'आवेदन वा प्रश्नका लागि "apply {id}" पठाउनुहोस्।',
    applied: 'तपाईंको आवेदन प्राप्त भयो (काम ID: {id})।\nहाम्रो कर्मचारीले यही LINE मा सम्पर्क गर्नेछ।',
    askPrompt: 'आफ्नो प्रश्न यही च्याटमा पठाउनुहोस्।\nAI ले तुरुन्तै जवाफ दिनेछ, आवश्यक परे कर्मचारीले सम्पर्क गर्नेछ।',
    fallback: 'सन्देशको लागि धन्यवाद। हाम्रो कर्मचारीले हेरेर जवाफ दिनेछ।',
    handoff: '\n\n(हामीले कर्मचारीलाई पनि जानकारी दियौं। उहाँले यही LINE मा सम्पर्क गर्नुहुनेछ।)',
    aiNote: '* AI द्वारा स्वचालित जवाफ',
    quizInfo: '[विशिष्ट सीप २ (Tokutei Ginou 2) – खाद्य सेवा: अभ्यास प्रश्न]\nहाम्रो LINE का साथीहरूका लागि सीप परीक्षाको अभ्यास प्रश्न (फुरिगाना सहित जापानी भाषामा)।\n- अभ्यास (लिखित र व्यावहारिक)\n- वास्तविक परीक्षा जस्तै मोक टेस्ट (५५ प्रश्न, ७० मिनेट)\n- JLPT N3 अभ्यास र मोक टेस्ट (शब्द, व्याकरण, पढाइ र सुनाइ)\n\nशुल्क (टिकट; १ टिकट = २४ घण्टा असीमित प्रयोग)\n- ९ टिकट: ५५० येन\n- ३० टिकट: १,७६० येन\n- ६० टिकट: ३,३०० येन\n(कर सहित)\nपहिलो पटक प्रयोग गर्नेले एक पटक २४ घण्टा निःशुल्क प्रयोग गर्न सक्नुहुन्छ।\n\nतलको लिङ्क खोल्नुहोस्, वा मेनुको "Practice test" थिच्नुहोस्।\n{url}'
  }
};

// ステップ配信の本文（登録から 1日後 / 3日後 / 7日後）
var STEPS = {
  1: {
    ja: '【Job Change Japan の使い方】\n\n① 担当者とLINEや電話で面談\n② あなたに合う求人をご紹介\n③ 面接の準備・日程調整もお手伝い\n④ 内定後の在留資格の手続きもサポート\n\n求職者の方から手数料をいただくことは一切ありません。\n「紹介料を払って」と言われることもありませんので、安心してご相談ください。\n\n下のメニューの「求人を見る」で、いまの求人をチェックできます。',
    en: '[How Job Change Japan works]\n\n1. Talk with our staff on LINE or by phone\n2. We introduce jobs that suit you\n3. We help you prepare for interviews\n4. We support your visa procedures after you get an offer\n\nWe never charge job seekers any fee.\nNo one from us will ever ask you to pay an introduction fee.\n\nTap "Jobs" in the menu below to see current openings.',
    vi: '[Cách sử dụng Job Change Japan]\n\n1. Trao đổi với nhân viên qua LINE hoặc điện thoại\n2. Chúng tôi giới thiệu việc làm phù hợp\n3. Hỗ trợ chuẩn bị phỏng vấn\n4. Hỗ trợ thủ tục tư cách lưu trú sau khi có kết quả\n\nChúng tôi tuyệt đối không thu phí của người tìm việc.\nSẽ không có ai yêu cầu bạn trả phí giới thiệu.\n\nBấm "Jobs" ở menu bên dưới để xem việc làm hiện có.',
    ne: '[Job Change Japan कसरी प्रयोग गर्ने]\n\n१. LINE वा फोनमा हाम्रो कर्मचारीसँग कुरा गर्नुहोस्\n२. तपाईंलाई मिल्ने काम परिचय गराउँछौं\n३. अन्तर्वार्ताको तयारीमा सहयोग गर्छौं\n४. काम पक्का भएपछि भिसा प्रक्रियामा सहयोग गर्छौं\n\nहामी काम खोज्नेहरूबाट कुनै पनि शुल्क लिँदैनौं।\nपरिचय शुल्क तिर्न कसैले भन्ने छैन।\n\nतलको मेनुमा "Jobs" थिचेर अहिलेका कामहरू हेर्नुहोस्।'
  },
  3: {
    ja: '【転職するときの大切な注意】\n\n・会社を変えるときは、在留資格の手続きが必要になることがあります（特定技能の方は、新しい会社で働く前に「在留資格変更許可申請」が必要です）。\n・許可が出る前に新しい会社で働くと、不法就労になるおそれがあります。\n・在留カードの期限も確認しておきましょう。\n・高い手数料を求める業者には注意してください。\n\nあなたの場合はどうなるか、気になることがあれば「相談する」からお気軽にどうぞ。',
    en: '[Important when changing jobs]\n\n- When you change companies, you may need visa procedures. (Specified Skilled Workers must apply for a change of status of residence BEFORE working at the new company.)\n- Working at a new company before permission is granted may be illegal work.\n- Check the expiry date of your residence card.\n- Be careful of agents who ask for high fees.\n\nIf you want to know what applies to you, tap "Ask us" anytime.',
    vi: '[Lưu ý quan trọng khi chuyển việc]\n\n- Khi đổi công ty, có thể cần làm thủ tục tư cách lưu trú (người Kỹ năng đặc định phải xin "thay đổi tư cách lưu trú" TRƯỚC khi làm ở công ty mới).\n- Làm việc ở công ty mới trước khi được cấp phép có thể bị coi là lao động bất hợp pháp.\n- Hãy kiểm tra thời hạn thẻ lưu trú.\n- Cẩn thận với các bên đòi phí cao.\n\nNếu muốn biết trường hợp của bạn, hãy bấm "Ask us" bất cứ lúc nào.',
    ne: '[काम बदल्दा ध्यान दिनुपर्ने कुरा]\n\n- कम्पनी बदल्दा भिसा (在留資格) सम्बन्धी प्रक्रिया आवश्यक पर्न सक्छ (विशिष्ट सीप (Tokutei Ginou) भएकाले नयाँ कम्पनीमा काम सुरु गर्नु अघि "स्थिति परिवर्तन अनुमति" लिनुपर्छ)।\n- अनुमति नपाई नयाँ कम्पनीमा काम गरे गैरकानुनी काम हुन सक्छ।\n- आफ्नो रेसिडेन्स कार्डको म्याद जाँच गर्नुहोस्।\n- धेरै शुल्क माग्ने एजेन्टहरूबाट सावधान रहनुहोस्।\n\nतपाईंको अवस्थामा के हुन्छ जान्न "Ask us" थिच्नुहोस्।'
  },
  5: {
    ja: '【特定技能2号を目指す方へ】\n\n特定技能2号になると、在留期間の更新に上限がなくなり、条件を満たせば家族と一緒に暮らすこともできます。\n外食業で2号になるには、次の3つが必要です。\n・外食業特定技能2号技能測定試験の合格\n・日本語能力試験 N3以上の合格\n・アルバイトや後輩を指導しながら店舗管理を補助した経験（2年以上）\n\nJob Change Japan では、技能測定試験の練習問題を用意しました（ふりがな付き）。はじめての方は、1回だけ無料で24時間お試しできます。\n' + QUIZ_URL + '\n\nメニューの「練習問題」からも開けます。',
    en: '[For those aiming for Specified Skilled Worker (ii)]\n\nWith SSW (ii), there is no limit on renewing your period of stay, and if you meet the conditions you can live in Japan with your family.\nTo get SSW (ii) in the food service field, you need all three:\n- Pass the Food Service SSW (ii) skills test\n- Pass JLPT N3 or higher\n- 2+ years of experience supervising staff and assisting with store management\n\nJob Change Japan has prepared practice questions for the skills test (Japanese with furigana). First-time users can try them free for 24 hours, once.\n' + QUIZ_URL + '\n\nYou can also open it from "Practice test" in the menu.',
    vi: '[Dành cho bạn muốn lên Kỹ năng đặc định số 2]\n\nVới Kỹ năng đặc định số 2, bạn có thể gia hạn thời gian lưu trú không giới hạn, và nếu đủ điều kiện có thể sống cùng gia đình tại Nhật.\nĐể lên số 2 ngành dịch vụ ăn uống, cần đủ 3 điều kiện:\n- Đỗ kỳ thi kỹ năng số 2 ngành ăn uống\n- Đỗ JLPT N3 trở lên\n- Có từ 2 năm kinh nghiệm hướng dẫn nhân viên và hỗ trợ quản lý cửa hàng\n\nJob Change Japan đã chuẩn bị đề luyện thi kỹ năng. Lần đầu tiên được dùng thử miễn phí 24 giờ (tiếng Nhật có furigana).\n' + QUIZ_URL + '\n\nCũng có thể mở từ "Practice test" ở menu.',
    ne: '[विशिष्ट सीप २ (Tokutei Ginou 2) लक्ष्य राख्नेहरूका लागि]\n\nविशिष्ट सीप २ भएपछि बसाइ अवधि नवीकरणको सीमा हुँदैन, र सर्त पूरा गरे परिवारसँग जापानमा बस्न सकिन्छ।\nखाद्य सेवा (外食業) मा २ नम्बर पाउन यी ३ कुरा चाहिन्छ:\n- खाद्य सेवा विशिष्ट सीप २ को सीप परीक्षा पास\n- JLPT N3 वा माथि पास\n- कर्मचारीलाई सिकाउँदै पसल व्यवस्थापनमा सहयोग गरेको २ वर्षभन्दा बढी अनुभव\n\nJob Change Japan ले सीप परीक्षाको अभ्यास प्रश्न तयार गरेको छ। पहिलो पटक एक पटक २४ घण्टा निःशुल्क प्रयोग गर्न सकिन्छ (फुरिगाना सहित जापानी भाषामा)।\n' + QUIZ_URL + '\n\nमेनुको "Practice test" बाट पनि खोल्न सकिन्छ।'
  },
  7: {
    ja: '【いつでも相談できます】\n\n・希望の仕事や勤務地が変わったら、メニューの「登録」からいつでも更新できます。\n・わからないことは、このトークに送ってください。AIがすぐ答え、必要なときは担当者からご連絡します。\n・日本で仕事を探している友だちがいたら、このLINEを教えてあげてください。\n\nあなたの「次の仕事」を、一緒に見つけましょう。',
    en: '[You can ask us anytime]\n\n- If your preferred job or location changes, tap "Register" in the menu to update.\n- Send any question in this chat. Our AI answers right away, and our staff will follow up if needed.\n- If you have friends looking for work in Japan, please share this LINE with them.\n\nLet\'s find your next job together.',
    vi: '[Bạn có thể hỏi bất cứ lúc nào]\n\n- Nếu thay đổi mong muốn về công việc hoặc nơi làm, hãy bấm "Register" ở menu để cập nhật.\n- Gửi câu hỏi vào cuộc trò chuyện này. AI sẽ trả lời ngay, nhân viên sẽ liên lạc nếu cần.\n- Nếu có bạn bè đang tìm việc ở Nhật, hãy giới thiệu LINE này nhé.\n\nCùng nhau tìm công việc tiếp theo của bạn!',
    ne: '[जुनसुकै बेला सोध्न सक्नुहुन्छ]\n\n- चाहेको काम वा स्थान बदलियो भने मेनुको "Register" बाट अपडेट गर्नुहोस्।\n- कुनै प्रश्न भए यही च्याटमा पठाउनुहोस्। AI ले तुरुन्तै जवाफ दिन्छ, आवश्यक परे कर्मचारीले सम्पर्क गर्नेछ।\n- जापानमा काम खोजिरहेका साथीहरू भए यो LINE बताइदिनुहोस्।\n\nसँगै तपाईंको अर्को काम खोजौं।'
  }
};

// アルバイト登録の人には、3日後の配信をこちらに差し替える
var STEPS_BAITO = {
  3: {
    ja: '【留学生のアルバイト 大切なルール】\n\n・アルバイトをするには「資格外活動許可」が必要です。在留カードの裏面で確認できます。\n・働けるのは原則として週28時間まで。学校の長期休みの間は1日8時間までです。\n・アルバイトを掛け持ちする場合は、すべての合計で数えます。\n・風俗営業に関係するお店では働けません。\n・ルールを守らないと、在留資格の更新や、卒業後の就職に影響することがあります。\n\n気になることは「相談する」からお気軽にどうぞ。',
    en: '[Important rules for student part-time work]\n\n- You need "permission to engage in activities other than those permitted" (資格外活動許可). You can check it on the back of your residence card.\n- In principle, up to 28 hours a week. During long school holidays, up to 8 hours a day.\n- If you have more than one job, all hours are added together.\n- You cannot work at adult entertainment businesses (風俗営業).\n- Breaking these rules may affect your visa renewal or your job after graduation.\n\nIf you have questions, tap "Ask us" anytime.',
    vi: '[Quy định quan trọng khi du học sinh làm thêm]\n\n- Cần có "giấy phép hoạt động ngoài tư cách" (資格外活動許可). Có thể kiểm tra ở mặt sau thẻ lưu trú.\n- Về nguyên tắc tối đa 28 giờ/tuần. Trong kỳ nghỉ dài của trường tối đa 8 giờ/ngày.\n- Nếu làm nhiều nơi, tính tổng tất cả số giờ.\n- Không được làm ở các cơ sở kinh doanh giải trí người lớn (風俗営業).\n- Vi phạm có thể ảnh hưởng đến việc gia hạn tư cách lưu trú hoặc xin việc sau khi tốt nghiệp.\n\nCó thắc mắc, hãy bấm "Ask us" bất cứ lúc nào.',
    ne: '[विद्यार्थीको पार्ट-टाइम: महत्वपूर्ण नियम]\n\n- पार्ट-टाइम गर्न "資格外活動許可" (अनुमति) चाहिन्छ। रेसिडेन्स कार्डको पछाडि हेर्न सकिन्छ।\n- सामान्यतया हप्तामा २८ घण्टासम्म। स्कूलको लामो बिदामा दिनको ८ घण्टासम्म।\n- धेरै ठाउँमा काम गरे सबैको घण्टा जोडिन्छ।\n- वयस्क मनोरञ्जन व्यवसाय (風俗営業) मा काम गर्न पाइँदैन।\n- नियम नमाने भिसा नवीकरण वा पढाइ सकेपछिको काममा असर पर्न सक्छ।\n\nप्रश्न भए "Ask us" थिच्नुहोस्।'
  }
};

// 文字で送られたときに受け付ける言葉
var KW_REGISTER = ['登録', 'register', 'đăng ký', 'dang ky', 'दर्ता', 'start'];
var KW_LANG = ['言語', 'language', 'ngôn ngữ', 'भाषा', 'lang'];
var KW_JOBS = ['求人', 'jobs', 'job', 'việc làm', 'काम'];
var KW_QUIZ = ['練習問題', '練習', '模擬テスト', '試験', 'テスト', '2号', '特定技能2号', 'test', 'exam', 'quiz', 'practice', 'practice test', 'mock test', 'n3', 'jlpt', '日本語能力試験', '日本語', 'luyện thi', 'thi thử', 'đề thi', 'परीक्षा', 'अभ्यास'];
var RE_APPLY = /^(応募|apply|ứng tuyển|आवेदन)\s*[:：]?\s*(\S+)/i;

// アルバイト（留学生）コース用の文言
var T_BAITO = {
  ja: {
    q0: 'どんな働き方を探していますか？',
    b2: '資格外活動許可（アルバイトをするための許可）はありますか？',
    b5: '1週間に何時間くらい働きたいですか？',
    baitoRule: '\n\n※留学生のアルバイトには「資格外活動許可」が必要です。働ける時間は原則として週28時間まで（学校の長期休みの間は1日8時間まで）で、アルバイトを掛け持ちする場合は合計で数えます。',
    noPermit: '資格外活動許可がまだの場合は、アルバイトを始める前に出入国在留管理局での申請が必要です。許可が出るまでは働けませんのでご注意ください。わからないことは「相談する」からどうぞ。'
  },
  en: {
    q0: 'What kind of work are you looking for?',
    b2: 'Do you have permission to work part-time (資格外活動許可)?',
    b5: 'How many hours a week do you want to work?',
    baitoRule: '\n\n* International students need "permission to engage in activities other than those permitted" (資格外活動許可) to work part-time. In principle you can work up to 28 hours a week (up to 8 hours a day during long school holidays). If you have more than one part-time job, the hours are added together.',
    noPermit: 'If you do not have the permission yet, you must apply at the Immigration Services Bureau before starting a part-time job. You cannot work until it is granted. If you have questions, tap "Ask us".'
  },
  vi: {
    q0: 'Bạn đang tìm hình thức làm việc nào?',
    b2: 'Bạn đã có giấy phép hoạt động ngoài tư cách (資格外活動許可) để làm thêm chưa?',
    b5: 'Bạn muốn làm khoảng bao nhiêu giờ mỗi tuần?',
    baitoRule: '\n\n* Du học sinh cần có "giấy phép hoạt động ngoài tư cách" (資格外活動許可) để làm thêm. Về nguyên tắc chỉ được làm tối đa 28 giờ/tuần (trong kỳ nghỉ dài của trường là tối đa 8 giờ/ngày). Nếu làm nhiều nơi thì tính tổng số giờ.',
    noPermit: 'Nếu chưa có giấy phép, bạn phải xin tại Cục Quản lý Xuất nhập cảnh trước khi bắt đầu làm thêm. Chưa được cấp phép thì chưa được làm. Có thắc mắc, hãy bấm "Ask us".'
  },
  ne: {
    q0: 'तपाईं कस्तो किसिमको काम खोज्दै हुनुहुन्छ?',
    b2: 'पार्ट-टाइम काम गर्ने अनुमति (資格外活動許可) छ?',
    b5: 'हप्तामा कति घण्टा काम गर्न चाहनुहुन्छ?',
    baitoRule: '\n\n* विद्यार्थीलाई पार्ट-टाइम काम गर्न "資格外活動許可" (अनुमति) चाहिन्छ। सामान्यतया हप्तामा २८ घण्टासम्म मात्र काम गर्न पाइन्छ (स्कूलको लामो बिदामा दिनको ८ घण्टासम्म)। धेरै ठाउँमा काम गरे सबैको घण्टा जोडिन्छ।',
    noPermit: 'अनुमति छैन भने पार्ट-टाइम सुरु गर्नु अघि इमिग्रेसन कार्यालयमा आवेदन दिनुपर्छ। अनुमति नपाएसम्म काम गर्न पाइँदैन। प्रश्न भए "Ask us" थिच्नुहोस्।'
  }
};
Object.keys(T_BAITO).forEach(function (l) { Object.keys(T_BAITO[l]).forEach(function (k) { T[l][k] = T_BAITO[l][k]; }); });

// 日本語・英語を選んだ人には、日英併記の文章を使う
function bi_(a, b, short) {
  if (a === b) return a;
  if (short) return a + '\n' + b;
  return a + '\n\n― English ―\n' + b;
}
var SHORT_KEYS = ['chooseLang', 'startBtn', 'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'b2', 'b5', 'other', 'none', 'nameRetry', 'jobsHead', 'newJob', 'applyHint', 'aiNote', 'updated'];
T.jaen = {};
Object.keys(T.ja).forEach(function (k) {
  var a = T.ja[k], b = T.en[k];
  if (k === 'jobFields') { T.jaen[k] = { role: '職種 / Job type', loc: '勤務地 / Location', pay: '給与 / Salary', type: '雇用形態 / Employment' }; return; }
  if (k === 'chooseLang') { T.jaen[k] = a; return; }
  if (k === 'startBtn') { T.jaen[k] = '登録 / Register'; return; }
  if (k === 'other') { T.jaen[k] = 'その他 / Other'; return; }
  if (k === 'none') { T.jaen[k] = 'なし / None'; return; }
  if (k === 'newJob') { T.jaen[k] = '【新着求人 / New job】'; return; }
  if (k === 'baitoRule' || k === 'handoff') { T.jaen[k] = a + '\n' + b.replace(/^\n+/, ''); return; }
  T.jaen[k] = bi_(a, b, SHORT_KEYS.indexOf(k) >= 0);
});
// 文章を選ぶ：日本語・英語 → 日英併記、それ以外 → その言語
function tk_(lang) { return (!lang || lang === 'ja' || lang === 'en') ? 'jaen' : lang; }
function TL_(lang) { return T[tk_(lang)]; }
function fmt_(s, o) { Object.keys(o).forEach(function (k) { s = String(s).split('{' + k + '}').join(o[k]); }); return s; }

// 登録コースごとの質問の順番（最後に名前を聞く）
var FLOW_FULL = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'];
var FLOW_BAITO = ['q0', 'q1', 'b2', 'q3', 'q4', 'b5'];

// 質問（v はスプレッドシートに保存する日本語の値）
var Q = {
  q0: { key: 'type', opts: [
    ['正社員・フルタイム', { jaen: 'フルタイム/Full-time', ja: '正社員・フルタイム', en: 'Full-time job', vi: 'Việc toàn thời gian', ne: 'पूर्णकालीन काम' }],
    ['アルバイト', { jaen: 'アルバイト(留学生)/Part-time', ja: 'アルバイト（留学生）', en: 'Part-time (student)', vi: 'Làm thêm (du học sinh)', ne: 'पार्ट-टाइम (विद्यार्थी)' }]
  ]},
  b2: { key: 'permit', opts: [
    ['あり', { ja: 'あり', en: 'Yes', vi: 'Có', ne: 'छ' }],
    ['申請中', { ja: '申請中', en: 'Applying', vi: 'Đang xin', ne: 'आवेदन गर्दै' }],
    ['なし・わからない', { jaen: 'なし・不明 / No, Not sure', ja: 'なし・わからない', en: 'No / Not sure', vi: 'Chưa / Không rõ', ne: 'छैन / थाहा छैन' }]
  ]},
  b5: { key: 'hours', opts: [
    ['週10時間まで', { ja: '週10時間まで', en: 'Up to 10 h', vi: 'Tối đa 10 giờ', ne: '१० घण्टासम्म' }],
    ['週10〜20時間', { ja: '週10〜20時間', en: '10–20 h', vi: '10–20 giờ', ne: '१०–२० घण्टा' }],
    ['週20〜28時間', { ja: '週20〜28時間', en: '20–28 h', vi: '20–28 giờ', ne: '२०–२८ घण्टा' }]
  ]},
  q1: { key: 'role', opts: [
    ['外食業', { ja: '飲食店・外食', en: 'Restaurant', vi: 'Nhà hàng', ne: 'रेस्टुरेन्ट' }],
    ['食品製造', { ja: '食品製造', en: 'Food factory', vi: 'Chế biến thực phẩm', ne: 'खाद्य उत्पादन' }],
    ['ホテル・宿泊', { ja: 'ホテル・宿泊', en: 'Hotel', vi: 'Khách sạn', ne: 'होटल' }],
    ['介護・医療', { ja: '介護・医療', en: 'Caregiving', vi: 'Điều dưỡng', ne: 'हेरचाह' }],
    ['製造業', { ja: '工場・製造', en: 'Factory', vi: 'Nhà máy', ne: 'कारखाना' }],
    ['物流・倉庫', { ja: '物流・倉庫', en: 'Logistics', vi: 'Kho vận', ne: 'गोदाम' }],
    ['建設・土木', { ja: '建設', en: 'Construction', vi: 'Xây dựng', ne: 'निर्माण' }],
    ['販売・小売', { ja: '販売・小売', en: 'Retail', vi: 'Bán hàng', ne: 'बिक्री' }],
    ['IT・テクノロジー', { ja: 'IT', en: 'IT', vi: 'IT', ne: 'IT' }],
    ['その他', 'other']
  ]},
  q2: { key: 'visa', opts: [
    ['特定技能1号', { ja: '特定技能1号', en: 'SSW (i)', vi: 'Tokutei Ginou 1', ne: 'Tokutei Ginou 1' }],
    ['技能実習', { jaen: '技能実習 / Intern', ja: '技能実習', en: 'Technical Intern', vi: 'Thực tập sinh', ne: 'Ginou Jisshu' }],
    ['留学', { ja: '留学', en: 'Student', vi: 'Du học sinh', ne: 'विद्यार्थी' }],
    ['技術・人文知識・国際業務', { jaen: '技人国 / Engineer', ja: '技人国', en: 'Engineer/Humanities', vi: 'Gijinkoku', ne: 'Gijinkoku' }],
    ['永住者・配偶者等', { jaen: '永住・配偶者等/PR, Spouse', ja: '永住・配偶者など', en: 'PR / Spouse', vi: 'Vĩnh trú/Vợ chồng', ne: 'स्थायी / जीवनसाथी' }],
    ['海外在住', { jaen: 'いま海外 / Abroad', ja: 'いま海外にいる', en: 'Living abroad', vi: 'Đang ở nước ngoài', ne: 'जापान बाहिर' }],
    ['その他', 'other']
  ]},
  q3: { key: 'jp', opts: [
    ['N1', 'N1'], ['N2', 'N2'], ['N3', 'N3'], ['N4', 'N4'], ['N5', 'N5'], ['JFT-Basic', 'JFT-Basic'], ['資格なし', 'none']
  ]},
  q4: { key: 'location', opts: [
    ['大阪府', { ja: '大阪', en: 'Osaka', vi: 'Osaka', ne: 'ओसाका' }],
    ['関西（大阪以外）', { jaen: '関西(大阪以外)/Kansai', ja: '関西（大阪以外）', en: 'Kansai', vi: 'Kansai', ne: 'कान्साई' }],
    ['関東', { jaen: '関東・東京 / Kanto', ja: '関東（東京など）', en: 'Kanto (Tokyo)', vi: 'Kanto (Tokyo)', ne: 'कान्तो (टोकियो)' }],
    ['中部・東海', { jaen: '中部・東海 / Chubu', ja: '中部・東海', en: 'Chubu (Nagoya)', vi: 'Chubu (Nagoya)', ne: 'चुबु (नागोया)' }],
    ['全国', { ja: 'どこでもOK', en: 'Anywhere', vi: 'Ở đâu cũng được', ne: 'जहाँ पनि' }],
    ['その他', 'other']
  ]},
  q5: { key: 'start', opts: [
    ['すぐに働ける', { ja: 'すぐに', en: 'Right away', vi: 'Ngay lập tức', ne: 'तुरुन्तै' }],
    ['1ヶ月以内', { jaen: '1ヶ月以内 / 1 month', ja: '1ヶ月以内', en: 'Within 1 month', vi: 'Trong 1 tháng', ne: '१ महिनाभित्र' }],
    ['3ヶ月以内', { jaen: '3ヶ月以内 / 3 months', ja: '3ヶ月以内', en: 'Within 3 months', vi: 'Trong 3 tháng', ne: '३ महिनाभित्र' }],
    ['未定', { jaen: '未定 / Not decided', ja: 'まだ決めていない', en: 'Not decided', vi: 'Chưa quyết định', ne: 'निश्चित छैन' }]
  ]}
};

// シートの列（名前で探すので、列の順番を入れ替えても動きます）
var REG_SHEET = 'LINE登録';
var REG_HEADERS = ['登録日時', '受付ID', 'LINE userId', 'LINE表示名', '言語', 'お名前', '希望職種', '在留資格', '日本語', '希望勤務地', '就業開始', '対応状況', 'メモ', 'ステップ送信済', 'ブロック', '最終更新', '雇用形態', '資格外活動許可', '週の勤務時間'];
var JOB_SHEET = '求人';
var JOB_HEADERS = ['求人ID', '公開', '職種', '勤務地', 'タイトル', '給与', '内容', '詳細URL', '配信日時', '配信人数', '応募数', '雇用形態'];

// ============================================================
// Webhook
// ============================================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.api) return quizApi_(body);   // 練習問題ページ（Quiz.gs）からの呼び出し
    (body.events || []).forEach(function (ev) {
      try { handleEvent_(ev); } catch (err) { console.error(err && err.stack || err); }
    });
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Job Change Japan LINE bot is running.');
}

var CUR_UID_ = null;
function handleEvent_(ev) {
  var uid = ev.source && ev.source.userId;
  if (!uid) return;
  CUR_UID_ = uid;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { console.error('lock timeout'); }
  try { handleEventLocked_(ev, uid); } finally { try { lock.releaseLock(); } catch (e) {} }
}

function handleEventLocked_(ev, uid) {
  var st = getState_(uid);
  if (!st.lang && ev.type !== 'follow') {  // 会話の記録がない人は、シートの言語を使う
    var known = findReg_(uid);
    if (known && known['言語']) { st.lang = langCode_(known['言語']); st.registeredId = known['受付ID']; setState_(uid, st); }
  }
  var L = TL_(st.lang);

  if (ev.type === 'follow') {
    setRegField_(uid, 'ブロック', '');
    reply_(ev.replyToken, [text_(T.jaen.welcome), langMenu_()]);
    return;
  }
  if (ev.type === 'unfollow') { setRegField_(uid, 'ブロック', '○'); return; }

  if (ev.type === 'postback') {
    var p = parseQs_(ev.postback.data);
    if (p.lang && T[p.lang]) {
      st.lang = p.lang; setState_(uid, st);
      setRegField_(uid, '言語', langLabel_(p.lang));
      L = TL_(st.lang);
      if (st.registeredId) reply_(ev.replyToken, [text_('OK: ' + langLabel_(p.lang))]);
      else reply_(ev.replyToken, [quick_(L.intro, [[L.startBtn, 'go=1']])]);
      return;
    }
    if (p.menu === 'register' || p.go) { startFlow_(ev.replyToken, uid, st); return; }
    if (p.menu === 'lang') { reply_(ev.replyToken, [langMenu_()]); return; }
    if (p.menu === 'jobs') { replyJobs_(ev.replyToken, uid, st); return; }
    if (p.menu === 'ask') { reply_(ev.replyToken, [text_(L.askPrompt)]); return; }
    if (p.q && Q[p.q]) {
      var q = Q[p.q], opt = q.opts[+p.i];
      if (!opt) return;
      // 登録中でないとき（古いボタンを押した等）は、登録を最初から始める
      if (!st.step || st.step === 'done') { startFlow_(ev.replyToken, uid, st); return; }
      st.ans = st.ans || {};
      st.ans[q.key] = opt[0];
      if (p.q === 'q0') st.flow = opt[0] === 'アルバイト' ? 'baito' : 'full';
      // まだ答えていない最初の質問へ進む（ボタンを押す順番がずれても止まらない）
      var seq = flow_(st);
      st.step = seq.filter(function (k) { return !st.ans[Q[k].key]; })[0] || 'name';
      setState_(uid, st);
      var out = [];
      if (p.q === 'b2' && opt[0] === 'なし・わからない') out.push(text_(L.noPermit));
      out.push(st.step === 'name' ? text_(stepNo_(st, 'name') + L.q6) : question_(st.step, st.lang, st));
      reply_(ev.replyToken, out);
    }
    return;
  }

  if (ev.type === 'message' && ev.message.type === 'text') {
    var msg = String(ev.message.text || '').trim();
    var low = msg.toLowerCase();

    if (KW_LANG.indexOf(low) >= 0) { reply_(ev.replyToken, [langMenu_()]); return; }
    if (KW_REGISTER.indexOf(low) >= 0) { startFlow_(ev.replyToken, uid, st); return; }
    if (KW_JOBS.indexOf(low) >= 0) { replyJobs_(ev.replyToken, uid, st); return; }
    if (KW_QUIZ.indexOf(low) >= 0) { reply_(ev.replyToken, [text_(fmt_(L.quizInfo, { url: QUIZ_URL }))]); return; }

    if (st.step === 'name') {
      if (!/[A-Za-z]/.test(msg) || msg.length > 60) { reply_(ev.replyToken, [text_(L.nameRetry)]); return; }
      var res = saveRegistration_(uid, st, msg);
      st.step = 'done'; st.ans = {}; st.registeredId = res.id; setState_(uid, st);
      var tpl = (res.isNew ? L.done : L.updated) + (res.baito ? L.baitoRule : '');
      reply_(ev.replyToken, [text_(fmt_(tpl, { name: msg, id: res.id }))]);
      return;
    }
    if (st.step && Q[st.step]) { reply_(ev.replyToken, [question_(st.step, st.lang, st)]); return; }

    var m = msg.match(RE_APPLY);
    if (m) { handleApply_(ev.replyToken, uid, st, m[2]); return; }

    handleQuestion_(ev.replyToken, uid, st, msg);
  }
}

function startFlow_(token, uid, st) {
  if (!st.lang) { reply_(token, [langMenu_()]); return; }
  st.step = 'q0'; st.ans = {}; st.flow = ''; setState_(uid, st);
  reply_(token, [question_('q0', st.lang, st)]);
}

function flow_(st) { return st.flow === 'baito' ? FLOW_BAITO : FLOW_FULL; }
// 「2/7 」のような番号（全体 = 質問の数 + 名前）
function stepNo_(st, qid) {
  var seq = flow_(st), n = qid === 'name' ? seq.length + 1 : seq.indexOf(qid) + 1;
  return n > 0 ? n + '/' + (seq.length + 1) + ' ' : '';
}

// ============================================================
// 求人（「求人を見る」・応募）
// ============================================================
function replyJobs_(token, uid, st) {
  var L = TL_(st.lang);
  var rows = findRegs_(uid);
  if (!rows.length) { reply_(token, [quick_(L.needRegister, [[L.startBtn, 'menu=register']])]); return; }
  var jobs = openJobs_().filter(function (j) { return rows.some(function (u) { return jobMatches_(j, u); }); }).slice(0, 4);
  if (!jobs.length) { reply_(token, [text_(L.noJobs)]); return; }
  var msgs = [text_(fmt_(L.jobsHead, { n: jobs.length }))];
  jobs.forEach(function (j) { msgs.push(text_(jobText_(j, st.lang || 'ja', false))); });
  reply_(token, msgs);
}

function handleApply_(token, uid, st, jobId) {
  var L = TL_(st.lang);
  var job = openJobs_().filter(function (j) { return String(j['求人ID']).toLowerCase() === jobId.toLowerCase(); })[0];
  var user = findRegs_(uid);
  if (job) bumpJobCount_(job._row, '応募数');
  reply_(token, [text_(fmt_(L.applied, { id: jobId }))]);
  notifyMail_('【Job Change Japan LINE】応募：' + (user.length ? user[0]['お名前'] : uid) + ' → ' + jobId,
    '求人: ' + (job ? job['タイトル'] : '（該当なし: ' + jobId + '）') + '\n' + userSummary_(uid, user) +
    '\n\n※返信はLINE公式アカウントのチャット画面から行ってください。');
}

function openJobs_() {
  var sh = jobSheet_();
  var rows = sheetObjects_(sh);
  // 求人IDが空欄の行には、J001, J002 … を自動で振る
  var max = 0;
  rows.forEach(function (r) { var m = String(r['求人ID']).match(/^J(\d+)$/i); if (m) max = Math.max(max, +m[1]); });
  var idCol = colIndex_(sh, '求人ID');
  rows.forEach(function (r) {
    if (!r['求人ID'] && (r['タイトル'] || r['職種'])) {
      r['求人ID'] = 'J' + ('00' + (++max)).slice(-3);
      sh.getRange(r._row, idCol).setValue(r['求人ID']);
    }
    if (!r['タイトル'] && r['職種']) r['タイトル'] = r['職種'] + '（' + (r['勤務地'] || '') + '）';
  });
  return rows.filter(function (r) { return r['求人ID'] && String(r['公開']).trim() !== '×' && r['タイトル']; });
}

// 表記ゆれをそろえる（「大阪」「大阪府」、「飲食店・外食」「外食業」など）
function norm_(s, qid) {
  s = String(s == null ? '' : s).replace(/[\s　]/g, '');
  if (!s) return '';
  var hit = Q[qid].opts.filter(function (o) {
    var ja = typeof o[1] === 'object' ? o[1].ja : o[1];
    return s === o[0] || s === String(ja).replace(/[\s　]/g, '');
  })[0];
  if (hit) s = hit[0];
  return s.replace(/(府|県|都)$/, '').replace(/^全国.*$/, '全国');
}

function jobMatches_(job, user) {
  var jr = norm_(job['職種'], 'q1'), jl = norm_(job['勤務地'], 'q4');
  var ur = norm_(user['希望職種'], 'q1'), ul = norm_(user['希望勤務地'], 'q4');
  var roleOk = !jr || jr === ur || ur === 'その他';
  var locOk = !jl || jl === '全国' || jl === ul || ul === '全国' || ul === 'その他';
  // 雇用形態：求人が「アルバイト」ならアルバイト希望者だけ、「正社員・フルタイム」ならそれ以外の人に
  var jt = String(job['雇用形態'] || '').trim(), ut = String(user['雇用形態'] || '').trim() || '正社員・フルタイム';
  var typeOk = !jt || jt === 'どちらも' || jt === ut;
  return roleOk && locOk && typeOk;
}

function jobText_(j, lang, isNew) {
  var L = TL_(lang), f = L.jobFields, tl = tk_(lang);
  // 日英併記のときは「日本語 / 英訳」、それ以外はその言語に翻訳
  var t = function (s, long) {
    s = String(s == null ? '' : s);
    if (!s) return s;
    if (tl !== 'jaen') return tr_(s, tl);
    var e = tr_(s, 'en');
    return e === s ? s : s + (long ? '\n' : ' / ') + e;
  };
  var body = [
    (isNew ? L.newJob + ' ' : '') + t(j['タイトル']),
    '',
    jobType_(j, lang, f),
    f.role + ': ' + t(j['職種']),
    f.loc + ': ' + t(j['勤務地']),
    j['給与'] ? f.pay + ': ' + t(j['給与']) : '',
    j['内容'] ? '\n' + t(j['内容'], true) : '',
    j['詳細URL'] ? '\n' + j['詳細URL'] : '',
    '',
    fmt_(L.applyHint, { id: j['求人ID'] })
  ];
  return body.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 4900);
}

// 雇用形態の行（アルバイト / Part-time など）。空欄・どちらもの求人は表示しない
var TYPE_LABEL = {
  'アルバイト': { ja: 'アルバイト', en: 'Part-time', vi: 'Làm thêm (part-time)', ne: 'पार्ट-टाइम' },
  '正社員・フルタイム': { ja: '正社員・フルタイム', en: 'Full-time', vi: 'Toàn thời gian', ne: 'पूर्णकालीन' }
};
function jobType_(j, lang, f) {
  var l = TYPE_LABEL[String(j['雇用形態'] || '').trim()];
  if (!l) return '';
  var tl = tk_(lang), v = tl === 'jaen' ? l.ja + ' / ' + l.en : (l[tl] || l.ja);
  return f.type + ': ' + v;
}

var TR_CACHE_ = {};
function tr_(s, lang) {
  s = String(s == null ? '' : s);
  if (!s || lang === 'ja') return s;
  var k = lang + '|' + s;
  if (TR_CACHE_[k]) return TR_CACHE_[k];
  try { TR_CACHE_[k] = LanguageApp.translate(s, 'ja', lang); } catch (e) { TR_CACHE_[k] = s; }
  return TR_CACHE_[k];
}

// ============================================================
// AI自動応答
// ============================================================
var AI_SYSTEM = [
  'あなたは「Job Change Japan」（運営：株式会社Fairly connecting、大阪、有料職業紹介事業 許可番号 27-ユ-304918）の公式LINEの案内係です。',
  '日本で働きたい外国人の求職者からの質問に答えます。',
  '',
  '# 会社について',
  '- 外国人の転職・就職を支援する人材紹介会社。代表は現役のCoCo壱番屋フランチャイズオーナー。',
  '- 求職者から手数料を取ることは一切ない（無料）。紹介料を求めることもない。',
  '- 飲食（外食業）・食品製造・ホテル・介護・製造・物流などの求人を扱う。特に関西（大阪）が中心。',
  '- グループ会社の株式会社Solaeは登録支援機関で、特定技能の方の生活支援も行う。',
  '- 担当者はこのLINEで連絡する。面談はLINE・電話で可能。',
  '',
  '# 答え方のルール',
  '- 相手と同じ言語で答える（日本語・英語・ベトナム語・ネパール語など）。やさしい言葉で、LINEで読みやすい短さ（300字程度まで）にする。',
  '- 一般的な情報（在留資格の種類、転職の一般的な流れ、日本語試験、当社の使い方）は答えてよい。',
  '- 個別のビザ判断（「私は転職できますか」「許可されますか」など）は断定せず、一般論を伝えたうえで担当者が確認すると伝える。',
  '- 求人の有無・給料・内定を約束しない。具体的な求人はメニューの「求人を見る」を案内する。',
  '- わからないことは推測で答えず、担当者が確認すると伝える。',
  '- 次のどれかに当てはまる場合は、回答の最後に必ず [ESCALATE] とだけ書いた行を付ける：',
  '  応募したい／面談したい／担当者と話したい、個別のビザ・在留期限の相談、トラブルや苦情、緊急の内容、あなたが答えられない内容。',
  '',
  '# 留学生のアルバイトについて（一般的なルール）',
  '- アルバイトには資格外活動許可が必要。原則として週28時間以内、学校の長期休業中は1日8時間以内。掛け持ちは合計で数える。',
  '- 風俗営業に関係する仕事はできない。許可が出る前に働くことはできない。個別の判断は担当者が確認すると伝える。',
  '',
  '# 特定技能2号 外食業の練習問題（当社が提供）',
  '- 公式LINEの友だちは、外食業特定技能2号技能測定試験の練習問題を使える（学科・実技、ふりがな付き）。料金は回数券9回分550円・30回分1,760円・60回分3,300円（税込。税抜は500円・1,600円・3,000円）、1回分で24時間、練習も模擬テスト（本番と同じ55問・70分）もすべて使い放題。はじめての人は1回だけ無料で24時間お試しできる。日本語能力試験N3（文字・語彙・文法・読解・聴解）の練習問題もある（N3の模擬テストは「文字・語彙」35問・30分、「文法・読解」39問・70分、「聴解」28問・40分。回数券は共通。聴解の音声は合成音声）。練習問題の利用は職業紹介とは関係なく、買わなくても紹介で不利にならない。',
  '- 試験・2号・練習問題について聞かれたら、このリンクを案内する（メニューの「練習問題」からも開ける）: ' + QUIZ_URL,
  '- 外食業で2号になるには、技能測定試験の合格に加えて、日本語能力試験N3以上の合格と、2年以上の指導等の実務経験（店舗管理の補助）が必要。',
  '- 練習問題は当社のオリジナル問題で、実際の試験問題ではない。模擬テストの購入方法は準備中なので、聞かれたら担当者が案内すると伝える。'
].join('\n');

function handleQuestion_(token, uid, st, msg) {
  var L = TL_(st.lang);
  var user = findRegs_(uid);
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  var answer = null, escalate = true;

  if (key) {
    try {
      var hist = (st.hist || []).slice(-6);
      var ctx = user.length ? '\n\n# この人の登録内容\n' + userSummary_(uid, user) : '\n\n# この人はまだ未登録（メニューの「登録」を案内してよい）';
      if (tk_(st.lang) === 'jaen') ctx += '\n\n# 回答の言語\nこの人には、日本語と英語を併記して答える（日本語の段落のあとに英語の段落）。';
      var out = callClaude_(key, AI_SYSTEM + ctx, hist.concat([{ role: 'user', content: msg }]));
      escalate = /\[ESCALATE\]/.test(out);
      answer = out.replace(/\[ESCALATE\]/g, '').trim();
      st.hist = hist.concat([{ role: 'user', content: msg }, { role: 'assistant', content: answer }]).slice(-6);
      setState_(uid, st);
    } catch (e) {
      console.error(e);
      answer = null; escalate = true;
    }
  }

  var text = answer ? answer + '\n\n' + L.aiNote + (escalate ? L.handoff : '') : L.fallback;
  reply_(token, [text_(text.slice(0, 4900))]);

  if (escalate) {
    notifyMail_('【Job Change Japan LINE】' + (answer ? '担当者対応が必要な相談' : 'メッセージ受信') + '：' + (user.length ? user[0]['お名前'] : '未登録'),
      '受信メッセージ:\n' + msg + '\n\n' + (answer ? 'AIの回答:\n' + answer + '\n\n' : '') + userSummary_(uid, user) +
      '\n\n※返信はLINE公式アカウントのチャット画面から行ってください。');
  }
}

function callClaude_(key, system, messages) {
  var model = PropertiesService.getScriptProperties().getProperty('AI_MODEL') || 'claude-haiku-5-5';
  var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 700, system: system, messages: messages })
  });
  var j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error('Claude API ' + r.getResponseCode() + ': ' + r.getContentText());
  return (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
}

// ============================================================
// 毎日の自動実行：ステップ配信 ＋ 新着求人の配信
// ============================================================
function runDaily() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = sendSteps_();
    var j = sendNewJobs_();
    console.log('ステップ配信: ' + s + '件 / 求人配信: ' + j + '件');
  } finally {
    lock.releaseLock();
  }
}

function sendSteps_() {
  var sh = regSheet_(), rows = sheetObjects_(sh), sent = 0;
  var today = dayNum_(new Date());
  var col = colIndex_(sh, 'ステップ送信済');
  var sentTo = {};   // 同じ人に同じ内容（1日後・7日後）を二重に送らない
  rows.forEach(function (r) {
    String(r['ステップ送信済'] || '').split(',').filter(String).forEach(function (d) { sentTo[r['LINE userId'] + '|' + d] = 1; });
  });
  rows.forEach(function (r) {
    if (!r['LINE userId'] || r['ブロック'] === '○' || !(r['登録日時'] instanceof Date)) return;
    var days = today - dayNum_(r['登録日時']);
    var done = String(r['ステップ送信済'] || '').split(',').filter(String);
    var due = STEP_DAYS.filter(function (d) { return days >= d && days <= d + 2 && done.indexOf(String(d)) < 0; });
    if (!due.length) return;
    var d = due[due.length - 1];  // 遅れて複数たまっていても、送るのは最新の1通だけ
    var lang = langCode_(r['言語']);
    var baitoMsg = r['雇用形態'] === 'アルバイト' && STEPS_BAITO[d];
    var set = baitoMsg ? STEPS_BAITO[d] : STEPS[d];
    var dupKey = r['LINE userId'] + '|' + d + (baitoMsg ? 'b' : '');
    if (!baitoMsg && sentTo[r['LINE userId'] + '|' + d]) {   // 別の行ですでに送った
      STEP_DAYS.forEach(function (x) { if (x <= d && done.indexOf(String(x)) < 0) done.push(String(x)); });
      sh.getRange(r._row, col).setValue(done.join(','));
      return;
    }
    var body = tk_(lang) === 'jaen' ? set.ja + '\n\n― English ―\n' + set.en : (set[lang] || set.ja);
    if (push_(r['LINE userId'], [text_(body)])) {
      STEP_DAYS.forEach(function (x) { if (x <= d && done.indexOf(String(x)) < 0) done.push(String(x)); });
      sh.getRange(r._row, col).setValue(done.join(','));
      sentTo[r['LINE userId'] + '|' + d] = 1; sentTo[dupKey] = 1;
      sent++;
    }
  });
  return sent;
}

// dryRun = true のときは送らずに、配信予定（求人ごとの人数）だけ返す
function sendNewJobs_(dryRun) {
  var jsh = jobSheet_(), jobs = openJobs_().filter(function (j) { return !j['配信日時']; });
  var plan = [];
  if (!jobs.length) return dryRun ? plan : 0;
  var users = sheetObjects_(regSheet_()).filter(function (u) { return u['LINE userId'] && u['ブロック'] !== '○'; });
  var total = 0;
  jobs.forEach(function (job) {
    var byLang = {}, seen = {};
    users.filter(function (u) { return jobMatches_(job, u); }).forEach(function (u) {
      if (seen[u['LINE userId']]) return;   // 同じ人には1回だけ
      seen[u['LINE userId']] = 1;
      var lg = langCode_(u['言語']); (byLang[lg] = byLang[lg] || []).push(u['LINE userId']);
    });
    if (dryRun) { plan.push({ id: job['求人ID'], title: job['タイトル'], n: Object.keys(seen).length }); return; }
    var n = 0;
    Object.keys(byLang).forEach(function (lg) {
      var ids = byLang[lg];
      for (var i = 0; i < ids.length; i += 500) {
        if (multicast_(ids.slice(i, i + 500), [text_(jobText_(job, lg, true))])) n += Math.min(500, ids.length - i);
      }
    });
    jsh.getRange(job._row, colIndex_(jsh, '配信日時')).setValue(new Date());
    jsh.getRange(job._row, colIndex_(jsh, '配信人数')).setValue(n);
    total += n;
  });
  return dryRun ? plan : total;
}

// ============================================================
// スプレッドシートのメニュー「LINE配信」
// ============================================================
function onSheetOpen() {
  SpreadsheetApp.getUi().createMenu('LINE配信')
    .addItem('新着求人を今すぐ送る', 'menuSendJobsNow')
    .addItem('配信予定を確認する（送りません）', 'menuPreviewJobs')
    .addSeparator()
    .addItem('回数券：選んだ行の人に付与（9・30・60回分）', 'menuGiveMockCredits')
    .addItem('練習問題の案内を登録者に送る（1回だけ）', 'menuAnnounceQuiz')
    .addToUi();
}

function previewText_(plan) {
  return plan.map(function (p) { return '・' + p.id + ' ' + p.title + ' → ' + p.n + '人'; }).join('\n');
}

function menuPreviewJobs() {
  var ui = SpreadsheetApp.getUi(), plan = sendNewJobs_(true);
  ui.alert('配信予定', plan.length ? 'まだ配信していない求人：\n\n' + previewText_(plan) : 'まだ配信していない求人はありません。', ui.ButtonSet.OK);
}

function menuSendJobsNow() {
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var plan = sendNewJobs_(true);
    if (!plan.length) { ui.alert('新着求人', 'まだ配信していない求人はありません。', ui.ButtonSet.OK); return; }
    var total = plan.reduce(function (a, p) { return a + p.n; }, 0);
    var ans = ui.alert('新着求人を今すぐ送りますか？',
      previewText_(plan) + '\n\n合計 ' + total + '通（LINEの月200通の無料枠を使います）', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
    var sent = sendNewJobs_(false);
    ui.alert('送信しました', sent + '通を送りました。「配信日時」「配信人数」に記録しました。', ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

// 練習問題ができたことを、今の登録者に1回だけ知らせる（同じ人には二度送らない）
function menuAnnounceQuiz() {
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getScriptProperties();
    var done = JSON.parse(props.getProperty('QUIZ_ANNOUNCED') || '{}');
    var plan = quizAnnouncePlan_(done);
    if (!plan.n) { ui.alert('練習問題の案内', 'まだ案内していない登録者はいません。', ui.ButtonSet.OK); return; }
    var ans = ui.alert('練習問題の案内を送りますか？', plan.n + '人に送ります（LINEの月200通の無料枠を' + plan.n + '通使います）。', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
    var total = sendQuizAnnounce_(plan.byLang, done);
    props.setProperty('QUIZ_ANNOUNCED', JSON.stringify(done));
    ui.alert('送信しました', total + '人に練習問題の案内を送りました。', ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

// まだ案内していない登録者を言語ごとに分ける（同じ人の2行目以降は数えない）
function quizAnnouncePlan_(done) {
  var byLang = {}, seen = {}, n = 0;
  sheetObjects_(regSheet_()).forEach(function (u) {
    var id = u['LINE userId'];
    if (!id || u['ブロック'] === '○' || done[id] || seen[id]) return;
    seen[id] = 1;
    var lg = langCode_(u['言語']); (byLang[lg] = byLang[lg] || []).push(id); n++;
  });
  return { byLang: byLang, n: n };
}

function sendQuizAnnounce_(byLang, done) {
  var total = 0;
  Object.keys(byLang).forEach(function (lg) {
    var ids = byLang[lg];
    for (var i = 0; i < ids.length; i += 500) {
      var part = ids.slice(i, i + 500);
      if (multicast_(part, [text_(fmt_(TL_(lg).quizInfo, { url: QUIZ_URL }))])) {
        part.forEach(function (id) { done[id] = 1; });
        total += part.length;
      }
    }
  });
  return total;
}

function dayNum_(d) {
  return Math.floor((d.getTime() + 9 * 3600 * 1000) / 86400000);  // 日本時間の日付
}

// ============================================================
// リッチメニュー
// ============================================================
function setupRichMenu() {
  var h = { Authorization: 'Bearer ' + token_() };
  // 古いメニューを削除
  var list = JSON.parse(UrlFetchApp.fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h }).getContentText());
  (list.richmenus || []).forEach(function (m) {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/richmenu/' + m.richMenuId, { method: 'delete', headers: h, muteHttpExceptions: true });
  });
  // 3列×2段（上：登録・求人・練習問題／下：相談・言語・サイト）
  var W = [833, 834, 833], H = 843, x0 = [0, 833, 1667];
  var buttons = [
    { type: 'postback', data: 'menu=register', displayText: '登録 / Register' },
    { type: 'postback', data: 'menu=jobs', displayText: '求人 / Jobs' },
    { type: 'uri', uri: QUIZ_URL },
    { type: 'postback', data: 'menu=ask', displayText: '相談 / Ask' },
    { type: 'postback', data: 'menu=lang', displayText: '言語 / Language' },
    { type: 'uri', uri: SITE_URL }
  ];
  var menu = {
    size: { width: 2500, height: 1686 }, selected: true, name: 'Job Change Japan main v3', chatBarText: 'Menu / メニュー',
    areas: buttons.map(function (a, i) {
      var c = i % 3, r = Math.floor(i / 3);
      return { bounds: { x: x0[c], y: r * H, width: W[c], height: H }, action: a };
    })
  };
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'post', contentType: 'application/json', headers: h, payload: JSON.stringify(menu), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('リッチメニュー作成失敗: ' + res.getContentText());
  var id = JSON.parse(res.getContentText()).richMenuId;
  var img = UrlFetchApp.fetch(RICHMENU_IMAGE_URL).getBlob().setContentType('image/png');
  var up = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/richmenu/' + id + '/content', {
    method: 'post', contentType: 'image/png', headers: h, payload: img.getBytes(), muteHttpExceptions: true
  });
  if (up.getResponseCode() !== 200) throw new Error('画像アップロード失敗: ' + up.getContentText());
  var def = UrlFetchApp.fetch('https://api.line.me/v2/bot/user/all/richmenu/' + id, { method: 'post', headers: h, muteHttpExceptions: true });
  console.log('リッチメニュー設定: ' + def.getResponseCode() + ' (' + id + ')');
}

// ============================================================
// メッセージ部品
// ============================================================
function label_(o, lang) {
  if (o === 'other') return TL_(lang).other;
  if (o === 'none') return TL_(lang).none;
  if (typeof o === 'string') return o;
  if (tk_(lang) === 'jaen') {
    if (o.jaen) return o.jaen;
    var both = o.ja === o.en ? o.ja : o.ja + ' / ' + o.en;
    return Array.from(both).length <= 20 ? both : o.ja;   // ボタンは20文字まで
  }
  return o[lang] || o.ja;
}
function question_(qid, lang, st) {
  lang = lang || 'ja';
  var items = Q[qid].opts.map(function (o, i) { return [label_(o[1], lang), 'q=' + qid + '&i=' + i]; });
  return quick_((st ? stepNo_(st, qid) : '') + TL_(lang)[qid], items);
}
function langMenu_() {
  return quick_(T.ja.chooseLang, LANGS.map(function (l) { return [l[1], 'lang=' + l[0]]; }));
}
function langLabel_(code) { return (LANGS.filter(function (l) { return l[0] === code; })[0] || ['', ''])[1]; }
function langCode_(label) { return (LANGS.filter(function (l) { return l[1] === label; })[0] || ['ja'])[0]; }
function text_(s) { return { type: 'text', text: s }; }
function quick_(s, items) {
  return {
    type: 'text', text: s,
    quickReply: { items: items.slice(0, 13).map(function (it) {
      var lab = Array.from(it[0]).slice(0, 20).join('');
      return { type: 'action', action: { type: 'postback', label: lab, data: it[1], displayText: it[0] } };
    }) }
  };
}
function parseQs_(s) {
  var o = {};
  String(s || '').split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) o[a[0]] = decodeURIComponent(a[1] || ''); });
  return o;
}

// ============================================================
// LINE API
// ============================================================
function token_() {
  var t = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
  if (!t) throw new Error('スクリプトプロパティ LINE_TOKEN が未設定です');
  return t;
}
function lineApi_(path, payload) {
  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/' + path, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token_() },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) { console.error(path + ' ' + r.getResponseCode() + ' ' + r.getContentText()); return false; }
  return true;
}
function reply_(replyToken, messages) {
  var ok = lineApi_('message/reply', { replyToken: replyToken, messages: messages.slice(0, 5) });
  // 返信の期限切れなどで送れなかったときは、プッシュで送り直す
  if (!ok && CUR_UID_) ok = push_(CUR_UID_, messages.slice(0, 5));
  return ok;
}
function push_(to, messages) { return lineApi_('message/push', { to: to, messages: messages }); }
function multicast_(ids, messages) { return lineApi_('message/multicast', { to: ids, messages: messages }); }
function profileName_(uid) {
  try {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/' + uid, {
      headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true
    });
    return JSON.parse(r.getContentText()).displayName || '';
  } catch (e) { return ''; }
}

// ============================================================
// 会話の途中経過
// ============================================================
function getState_(uid) {
  var v = PropertiesService.getScriptProperties().getProperty('u_' + uid);
  return v ? JSON.parse(v) : {};
}
function setState_(uid, st) { PropertiesService.getScriptProperties().setProperty('u_' + uid, JSON.stringify(st)); }

// ============================================================
// スプレッドシート
// ============================================================
function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('Job Change Japan LINE登録者');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheetWithHeaders_(name, headers) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f1f1');
    var def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
    return sh;
  }
  // 足りない列を右端に追加（古いシートからの移行用）
  var cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  headers.forEach(function (h) {
    if (cur.indexOf(h) < 0) {
      var c = sh.getLastColumn() + 1;
      sh.getRange(1, c).setValue(h).setFontWeight('bold').setBackground('#f1f1f1');
      cur.push(h);
    }
  });
  return sh;
}
function regSheet_() { return sheetWithHeaders_(REG_SHEET, REG_HEADERS); }
function jobSheet_() {
  var sh = sheetWithHeaders_(JOB_SHEET, JOB_HEADERS);
  return sh;
}
function colIndex_(sh, name) {
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var i = h.indexOf(name);
  if (i < 0) throw new Error('列が見つかりません: ' + name);
  return i + 1;
}
function sheetObjects_(sh) {
  var v = sh.getDataRange().getValues();
  var h = v[0] || [];
  return v.slice(1).map(function (row, i) {
    var o = { _row: i + 2 };
    h.forEach(function (k, j) { o[k] = row[j]; });
    return o;
  });
}
// 同じ人が「フルタイム」と「アルバイト」で別々の行を持てる
function typeOf_(r) { return String((r && r['雇用形態']) || '').trim() || '正社員・フルタイム'; }
function findRegs_(uid) {
  return sheetObjects_(regSheet_()).filter(function (r) { return r['LINE userId'] === uid; });
}
function findReg_(uid, type) {
  var rows = findRegs_(uid);
  if (type) rows = rows.filter(function (r) { return typeOf_(r) === type; });
  return rows[0] || null;
}
function setRegField_(uid, field, value) {
  var sh = regSheet_(), c = colIndex_(sh, field);
  findRegs_(uid).forEach(function (r) { sh.getRange(r._row, c).setValue(value); });
}
function histSheet_() { return sheetWithHeaders_('登録履歴', ['履歴日時'].concat(REG_HEADERS)); }
function bumpJobCount_(row, field) {
  var sh = jobSheet_(), c = colIndex_(sh, field);
  var cell = sh.getRange(row, c); cell.setValue((+cell.getValue() || 0) + 1);
}
function safe_(v) {
  v = v == null ? '' : v;
  return (typeof v === 'string' && /^[=+@-]/.test(v)) ? "'" + v : v;
}

function saveRegistration_(uid, st, name) {
  var lock = LockService.getScriptLock();
  var mine = !lock.hasLock();          // すでにロック中（Webhook処理中）なら取り直さない
  if (mine) lock.waitLock(20000);
  try {
    var sh = regSheet_(), a = st.ans || {}, type = a.type || '正社員・フルタイム';
    var existing = findReg_(uid, type);   // 同じ雇用形態の行があれば上書き、なければ新しい行
    var vals = {
      'LINE userId': uid, 'LINE表示名': profileName_(uid), '言語': langLabel_(st.lang), 'お名前': name,
      '希望職種': a.role, '在留資格': st.flow === 'baito' ? '留学' : a.visa, '日本語': a.jp, '希望勤務地': a.location,
      '就業開始': a.start || '', '雇用形態': a.type || '正社員・フルタイム', '資格外活動許可': a.permit || '', '週の勤務時間': a.hours || '',
      'ブロック': '', '最終更新': new Date()
    };
    var id, isNew = !existing;
    if (existing) {
      id = existing['受付ID'];
      // 上書きする前の内容を「登録履歴」タブに残す
      var hs = histSheet_(), hh = hs.getRange(1, 1, 1, hs.getLastColumn()).getValues()[0];
      hs.appendRow(hh.map(function (h) { return h === '履歴日時' ? new Date() : safe_(existing[h]); }));
      Object.keys(vals).forEach(function (k) { sh.getRange(existing._row, colIndex_(sh, k)).setValue(safe_(vals[k])); });
    } else {
      id = 'JCL-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
      vals['登録日時'] = new Date(); vals['受付ID'] = id; vals['対応状況'] = '未対応';
      var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      sh.appendRow(header.map(function (h) { return safe_(vals[h]); }));
    }
    notifyMail_('【Job Change Japan LINE】' + (isNew ? '新規登録' : '登録内容の更新') + '：' + name + '（' + id + '）',
      userSummary_(uid, findReg_(uid, type)) + (findRegs_(uid).length > 1 ? '\n\n※この方は複数の雇用形態で登録しています（' + findRegs_(uid).map(typeOf_).join('・') + '）' : '') +
      '\n\n一覧: ' + sh.getParent().getUrl());
    return { id: id, isNew: isNew, baito: st.flow === 'baito' };
  } finally {
    if (mine) lock.releaseLock();
  }
}

function userSummary_(uid, u) {
  if (Array.isArray(u)) {
    if (!u.length) return 'LINE userId: ' + uid + '（未登録）';
    return u.map(function (r) { return userSummary_(uid, r); }).join('\n---\n');
  }
  if (!u) return 'LINE userId: ' + uid + '（未登録）';
  return ['受付ID', 'お名前', 'LINE表示名', '言語', '雇用形態', '希望職種', '在留資格', '資格外活動許可', '日本語', '希望勤務地', '就業開始', '週の勤務時間']
    .map(function (k) { return k + ': ' + (u[k] instanceof Date ? u[k].toLocaleString('ja-JP') : (u[k] || '')); }).join('\n');
}

function notifyMail_(subject, body) {
  try {
    var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to, subject, body);
  } catch (e) { console.error(e); }
}

// ============================================================
// 初期設定（エディタから実行）
// ============================================================
function setup() {
  regSheet_();
  histSheet_();
  var jsh = jobSheet_();
  // 求人シートの「職種」「勤務地」「公開」にプルダウンを付ける
  var roles = Q.q1.opts.map(function (o) { return o[0]; });
  var locs = Q.q4.opts.map(function (o) { return o[0]; });
  jsh.getRange(2, colIndex_(jsh, '職種'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(roles, true).build());
  jsh.getRange(2, colIndex_(jsh, '勤務地'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(locs, true).build());
  jsh.getRange(2, colIndex_(jsh, '雇用形態'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['正社員・フルタイム', 'アルバイト', 'どちらも'], true).build());
  jsh.getRange(2, colIndex_(jsh, '公開'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['○', '×'], true).build());
  console.log('保存先: ' + jsh.getParent().getUrl());

  // 毎朝10時の自動実行
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runDaily').timeBased().everyDays(1).atHour(DAILY_HOUR).inTimezone('Asia/Tokyo').create();
  console.log('自動実行: 毎日 ' + DAILY_HOUR + '時台に runDaily');

  // スプレッドシートを開いたときに「LINE配信」メニューを出す
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'onSheetOpen') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onSheetOpen').forSpreadsheet(jsh.getParent()).onOpen().create();
  console.log('メニュー: スプレッドシートを開き直すと「LINE配信」メニューが出ます');

  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true });
  console.log('LINE接続確認: ' + r.getResponseCode() + ' ' + r.getContentText());
  console.log('AI自動応答: ' + (PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') ? 'ON' : 'OFF（ANTHROPIC_API_KEY 未設定）'));
}

// AIの動作確認（エディタから実行）
function testAI() {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  console.log(callClaude_(key, AI_SYSTEM, [{ role: 'user', content: 'Do I have to pay any fee to use your service?' }]));
}
