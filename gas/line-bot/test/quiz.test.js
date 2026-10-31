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
assert.strictEqual(r.ok, true); assert.strictEqual(r.credits, 0); assert.strictEqual(r.total, 224); assert.strictEqual(r.mockSize, 55);
assert.strictEqual(r.mockMinutes, 70); assert.strictEqual(r.maxPoints, 250); assert.strictEqual(r.passPoints, 163);
assert.strictEqual(JSON.stringify(r.counts), JSON.stringify({ handan: 36, keikaku: 36, jirei: 12, eisei: 39, chori: 26, sekkyaku: 38, unei: 37 }));
const before = fetchCount; call({ api: 'me', token: 'good' }); assert.strictEqual(fetchCount, before, 'friend auth cached');

// --- practice ---
r = call({ api: 'practice', token: 'good', cat: 'chori' });
assert.strictEqual(r.questions.length, 26);
r.questions.forEach(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); assert.strictEqual(q.ch[q.a], src.ch[0]); assert.strictEqual(q.c, 'chori'); assert.strictEqual(q.k, 'gakka'); });
assert.strictEqual(call({ api: 'practice', token: 'good', cat: 'handan' }).questions.length, 36);
// 事例問題：3題×4問、同じ事例は続けて順番どおり、事例の文章つき
const jr = call({ api: 'practice', token: 'good', cat: 'jirei' });
assert.strictEqual(jr.questions.length, 12); assert.strictEqual(Object.keys(jr.passages).length, 3);
for (let i = 0; i < 12; i += 4) { const g = jr.questions.slice(i, i + 4); assert.ok(g.every(q => q.p === g[0].p && !q.x)); assert.deepStrictEqual(g.map(q => q.id.split('-')[1]), ['1', '2', '3', '4']); }
assert.ok(/<rt>/.test(jr.passages[jr.questions[0].p]), 'case text has furigana');
assert.ok(call({ api: 'practice', token: 'good', cat: 'keikaku' }).questions.every(q => q.k === 'keikaku'));
const all = call({ api: 'practice', token: 'good', cat: 'all' }).questions;
assert.strictEqual(all.length, 224);
assert.strictEqual(new Set(all.map(q => q.id)).size, 224);
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
assert.ok(r.questions.every(q => q.k !== 'jirei'), 'skill mock keeps the real format (no case sets)');
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

