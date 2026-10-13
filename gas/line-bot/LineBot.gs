/**
 * Job Change Japan — 公式LINE 登録ボット（GAS）
 *
 * 友だち追加 → 言語を選ぶ → 6つの質問にボタンで答える → 名前を入力 → 登録完了
 * 登録内容はスプレッドシートに保存し、運営にメールで通知します。
 *
 * 【初期設定】スクリプトプロパティに以下を登録
 *   LINE_TOKEN   : LINE Developers の「チャネルアクセストークン（長期）」
 *   NOTIFY_EMAIL : 新規登録の通知先（空ならGASの所有者）
 *   SHEET_ID     : （任意）保存先スプレッドシートのID。空なら自動作成
 */

// ============================================================
// 文言
// ============================================================
var LANGS = [['ja', '日本語'], ['en', 'English'], ['vi', 'Tiếng Việt'], ['ne', 'नेपाली']];

var T = {
  ja: {
    welcome: '友だち追加ありがとうございます。\nJob Change Japan（株式会社Fairly connecting）です。\n\n日本で働きたい外国人の方の転職・就職を、無料でお手伝いしています。',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: '6つの質問に答えるだけで、30秒で登録できます。\n登録・相談はすべて無料です。',
    startBtn: '登録をはじめる',
    q1: '1/6 どんな仕事をしたいですか？', q2: '2/6 いまの在留資格は？', q3: '3/6 日本語のレベルは？',
    q4: '4/6 どこで働きたいですか？', q5: '5/6 いつから働けますか？',
    q6: '6/6 最後に、お名前をローマ字で送ってください。\n（例: NGUYEN THI LAN）',
    done: '{name} さん、登録できました！\n受付ID: {id}\n\n担当者から、このLINEで2営業日以内にご連絡します。\nあなたに合う求人が見つかったら、ここでお知らせします。',
    already: 'すでに登録済みです。登録内容を変えたいときは「登録」と送ってください。',
    other: 'その他', none: '資格なし',
    fallback: 'メッセージありがとうございます。担当者が確認してご返信します。\n\n登録がまだの方は「登録」、言語を変えるときは「言語」と送ってください。',
    nameRetry: 'お名前をローマ字（英字）で送ってください。'
  },
  en: {
    welcome: 'Thank you for adding us!\nThis is Job Change Japan (Fairly connecting Inc.).\n\nWe help foreign nationals find jobs in Japan — completely free.',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: 'Answer 6 quick questions to register in 30 seconds.\nRegistration and consultation are free.',
    startBtn: 'Start registration',
    q1: '1/6 What kind of work do you want?', q2: '2/6 What is your current visa status?', q3: '3/6 What is your Japanese level?',
    q4: '4/6 Where do you want to work?', q5: '5/6 When can you start working?',
    q6: '6/6 Finally, please send your full name in English letters.\n(e.g. NGUYEN THI LAN)',
    done: 'Thank you, {name}! You are registered.\nReceipt ID: {id}\n\nOur staff will contact you on this LINE within 2 business days.\nWe will let you know here when we find a job that suits you.',
    already: 'You are already registered. To update your information, send "register".',
    other: 'Other', none: 'No certificate',
    fallback: 'Thank you for your message. Our staff will check and reply.\n\nTo register, send "register". To change language, send "language".',
    nameRetry: 'Please send your name in English letters.'
  },
  vi: {
    welcome: 'Cảm ơn bạn đã kết bạn!\nĐây là Job Change Japan (Công ty Fairly connecting).\n\nChúng tôi hỗ trợ người nước ngoài tìm việc tại Nhật Bản — hoàn toàn miễn phí.',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: 'Chỉ cần trả lời 6 câu hỏi, đăng ký trong 30 giây.\nĐăng ký và tư vấn đều miễn phí.',
    startBtn: 'Bắt đầu đăng ký',
    q1: '1/6 Bạn muốn làm công việc gì?', q2: '2/6 Tư cách lưu trú hiện tại?', q3: '3/6 Trình độ tiếng Nhật?',
    q4: '4/6 Bạn muốn làm việc ở đâu?', q5: '5/6 Khi nào bạn có thể bắt đầu?',
    q6: '6/6 Cuối cùng, hãy gửi họ tên bằng chữ La-tinh.\n(VD: NGUYEN THI LAN)',
    done: 'Cảm ơn {name}! Bạn đã đăng ký thành công.\nMã tiếp nhận: {id}\n\nNhân viên sẽ liên lạc qua LINE này trong vòng 2 ngày làm việc.\nKhi có việc phù hợp, chúng tôi sẽ báo tại đây.',
    already: 'Bạn đã đăng ký rồi. Muốn thay đổi thông tin, hãy gửi "đăng ký".',
    other: 'Khác', none: 'Chưa có',
    fallback: 'Cảm ơn tin nhắn của bạn. Nhân viên sẽ kiểm tra và trả lời.\n\nĐể đăng ký, gửi "đăng ký". Đổi ngôn ngữ, gửi "ngôn ngữ".',
    nameRetry: 'Vui lòng gửi họ tên bằng chữ La-tinh.'
  },
  ne: {
    welcome: 'साथी थप्नुभएकोमा धन्यवाद!\nयो Job Change Japan (Fairly connecting Inc.) हो।\n\nहामी जापानमा काम खोज्ने विदेशीहरूलाई निःशुल्क सहयोग गर्छौं।',
    chooseLang: '言語を選んでください。\nPlease choose your language.',
    intro: '६ वटा प्रश्नको उत्तर दिनुहोस्, ३० सेकेन्डमा दर्ता हुन्छ।\nदर्ता र परामर्श निःशुल्क छ।',
    startBtn: 'दर्ता सुरु गर्नुहोस्',
    q1: '1/6 तपाईं कस्तो काम गर्न चाहनुहुन्छ?', q2: '2/6 तपाईंको हालको भिसा के हो?', q3: '3/6 जापानी भाषाको स्तर?',
    q4: '4/6 कहाँ काम गर्न चाहनुहुन्छ?', q5: '5/6 कहिलेदेखि काम सुरु गर्न सक्नुहुन्छ?',
    q6: '6/6 अन्तमा, आफ्नो नाम अंग्रेजी अक्षरमा पठाउनुहोस्।\n(जस्तै: SHARMA RAM)',
    done: 'धन्यवाद {name}! दर्ता भयो।\nदर्ता नम्बर: {id}\n\nहाम्रो कर्मचारीले २ कार्य दिनभित्र यही LINE मा सम्पर्क गर्नेछ।\nउपयुक्त काम भेटिएमा यहीँ जानकारी दिनेछौं।',
    already: 'तपाईं पहिले नै दर्ता हुनुहुन्छ। जानकारी बदल्न "दर्ता" पठाउनुहोस्।',
    other: 'अन्य', none: 'छैन',
    fallback: 'सन्देशको लागि धन्यवाद। हाम्रो कर्मचारीले हेरेर जवाफ दिनेछ।\n\nदर्ता गर्न "दर्ता", भाषा बदल्न "भाषा" पठाउनुहोस्।',
    nameRetry: 'कृपया नाम अंग्रेजी अक्षरमा पठाउनुहोस्।'
  }
};

