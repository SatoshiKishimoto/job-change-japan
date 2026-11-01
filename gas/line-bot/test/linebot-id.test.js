// インドネシア語（id）の流れのテスト：言語選択→登録（フルタイム・アルバイト）→求人→応募→ステップ配信
// 実行: node gas/line-bot/test/linebot-id.test.js
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


const allReplies = () => calls.filter(c => /message\/(reply|push)/.test(c.url)).flatMap(c => c.body.messages);
const reply = () => calls.filter(c => /message\/reply/.test(c.url)).pop().body.messages;
const pb = (uid, data) => { calls.length = 0; post({ type: 'postback', replyToken: 'r', source: { userId: uid }, postback: { data } }); return reply(); };
const say = (uid, text) => { calls.length = 0; post({ type: 'message', replyToken: 'r', source: { userId: uid }, message: { type: 'text', text } }); return reply(); };
const labels = m => (m.quickReply ? m.quickReply.items.map(i => i.action.label) : []);

// 友だち追加 → 言語メニューに Bahasa Indonesia
calls.length = 0;
post({ type: 'follow', replyToken: 'r', source: { userId: 'Uid1' } });
const lm = reply().find(m => m.quickReply);
assert.ok(labels(lm).includes('Bahasa Indonesia'), labels(lm).join(','));
labels(lm).forEach(l => assert.ok([...l].length <= 20));

// 言語を選ぶ
let m = pb('Uid1', 'lang=id');
const all = m.map(x => x.text).join('\n');
assert.ok(/Pendaftaran|daftar/i.test(all), all.slice(0, 200));

// 登録（フルタイム）
const flow = (uid, picks) => {
  let ms = pb(uid, 'menu=register');
  for (const [q, i] of picks) {
    const qm = ms.find(x => x.quickReply);
    assert.ok(qm, 'question ' + q);
    labels(qm).forEach(l => assert.ok([...l].length <= 20, 'label too long: ' + l));
    ms = pb(uid, 'q=' + q + '&i=' + i);
  }
  return ms;
};
let ms = flow('Uid1', [['q0', 0], ['q1', 0], ['q2', 0], ['q3', 2], ['q4', 0], ['q5', 0]]);
assert.ok(ms.map(x => x.text).join('\n').includes('nama'), 'asks name in Indonesian');
ms = say('Uid1', 'SITI RAHAYU');
const done = ms.map(x => x.text).join('\n');
assert.ok(done.includes('Terima kasih, SITI RAHAYU') && done.includes('Pendaftaran berhasil'), done);
const reg = ctx.regSheet_();
const r1 = ctx.sheetObjects_(reg).filter(r => r['LINE userId'] === 'Uid1')[0];
assert.deepStrictEqual([r1['言語'], r1['希望職種'], r1['在留資格'], r1['日本語'], r1['希望勤務地'], r1['就業開始'], r1['雇用形態']],
  ['Bahasa Indonesia', '外食業', '特定技能1号', 'N3', '大阪府', 'すぐに働ける', '正社員・フルタイム']);
console.log('full-time registration OK');

// 登録（アルバイト・許可なし）
pb('Uid2', 'lang=id');
ms = flow('Uid2', [['q0', 1], ['q1', 0], ['b2', 2], ['q3', 3], ['q4', 0], ['b5', 2]]);
const bt = allReplies().map(x => x.text).join('\n');
ms = say('Uid2', 'BUDI SANTOSO');
const done2 = ms.map(x => x.text).join('\n');
assert.ok(done2.includes('28 jam'), 'baito rule in Indonesian: ' + done2.slice(-200));
const r2 = ctx.sheetObjects_(reg).filter(r => r['LINE userId'] === 'Uid2')[0];
assert.deepStrictEqual([r2['雇用形態'], r2['資格外活動許可'], r2['週の勤務時間'], r2['在留資格']], ['アルバイト', 'なし・わからない', '週20〜28時間', '留学']);
console.log('part-time registration OK');

// 求人・応募・キーワード
const jsh = ctx.jobSheet_ ? ctx.jobSheet_() : ctx.sheetWithHeaders_('求人', ctx.JOB_HEADERS);
const jh = jsh.getRange(1, 1, 1, jsh.getLastColumn()).getValues()[0];
jsh.appendRow(jh.map(h => ({ '求人ID': 'J001', '公開': '○', '職種': '外食業', '勤務地': '大阪府', 'タイトル': 'ホールスタッフ', '給与': '時給1200円', '雇用形態': '正社員・フルタイム' })[h] || ''));
ms = pb('Uid1', 'menu=jobs');
const jt = ms.map(x => x.text || JSON.stringify(x)).join('\n');
assert.ok(jt.includes('Lowongan yang cocok') && jt.includes('apply J001') && jt.includes('Jenis kontrak: Penuh waktu'), jt.slice(0, 400));
ms = say('Uid1', 'lamar J001');
assert.ok(ms.map(x => x.text).join('\n').includes('Lamaran Anda sudah kami terima'));
ms = say('Uid1', 'lowongan');
assert.ok(ms.map(x => x.text || JSON.stringify(x)).join('\n').includes('Lowongan'));
ms = say('Uid1', 'latihan');
assert.ok(ms.map(x => x.text).join('\n').includes(URL) && ms.map(x => x.text).join('\n').includes('Latihan soal'));
console.log('jobs / apply / keywords OK');

// ステップ配信（1・3・5・7日後、アルバイトの3日後）
const head2 = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
const row = o => head2.map(h => o[h] === undefined ? '' : o[h]);
const daysAgo = n => new Date(Date.now() - n * 86400000);
reg.appendRow(row({ '登録日時': daysAgo(1), 'LINE userId': 'Ustep', '言語': 'Bahasa Indonesia', 'ステップ送信済': '', '雇用形態': 'アルバイト' }));
const texts = [], dcol = head2.indexOf('登録日時');
for (const d of [1, 3, 5, 7]) {
  reg.data[reg.data.length - 1][dcol] = daysAgo(d);
  calls.length = 0; ctx.sendSteps_();
  calls.filter(c => /message\/push/.test(c.url) && c.body.to === 'Ustep').forEach(c => texts.push(c.body.messages[0].text));
}
assert.strictEqual(texts.length, 4, 'four steps: ' + texts.length);
assert.ok(texts[0].includes('Cara menggunakan'));
assert.ok(texts[1].includes('Aturan penting kerja paruh waktu'), 'baito step 3');
assert.ok(texts[2].includes('Tokutei Ginou 2') && texts[2].includes(URL));
assert.ok(texts[3].includes('bertanya kapan saja'));
console.log('steps OK');
console.log('ALL TESTS PASSED');