// --- N3 ---
r = call({ api: 'me', token: 'good' });
assert.strictEqual(r.n3.all, 205); assert.strictEqual(r.n3.chokai, 37); assert.strictEqual(r.n3.yomi, 20); assert.strictEqual(r.n3.moji, 84); assert.strictEqual(r.n3.bunpo, 52); assert.strictEqual(r.n3.dokkai, 32);
assert.deepStrictEqual([r.mocks.n3bunpo.size, r.mocks.n3bunpo.minutes, r.mocks.n3bunpo.exam], [39, 70, 'n3']);
assert.deepStrictEqual([r.mocks.n3moji.size, r.mocks.n3moji.minutes, r.mocks.n3moji.maxPoints], [35, 30, null]);
assert.strictEqual(r.total, 224, 'skill total excludes N3');
const n3p = call({ api: 'practice', token: 'good', exam: 'n3', cat: 'keishiki' }).questions;
assert.strictEqual(n3p.length, 30);
n3p.forEach(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); assert.strictEqual(q.ch.length, 4); assert.strictEqual(q.ch[q.a], src.ch[0]); assert.strictEqual(q.x, 'n3'); });
assert.ok(!/<rt>/.test(n3p.map(q => q.q + q.ch.join('')).join('')), 'no furigana in N3 questions/choices');
assert.ok(n3p.some(q => /<rt>/.test(q.e)), 'furigana in explanations');
const pos4 = [0, 0, 0, 0]; call({ api: 'practice', token: 'good', exam: 'n3', cat: 'all' }).questions.forEach(q => pos4[q.a]++);
// 聴解：音声つき。選択肢を読み上げる問題は順番が固定で、正解の番号がスクリプトどおり
const lp = call({ api: 'practice', token: 'good', exam: 'n3', cat: 'chokai' }).questions;
assert.strictEqual(lp.length, 37);
assert.ok(lp.every(q => /^audio\/L[KPGHS]\d\d\.mp3$/.test(q.au)));
lp.filter(q => q.hid).forEach(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); assert.strictEqual(JSON.stringify(q.ch), JSON.stringify(src.ch)); assert.strictEqual(q.a, src.ans); });
lp.filter(q => !q.hid).forEach(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); assert.strictEqual(q.ch[q.a], src.ch[0]); });
assert.ok(lp.filter(q => q.k === 'hatsuwa').every(q => q.sc));
assert.strictEqual(lp.filter(q => q.hid).length, 4 + 5 + 12);
// 文章つき：練習でも同じ文章の問題は続けて、順番どおり
const rc = call({ api: 'practice', token: 'good', exam: 'n3', cat: 'chubun' });
assert.strictEqual(rc.questions.length, 12); assert.strictEqual(Object.keys(rc.passages).length, 4);
for (let i = 0; i < 12; i += 3) { const g = rc.questions.slice(i, i + 3); assert.ok(g.every(q => q.p === g[0].p)); assert.deepStrictEqual(g.map(q => q.id.split('-')[1]), ['1', '2', '3']); }
assert.ok(rc.passages[rc.questions[0].p].includes('<br>'));
console.log('N3 answer positions', pos4); assert.ok(pos4.every(n => n > 10));
assert.strictEqual(call({ api: 'practice', token: 'good', exam: 'n3', cat: 'moji' }).questions.length, 84);
assert.ok(call({ api: 'practice', token: 'good', cat: 'all' }).questions.every(q => !q.x), 'skill practice has no N3');
const kum = ctx.QUIZ_BANK.filter(b => b.k === 'kumitate');
kum.forEach(b => assert.ok(b.q.includes('★') && b.e.includes('★'), b.id));

const credBefore = call({ api: 'me', token: 'good' }).credits;
const n3m = call({ api: 'mock_start', token: 'good', mock: 'n3moji' });
assert.strictEqual(n3m.ok, true); assert.strictEqual(n3m.mock, 'n3moji'); assert.strictEqual(n3m.minutes, 30);
assert.strictEqual(n3m.credits, credBefore - 1, 'shared credits');
assert.strictEqual(n3m.questions.length, 35);
const kseq = n3m.questions.map(q => q.k);
assert.deepStrictEqual([...new Set(kseq)], ['yomi', 'hyoki', 'bunmyaku', 'iikae', 'yoho'], 'ordered by type');
assert.deepStrictEqual(['yomi', 'hyoki', 'bunmyaku', 'iikae', 'yoho'].map(k => kseq.filter(x => x === k).length), [8, 6, 11, 5, 5]);
assert.ok(n3m.questions.every(q => q.a === undefined && q.e === undefined && q.ch.length === 4));
assert.strictEqual(call({ api: 'me', token: 'good' }).open.mock, 'n3moji');
const rs = call({ api: 'mock_resume', token: 'good', attemptId: n3m.attemptId });
assert.strictEqual(rs.minutes, 30); assert.deepStrictEqual(rs.questions, n3m.questions);
const ans4 = n3m.questions.map((q, i) => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); const c = q.ch.indexOf(src.ch[0]); return i < 30 ? c : 3.5; });
const sub = call({ api: 'mock_submit', token: 'good', attemptId: n3m.attemptId, answers: ans4 });
assert.strictEqual(sub.correct, 30); assert.strictEqual(sub.points, undefined); assert.strictEqual(sub.pass, undefined);
assert.ok(sub.results.slice(30).every(x => x.you === null));
const arow = ss.sheets['模擬テスト受験'].data.slice(-1)[0];
console.log('N3 attempt row:', arow.slice(4, 9), arow[13]);
assert.strictEqual(call({ api: 'mock_start', token: 'good', mock: 'nope' }).error, 'unknown');

