/**
 * Job Change Japan — 特定技能2号 外食業 練習問題（LINE友だち限定）
 *
 * しくみ
 *  - 練習問題ページ（quiz/index.html, LIFF）が LINE ログインのアクセストークンを送ってくる
 *  - このGASで「本物のトークンか」「公式LINEの友だちか」を確認してから問題を返す
 *  - 練習（分野別・全問）は友だちなら無料。模擬テストは回数券（500円で10回）を1回分使う
 *  - 模擬テストは本番と同じ 学科35問＋実技20問（判断・計画立案）＝55問・70分・250点満点
 *  - 問題の順番と選択肢の順番は毎回シャッフル。模擬テストはまだ出ていない問題を優先して出す
 *
 * スクリプトプロパティ（追加分）
 *   LIFF_CHANNEL_ID : LINEログインチャネルの「チャネルID」（数字）  ※必須
 *
 * シート（setupQuiz で作成）
 *   模擬テスト回数 : 人ごとの残り回数。手で数字を書き換えても反映される
 *   模擬テスト受験 : 受験の記録（開始・提出・点数）
 *
 * 問題データは QuizBank.gs（quiz/build/build.py で自動生成。手で編集しない）
 */

var QUIZ_PACK = { price: 500, count: 10 };          // 回数券：500円で10回
// 本番の出題配分：[分野, 種類, 問題数, 1問の点数]
//  学科は実施要領の配点（衛生4点・調理2点・接客3点・店舗運営4点＝120点）
//  実技は合計130点（満点250点 − 学科120点）を20問で割った目安
var QUIZ_MOCK_PLAN = [
  ['eisei', 'gakka', 10, 4], ['chori', 'gakka', 5, 2], ['sekkyaku', 'gakka', 10, 3], ['unei', 'gakka', 10, 4],
  ['eisei', 'handan', 3, 6.5], ['eisei', 'keikaku', 2, 6.5],
  ['chori', 'handan', 3, 6.5], ['chori', 'keikaku', 2, 6.5],
  ['sekkyaku', 'handan', 3, 6.5], ['sekkyaku', 'keikaku', 2, 6.5],
  ['unei', 'handan', 3, 6.5], ['unei', 'keikaku', 2, 6.5]
];
var QUIZ_MOCK_MINUTES = 70;                         // 本番の試験時間
var QUIZ_PASS_POINTS = 163;                         // 合格基準点（250点満点の65％）
var QUIZ_RESUME_HOURS = 24;                         // 途中でやめた模擬テストを、続きから受けられる時間

var QUIZ_CREDIT_SHEET = '模擬テスト回数';
var QUIZ_CREDIT_HEADERS = ['LINE userId', 'LINE表示名', '残り回数', '付与回数合計', '最終利用', '初回アクセス', 'メモ'];
var QUIZ_ATTEMPT_SHEET = '模擬テスト受験';
var QUIZ_ATTEMPT_HEADERS = ['開始日時', '受験ID', 'LINE userId', 'LINE表示名', '状態', '正解数', '問題数', '正答率', '分野別', '終了日時', '出題データ', '得点', '合否'];

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
    case 'practice': return { ok: true, questions: quizPractice_(String(b.cat || 'all')) };
    case 'mock_start': return quizWithLock_(function () { return quizMockStart_(user); });
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
// 練習（無料）
// ============================================================
function quizMe_(user) {
  var row = quizWithLock_(function () { return quizCreditRow_(user, true); });
  var counts = { handan: 0, keikaku: 0 };
  QUIZ_BANK.forEach(function (q) {
    if (q.k === 'gakka') counts[q.c] = (counts[q.c] || 0) + 1; else counts[q.k]++;
  });
  var open = quizOpenAttempt_(user.uid);
  return {
    ok: true, name: user.name, credits: quizNum_(row['残り回数']), pack: QUIZ_PACK,
    counts: counts, total: QUIZ_BANK.length, mockSize: quizMockSize_(), mockMinutes: QUIZ_MOCK_MINUTES,
    maxPoints: quizMaxPoints_(), passPoints: QUIZ_PASS_POINTS,
    open: open ? { attemptId: open['受験ID'], started: +new Date(open['開始日時']) } : null
  };
}

