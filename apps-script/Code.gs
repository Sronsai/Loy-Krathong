/**
 * ลอยกระทงออนไลน์ — โรงพยาบาลปากชม จ.เลย
 * Google Apps Script backend (Web App)
 *
 *  - doPost  : รับข้อมูลการบริจาค + สลิป (base64) → บันทึกสลิปลง Drive โฟลเดอร์ "slip"
 *              และเพิ่มแถวในชีต "Donations"
 *  - doGet   : ?action=list&since=<ms>  → รายชื่อผู้บริจาค (เฉพาะข้อมูลสาธารณะ) สำหรับหน้าจอ real-time
 *              ?action=config            → ค่าตั้งค่าจากชีต "Settings" (บัญชีธนาคาร/พร้อมเพย์/เกณฑ์ขนาดกระทง)
 *
 * วิธี deploy: ดู README.md หัวข้อ "ติดตั้ง Backend"
 */

const CONFIG = {
  SPREADSHEET_ID: '1qpyQ4E8jwHno2wMiqgwr6B-OT3308wBR5tYOsdkLYGQ',
  SLIP_FOLDER_ID: '18lMevIo2qPDd8pEOqzYqKhfbaKJpvIJK',
  SHEET_DONATIONS: 'Donations',
  SHEET_SETTINGS: 'Settings',
  MAX_SLIP_BYTES: 6 * 1024 * 1024,
  MAX_NAME_LEN: 80,
  MAX_WISH_LEN: 120,
  LIST_LIMIT: 600,          // จำนวนรายการล่าสุดที่ส่งให้หน้าจอ
  CACHE_SECONDS: 5,         // แคชรายการ ลดโหลดเมื่อมีผู้ชมจำนวนมาก
};

const STATUS = { PENDING: 'รอตรวจสอบ', VERIFIED: 'ตรวจแล้ว', HIDDEN: 'ซ่อน' };
const GENDER_TH = { male: 'ชาย', female: 'หญิง' };
const ANON_NAME = 'ผู้ใจบุญ (ไม่ประสงค์ออกนาม)';

// คอลัมน์ในชีต Donations (ลำดับต้องตรงกับหัวตาราง)
const COL = {
  TS: 0, ID: 1, NAME: 2, DISPLAY: 3, GENDER: 4, AMOUNT: 5, SIZE: 6, WISH: 7,
  ANON: 8, PHONE: 9, RECEIPT: 10, SLIP_URL: 11, SLIP_ID: 12, STATUS: 13, NOTE: 14,
};
const HEADERS = ['วันเวลา', 'รหัส', 'ชื่อ-สกุล', 'ชื่อที่แสดง', 'เพศ', 'จำนวนเงิน', 'ขนาดกระทง',
  'คำอธิษฐาน', 'ไม่ประสงค์ออกนาม', 'เบอร์โทร', 'ต้องการใบอนุโมทนาบัตร', 'ลิงก์สลิป', 'Slip File ID',
  'สถานะ', 'หมายเหตุเจ้าหน้าที่'];

