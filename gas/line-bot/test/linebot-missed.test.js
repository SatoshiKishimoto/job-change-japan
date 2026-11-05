// 取りこぼしたステップ配信をまとめて送る（menuSendMissedSteps）のテスト
// 実行: node gas/line-bot/test/linebot-missed.test.js
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


const reg = ctx.regSheet_();
const head = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
const row = o => head.map(h => o[h] === undefined ? '' : o[h]);
const daysAgo = n => new Date(Date.now() - n * 86400000);
const add = (uid, d, done, o) => reg.appendRow(row(Object.assign({ '登録日時': daysAgo(d), 'LINE userId': uid, 'お名前': uid, '言語': 'English', 'ステップ送信済': done, '雇用形態': '正社員・フルタイム' }, o || {})));
add('UA', 22, '1,3');                           // 5日後・7日後を取りこぼし
add('UB', 19, '1', { '言語': 'नेपाली' });        // 3・5・7日後
add('UC', 9, '1,3,5,7');                        // すべて送信済み
add('UD', 6, '1,3,5');                          // 7日後はまだ期間内（毎朝の配信に任せる）
add('UE', 2, '1');                              // まだ途中
add('UF', 22, '1,3', { 'ブロック': '○' });      // ブロック
add('UG', 22, '1,3', { '言語': 'नेपाली' });      // 同じ人の2行目（アルバイト）
add('UG', 10, '', { '言語': 'नेपाली', '雇用形態': 'アルバイト' });
add('UH', 22, '1,3');                           // 練習問題の一斉案内を受け取り済み → 7日後だけ
add('UI', 22, '1,3,7');                         // 受け取り済みで5日後だけ足りない → 送らずに記録だけ
props.QUIZ_ANNOUNCED = JSON.stringify({ UH: 1, UI: 1 });

const plan = ctx.missedStepsPlan_();
const pick = id => plan.find(p => p.uid === id);
assert.strictEqual(JSON.stringify(plan.map(p => p.uid).sort()), JSON.stringify(['UA', 'UB', 'UG', 'UH', 'UI']));
assert.deepStrictEqual([...pick('UA').send], [5, 7]);
assert.deepStrictEqual([...pick('UB').send], [3, 5, 7]);
assert.deepStrictEqual([...pick('UG').steps], [5, 7]);
assert.strictEqual(pick('UG').baito, true);
assert.deepStrictEqual([...pick('UH').send], [7]);
assert.deepStrictEqual([...pick('UI').send], []);

calls.length = 0; uiAnswer = 'YES';
ctx.menuSendMissedSteps();
const pushes = calls.filter(c => /message\/push/.test(c.url));
assert.strictEqual(pushes.length, 4, 'one push per person (UI gets none)');
const by = id => pushes.find(p => p.body.to === id).body.messages.map(m => m.text);
assert.strictEqual(by('UA').length, 2); assert.ok(by('UA')[0].includes('特定技能2号を目指す方へ') && by('UA')[1].includes('ask us anytime'));
assert.strictEqual(by('UB').length, 3); assert.ok(by('UB')[0].includes('काम बदल्दा'), 'Nepali full-time step 3');
assert.strictEqual(by('UH').length, 1);
assert.ok(alerts.pop()[1].includes('4人'));
const doneOf = id => JSON.parse(JSON.stringify(ctx.sheetObjects_(reg).filter(r => r['LINE userId'] === id).map(r => r['ステップ送信済'])));
assert.deepStrictEqual(doneOf('UA'), ['1,3,5,7']);
assert.deepStrictEqual(doneOf('UB'), ['1,3,5,7']);
assert.deepStrictEqual(doneOf('UG'), ['1,3,5,7', '5,7']);
assert.deepStrictEqual(doneOf('UI'), ['1,3,5,7']);
assert.deepStrictEqual(doneOf('UD'), ['1,3,5']);
assert.deepStrictEqual(doneOf('UF'), ['1,3']);
// 2回目は何も送らない
calls.length = 0; ctx.menuSendMissedSteps();
assert.strictEqual(calls.filter(c => /message\/push/.test(c.url)).length, 0);
assert.ok(alerts.pop()[1].includes('ありません'));
// 毎朝の配信とぶつからない（UDの7日後は、期間に入ったら runDaily が送る）
assert.strictEqual(ctx.missedStepsPlan_().length, 0);
console.log('ALL TESTS PASSED');
