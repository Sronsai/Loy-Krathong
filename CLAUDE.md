# CLAUDE.md — PCH-Loy_Krathong

ลอยกระทงออนไลน์รับบริจาคให้ **โรงพยาบาลปากชม จ.เลย** (ริมแม่น้ำโขง) — เว็บสแตติก + Google Apps Script
ผู้ใช้หลักพูดไทย: ตอบและเขียนข้อความ UI เป็นภาษาไทย

## Architecture
- **Frontend**: static HTML/CSS/vanilla JS ไม่มี build step ไม่มี framework. เปิด `index.html` ได้ตรงๆ (file://) หรือโฮสต์ static
  - script โหลดตามลำดับ: `lib/qrcode.js` → `js/config.js` → `js/promptpay.js` → `js/scene.js` → `js/walkers.js` → `js/app.js`
  - แต่ละไฟล์เป็น IIFE export ผ่าน `window.*`: `LK_CONFIG`, `PromptPay`, `Scene`, `Walkers`
- **Backend**: `apps-script/Code.gs` (Web App, execute as owner, access Anyone)
  - `GET ?action=list[&since=ms]` → `{ok, items:[{id,ts,name,gender,amount,size,wish}], total, count}`
  - `GET ?action=config` → ค่าสาธารณะจากชีต Settings (เขียนทับ `LK_CONFIG` ฝั่งหน้าเว็บ)
  - `POST` body JSON (ส่งเป็น `text/plain` เพื่อเลี่ยง CORS preflight): `{name, gender, amount, wish, phone, receipt, anonymous, website(honeypot), slip:{mimeType,data(base64),name}}`
- **Data**: Google Sheet `1qpyQ4E8jwHno2wMiqgwr6B-OT3308wBR5tYOsdkLYGQ` แท็บ `Donations` (15 คอลัมน์ ตาม `HEADERS`/`COL` ใน Code.gs), `Summary` (สูตร), `Settings` (KEY/VALUE)
  - สลิปเก็บใน Drive folder `18lMevIo2qPDd8pEOqzYqKhfbaKJpvIJK` ("slip") — ห้ามตั้งแชร์สาธารณะ
  - สถานะ: `รอตรวจสอบ` / `ตรวจแล้ว` / `ซ่อน` (ซ่อน = ไม่แสดงและไม่นับยอด)
- **Facebook Live** (ช่องทางหลัก) = OBS Browser Source เปิด `index.html?tv=1&sound=1&end=HH:MM` → แถบ LIVE/นาฬิกา/นับถอยหลัง (`#liveBar`), ข้อความวิ่ง+คำอธิษฐาน (`#ticker`), QR + ข้อความลิงก์ปักหมุด (`#tvQr`); ค่าที่เกี่ยวข้อง `FB_PAGE_NAME`, `EVENT_END`, `TICKER_MESSAGES`. ออกแบบให้อ่านออกที่ 1920×1080 บนจอมือถือ
- **Real-time** = polling ทุก `POLL_MS` (6s) + CacheService 5s ฝั่ง server; dedupe ด้วย `id` ฝั่ง client

## Scene coordinates (สำคัญ)
ทุกตำแหน่งในฉากใช้ **พิกัดภาพพื้นหลัง 2576×1450** (`#stage` ถูก scale ด้วย CSS transform แบบ cover บน desktop, แบบเต็มความกว้างบนมือถือ)
- `scene.js`: `WATER` polygon ผิวน้ำ (ไม่รวมแพ/ตลิ่ง), `RELEASE_POINT` (648,1112) จุดปล่อยกระทงข้างแพ,
  `GYRE` วงน้ำวนที่กระทงไหลวน, `persp(y)` ตัวคูณ perspective, `TABLE` โต๊ะรับกระทง (2284,806), ป้าย รพ. ที่ทางเดินขวาล่าง
- `walkers.js`: `PATH_TO_TABLE`, `PATH_TO_RAFT` (ทางเดิน → ช่องลงบันได → บันได → แพ), `heightAt(y)` ความสูงตัวการ์ตูนตามระยะ
- ถ้าเปลี่ยนภาพพื้นหลัง ต้องวัดพิกัดเหล่านี้ใหม่ทั้งหมด (ทำ grid overlay ทุก 100px ช่วยได้)

## Conventions
- ขนาดกระทง: `S` < TIER_MEDIUM(100) ≤ `M` < TIER_LARGE(500) ≤ `L` — ฝั่ง client และ server ต้องใช้เกณฑ์เดียวกัน (มาจากชีต Settings)
- ตัวการ์ตูนวาดเป็น inline SVG ใน `walkers.js` (viewBox 0 0 120 200, เท้าที่ (60,196)); ท่าทางขยับด้วย `setAttribute('transform')` ทุกเฟรม
- กระทงบนน้ำวาดบน `<canvas id="fx">` ด้วย sprite ที่ pre-render (`buildSprites`) + ป้ายชื่อ pre-render (`makeTag`); จำกัด `MAX_KRATHONG_ON_WATER`
- escape ข้อความผู้ใช้เสมอก่อนใส่ innerHTML (`esc`/`escapeHtml`/`escapeXml`); server ใช้ `clean_()` กัน formula injection
- ห้ามแสดง/ส่งเบอร์โทรหรือลิงก์สลิปออกไปทาง `doGet`
- โหมดทดลอง (`!API_URL` หรือ `?demo=1`) สร้างรายชื่อสมมติ — ห้ามเปิดโหมดนี้บนหน้าที่ใช้รับบริจาคจริง

## Dev / test
- รัน local: `python3 -m http.server 8000` ในโฟลเดอร์นี้ แล้วเปิด `http://localhost:8000/` (หรือ `?tv=1`, `?demo=1`)
- ทดสอบอัตโนมัติ: Playwright screenshot ที่ 1920×1080 และ 390×844 ตรวจว่าตัวการ์ตูนเดินตามเส้นทาง/ไม่มี pageerror
- `node --check js/*.js` และ `cp apps-script/Code.gs /tmp/c.js && node --check /tmp/c.js` สำหรับ syntax
- แก้ Code.gs แล้วต้อง deploy เวอร์ชันใหม่ใน Apps Script (Manage deployments › New version)

## TODO ที่ยังรอข้อมูลจาก รพ.
- เลขบัญชี/ชื่อบัญชี/พร้อมเพย์ ในชีต Settings
- `API_URL` และ `DONATE_URL` ใน `js/config.js` หลัง deploy
- นโยบายความเป็นส่วนตัว (PDPA) ของ รพ. และเบอร์ติดต่อ (`CONTACT`)