// 「登録」「言語」として受け付ける言葉
var KW_REGISTER = ['登録', 'register', 'đăng ký', 'dang ky', 'दर्ता', 'start'];
var KW_LANG = ['言語', 'language', 'ngôn ngữ', 'भाषा', 'lang'];

// 質問（v はスプレッドシートに保存する日本語の値）
var Q = {
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
    ['技能実習', { ja: '技能実習', en: 'Technical Intern', vi: 'Thực tập sinh', ne: 'Ginou Jisshu' }],
    ['留学', { ja: '留学', en: 'Student', vi: 'Du học sinh', ne: 'विद्यार्थी' }],
    ['技術・人文知識・国際業務', { ja: '技人国', en: 'Engineer/Humanities', vi: 'Gijinkoku', ne: 'Gijinkoku' }],
    ['永住者・配偶者等', { ja: '永住・配偶者など', en: 'PR / Spouse', vi: 'Vĩnh trú/Vợ chồng', ne: 'स्थायी / जीवनसाथी' }],
    ['海外在住', { ja: 'いま海外にいる', en: 'Living abroad', vi: 'Đang ở nước ngoài', ne: 'जापान बाहिर' }],
    ['その他', 'other']
  ]},
  q3: { key: 'jp', opts: [
    ['N1', 'N1'], ['N2', 'N2'], ['N3', 'N3'], ['N4', 'N4'], ['N5', 'N5'], ['JFT-Basic', 'JFT-Basic'], ['資格なし', 'none']
  ]},
  q4: { key: 'location', opts: [
    ['大阪府', { ja: '大阪', en: 'Osaka', vi: 'Osaka', ne: 'ओसाका' }],
    ['関西（大阪以外）', { ja: '関西（大阪以外）', en: 'Kansai', vi: 'Kansai', ne: 'कान्साई' }],
    ['関東', { ja: '関東（東京など）', en: 'Kanto (Tokyo)', vi: 'Kanto (Tokyo)', ne: 'कान्तो (टोकियो)' }],
    ['中部・東海', { ja: '中部・東海', en: 'Chubu (Nagoya)', vi: 'Chubu (Nagoya)', ne: 'चुबु (नागोया)' }],
    ['全国', { ja: 'どこでもOK', en: 'Anywhere', vi: 'Ở đâu cũng được', ne: 'जहाँ पनि' }],
    ['その他', 'other']
  ]},
  q5: { key: 'start', opts: [
    ['すぐに働ける', { ja: 'すぐに', en: 'Right away', vi: 'Ngay lập tức', ne: 'तुरुन्तै' }],
    ['1ヶ月以内', { ja: '1ヶ月以内', en: 'Within 1 month', vi: 'Trong 1 tháng', ne: '१ महिनाभित्र' }],
    ['3ヶ月以内', { ja: '3ヶ月以内', en: 'Within 3 months', vi: 'Trong 3 tháng', ne: '३ महिनाभित्र' }],
    ['未定', { ja: 'まだ決めていない', en: 'Not decided', vi: 'Chưa quyết định', ne: 'निश्चित छैन' }]
  ]}
};

