// 求人が、あとから登録した人にも届くこと（登録完了の返信・受信求人・menuSendMissedJobs）のテスト
// 実行: node gas/line-bot/test/linebot-jobs.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const DIR = path.join(__dirname, '..') + '/';

function makeSheet(name, ss) {
  const data = [];
  const sh = {
    name, data, getName: () => name, getParent: () => ss,
    appendRow(r) { data.push(r.slice()); }, setFrozenRows() {},
    getLastRow: () => data.length, getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    getDataRange() { const w = sh.getLastColumn(); return { getValues: () => data.map(r => { const x = r.slice(); while (x.length < w) x.push(''); return x; }) }; },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const rg = {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
        getValue() { return rg.getValues()[0][0]; },
        setValue(v) { while (data.length < r) data.push([]); const row = data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; return rg; },
        setFontWeight() { return rg; }, setBackground() { return rg; }, setDataValidation() { return rg; }
      };
      return rg;
    }
  };
  return sh;
}
const ss = { sheets: {}, getId: () => 'SSID', getUrl: () => 'https://sheet', getSheetByName(n) { return this.sheets[n] || null; },
  insertSheet(n) { return (this.sheets[n] = makeSheet(n, ss)); }, getSheets() { return Object.values(this.sheets); }, deleteSheet(s) { delete this.sheets[s.name]; } };

const props = { SHEET_ID: 'SSID', LINE_TOKEN: 'x', LIFF_CHANNEL_ID: '1' };
const calls = [];
const ok = { getResponseCode: () => 200, getContentText: () => JSON.stringify({ richMenuId: 'rm1', richmenus: [], displayName: 'N' }), getBlob: () => ({ setContentType() { return { getBytes: () => [] }; } }) };
const UrlFetchApp = { fetch(url, opt) { calls.push({ url, body: opt && opt.payload && typeof opt.payload === 'string' ? JSON.parse(opt.payload) : null }); return ok; } };
let uiAnswer = 'YES'; const alerts = [];
const ui = { alert(...a) { alerts.push(a); return a.length > 2 ? uiAnswer : 'OK'; }, ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' }, Button: { YES: 'YES' } };
const ctx = {
  console, JSON, Math, Date, Array, Object, String, Number, parseInt, isNaN, Error,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, hasLock: () => false }) },
  SpreadsheetApp: { openById: () => ss, create: () => ss, getUi: () => ui },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Utilities: { formatDate: () => '261030', DigestAlgorithm: {}, computeDigest: () => [], base64EncodeWebSafe: () => '' },
  UrlFetchApp, MailApp: { sendEmail() {} }, Session: { getEffectiveUser: () => ({ getEmail: () => 'a@b' }) },
  LanguageApp: { translate: s => s }, ScriptApp: {},
};
vm.createContext(ctx);
for (const f of ['LineBot.gs', 'QuizBank.gs', 'Quiz.gs']) vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx, { filename: f });
const URL = ctx.QUIZ_URL;
assert.ok(/^https:\/\/liff\.line\.me\/\d+-\w+$/.test(URL));

const post = ev => ctx.doPost({ postData: { contents: JSON.stringify({ events: [ev] }) } });
const lastReply = () => calls.filter(c => /message\/reply/.test(c.url)).pop().body.messages.map(m => m.text).join('\n');



const reg = ctx.regSheet_(), jsh = ctx.jobSheet_();
const head = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
assert.ok(head.includes('受信求人'));
const jhead = jsh.getRange(1, 1, 1, jsh.getLastColumn()).getValues()[0];
const row = (h, o) => h.map(k => o[k] === undefined ? '' : o[k]);
const daysAgo = n => new Date(Date.now() - n * 86400000);
const sentAt = daysAgo(30);
const job = o => jsh.appendRow(row(jhead, Object.assign({ '公開': '○', '職種': '外食業', '勤務地': '大阪府', '給与': '1200円' }, o)));
job({ '求人ID': 'J001', 'タイトル': 'FT kitchen', '雇用形態': '正社員・フルタイム', '配信日時': sentAt, '配信人数': 1 });
job({ '求人ID': 'J002', 'タイトル': 'Baito A', '雇用形態': 'アルバイト', '配信日時': sentAt, '配信人数': 4 });
job({ '求人ID': 'J003', 'タイトル': 'Baito B', '雇用形態': 'アルバイト', '配信日時': sentAt, '配信人数': 4 });
job({ '求人ID': 'J004', 'タイトル': 'Baito Tokyo', '雇用形態': 'アルバイト', '勤務地': '東京都', '配信日時': sentAt });
const add = (uid, d, o) => reg.appendRow(row(head, Object.assign({ '登録日時': daysAgo(d), 'LINE userId': uid, 'お名前': uid, '言語': 'English',
  '希望職種': '外食業', '希望勤務地': '大阪府', '雇用形態': 'アルバイト' }, o || {})));
add('OLD', 40);                                    // 配信より前に登録 → もう届いている
add('NEW1', 10);                                   // 配信のあとに登録 → J002・J003 が届いていない
add('NEW2', 5, { '言語': 'नेपाली', '希望勤務地': 'その他' });   // 「その他」→ J002・J003・J004
add('FT', 10, { '雇用形態': '正社員・フルタイム' });   // フルタイム → J001
add('BLK', 10, { 'ブロック': '○' });
add('GOT', 10, { '受信求人': 'J002,J003' });       // 「求人を見る」などで受け取り済み

