/**
 * Job Change Japan — 特定技能2号 外食業 練習問題（LINE友だち限定）
 *
 * しくみ
 *  - 練習問題ページ（quiz/index.html, LIFF）が LINE ログインのアクセストークンを送ってくる
 *  - このGASで「本物のトークンか」「公式LINEの友だちか」を確認してから問題を返す
 *  - 料金：回数券 500円（税抜・税込550円）で10回分。1回分を使うと、そこから24時間、練習も模擬テストもすべて使い放題
 *    はじめての人は1回だけ、無料で24時間お試しできる（回数券を使わない）
 *    利用の開始はページの「始める」ボタン（api: pass_start）。ページを開いただけでは使わない
 *  - 模擬テスト：技能（学科35問＋実技20問＝55問・70分・250点満点）／N3 文字・語彙（35問・30分）／N3 文法・読解（39問・70分）／N3 聴解（28問・40分）。回数券は共通
 *  - 問題の順番と選択肢の順番は毎回シャッフル。模擬テストはまだ出ていない問題を優先して出す
 *
 * スクリプトプロパティ（追加分）
 *   LIFF_CHANNEL_ID : LINEログインチャネルの「チャネルID」（数字）  ※必須
 *
 * シート（setupQuiz で作成）
 *   模擬テスト回数 : 人ごとの残り回数・利用期限・お試し。手で書き換えても反映される
 *   利用記録       : 24時間の利用を始めた記録（お試し／回数券）
 *   模擬テスト受験 : 受験の記録（開始・提出・点数）
 *
 * 問題データは QuizBank.gs（quiz/build/build.py で自動生成。手で編集しない）
 */

var QUIZ_PACK = { price: 500, priceTax: 550, count: 10, hours: 24 };   // 回数券：500円（税込550円）で10回分。1回分＝24時間使い放題
var QUIZ_RESUME_HOURS = 24;                         // 途中でやめた模擬テストを、続きから受けられる時間

// 模擬テストの種類。plan：[分野, 種類, 問題数, 1問の点数]（点数0＝点数なし）
var QUIZ_MOCKS = {
  // 外食業特定技能2号技能測定試験：学科35問＋実技20問、70分、250点満点・合格163点
  //  学科は実施要領の配点（衛生4点・調理2点・接客3点・店舗運営4点＝120点）、実技は残り130点を20問で割った目安
  skill: {
    name: '外食業2号 技能測定試験', minutes: 70, passPoints: 163, groupOrder: ['gakka', 'jitsugi'],
    plan: [
      ['eisei', 'gakka', 10, 4], ['chori', 'gakka', 5, 2], ['sekkyaku', 'gakka', 10, 3], ['unei', 'gakka', 10, 4],
      ['eisei', 'handan', 3, 6.5], ['eisei', 'keikaku', 2, 6.5],
      ['chori', 'handan', 3, 6.5], ['chori', 'keikaku', 2, 6.5],
      ['sekkyaku', 'handan', 3, 6.5], ['sekkyaku', 'keikaku', 2, 6.5],
      ['unei', 'handan', 3, 6.5], ['unei', 'keikaku', 2, 6.5]
    ]
  },
  // 日本語能力試験N3 言語知識（文字・語彙）：本番と同じ35問・30分。問題の種類の順に出す
  n3moji: {
    name: 'N3 文字・語彙', minutes: 30, exam: 'n3',
    plan: [['moji', 'yomi', 8, 0], ['moji', 'hyoki', 6, 0], ['moji', 'bunmyaku', 11, 0], ['moji', 'iikae', 5, 0], ['moji', 'yoho', 5, 0]]
  },
  // 日本語能力試験N3 言語知識（文法）・読解：本番と同じ39問・70分。文章つきの問題は、文章ごとにまとめて出す
  n3bunpo: {
    name: 'N3 文法・読解', minutes: 70, exam: 'n3',
    plan: [['bunpo', 'keishiki', 13, 0], ['bunpo', 'kumitate', 5, 0], ['bunpo', 'bunsho', 5, 0],
           ['dokkai', 'tanbun', 4, 0], ['dokkai', 'chubun', 6, 0], ['dokkai', 'chobun', 4, 0], ['dokkai', 'joho', 2, 0]]
  },
  // 日本語能力試験N3 聴解：本番と同じ28問・40分。音声は1回だけ（ページ側で制御）
  n3chokai: {
    name: 'N3 聴解', minutes: 40, exam: 'n3',
    plan: [['chokai', 'kadai', 6, 0], ['chokai', 'point', 6, 0], ['chokai', 'gaiyo', 3, 0], ['chokai', 'hatsuwa', 4, 0], ['chokai', 'sokuji', 9, 0]]
  }
};