/* ------------------------------------------------------------------ */
/*  HTTP handlers                                                      */
/* ------------------------------------------------------------------ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'config') return json_({ ok: true, config: publicSettings_() });
    if (p.action === 'list' || !p.action) {
      const since = Number(p.since || 0);
      return json_(Object.assign({ ok: true, serverTime: Date.now() }, listDonations_(since)));
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' });
  }
  if (body.website) return json_({ ok: true, ignored: true }); // honeypot กันบอท

  const settings = getSettings_();
  if (settings.DONATION_OPEN === false) return json_({ ok: false, error: 'ขณะนี้ปิดรับบริจาคแล้ว ขอบคุณค่ะ' });

  // ---------- validate ----------
  const name = clean_(body.name, CONFIG.MAX_NAME_LEN);
  const gender = body.gender === 'female' ? 'female' : (body.gender === 'male' ? 'male' : '');
  const amount = Math.round(Number(body.amount) * 100) / 100;
  const wish = clean_(body.wish, CONFIG.MAX_WISH_LEN);
  const anonymous = body.anonymous === true;
  const phone = clean_(body.phone, 20).replace(/[^0-9+\- ]/g, '');
  const receipt = body.receipt === true;
  const minAmount = Number(settings.MIN_AMOUNT || 1);

  if (name.length < 2) return json_({ ok: false, error: 'กรุณากรอกชื่อ-สกุล' });
  if (!gender) return json_({ ok: false, error: 'กรุณาเลือกเพศ' });
  if (!(amount >= minAmount)) return json_({ ok: false, error: 'จำนวนเงินขั้นต่ำ ' + minAmount + ' บาท' });
  if (amount > 10000000) return json_({ ok: false, error: 'จำนวนเงินไม่ถูกต้อง' });
  if (!body.slip || !body.slip.data) return json_({ ok: false, error: 'กรุณาแนบสลิปโอนเงิน' });

  const mime = String(body.slip.mimeType || '');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime) && mime !== 'application/pdf') {
    return json_({ ok: false, error: 'รองรับสลิปเป็นรูปภาพหรือ PDF เท่านั้น' });
  }
  let bytes;
  try { bytes = Utilities.base64Decode(body.slip.data); } catch (err) {
    return json_({ ok: false, error: 'ไฟล์สลิปเสียหาย' });
  }
  if (bytes.length > CONFIG.MAX_SLIP_BYTES) return json_({ ok: false, error: 'ไฟล์สลิปใหญ่เกิน 6 MB' });

  // ---------- save ----------
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const now = new Date();
    const id = 'K' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyMMddHHmmss') +
      Math.floor(Math.random() * 900 + 100);
    const size = sizeFor_(amount, settings);
    const display = anonymous ? ANON_NAME : name;

    const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const fileName = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd-HHmmss') + '_' + id + '_' +
      name.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '_' + amount + 'บาท.' + ext;
    const folder = DriveApp.getFolderById(CONFIG.SLIP_FOLDER_ID);
    const file = folder.createFile(Utilities.newBlob(bytes, mime, fileName));
    file.setDescription('ลอยกระทงออนไลน์ รพ.ปากชม | ' + id + ' | ' + name + ' | ' + amount + ' บาท');
    // หมายเหตุ: ไม่เปิดแชร์สลิปสาธารณะ — เฉพาะเจ้าหน้าที่ที่มีสิทธิ์ในโฟลเดอร์เท่านั้นที่เปิดได้

    const sheet = sheet_(CONFIG.SHEET_DONATIONS);
    const row = [];
    row[COL.TS] = now;
    row[COL.ID] = id;
    row[COL.NAME] = name;
    row[COL.DISPLAY] = display;
    row[COL.GENDER] = GENDER_TH[gender];
    row[COL.AMOUNT] = amount;
    row[COL.SIZE] = size.th;
    row[COL.WISH] = wish;
    row[COL.ANON] = anonymous ? 'ใช่' : '';
    row[COL.PHONE] = phone ? "'" + phone : '';
    row[COL.RECEIPT] = receipt ? 'ต้องการ' : '';
    row[COL.SLIP_URL] = file.getUrl();
    row[COL.SLIP_ID] = file.getId();
    row[COL.STATUS] = STATUS.PENDING;
    row[COL.NOTE] = '';
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove('list');

    return json_({
      ok: true,
      donation: { id: id, ts: now.getTime(), name: display, gender: gender, amount: amount, size: size.key, wish: wish },
    });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

function listDonations_(since) {
  const cache = CacheService.getScriptCache();
  let all = null;
  const cached = cache.get('list');
  if (cached) {
    try { all = JSON.parse(cached); } catch (e) { all = null; }
  }
  if (!all) {
    const settings = getSettings_();
    const requireApproval = settings.REQUIRE_APPROVAL === true;
    const sheet = sheet_(CONFIG.SHEET_DONATIONS);
    const last = sheet.getLastRow();
    let items = [], total = 0, count = 0;
    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
      values.forEach(function (r) {
        const status = String(r[COL.STATUS] || '');
        if (!r[COL.ID] || status === STATUS.HIDDEN) return;
        const amount = Number(r[COL.AMOUNT]) || 0;
        total += amount; count++;
        if (requireApproval && status !== STATUS.VERIFIED) return;
        const ts = r[COL.TS] instanceof Date ? r[COL.TS].getTime() : new Date(r[COL.TS]).getTime();
        items.push({
          id: String(r[COL.ID]),
          ts: ts || 0,
          name: String(r[COL.DISPLAY] || r[COL.NAME] || ''),
          gender: r[COL.GENDER] === 'หญิง' ? 'female' : 'male',
          amount: amount,
          size: sizeFor_(amount, settings).key,
          wish: String(r[COL.WISH] || ''),
        });
      });
    }
    items = items.slice(-CONFIG.LIST_LIMIT);
    all = { items: items, total: total, count: count };
    try { cache.put('list', JSON.stringify(all), CONFIG.CACHE_SECONDS); } catch (e) { /* >100KB: skip cache */ }
  }
  const items = since ? all.items.filter(function (d) { return d.ts > since; }) : all.items;
  return { items: items, total: all.total, count: all.count };
}

