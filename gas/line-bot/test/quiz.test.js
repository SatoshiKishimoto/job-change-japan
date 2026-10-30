// 練習問題API（Quiz.gs）のテスト。GAS・LINE・シートをまねて動かす。 実行: node gas/line-bot/test/quiz.test.js
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), assert = require('assert');
const DIR = require('path').join(__dirname, '..') + '/';

function makeSheet(name, ss) {
  const data = [];
  const sh = {
    name, data,
    getName: () => name,
    getParent: () => ss,
    appendRow(r) { data.push(r.slice()); },
    setFrozenRows() {},
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    getDataRange() { const w = sh.getLastColumn(); return { getValues: () => data.map(r => { const x = r.slice(); while (x.length < w) x.push(''); return x; }) }; },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const rg = {
        getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
        getValue() { return rg.getValues()[0][0]; },
        setValue(v) { while (data.length < r) data.push([]); const row = data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; return rg; },
        setFontWeight() { return rg; }, setBackground() { return rg; }, setDataValidation() { return rg; }, getRow: () => r
      };
      return rg;
    }
  };
  return sh;
}
const ss = { sheets: {}, getId: () => 'SSID', getUrl: () => 'https://sheet', getSheetByName(n) { return this.sheets[n] || null; },
  insertSheet(n) { return (this.sheets[n] = makeSheet(n, ss)); }, getSheets() { return Object.values(this.sheets); }, deleteSheet(s) { delete this.sheets[s.name]; } };

const props = { SHEET_ID: 'SSID', LINE_TOKEN: 'x', LIFF_CHANNEL_ID: '1650000000' };
const cache = {};
// token -> {uid,name,friend,client}
const TOKENS = {
  good: { uid: 'Uaaa', name: 'Ram', friend: true, client: '1650000000' },
  good2: { uid: 'Ubbb', name: 'Lan', friend: true, client: '1650000000' },
  nofriend: { uid: 'Uccc', name: 'Tom', friend: false, client: '1650000000' },
  other: { uid: 'Uddd', name: 'X', friend: true, client: '999' },
};
let fetchCount = 0;
function resp(code, obj) { return { getResponseCode: () => code, getContentText: () => JSON.stringify(obj) }; }
const UrlFetchApp = {
  fetch(url, opt) {
    fetchCount++;
    const auth = opt && opt.headers && opt.headers.Authorization;
    if (url.startsWith('https://api.line.me/oauth2/v2.1/verify')) {
      const t = decodeURIComponent(url.split('access_token=')[1]); const u = TOKENS[t];
      return u ? resp(200, { scope: 'profile openid', client_id: u.client, expires_in: 1000 }) : resp(400, { error: 'invalid_request' });
    }
    const t = auth && auth.replace('Bearer ', ''); const u = TOKENS[t];
    if (url === 'https://api.line.me/v2/profile') return u ? resp(200, { userId: u.uid, displayName: u.name }) : resp(401, {});
    if (url === 'https://api.line.me/friendship/v1/status') return u ? resp(200, { friendFlag: u.friend }) : resp(401, {});
    throw new Error('unexpected fetch ' + url);
  }
};
const ctx = {
  console, JSON, Math, Date, Array, Object, String, Number, parseInt, isNaN, Error,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, hasLock: () => false }) },
  SpreadsheetApp: { openById: () => ss, create: () => ss },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
    base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'),
    formatDate: (d, tz, f) => '261030221500',
  },
  UrlFetchApp, MailApp: { sendEmail() {} }, Session: { getEffectiveUser: () => ({ getEmail: () => 'a@b' }) },
  LanguageApp: { translate: s => s }, ScriptApp: {},
};
vm.createContext(ctx);
for (const f of ['LineBot.gs', 'QuizBank.gs', 'Quiz.gs']) vm.runInContext(fs.readFileSync(DIR + f, 'utf8'), ctx, { filename: f });

const call = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).s);

// --- auth ---
assert.deepStrictEqual(call({ api: 'me', token: 'bogus' }), { ok: false, error: 'auth' });
assert.deepStrictEqual(call({ api: 'me', token: 'other' }), { ok: false, error: 'auth' }, 'wrong channel rejected');
let r = call({ api: 'me', token: 'nofriend' });
assert.strictEqual(r.error, 'not_friend'); assert.strictEqual(r.name, 'Tom');
assert.ok(!Object.keys(cache).length, 'non-friend not cached');
// becomes friend -> immediately ok
TOKENS.nofriend.friend = true;
assert.strictEqual(call({ api: 'me', token: 'nofriend' }).ok, true);

// --- me ---
r = call({ api: 'me', token: 'good' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.credits, 0); assert.strictEqual(r.total, 175); assert.strictEqual(r.mockSize, 55);
assert.strictEqual(r.mockMinutes, 70); assert.strictEqual(r.maxPoints, 250); assert.strictEqual(r.passPoints, 163);
assert.deepStrictEqual(r.counts, { handan: 32, keikaku: 27, eisei: 32, chori: 21, sekkyaku: 31, unei: 32 });
const before = fetchCount; call({ api: 'me', token: 'good' }); assert.strictEqual(fetchCount, before, 'friend auth cached');

// --- practice ---
r = call({ api: 'practice', token: 'good', cat: 'chori' });
assert.strictEqual(r.questions.length, 21);
r.questions.forEach(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); assert.strictEqual(q.ch[q.a], src.ch[0]); assert.strictEqual(q.c, 'chori'); assert.strictEqual(q.k, 'gakka'); });
assert.strictEqual(call({ api: 'practice', token: 'good', cat: 'handan' }).questions.length, 32);
assert.ok(call({ api: 'practice', token: 'good', cat: 'keikaku' }).questions.every(q => q.k === 'keikaku'));
const all = call({ api: 'practice', token: 'good', cat: 'all' }).questions;
assert.strictEqual(all.length, 175);
assert.strictEqual(new Set(all.map(q => q.id)).size, 175);
const pos = [0, 0, 0]; all.forEach(q => pos[q.a]++); console.log('practice answer positions', pos);
const o1 = all.map(q => q.id).join(), o2 = call({ api: 'practice', token: 'good', cat: 'all' }).questions.map(q => q.id).join();
assert.notStrictEqual(o1, o2, 'order shuffles');