var QUIZ_CREDIT_SHEET = '模擬テスト回数';
var QUIZ_CREDIT_HEADERS = ['LINE userId', 'LINE表示名', '残り回数', '付与回数合計', '最終利用', '初回アクセス', 'メモ', '利用期限', 'お試し利用'];
var QUIZ_USE_SHEET = '利用記録';
var QUIZ_USE_HEADERS = ['日時', 'LINE userId', 'LINE表示名', '内容', '利用期限', '残り回数'];
var QUIZ_ATTEMPT_SHEET = '模擬テスト受験';
var QUIZ_ATTEMPT_HEADERS = ['開始日時', '受験ID', 'LINE userId', 'LINE表示名', '状態', '正解数', '問題数', '正答率', '分野別', '終了日時', '出題データ', '得点', '合否', '種類'];

// ============================================================
// 入口（LineBot.gs の doPost から呼ばれる）
// ============================================================
function quizApi_(body) {
  var out;
  try {
    out = quizRoute_(body);
  } catch (e) {
    console.error(e && e.stack || e);
    out = { ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function quizRoute_(b) {
  var user = quizAuth_(b.token);
  if (!user) return { ok: false, error: 'auth' };
  if (!user.friend) return { ok: false, error: 'not_friend', name: user.name };

  switch (b.api) {
    case 'me': return quizMe_(user);
    case 'pass_start': return quizWithLock_(function () { return quizPassStart_(user); });
    case 'practice':
      if (!quizPassActive_(user)) return quizNoPass_(user);
      var pq = quizPractice_(String(b.cat || 'all'), String(b.exam || 'skill'));
      return { ok: true, questions: pq, passages: quizPassagesFor_(pq) };
    case 'mock_start':
      if (!quizPassActive_(user)) return quizNoPass_(user);
      return quizWithLock_(function () { return quizMockStart_(user, String(b.mock || 'skill')); });
    case 'mock_resume': return quizMockResume_(user, String(b.attemptId || ''));
    case 'mock_submit': return quizWithLock_(function () { return quizMockSubmit_(user, String(b.attemptId || ''), b.answers); });
  }
  return { ok: false, error: 'unknown' };
}

function quizWithLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ============================================================
// LINEログインの確認（トークンの持ち主・友だちかどうか）
// ============================================================
function quizAuth_(token) {
  if (!token || typeof token !== 'string' || token.length > 4000) return null;
  var cache = CacheService.getScriptCache();
  var key = 'qa_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var channel = PropertiesService.getScriptProperties().getProperty('LIFF_CHANNEL_ID');
  if (!channel) throw new Error('スクリプトプロパティ LIFF_CHANNEL_ID が未設定です');

  // 1) このチャネルが発行した、期限内のトークンか
  var v = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (v.getResponseCode() !== 200) return null;
  var vj = JSON.parse(v.getContentText());
  if (String(vj.client_id) !== String(channel) || !(vj.expires_in > 0)) return null;

  var h = { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  // 2) だれのトークンか
  var p = UrlFetchApp.fetch('https://api.line.me/v2/profile', h);
  if (p.getResponseCode() !== 200) return null;
  var pj = JSON.parse(p.getContentText());
  // 3) 公式LINEの友だちか
  var f = UrlFetchApp.fetch('https://api.line.me/friendship/v1/status', h);
  var friend = f.getResponseCode() === 200 && JSON.parse(f.getContentText()).friendFlag === true;

  var user = { uid: pj.userId, name: pj.displayName || '', friend: friend };
  // 友だちなら10分だけ覚える（まだの人は覚えない：友だち追加したあと、すぐ再確認できるように）
  if (friend) cache.put(key, JSON.stringify(user), 600);
  return user;
}

// ============================================================
// 24時間の利用（お試し・回数券）
// ============================================================
function quizPassUntil_(row) {
  var v = row && row['利用期限'];
  var t = v ? new Date(v).getTime() : 0;
  return isNaN(t) ? 0 : t;
}
function quizTrialUsed_(row) { return !!(row && row['お試し利用']); }
function quizPassActive_(user) {
  var row = quizCreditRow_(user, false);
  return quizPassUntil_(row) > Date.now();
}
function quizNoPass_(user) {
  var row = quizCreditRow_(user, false);
  return { ok: false, error: 'no_pass', credits: quizNum_(row && row['残り回数']), trial: !quizTrialUsed_(row), pack: QUIZ_PACK };
}

// 「始める」：お試しがまだならお試し、なければ回数券を1回分使って、今から24時間使えるようにする
function quizPassStart_(user) {
  var sh = quizCreditSheet_();
  var row = quizCreditRow_(user, true);
  var until = quizPassUntil_(row), left = quizNum_(row['残り回数']);
  if (until > Date.now()) return { ok: true, passUntil: until, credits: left, trial: !quizTrialUsed_(row), already: true };
  var now = new Date(), how;
  if (!quizTrialUsed_(row)) {
    how = 'お試し（無料）';
    sh.getRange(row._row, quizCol_(sh, 'お試し利用')).setValue(now);
  } else if (left > 0) {
    how = '回数券';
    left--;
    sh.getRange(row._row, quizCol_(sh, '残り回数')).setValue(left);
  } else {
    return { ok: false, error: 'no_credits', credits: 0, trial: false, pack: QUIZ_PACK };
  }
  until = now.getTime() + QUIZ_PACK.hours * 3600 * 1000;
  sh.getRange(row._row, quizCol_(sh, '利用期限')).setValue(new Date(until));
  sh.getRange(row._row, quizCol_(sh, '最終利用')).setValue(now);
  quizUseSheet_().appendRow([now, user.uid, safe_(user.name), how, new Date(until), left]);
  return { ok: true, passUntil: until, credits: left, trial: false, started: how };
}

// ============================================================
// 練習
// ============================================================
function quizMe_(user) {
  var row = quizWithLock_(function () { return quizCreditRow_(user, true); });
  var counts = { handan: 0, keikaku: 0, jirei: 0 }, n3 = { all: 0 }, skillTotal = 0;
  QUIZ_BANK.forEach(function (q) {
    if (q.x === 'n3') { n3[q.k] = (n3[q.k] || 0) + 1; n3[q.c] = (n3[q.c] || 0) + 1; n3.all++; return; }
    skillTotal++;
    if (q.k === 'gakka') counts[q.c] = (counts[q.c] || 0) + 1; else counts[q.k]++;
  });
  var open = quizOpenAttempt_(user.uid);
  var mocks = {};
  Object.keys(QUIZ_MOCKS).forEach(function (id) {
    var m = QUIZ_MOCKS[id];
    mocks[id] = { name: m.name, exam: m.exam || 'skill', size: quizMockSize_(id), minutes: m.minutes, maxPoints: quizMaxPoints_(id) || null, passPoints: m.passPoints || null };
  });
  var s = mocks.skill;
  return {
    ok: true, name: user.name, credits: quizNum_(row['残り回数']), pack: QUIZ_PACK,
    passUntil: quizPassUntil_(row), trial: !quizTrialUsed_(row), now: Date.now(),
    counts: counts, total: skillTotal, n3: n3, mocks: mocks,
    // 前の版のページ用
    mockSize: s.size, mockMinutes: s.minutes, maxPoints: s.maxPoints, passPoints: s.passPoints,
    open: open ? { attemptId: open['受験ID'], mock: quizMockIdOf_(open), started: +new Date(open['開始日時']) } : null
  };
}

// 選択肢の順番をシャッフル（3択・4択どちらも）。order[i] ＝ 表示i番目に出す元の選択肢
// 選択肢を音声で読み上げる問題（fx）は、順番を変えない
function quizOrder_(q) { var o = []; for (var i = 0; i < q.ch.length; i++) o.push(i); return q.fx ? o : quizShuffle_(o); }
function quizAnsOf_(q) { return q.ans || 0; }   // 元の選択肢の中の正解の番号
// 問題の共通の項目（聴解は音声・場面・選択肢を隠すかどうかも）
function quizBase_(q) {
  var o = { id: q.id, x: q.x || '', c: q.c, k: q.k, p: q.p || '', q: q.q };
  if (q.au) { o.au = q.au; o.hid = q.hid ? 1 : 0; if (q.sc) o.sc = q.sc; }
  return o;
}

function quizPractice_(cat, exam) {
  var list;
  if (exam === 'n3') {
    // cat：問題の種類（yomi など）／科目（moji・bunpo）／all
    list = QUIZ_BANK.filter(function (q) { return q.x === 'n3' && (cat === 'all' || q.k === cat || q.c === cat); });
  } else {
    // cat：分野名（その分野の学科）／handan・keikaku・jirei（実技の全分野）／all
    list = QUIZ_BANK.filter(function (q) {
      if (q.x) return false;
      if (cat === 'all') return true;
      return (cat === 'handan' || cat === 'keikaku' || cat === 'jirei') ? q.k === cat : (q.k === 'gakka' && q.c === cat);
    });
  }
  return quizShuffleKeepSets_(list).map(function (q) {
    var order = quizOrder_(q), o = quizBase_(q);
    o.ch = order.map(function (i) { return q.ch[i]; }); o.a = order.indexOf(quizAnsOf_(q)); o.e = q.e;
    return o;
  });
}

// 文章つき問題は、同じ文章の問題をまとめて順番どおりに並べる（文章の順番はシャッフル）
function quizShuffleKeepSets_(list) {
  var groups = {}, keys = [];
  list.forEach(function (q) {
    var g = q.p || q.id;
    if (!groups[g]) { groups[g] = []; keys.push(g); }
    groups[g].push(q);
  });
  var out = [];
  quizShuffle_(keys).forEach(function (g) {
    out = out.concat(groups[g].sort(function (a, b) { return (a.pi || 0) - (b.pi || 0); }));
  });
  return out;
}

// 問題の一覧に出てくる文章だけを返す
function quizPassagesFor_(qs) {
  var out = {};
  qs.forEach(function (q) { if (q.p && typeof QUIZ_PASSAGES !== 'undefined' && QUIZ_PASSAGES[q.p]) out[q.p] = QUIZ_PASSAGES[q.p]; });
  return out;
}

// ============================================================
// 模擬テスト（24時間の利用中は何回でも）
// ============================================================
function quizMockSize_(id) { return QUIZ_MOCKS[id].plan.reduce(function (a, p) { return a + p[2]; }, 0); }
function quizMaxPoints_(id) { return QUIZ_MOCKS[id].plan.reduce(function (a, p) { return a + p[2] * p[3]; }, 0); }
function quizPointOf_(id, q) {
  var p = QUIZ_MOCKS[id].plan.filter(function (x) { return x[0] === q.c && x[1] === q.k; })[0];
  return p ? p[3] : 0;
}
function quizMockIdOf_(r) { var m = String(r['種類'] || ''); return QUIZ_MOCKS[m] ? m : 'skill'; }
function quizInPlan_(id, q) {
  var exam = QUIZ_MOCKS[id].exam || '';
  return (q.x || '') === exam && QUIZ_MOCKS[id].plan.some(function (p) { return p[0] === q.c && p[1] === q.k; });
}

// 問題を n 問選ぶ。文章つきの問題は文章ごと（全部の問題）選ぶ。まだ出ていないものを優先
function quizPick_(pool, n, seen) {
  var groups = {}, keys = [];
  pool.forEach(function (q) {
    var g = q.p || q.id;
    if (!groups[g]) { groups[g] = []; keys.push(g); }
    groups[g].push(q);
  });
  var fresh = [], old = [];
  quizShuffle_(keys).forEach(function (g) {
    (groups[g].some(function (q) { return seen[q.id]; }) ? old : fresh).push(g);
  });
  var out = [];
  fresh.concat(old).forEach(function (g) {
    if (out.length + groups[g].length <= n) out = out.concat(groups[g]);
  });
  return out;
}

function quizMockStart_(user, mockId) {
  var M = QUIZ_MOCKS[mockId];
  if (!M) return { ok: false, error: 'unknown' };
  var sh = quizCreditSheet_();
  var row = quizCreditRow_(user, true);

  // 前に受けた模擬テストで出た問題は、あとに回す
  var seen = {};
  quizAttempts_(user.uid).forEach(function (r) {
    quizParseItems_(r['出題データ']).forEach(function (it) { seen[it[0]] = 1; });
  });
  var groups = {}, order = [];
  M.plan.forEach(function (p) {
    var exam = M.exam || '';
    var pool = QUIZ_BANK.filter(function (q) { return (q.x || '') === exam && q.c === p[0] && q.k === p[1]; });
    var take = quizPick_(pool, p[2], seen);
    // 技能：学科のあとに実技（それぞれの中はシャッフル）。N3：問題の種類の順（種類の中はシャッフル）
    var g = M.groupOrder ? (p[1] === 'gakka' ? 'gakka' : 'jitsugi') : p[1];
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g] = groups[g].concat(take);
  });
  var list = [];
  (M.groupOrder || order).forEach(function (g) { list = list.concat(quizShuffleKeepSets_(groups[g] || [])); });
  var items = list.map(function (q) { return [q.id, quizOrder_(q).join('')]; });

  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000);
  sh.getRange(row._row, quizCol_(sh, '最終利用')).setValue(new Date());
  var ash = quizAttemptSheet_();
  var head = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
  var vals = { '開始日時': new Date(), '受験ID': id, 'LINE userId': user.uid, 'LINE表示名': safe_(user.name), '状態': '受験中', '問題数': items.length, '出題データ': JSON.stringify(items), '種類': mockId };
  ash.appendRow(head.map(function (h) { return vals[h] == null ? '' : vals[h]; }));

  var mq = quizMockQuestions_(items);
  return { ok: true, attemptId: id, mock: mockId, credits: quizNum_(row['残り回数']), started: +vals['開始日時'], minutes: M.minutes, questions: mq, passages: quizPassagesFor_(mq) };
}

function quizMockResume_(user, attemptId) {
  var r = quizAttempts_(user.uid).filter(function (a) { return a['受験ID'] === attemptId; })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (r['状態'] !== '受験中') return { ok: false, error: 'done' };
  var items = quizParseItems_(r['出題データ']);
  if (!quizItemsValid_(items)) return { ok: false, error: 'done' };   // 問題の入れ替え前に始めた受験
  var mockId = quizMockIdOf_(r);
  var mq = quizMockQuestions_(items);
  return { ok: true, attemptId: attemptId, mock: mockId, started: +new Date(r['開始日時']), minutes: QUIZ_MOCKS[mockId].minutes, questions: mq, passages: quizPassagesFor_(mq) };
}

function quizMockQuestions_(items) {
  return items.map(function (it) {
    var q = quizById_(it[0]), order = it[1].split('').map(Number), o = quizBase_(q);
    // 正解は返さない。選択肢を音声で読む問題は、選択肢の文字も返さない（番号だけ）
    o.ch = order.map(function (i, n) { return q.hid ? String(n + 1) : q.ch[i]; });
    if (q.au) o.q = '';   // 聴解の質問は音声で聞く
    return o;
  });
}

function quizMockSubmit_(user, attemptId, answers) {
  var ash = quizAttemptSheet_();
  var r = quizAttempts_(user.uid).filter(function (a) { return a['受験ID'] === attemptId; })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (r['状態'] !== '受験中') return { ok: false, error: 'done' };
  answers = Array.isArray(answers) ? answers : [];
  var mockId = quizMockIdOf_(r), M = QUIZ_MOCKS[mockId];

  var items = quizParseItems_(r['出題データ']);
  if (!quizItemsValid_(items)) return { ok: false, error: 'done' };
  var ok = 0, points = 0, byCat = {}, byKind = {};
  var results = items.map(function (it, i) {
    var q = quizById_(it[0]), order = it[1].split('').map(Number), a = order.indexOf(quizAnsOf_(q));
    var k = (typeof answers[i] === 'number' && answers[i] >= 0 && answers[i] < order.length && answers[i] % 1 === 0) ? answers[i] : null;
    var right = k === a;
    if (right) { ok++; points += quizPointOf_(mockId, q); }
    byCat[q.c] = byCat[q.c] || [0, 0]; byCat[q.c][1]++; if (right) byCat[q.c][0]++;
    byKind[q.k] = byKind[q.k] || [0, 0]; byKind[q.k][1]++; if (right) byKind[q.k][0]++;
    var o = quizBase_(q);
    o.ch = order.map(function (j) { return q.ch[j]; }); o.a = a; o.you = k; o.e = q.e;
    return o;
  });
  var pct = Math.round(ok / items.length * 100);
  var maxPoints = quizMaxPoints_(mockId);
  var set = { '状態': '提出済', '正解数': ok, '正答率': pct + '%', '終了日時': new Date() };
  var out = { ok: true, mock: mockId, correct: ok, total: items.length, pct: pct, byCat: byCat, byKind: byKind, results: results, passages: quizPassagesFor_(results) };
  if (maxPoints) {
    points = Math.round(points * 10) / 10;
    out.points = points; out.maxPoints = maxPoints; out.passPoints = M.passPoints; out.pass = points >= M.passPoints;
    set['得点'] = points; set['合否'] = out.pass ? '合格ライン' : '未達';
  }
  var names = M.exam === 'n3' ? QUIZ_N3.kinds : QUIZ_KINDS;
  var catText = M.exam === 'n3' ? '' : Object.keys(QUIZ_CATS).map(function (c) { var v = byCat[c] || [0, 0]; return QUIZ_CATS[c] + ' ' + v[0] + '/' + v[1]; }).join('、') + '、';
  set['分野別'] = catText + Object.keys(names).filter(function (k) { return byKind[k]; }).map(function (k) { return names[k] + ' ' + byKind[k][0] + '/' + byKind[k][1]; }).join('、');
  Object.keys(set).forEach(function (k) { ash.getRange(r._row, quizCol_(ash, k)).setValue(set[k]); });
  return out;
}

// ============================================================
// 回数の付与（手作業・将来の決済連携から使う）
// ============================================================
function addMockCredits_(uid, n, memo) {
  return quizWithLock_(function () {
    var sh = quizCreditSheet_();
    var row = sheetObjects_(sh).filter(function (r) { return r['LINE userId'] === uid; })[0];
    if (!row) {
      quizCreditRow_({ uid: uid, name: '' }, true);
      row = sheetObjects_(sh).filter(function (r) { return r['LINE userId'] === uid; })[0];
    }
    var left = quizNum_(row['残り回数']) + n;
    sh.getRange(row._row, quizCol_(sh, '残り回数')).setValue(left);
    sh.getRange(row._row, quizCol_(sh, '付与回数合計')).setValue(quizNum_(row['付与回数合計']) + n);
    if (memo) {
      var c = quizCol_(sh, 'メモ'), old = String(row['メモ'] || '');
      sh.getRange(row._row, c).setValue((old ? old + ' / ' : '') + memo);
    }
    return left;
  });
}

// スプレッドシートのメニューから：「模擬テスト回数」シートで選んでいる行の人に10回分を付与
function menuGiveMockCredits() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== QUIZ_CREDIT_SHEET) { ui.alert('「' + QUIZ_CREDIT_SHEET + '」シートで、付与したい人の行を選んでから実行してください。'); return; }
  var r = sh.getActiveRange().getRow();
  if (r < 2) { ui.alert('付与したい人の行（2行目以降）を選んでください。'); return; }
  var uid = sh.getRange(r, quizCol_(sh, 'LINE userId')).getValue();
  var name = sh.getRange(r, quizCol_(sh, 'LINE表示名')).getValue();
  if (!uid) { ui.alert('この行には LINE userId がありません。'); return; }
  var ans = ui.alert('回数券を付与しますか？', name + ' さんに ' + QUIZ_PACK.count + '回分（' + QUIZ_PACK.priceTax + '円分。1回分＝' + QUIZ_PACK.hours + '時間）を付与します。', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  var memo = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d') + ' +' + QUIZ_PACK.count + '回';
  var left = addMockCredits_(uid, QUIZ_PACK.count, memo);
  ui.alert('付与しました', name + ' さんの残り回数：' + left + '回', ui.ButtonSet.OK);
}

// ============================================================
// シート
// ============================================================
function quizCreditSheet_() { return sheetWithHeaders_(QUIZ_CREDIT_SHEET, QUIZ_CREDIT_HEADERS); }
function quizAttemptSheet_() { return sheetWithHeaders_(QUIZ_ATTEMPT_SHEET, QUIZ_ATTEMPT_HEADERS); }
function quizUseSheet_() { return sheetWithHeaders_(QUIZ_USE_SHEET, QUIZ_USE_HEADERS); }
function quizCol_(sh, name) { return colIndex_(sh, name); }
function quizNum_(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

// その人の行を返す（なければ作る）。表示名が変わっていたら更新する
function quizCreditRow_(user, create) {
  var sh = quizCreditSheet_();
  var row = sheetObjects_(sh).filter(function (r) { return r['LINE userId'] === user.uid; })[0];
  if (row) {
    if (user.name && row['LINE表示名'] !== user.name) sh.getRange(row._row, quizCol_(sh, 'LINE表示名')).setValue(safe_(user.name));
    return row;
  }
  if (!create) return null;
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var vals = { 'LINE userId': user.uid, 'LINE表示名': safe_(user.name), '残り回数': 0, '付与回数合計': 0, '初回アクセス': new Date() };
  sh.appendRow(head.map(function (h) { return vals[h] == null ? '' : vals[h]; }));
  return sheetObjects_(sh).filter(function (r) { return r['LINE userId'] === user.uid; })[0];
}

function quizAttempts_(uid) {
  return sheetObjects_(quizAttemptSheet_()).filter(function (r) { return r['LINE userId'] === uid; });
}

function quizOpenAttempt_(uid) {
  var limit = Date.now() - QUIZ_RESUME_HOURS * 3600 * 1000;
  return quizAttempts_(uid).filter(function (r) {
    return r['状態'] === '受験中' && new Date(r['開始日時']).getTime() > limit && quizItemsValid_(quizParseItems_(r['出題データ']));
  }).pop() || null;
}

function quizParseItems_(s) { try { return JSON.parse(s) || []; } catch (e) { return []; } }
function quizItemsValid_(items) { return items.length > 0 && items.every(function (it) { return !!quizById_(it[0]); }); }

var QUIZ_INDEX_ = null;
function quizById_(id) {
  if (!QUIZ_INDEX_) { QUIZ_INDEX_ = {}; QUIZ_BANK.forEach(function (q) { QUIZ_INDEX_[q.id] = q; }); }
  return QUIZ_INDEX_[id];
}

function quizShuffle_(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ============================================================
// 初期設定（エディタから1回実行）
// ============================================================
function setupQuiz() {
  quizCreditSheet_();
  quizAttemptSheet_();
  quizUseSheet_();
  var ch = PropertiesService.getScriptProperties().getProperty('LIFF_CHANNEL_ID');
  var n3 = QUIZ_BANK.filter(function (q) { return q.x === 'n3'; }).length;
  console.log('問題数: 技能 ' + (QUIZ_BANK.length - n3) + '問・N3 ' + n3 + '問');
  Object.keys(QUIZ_MOCKS).forEach(function (id) {
    var m = QUIZ_MOCKS[id];
    console.log('模擬テスト「' + m.name + '」: ' + quizMockSize_(id) + '問・' + m.minutes + '分' + (quizMaxPoints_(id) ? '・' + quizMaxPoints_(id) + '点満点' : ''));
  });
  console.log('LIFF_CHANNEL_ID: ' + (ch ? '設定済み（' + ch + '）' : '未設定 → スクリプトプロパティに追加してください'));
  console.log('シート「' + QUIZ_CREDIT_SHEET + '」「' + QUIZ_ATTEMPT_SHEET + '」「' + QUIZ_USE_SHEET + '」を用意しました: ' + ss_().getUrl());
}