const plan = ctx.missedJobsPlan_();
const ids = id => (plan.find(p => p.uid === id) || { jobs: [] }).jobs.map(j => j['求人ID']).join(',');
assert.strictEqual(JSON.stringify(plan.map(p => p.uid)), JSON.stringify(['NEW1', 'NEW2', 'FT']));
assert.strictEqual(ids('NEW1'), 'J002,J003');
assert.strictEqual(ids('NEW2'), 'J002,J003,J004');
assert.strictEqual(ids('FT'), 'J001');

calls.length = 0; uiAnswer = 'YES';
ctx.menuSendMissedJobs();
const confirm = alerts[alerts.length - 2][1];
assert.ok(confirm.includes('NEW1：J002・J003') && confirm.includes('3人'), confirm);
const pushes = calls.filter(c => /message\/push/.test(c.url));
assert.strictEqual(pushes.length, 3, 'one push per person');
const msgs = id => pushes.find(p => p.body.to === id).body.messages.map(m => m.text);
assert.strictEqual(msgs('NEW1').length, 3);
assert.ok(msgs('NEW1')[0].includes('(2)') && msgs('NEW1')[1].includes('Baito A') && msgs('NEW1')[2].includes('Baito B'));
assert.ok(msgs('NEW2')[0].includes('मिल्ने'), 'Nepali heading');
const got = id => ctx.sheetObjects_(reg).filter(r => r['LINE userId'] === id).map(r => r['受信求人']).join('|');
assert.strictEqual(got('NEW1'), 'J002,J003');
assert.strictEqual(got('NEW2'), 'J002,J003,J004');
assert.strictEqual(got('OLD'), '');
// 2回目は送らない
calls.length = 0; ctx.menuSendMissedJobs();
assert.strictEqual(calls.filter(c => /message\/push/.test(c.url)).length, 0);
assert.ok(alerts.pop()[1].includes('いません'));

// まだ配信していない求人（J005）は、このメニューでは送らず「新着求人を今すぐ送る」に任せる
job({ '求人ID': 'J005', 'タイトル': 'Baito New', '雇用形態': 'アルバイト' });
assert.strictEqual(ctx.missedJobsPlan_().length, 0);

// 新しく登録した人：登録完了の返信に、条件に合う求人が付く（J005 もまだ配信前だが届ける）
ctx.setState_('U9', { lang: 'en', step: 'name', flow: 'baito', ans: { role: '外食業', location: '大阪府', type: 'アルバイト', visa: '留学' } });
calls.length = 0;
post({ type: 'message', replyToken: 'r', source: { userId: 'U9' }, message: { type: 'text', text: 'Ram Thapa' } });
const rep = calls.filter(c => /message\/reply/.test(c.url)).pop().body.messages.map(m => m.text);
assert.strictEqual(rep.length, 4, rep.join('\n---\n'));
assert.ok(rep[0].includes('Ram Thapa') && rep[0].includes('(3)'));
assert.ok(rep[1].includes('Baito A') && rep[2].includes('Baito B') && rep[3].includes('Baito New'));
assert.strictEqual(calls.filter(c => /message\/push|multicast/.test(c.url)).length, 0, 'reply only (free)');
assert.strictEqual(got('U9'), 'J002,J003,J005');

// 「新着求人を今すぐ送る」で J005 を配信：U9 にはもう届いているので送らない、NEW1・NEW2 には送る
calls.length = 0;
const n = ctx.sendNewJobs_(false);
const mc = calls.filter(c => /multicast/.test(c.url));
const to = [].concat(...mc.map(c => c.body.to)).sort();
assert.strictEqual(JSON.stringify(to), JSON.stringify(['GOT', 'NEW1', 'NEW2', 'OLD']));
assert.strictEqual(n, 4);
assert.strictEqual(got('NEW1'), 'J002,J003,J005');
assert.strictEqual(got('OLD'), 'J005');

// 登録済みの人が「求人を見る」で見た求人も、受け取り済みになる
add('VIEW', 3);
post({ type: 'message', replyToken: 'r', source: { userId: 'VIEW' }, message: { type: 'text', text: 'jobs' } });
assert.strictEqual(got('VIEW'), 'J002,J003,J005');
assert.strictEqual(ctx.missedJobsPlan_().length, 0);
// 配信の前に東京で登録 → 配信のあとに大阪へ登録し直した人には、大阪の求人がまだ届いていない
add('MOVE', 40, { '最終更新': daysAgo(2) });
assert.strictEqual(ctx.missedJobsPlan_().find(p => p.uid === 'MOVE').jobs.map(j => j['求人ID']).join(','), 'J002,J003');
// 登録し直しの流れ：同じ雇用形態の行を上書きし、条件に合う求人が返信に付く
ctx.setState_('MOVE', { lang: 'en', step: 'name', flow: 'baito', ans: { role: '外食業', location: '東京都', type: 'アルバイト', visa: '留学' } });
calls.length = 0;
post({ type: 'message', replyToken: 'r', source: { userId: 'MOVE' }, message: { type: 'text', text: 'Move Kun' } });
const rep2 = calls.filter(c => /message\/reply/.test(c.url)).pop().body.messages.map(m => m.text);
assert.ok(rep2[0].includes('updated') && rep2.some(x => x.includes('Baito Tokyo')), rep2.join('\n---\n'));
assert.strictEqual(ctx.findRegs_('MOVE').length, 1);
assert.strictEqual(ctx.findRegs_('MOVE')[0]['希望勤務地'], '東京都');
console.log('ALL TESTS PASSED');