// --- mock without credits ---
r = call({ api: 'mock_start', token: 'good' });
assert.deepStrictEqual([r.ok, r.error, r.pack.price, r.pack.count], [false, 'no_credits', 500, 10]);

// --- give credits (manual / future payment) ---
assert.strictEqual(ctx.addMockCredits_('Uaaa', 10, 'test'), 10);
assert.strictEqual(call({ api: 'me', token: 'good' }).credits, 10);

// --- mock start ---
r = call({ api: 'mock_start', token: 'good' });
assert.strictEqual(r.ok, true); assert.strictEqual(r.credits, 9); assert.strictEqual(r.questions.length, 55); assert.strictEqual(r.minutes, 70); assert.ok(r.started > 0);
assert.ok(r.questions.every(q => q.a === undefined && q.e === undefined), 'no answers leaked');
const cnt = {}; r.questions.forEach(q => cnt[q.k + ':' + q.c] = (cnt[q.k + ':' + q.c] || 0) + 1);
assert.deepStrictEqual(cnt, { 'gakka:eisei': 10, 'gakka:chori': 5, 'gakka:sekkyaku': 10, 'gakka:unei': 10,
  'handan:eisei': 3, 'handan:chori': 3, 'handan:sekkyaku': 3, 'handan:unei': 3, 'keikaku:eisei': 2, 'keikaku:chori': 2, 'keikaku:sekkyaku': 2, 'keikaku:unei': 2 }, JSON.stringify(cnt));
assert.ok(r.questions.slice(0, 35).every(q => q.k === 'gakka') && r.questions.slice(35).every(q => q.k !== 'gakka'), 'gakka first');
const att = r;
// me shows open attempt
assert.strictEqual(call({ api: 'me', token: 'good' }).open.attemptId, att.attemptId);
// other user cannot resume/submit
assert.strictEqual(call({ api: 'mock_resume', token: 'good2', attemptId: att.attemptId }).error, 'not_found');
assert.strictEqual(call({ api: 'mock_submit', token: 'good2', attemptId: att.attemptId, answers: [] }).error, 'not_found');
// resume returns same questions/choices
const res = call({ api: 'mock_resume', token: 'good', attemptId: att.attemptId });
assert.deepStrictEqual(res.questions, att.questions);

// --- submit: all correct except: q0 invalid, 30-39 wrong, 50-54 blank ---
const PTS = { 'gakka:eisei': 4, 'gakka:chori': 2, 'gakka:sekkyaku': 3, 'gakka:unei': 4 };
let expect = 0;
const answers = att.questions.map((q, i) => {
  const src = ctx.QUIZ_BANK.find(b => b.id === q.id); const correct = q.ch.indexOf(src.ch[0]);
  if (i === 0) return 'hack';
  if (i >= 30 && i < 40) return (correct + 1) % 3;
  if (i >= 50) return null;
  expect += PTS[q.k + ':' + q.c] || 6.5; return correct;
});
r = call({ api: 'mock_submit', token: 'good', attemptId: att.attemptId, answers });
assert.strictEqual(r.ok, true); assert.strictEqual(r.correct, 39); assert.strictEqual(r.total, 55);
assert.strictEqual(r.points, Math.round(expect * 10) / 10); assert.strictEqual(r.maxPoints, 250); assert.strictEqual(r.pass, r.points >= 163);
console.log('points', r.points, 'pass', r.pass, r.byKind);
assert.strictEqual(r.results[0].you, null);
assert.ok(r.results.every(x => typeof x.k === 'string'));
r.results.forEach((x, i) => assert.deepStrictEqual(x.ch, att.questions[i].ch));
// cannot resubmit
assert.strictEqual(call({ api: 'mock_submit', token: 'good', attemptId: att.attemptId, answers }).error, 'done');
assert.strictEqual(call({ api: 'me', token: 'good' }).open, null);
const ash = ss.sheets['模擬テスト受験'].data; console.log('attempt row:', ash[1].slice(4, 9));

// --- seen-question preference: 2nd mock avoids the 35 already seen where possible ---
const seen = new Set(att.questions.map(q => q.id));
const m2 = call({ api: 'mock_start', token: 'good' });
const overlap = m2.questions.filter(q => seen.has(q.id)).length;
console.log('2nd mock overlap with 1st:', overlap);
assert.strictEqual(overlap, 0);
assert.strictEqual(m2.credits, 8);

// webhook path still works (no events)
assert.deepStrictEqual(JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ destination: 'x', events: [] }) } }).s), { ok: true });

console.log('credit sheet:', ss.sheets['模擬テスト回数'].data);
console.log('ALL TESTS PASSED');
