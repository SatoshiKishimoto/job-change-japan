/**
 * Job Change Japan — GAS（LP表示 ＋ 登録受付API）
 *
 * - ?action=... が付いたアクセス → 登録を受け付けて JSON を返す
 *     submitInquiry    : register.html（30秒登録）/ form.html
 *     submitDetailForm : detail_form.html（求職申込書）
 * - それ以外のアクセス → これまでどおり LP を表示
 *
 * 保存先のスプレッドシートは、最初の登録時に自動で作成されます
 * （スクリプトプロパティ JCJ_SHEET_ID に既存シートのIDを入れれば、そこに保存）。
 */

var FORM_URL = 'https://script.google.com/macros/s/AKfycbyrLBO1LqeOXjempqZXJUtMH09uk9eV2UbAN2K3Aq-fTHbL_7SopLNqhlIyonimmMU/exec';

// 新規登録の通知を受け取るメールアドレス（空ならスクリプトの所有者）
var JCJ_NOTIFY_EMAIL = '';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) return jcjApi_(p);

  try {
    var t = HtmlService.createTemplateFromFile('LP');
    t.formUrl = FORM_URL;
    return t.evaluate()
      .setTitle('Job Change Japan | 転職・採用エージェント');
  } catch (err) {
    return HtmlService.createHtmlOutput('Error: ' + err.toString());
  }
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
function jcjApi_(p) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse(p.data || '{}');
    lock.waitLock(20000);
    var id;
    if (p.action === 'submitInquiry') {
      id = jcjSaveInquiry_(data);
    } else if (p.action === 'submitDetailForm') {
      id = jcjSaveDetail_(data);
    } else if (p.action === 'ping') {
      return jcjJson_({ success: true, message: 'ok' });
    } else {
      return jcjJson_({ success: false, message: 'unknown action' });
    }
    lock.releaseLock();
    try { jcjNotify_(p.action, id, data); } catch (mailErr) { console.error(mailErr); }
    return jcjJson_({ success: true, id: id });
  } catch (err) {
    try { lock.releaseLock(); } catch (x) {}
    console.error(err);
    return jcjJson_({ success: false, message: String(err && err.message || err) });
  }
}

function jcjJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// 保存
// ------------------------------------------------------------
var JCJ_INQUIRY_HEADERS = ['受付日時', '受付ID', '種別', 'お名前', 'メール', '希望職種', '希望月収', 'ボーナス', '希望勤務地', '住宅手当', '相談内容', '対応状況'];

function jcjSaveInquiry_(d) {
  if (!d.name || !d.email) throw new Error('name and email are required');
  var sh = jcjSheet_('登録・相談', JCJ_INQUIRY_HEADERS);
  var id = jcjNewId_('JCJ');
  sh.appendRow([
    new Date(), id,
    d.clientType === 'corporate' ? '企業' : '個人',
    d.name, d.email, d.role, d.salary, d.bonus, d.location, d.housing, d.message, '未対応'
  ].map(jcjSafe_));
  return id;
}

var JCJ_DETAIL_KEYS = [
  ['nameRoman', '氏名（ローマ字）'], ['nameKanji', '氏名（カナ等）'], ['dob', '生年月日'], ['gender', '性別'],
  ['nationality', '国籍'], ['nativeLang', '母国語'], ['address', '現住所'], ['phone', '電話番号'], ['email', 'メール'],
  ['visaStatus', '在留資格'], ['visaExpiry', '在留期限'], ['workRestriction', '就労制限'], ['visaEligible', '在留資格の希望'],
  ['visaChange', '在留資格変更'], ['education', '最終学歴'], ['workHistory', '職歴'], ['japaneseLevel', '日本語能力'],
  ['qualifications', '資格'], ['experienceYears', '経験年数'], ['jobTypes', '希望職種'], ['employType', '雇用形態'],
  ['desiredSalary', '希望給与'], ['desiredLocation', '希望勤務地'], ['bonusPref', 'ボーナス'], ['housingPref', '住宅手当'],
  ['availableDate', '就業可能時期'], ['otherNotes', 'その他']
];

function jcjSaveDetail_(d) {
  if (!d.nameRoman || !d.email) throw new Error('name and email are required');
  var headers = ['受付日時', '受付ID'].concat(JCJ_DETAIL_KEYS.map(function (k) { return k[1]; })).concat(['対応状況']);
  var sh = jcjSheet_('求職申込書', headers);
  var id = jcjNewId_('JCD');
  var row = [new Date(), id].concat(JCJ_DETAIL_KEYS.map(function (k) { return d[k[0]] || ''; })).concat(['未対応']);
  sh.appendRow(row.map(jcjSafe_));
  return id;
}

function jcjSheet_(name, headers) {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('JCJ_SHEET_ID');
  var ss;
  if (ssId) {
    ss = SpreadsheetApp.openById(ssId);
  } else {
    ss = SpreadsheetApp.create('Job Change Japan 登録者一覧');
    props.setProperty('JCJ_SHEET_ID', ss.getId());
  }
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f1f1');
    var def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  return sh;
}

function jcjNewId_(prefix) {
  var ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyMMdd-HHmmss');
  return prefix + '-' + ts + '-' + Math.floor(Math.random() * 900 + 100);
}

// 数式として解釈されないようにする
function jcjSafe_(v) {
  if (v instanceof Date) return v;
  v = v == null ? '' : String(v).slice(0, 5000);
  return /^[=+@]/.test(v) ? "'" + v : v;
}

// ------------------------------------------------------------
// メール
// ------------------------------------------------------------
function jcjNotify_(action, id, d) {
  var to = JCJ_NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  var name = d.name || d.nameRoman || '';
  var ssUrl = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('JCJ_SHEET_ID')).getUrl();
  var kind = action === 'submitDetailForm' ? '求職申込書' : (d.clientType === 'corporate' ? '企業お問い合わせ' : '求職者登録');

  // 運営側への通知
  var lines = Object.keys(d).filter(function (k) { return k !== 'action'; })
    .map(function (k) { return k + ': ' + d[k]; });
  MailApp.sendEmail(to, '【Job Change Japan】新規' + kind + '：' + name + '（' + id + '）',
    kind + 'がありました。\n\n受付ID: ' + id + '\n' + lines.join('\n') + '\n\n一覧: ' + ssUrl);

  // 登録者への確認メール（日本語＋英語）
  if (d.email) {
    MailApp.sendEmail(d.email, '【Job Change Japan】ご登録ありがとうございます / Thank you for registering',
      name + ' 様\n\n' +
      'Job Change Japan にご登録いただき、ありがとうございます。\n' +
      '担当者より2営業日以内にご連絡いたします。\n\n' +
      'Thank you for registering with Job Change Japan.\n' +
      'Our staff will contact you within 2 business days.\n\n' +
      '受付ID / Receipt ID: ' + id + '\n\n' +
      '――――――――――――\n' +
      '株式会社Fairly connecting（有料職業紹介事業 許可番号 27-ユ-304918）\n' +
      'https://satoshikishimoto.github.io/job-change-japan/\n',
      { name: 'Job Change Japan' });
  }
}

// 初回だけエディタから実行：権限の許可とシート作成の確認用
function jcjSetup() {
  var sh = jcjSheet_('登録・相談', JCJ_INQUIRY_HEADERS);
  console.log('保存先: ' + sh.getParent().getUrl());
}
