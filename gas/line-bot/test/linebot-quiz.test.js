// LINEボットの練習問題まわり（キーワード返信・5日後のステップ配信・リッチメニュー・一斉案内）のテスト
// 実行: node gas/line-bot/test/linebot-quiz.test.js
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

// --- キーワード返信（言語ごと） ---
for (const [lang, kw, expect] of [['ja', '練習問題', '練習問題'], ['en', 'Practice', 'Practice test'], ['vi', 'thi thử', 'luyện thi'], ['ne', 'परीक्षा', 'अभ्यास']]) {
  props['u_U' + lang] = JSON.stringify({ lang });
  post({ type: 'message', replyToken: 'r', source: { userId: 'U' + lang }, message: { type: 'text', text: kw } });
  const t = lastReply();
  assert.ok(t.includes(URL), lang + ' has url');
  assert.ok(t.includes(expect), lang + ' text: ' + t.slice(0, 60));
  if (lang === 'ja' || lang === 'en') assert.ok(t.includes('練習問題') && t.includes('Practice test'), 'ja/en bilingual');
}
console.log('keyword replies OK');

// --- 5日後のステップ配信 ---
const reg = ctx.regSheet_();
const head = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
const row = o => head.map(h => o[h] === undefined ? '' : o[h]);
const daysAgo = n => new Date(Date.now() - n * 86400000);
reg.appendRow(row({ '登録日時': daysAgo(5), 'LINE userId': 'Ustep', '言語': 'नेपाली', 'ステップ送信済': '1,3', '雇用形態': '正社員・フルタイム' }));
reg.appendRow(row({ '登録日時': daysAgo(5), 'LINE userId': 'Ubaito', '言語': 'English', 'ステップ送信済': '1,3', '雇用形態': 'アルバイト' }));
reg.appendRow(row({ '登録日時': daysAgo(20), 'LINE userId': 'Uold', '言語': '日本語', 'ステップ送信済': '1,3,7' }));
reg.appendRow(row({ '登録日時': daysAgo(2), 'LINE userId': 'Ublock', '言語': '日本語', 'ブロック': '○' }));
calls.length = 0;
ctx.sendSteps_();
const pushes = calls.filter(c => /message\/push/.test(c.url));
assert.strictEqual(pushes.length, 2, 'step5 to 2 people');
assert.ok(pushes.every(p => p.body.messages[0].text.includes(URL)));
assert.ok(pushes.find(p => p.body.to === 'Ustep').body.messages[0].text.includes('विशिष्ट सीप २'));
const steps = ctx.sheetObjects_(reg).filter(r => r['LINE userId'] === 'Ustep')[0]['ステップ送信済'];
assert.strictEqual(steps, '1,3,5');
calls.length = 0; ctx.sendSteps_();
assert.strictEqual(calls.filter(c => /message\/push/.test(c.url)).length, 0, 'not sent twice');
console.log('step 5 OK');

// --- リッチメニュー ---
calls.length = 0;
ctx.setupRichMenu();
const menu = calls.find(c => /v2\/bot\/richmenu$/.test(c.url)).body;
assert.deepStrictEqual(menu.size, { width: 2500, height: 1686 });
assert.strictEqual(menu.areas.length, 6);
const right = menu.areas.map(a => a.bounds.x + a.bounds.width);
assert.deepStrictEqual(right, [833, 1667, 2500, 833, 1667, 2500]);
assert.deepStrictEqual(menu.areas[2].action, { type: 'uri', uri: URL });
assert.strictEqual(menu.areas[5].action.uri, ctx.SITE_URL);
assert.deepStrictEqual(menu.areas.map(a => a.action.data || 'uri'), ['menu=register', 'menu=jobs', 'uri', 'menu=ask', 'menu=lang', 'uri']);
console.log('rich menu OK');

// --- 一斉案内（1回だけ） ---
calls.length = 0;
ctx.menuAnnounceQuiz();
const mc = calls.filter(c => /multicast/.test(c.url));
const sentTo = mc.flatMap(c => c.body.to).sort();
assert.deepStrictEqual(sentTo, ['Ubaito', 'Uold', 'Ustep']);   // ブロックした人には送らない
assert.ok(mc.every(c => c.body.messages[0].text.includes(URL)));
calls.length = 0;
ctx.menuAnnounceQuiz();
assert.strictEqual(calls.filter(c => /multicast/.test(c.url)).length, 0, 'second run sends nothing');
assert.ok(alerts.pop()[1].includes('いません'));
console.log('announce OK');

console.log('ALL TESTS PASSED');