var HEADERS = ['登録日時', '受付ID', 'LINE userId', 'LINE表示名', '言語', 'お名前', '希望職種', '在留資格', '日本語', '希望勤務地', '就業開始', '対応状況', 'メモ'];

// ============================================================
// Webhook
// ============================================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(function (ev) {
      try { handleEvent_(ev); } catch (err) { console.error(err); }
    });
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Job Change Japan LINE bot is running.');
}

function handleEvent_(ev) {
  var uid = ev.source && ev.source.userId;
  if (!uid) return;
  var st = getState_(uid);

  if (ev.type === 'follow') {
    reply_(ev.replyToken, [text_(T.ja.welcome), langMenu_()]);
    return;
  }
  if (ev.type === 'unfollow') { clearState_(uid); return; }

  if (ev.type === 'postback') {
    var p = parseQs_(ev.postback.data);
    if (p.lang && T[p.lang]) {
      st.lang = p.lang; setState_(uid, st);
      var L = T[st.lang];
      reply_(ev.replyToken, [quick_(L.intro, [[L.startBtn, 'go=1']])]);
      return;
    }
    if (p.go) { startFlow_(ev.replyToken, uid, st); return; }
    if (p.q && Q[p.q] && st.step === p.q) {
      var q = Q[p.q], opt = q.opts[+p.i];
      if (!opt) return;
      st.ans = st.ans || {};
      st.ans[q.key] = opt[0];
      var n = +p.q.slice(1) + 1;
      st.step = n <= 5 ? 'q' + n : 'name';
      setState_(uid, st);
      reply_(ev.replyToken, [n <= 5 ? question_(st.step, st.lang) : text_(T[st.lang].q6)]);
    }
    return;
  }

  if (ev.type === 'message' && ev.message.type === 'text') {
    var msg = String(ev.message.text || '').trim();
    var low = msg.toLowerCase();
    var L2 = T[st.lang || 'ja'];

    if (KW_LANG.indexOf(low) >= 0) { reply_(ev.replyToken, [langMenu_()]); return; }
    if (KW_REGISTER.indexOf(low) >= 0) {
      if (!st.lang) { reply_(ev.replyToken, [langMenu_()]); return; }
      startFlow_(ev.replyToken, uid, st); return;
    }
    if (st.step === 'name') {
      if (!/[A-Za-z]/.test(msg) || msg.length > 60) { reply_(ev.replyToken, [text_(L2.nameRetry)]); return; }
      var id = saveRegistration_(uid, st, msg);
      st.step = 'done'; st.ans = {}; st.registeredId = id; setState_(uid, st);
      reply_(ev.replyToken, [text_(L2.done.replace('{name}', msg).replace('{id}', id))]);
      return;
    }
    if (st.step && /^q\d$/.test(st.step)) { reply_(ev.replyToken, [question_(st.step, st.lang)]); return; }

    // その他のメッセージ：返信＋運営へ通知
    reply_(ev.replyToken, [text_(L2.fallback)]);
    notifyMail_('【Job Change Japan LINE】メッセージ受信', 'userId: ' + uid + '\n登録ID: ' + (st.registeredId || '未登録') + '\n\n' + msg +
      '\n\n※返信はLINE公式アカウントのチャット画面から行ってください。');
  }
}