function quizPractice_(cat) {
  // cat：分野名（その分野の学科）／handan・keikaku（実技の全分野）／all
  var list = cat === 'all' ? QUIZ_BANK : QUIZ_BANK.filter(function (q) {
    return (cat === 'handan' || cat === 'keikaku') ? q.k === cat : (q.k === 'gakka' && q.c === cat);
  });
  return quizShuffle_(list).map(function (q) {
    var order = quizShuffle_([0, 1, 2]);
    return { id: q.id, c: q.c, k: q.k, q: q.q, ch: order.map(function (i) { return q.ch[i]; }), a: order.indexOf(0), e: q.e };
  });
}

// ============================================================
// 模擬テスト（有料・回数券）
// ============================================================
function quizMockSize_() { return QUIZ_MOCK_PLAN.reduce(function (a, p) { return a + p[2]; }, 0); }
function quizMaxPoints_() { return QUIZ_MOCK_PLAN.reduce(function (a, p) { return a + p[2] * p[3]; }, 0); }
function quizPointOf_(q) {
  var p = QUIZ_MOCK_PLAN.filter(function (x) { return x[0] === q.c && x[1] === q.k; })[0];
  return p ? p[3] : 0;
}

function quizMockStart_(user) {
  var sh = quizCreditSheet_();
  var row = quizCreditRow_(user, true);
  var left = quizNum_(row['残り回数']);
  if (left <= 0) return { ok: false, error: 'no_credits', credits: 0, pack: QUIZ_PACK };

  // 前に受けた模擬テストで出た問題は、あとに回す
  var seen = {};
  quizAttempts_(user.uid).forEach(function (r) {
    quizParseItems_(r['出題データ']).forEach(function (it) { seen[it[0]] = 1; });
  });
  var gakka = [], jitsugi = [];
  QUIZ_MOCK_PLAN.forEach(function (p) {
    var pool = QUIZ_BANK.filter(function (q) { return q.c === p[0] && q.k === p[1]; });
    var fresh = quizShuffle_(pool.filter(function (q) { return !seen[q.id]; }));
    var old = quizShuffle_(pool.filter(function (q) { return seen[q.id]; }));
    var take = fresh.concat(old).slice(0, p[2]);
    if (p[1] === 'gakka') gakka = gakka.concat(take); else jitsugi = jitsugi.concat(take);
  });
  // 本番と同じく、学科のあとに実技（それぞれの中はシャッフル）
  var items = quizShuffle_(gakka).concat(quizShuffle_(jitsugi)).map(function (q) { return [q.id, quizShuffle_([0, 1, 2]).join('')]; });

  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000);
  sh.getRange(row._row, quizCol_(sh, '残り回数')).setValue(left - 1);
  sh.getRange(row._row, quizCol_(sh, '最終利用')).setValue(new Date());
  var ash = quizAttemptSheet_();
  var head = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
  var vals = { '開始日時': new Date(), '受験ID': id, 'LINE userId': user.uid, 'LINE表示名': safe_(user.name), '状態': '受験中', '問題数': items.length, '出題データ': JSON.stringify(items) };
  ash.appendRow(head.map(function (h) { return vals[h] == null ? '' : vals[h]; }));

  return { ok: true, attemptId: id, credits: left - 1, started: +vals['開始日時'], minutes: QUIZ_MOCK_MINUTES, questions: quizMockQuestions_(items) };
}

function quizMockResume_(user, attemptId) {
  var r = quizAttempts_(user.uid).filter(function (a) { return a['受験ID'] === attemptId; })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (r['状態'] !== '受験中') return { ok: false, error: 'done' };
  var items = quizParseItems_(r['出題データ']);
  if (!quizItemsValid_(items)) return { ok: false, error: 'done' };   // 問題の入れ替え前に始めた受験
  return { ok: true, attemptId: attemptId, started: +new Date(r['開始日時']), minutes: QUIZ_MOCK_MINUTES, questions: quizMockQuestions_(items) };
}