// N3 文法・読解の模擬テスト：39問、種類の順、文章ごとにまとまる
const rb = call({ api: 'mock_start', token: 'good', mock: 'n3bunpo' });
assert.strictEqual(rb.ok, true); assert.strictEqual(rb.questions.length, 39); assert.strictEqual(rb.minutes, 70);
const ks = rb.questions.map(q => q.k);
assert.deepStrictEqual([...new Set(ks)], ['keishiki', 'kumitate', 'bunsho', 'tanbun', 'chubun', 'chobun', 'joho']);
assert.deepStrictEqual(['keishiki', 'kumitate', 'bunsho', 'tanbun', 'chubun', 'chobun', 'joho'].map(k => ks.filter(x => x === k).length), [13, 5, 5, 4, 6, 4, 2]);
const pids = rb.questions.filter(q => q.p).map(q => q.p);
assert.strictEqual(new Set(pids).size, 1 + 4 + 2 + 1 + 1, 'passage count');
// 同じ文章の問題は連続している
const firstIdx = {}, lastIdx = {}; rb.questions.forEach((q, i) => { if (q.p) { if (firstIdx[q.p] === undefined) firstIdx[q.p] = i; lastIdx[q.p] = i; } });
Object.keys(firstIdx).forEach(pid => assert.strictEqual(lastIdx[pid] - firstIdx[pid] + 1, pids.filter(x => x === pid).length, pid));
assert.deepStrictEqual(Object.keys(rb.passages).sort(), [...new Set(pids)].sort());
const rbs = call({ api: 'mock_submit', token: 'good', attemptId: rb.attemptId, answers: rb.questions.map(() => 0) });
assert.strictEqual(rbs.ok, true); assert.ok(rbs.passages && Object.keys(rbs.passages).length === 9);
// 聴解の模擬テスト：28問・40分、選択肢を読み上げる問題は文字を返さない
const lc = call({ api: 'mock_start', token: 'good', mock: 'n3chokai' });
assert.strictEqual(lc.ok, true); assert.strictEqual(lc.questions.length, 28); assert.strictEqual(lc.minutes, 40);
assert.deepStrictEqual(['kadai', 'point', 'gaiyo', 'hatsuwa', 'sokuji'].map(k => lc.questions.filter(q => q.k === k).length), [6, 6, 3, 4, 9]);
assert.deepStrictEqual([...new Set(lc.questions.map(q => q.k))], ['kadai', 'point', 'gaiyo', 'hatsuwa', 'sokuji']);
lc.questions.forEach(q => { assert.ok(q.au); assert.strictEqual(q.q, ''); assert.strictEqual(q.e, undefined); if (q.hid) assert.ok(q.ch.every((c, i) => c === String(i + 1))); else assert.ok(q.ch[0].length > 2); });
const lans = lc.questions.map(q => { const src = ctx.QUIZ_BANK.find(b => b.id === q.id); return q.hid ? src.ans : q.ch.indexOf(src.ch[0]); });
const lsub = call({ api: 'mock_submit', token: 'good', attemptId: lc.attemptId, answers: lans });
assert.strictEqual(lsub.correct, 28, 'all correct with script answers');
assert.ok(lsub.results.filter(x => x.hid).every(x => x.ch.length >= 3 && x.ch[0].length > 2), 'texts revealed in results');
assert.ok(lsub.results.every(x => x.q.length > 0 && x.e.includes('スクリプト')));

// 2回目は、前回と違う文章が出る（文章の文法2題・中文4題・長文2題・情報検索2題）
const rb2 = call({ api: 'mock_start', token: 'good', mock: 'n3bunpo' });
const p1 = new Set(pids), p2 = rb2.questions.filter(q => q.p).map(q => q.p);
console.log('N3 reading 2nd mock passage overlap:', p2.filter(x => p1.has(x)).length);
assert.strictEqual(p2.filter(x => p1.has(x)).length, 0);

// webhook path still works (no events)
assert.deepStrictEqual(JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ destination: 'x', events: [] }) } }).s), { ok: true });

console.log('credit sheet:', ss.sheets['模擬テスト回数'].data);
console.log('ALL TESTS PASSED');