function sizeFor_(amount, s) {
  const mid = Number(s.TIER_MEDIUM || 100), big = Number(s.TIER_LARGE || 500);
  if (amount >= big) return { key: 'L', th: 'ใหญ่' };
  if (amount >= mid) return { key: 'M', th: 'กลาง' };
  return { key: 'S', th: 'เล็ก' };
}

function getSettings_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('settings');
  if (c) return JSON.parse(c);
  const out = {};
  const sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_SETTINGS);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0]) out[String(r[0]).trim()] = r[1];
    });
  }
  cache.put('settings', JSON.stringify(out), 60);
  return out;
}

function publicSettings_() {
  const s = getSettings_();
  const keys = ['EVENT_TITLE', 'HOSPITAL_NAME', 'BANK_NAME', 'ACCOUNT_NO', 'ACCOUNT_NAME', 'PROMPTPAY_ID',
    'MIN_AMOUNT', 'TIER_MEDIUM', 'TIER_LARGE', 'GOAL_AMOUNT', 'CONTACT', 'DONATION_OPEN', 'FB_PAGE_NAME', 'EVENT_END'];
  const out = {};
  keys.forEach(function (k) { if (s[k] !== undefined && s[k] !== '') out[k] = s[k]; });
  // EVENT_END: รองรับทั้ง "23:00" (เวลาวันนี้) และวันที่+เวลาเต็ม
  if (out.EVENT_END) {
    const v = new Date(out.EVENT_END);
    if (!isNaN(v.getTime())) {
      out.EVENT_END = v.getFullYear() < 1950
        ? Utilities.formatDate(v, 'Asia/Bangkok', 'HH:mm')
        : Utilities.formatDate(v, 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === CONFIG.SHEET_DONATIONS) sh.appendRow(HEADERS);
  }
  return sh;
}

function clean_(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/^[=+\-@]+/, '')   // กัน formula injection ในชีต
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/*  Utilities for staff (run manually from the Apps Script editor)     */
/* ------------------------------------------------------------------ */

/** รันครั้งแรกเพื่อขอสิทธิ์ Drive/Sheets และทดสอบว่าเข้าถึงไฟล์ได้ */
function testSetup() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(CONFIG.SLIP_FOLDER_ID);
  Logger.log('Sheet: ' + ss.getName() + ' | Slip folder: ' + folder.getName());
  Logger.log(JSON.stringify(publicSettings_()));
}

/** ล้างแคช (ใช้หลังแก้ชีต Settings หากต้องการให้มีผลทันที) */
function clearCache() {
  CacheService.getScriptCache().removeAll(['list', 'settings']);
}