function quizMockQuestions_(items) {
  return items.map(function (it) {
    var q = quizById_(it[0]), order = it[1].split('').map(Number);
    return { id: q.id, c: q.c, k: q.k, q: q.q, ch: order.map(function (i) { return q.ch[i]; }) };   // 正解は返さない
  });
}

function quizMockSubmit_(user, attemptId, answers) {
  var ash = quizAttemptSheet_();
  var r = quizAttempts_(user.uid).filter(function (a) { return a['受験ID'] === attemptId; })[0];
  if (!r) return { ok: false, error: 'not_found' };
  if (r['状態'] !== '受験中') return { ok: false, error: 'done' };
  answers = Array.isArray(answers) ? answers : [];

  var items = quizParseItems_(r['出題データ']);
  if (!quizItemsValid_(items)) return { ok: false, error: 'done' };
  var ok = 0, points = 0, byCat = {}, byKind = {};
  var results = items.map(function (it, i) {
    var q = quizById_(it[0]), order = it[1].split('').map(Number), a = order.indexOf(0);
    var k = answers[i] === 0 || answers[i] === 1 || answers[i] === 2 ? answers[i] : null;
    var right = k === a;
    if (right) { ok++; points += quizPointOf_(q); }
    byCat[q.c] = byCat[q.c] || [0, 0]; byCat[q.c][1]++; if (right) byCat[q.c][0]++;
    byKind[q.k] = byKind[q.k] || [0, 0]; byKind[q.k][1]++; if (right) byKind[q.k][0]++;
    return { id: q.id, c: q.c, k: q.k, q: q.q, ch: order.map(function (j) { return q.ch[j]; }), a: a, you: k, e: q.e };
  });
  points = Math.round(points * 10) / 10;
  var pct = Math.round(ok / items.length * 100);
  var pass = points >= QUIZ_PASS_POINTS;
  var catText = Object.keys(QUIZ_CATS).map(function (c) { var v = byCat[c] || [0, 0]; return QUIZ_CATS[c] + ' ' + v[0] + '/' + v[1]; })
    .concat(Object.keys(QUIZ_KINDS).map(function (k) { var v = byKind[k] || [0, 0]; return QUIZ_KINDS[k] + ' ' + v[0] + '/' + v[1]; })).join('、');
  var set = { '状態': '提出済', '正解数': ok, '正答率': pct + '%', '分野別': catText, '終了日時': new Date(), '得点': points, '合否': pass ? '合格ライン' : '未達' };
  Object.keys(set).forEach(function (k) { ash.getRange(r._row, quizCol_(ash, k)).setValue(set[k]); });

  return { ok: true, correct: ok, total: items.length, pct: pct, points: points, maxPoints: quizMaxPoints_(), passPoints: QUIZ_PASS_POINTS, pass: pass, byCat: byCat, byKind: byKind, results: results };
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
  var ans = ui.alert('模擬テストの回数を付与しますか？', name + ' さんに ' + QUIZ_PACK.count + '回分（' + QUIZ_PACK.price + '円分）を付与します。', ui.ButtonSet.YES_NO);
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
  var ch = PropertiesService.getScriptProperties().getProperty('LIFF_CHANNEL_ID');
  console.log('問題数: ' + QUIZ_BANK.length + '問（模擬テスト ' + quizMockSize_() + '問・' + QUIZ_MOCK_MINUTES + '分・' + quizMaxPoints_() + '点満点）');
  console.log('LIFF_CHANNEL_ID: ' + (ch ? '設定済み（' + ch + '）' : '未設定 → スクリプトプロパティに追加してください'));
  console.log('シート「' + QUIZ_CREDIT_SHEET + '」「' + QUIZ_ATTEMPT_SHEET + '」を用意しました: ' + ss_().getUrl());
}