function startFlow_(token, uid, st) {
  st.step = 'q1'; st.ans = {}; setState_(uid, st);
  reply_(token, [question_('q1', st.lang)]);
}

// ============================================================
// メッセージ部品
// ============================================================
function label_(o, lang) {
  if (o === 'other') return T[lang].other;
  if (o === 'none') return T[lang].none;
  return typeof o === 'string' ? o : (o[lang] || o.ja);
}
function question_(qid, lang) {
  lang = lang || 'ja';
  var items = Q[qid].opts.map(function (o, i) { return [label_(o[1], lang), 'q=' + qid + '&i=' + i]; });
  return quick_(T[lang][qid], items);
}
function langMenu_() {
  return quick_(T.ja.chooseLang, LANGS.map(function (l) { return [l[1], 'lang=' + l[0]]; }));
}
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
function reply_(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token_() },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
}
function profileName_(uid) {
  try {
    var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/' + uid, {
      headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true
    });
    return JSON.parse(r.getContentText()).displayName || '';
  } catch (e) { return ''; }
}

// ============================================================
// 状態（会話の途中経過）
// ============================================================
function getState_(uid) {
  var v = PropertiesService.getScriptProperties().getProperty('u_' + uid);
  return v ? JSON.parse(v) : {};
}
function setState_(uid, st) { PropertiesService.getScriptProperties().setProperty('u_' + uid, JSON.stringify(st)); }
function clearState_(uid) { PropertiesService.getScriptProperties().deleteProperty('u_' + uid); }

// ============================================================
// 保存・通知
// ============================================================
function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : null;
  if (!ss) {
    ss = SpreadsheetApp.create('Job Change Japan LINE登録者');
    props.setProperty('SHEET_ID', ss.getId());
  }
  var sh = ss.getSheetByName('LINE登録');
  if (!sh) {
    sh = ss.insertSheet('LINE登録');
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f1f1f1');
  }
  return sh;
}

function saveRegistration_(uid, st, name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var id = 'JCL-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
    var a = st.ans || {};
    var langLabel = (LANGS.filter(function (l) { return l[0] === st.lang; })[0] || ['', ''])[1];
    var row = [new Date(), id, uid, profileName_(uid), langLabel, name, a.role, a.visa, a.jp, a.location, a.start, '未対応', '']
      .map(function (v) { v = v == null ? '' : v; return (typeof v === 'string' && /^[=+@-]/.test(v)) ? "'" + v : v; });
    var sh = sheet_();
    sh.appendRow(row);
    notifyMail_('【Job Change Japan LINE】新規登録：' + name + '（' + id + '）',
      HEADERS.slice(0, 11).map(function (h, i) { return h + ': ' + row[i]; }).join('\n') + '\n\n一覧: ' + sh.getParent().getUrl());
    return id;
  } finally {
    lock.releaseLock();
  }
}

function notifyMail_(subject, body) {
  try {
    var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to, subject, body);
  } catch (e) { console.error(e); }
}

// 初回だけエディタから実行：権限の許可・保存先シートの作成・トークン確認
function setup() {
  console.log('保存先: ' + sheet_().getParent().getUrl());
  var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true });
  console.log('LINE接続確認: ' + r.getResponseCode() + ' ' + r.getContentText());
}
