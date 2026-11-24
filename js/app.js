/* =====================================================================
 *  App: form, Google Apps Script API, real-time polling, donor list,
 *  stats, TV/live-stream mode, demo mode
 * ===================================================================== */
(function () {
  const C = window.LK_CONFIG;
  const qs = new URLSearchParams(location.search);
  const TV = qs.has('tv');
  const API = (qs.get('api') || C.API_URL || '').trim();
  const DEMO = !API || qs.has('demo');
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });

  const state = { donations: new Map(), total: 0, count: 0, lastTs: 0, gender: '', slip: null };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const tierOf = (amt) => (amt >= C.TIER_LARGE ? 'L' : amt >= C.TIER_MEDIUM ? 'M' : 'S');
  const TIER_TH = { S: 'กระทงเล็ก', M: 'กระทงกลาง', L: 'กระทงใหญ่' };
  const TIER_ICO = { S: '🌸', M: '🌸🌸', L: '🌟🌸' };
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  function ago(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return Math.floor(s / 60) + ' นาทีที่แล้ว';
    if (s < 86400) return Math.floor(s / 3600) + ' ชม.ที่แล้ว';
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }
  function toast(html) {
    const el = document.createElement('div');
    el.className = 'toast'; el.innerHTML = html;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 5200);
    const all = $('toasts').children; if (all.length > 3) all[0].remove();
  }

  /* ------------------------------------------------------------------ */
  /*  API                                                                */
  /* ------------------------------------------------------------------ */
  async function apiGet(params) {
    const url = API + (API.includes('?') ? '&' : '?') + new URLSearchParams(params);
    const r = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    return r.json();
  }
  async function apiPost(body) {
    // text/plain → ไม่เกิด CORS preflight กับ Apps Script
    const r = await fetch(API, { method: 'POST', body: JSON.stringify(body), redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    return r.json();
  }

  /* ------------------------------------------------------------------ */
  /*  Donations → scene + list                                           */
  /* ------------------------------------------------------------------ */
  function ingest(d, { animate }) {
    if (!d || !d.id || state.donations.has(d.id)) return false;
    d.size = d.size || tierOf(d.amount);
    state.donations.set(d.id, d);
    state.lastTs = Math.max(state.lastTs, d.ts || 0);
    if (animate) {
      Walkers.enqueue(d, release);
    } else {
      Scene.addKrathong(d);
    }
    return true;
  }
  function release(d) {
    const p = Scene.RELEASE_POINT;
    Scene.addKrathong(d, { at: { x: p.x + (Math.random() * 20 - 10), y: p.y + (Math.random() * 8 - 4) }, fresh: true });
    Scene.ripple(p.x, p.y + 4, 3);
    Scene.sparkle(p.x, p.y - 30, d.size === 'L' ? 30 : 16, d.size === 'L' ? 90 : 55);
    Scene.chime(d.size === 'L');
    if (d.size === 'L') { Scene.firework(); setTimeout(() => Scene.firework(), 500); setTimeout(() => Scene.firework(), 1100); }
    else if (d.size === 'M') Scene.firework();
    toast(`🙏 <b>${esc(d.name)}</b> ลอย${TIER_TH[d.size]} ร่วมบุญ ${fmt(d.amount)} บาท`);
  }

  function renderStats() {
    $('statTotal').textContent = fmt(state.total);
    $('statCount').textContent = fmt(state.count);
    const goal = Number(C.GOAL_AMOUNT) || 0;
    if (goal > 0) {
      $('goalFill').style.width = Math.min(100, (state.total / goal) * 100) + '%';
      $('goalText').textContent = `เป้าหมาย ${fmt(goal)} บาท (${Math.min(999, Math.round((state.total / goal) * 100))}%)`;
    }
  }

  const avatars = {};
  const ava = (g) => (avatars[g] = avatars[g] || Walkers.avatar(g));
  function donorItem(d) {
    return `<li class="donor"><i class="ava" style="background-image:url('${ava(d.gender)}')"></i>
      <span class="nm"><b>${esc(d.name)}</b><small>${TIER_ICO[d.size]} ${TIER_TH[d.size]} · ${ago(d.ts)}</small></span>
      <span class="amt">${fmt(d.amount)}<small>บาท</small></span></li>`;
  }
  let listDirty = true;
  function renderList() {
    const arr = [...state.donations.values()].sort((a, b) => b.ts - a.ts);
    const latest = arr[0];
    $('latest').innerHTML = latest ? `<div class="card"><i class="ava" style="background-image:url('${ava(latest.gender)}');width:38px;height:38px"></i>
      <div style="flex:1;min-width:0"><small style="color:#ffd9a0">ล่าสุด · ${ago(latest.ts)}</small><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(latest.name)}</b></div>
      <b style="color:#ffe39b">${fmt(latest.amount)} ฿</b></div>` : '<p style="text-align:center;opacity:.7">ร่วมเป็นคนแรกที่ลอยกระทง 🌸</p>';
    const rest = arr.slice(1, 120);
    const html = rest.map(donorItem).join('');
    $('donorList').innerHTML = html + (rest.length > 6 ? html : '');   // ซ้ำเพื่อเลื่อนวนต่อเนื่อง
    listDirty = false;
  }
  // auto-scroll (เลื่อนแสดงรายชื่อเรื่อยๆ)
  let scrollY = 0, hover = false;
  $('donorScroll').addEventListener('mouseenter', () => (hover = true));
  $('donorScroll').addEventListener('mouseleave', () => (hover = false));
  Scene.onFrame((dt) => {
    Walkers.pump(dt, performance.now() / 1000);
    const ul = $('donorList');
    const half = ul.scrollHeight / 2;
    if (ul.children.length > 12 && !hover) {
      scrollY += dt * 26;
      if (scrollY >= half) scrollY -= half;
      ul.style.transform = `translateY(${-scrollY}px)`;
    } else ul.style.transform = '';
  });
  setInterval(() => { if (listDirty) renderList(); }, 1000);
  setInterval(() => (listDirty = true), 30000); // refresh "x นาทีที่แล้ว"

  /* ------------------------------------------------------------------ */
  /*  Real-time polling                                                  */
  /* ------------------------------------------------------------------ */
  async function loadInitial() {
    try {
      const cfgRes = await apiGet({ action: 'config' });
      if (cfgRes.ok) applyConfig(cfgRes.config);
    } catch (e) { console.warn('config', e); }
    try {
      const res = await apiGet({ action: 'list' });
      if (res.ok) {
        res.items.forEach((d) => ingest(d, { animate: false }));
        state.total = res.total; state.count = res.count;
        renderStats(); listDirty = true;
      }
    } catch (e) { console.warn('list', e); }
    setTimeout(poll, C.POLL_MS);
  }
  async function poll() {
    try {
      const res = await apiGet({ action: 'list', since: Math.max(0, state.lastTs - 120000) });
      if (res.ok) {
        let n = 0;
        res.items.sort((a, b) => a.ts - b.ts).forEach((d) => { if (ingest(d, { animate: true })) n++; });
        state.total = res.total; state.count = res.count;
        renderStats(); if (n) listDirty = true;
      }
    } catch (e) { console.warn('poll', e); }
    setTimeout(poll, document.hidden ? C.POLL_MS * 3 : C.POLL_MS);
  }

  function applyConfig(cfg) {
    const num = ['MIN_AMOUNT', 'TIER_MEDIUM', 'TIER_LARGE', 'GOAL_AMOUNT'];
    Object.keys(cfg || {}).forEach((k) => { C[k] = num.includes(k) ? Number(cfg[k]) : cfg[k]; });
    $('eventTitle').textContent = C.EVENT_TITLE;
    buildTierCards(); renderPay(); renderTier(); renderStats();
    if (C.DONATION_OPEN === false || C.DONATION_OPEN === 'FALSE') {
      $('submitBtn').disabled = true; $('submitBtn').textContent = 'ปิดรับบริจาคแล้ว ขอบคุณค่ะ';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Demo mode (no backend)                                             */
  /* ------------------------------------------------------------------ */
  const FIRST_M = ['สมชาย', 'ประเสริฐ', 'วิชัย', 'สุรชัย', 'อนันต์', 'ธนากร', 'กิตติ', 'ณัฐวุฒิ', 'บุญมี', 'ทองดี', 'ศักดิ์ชัย', 'พงศกร'];
  const FIRST_F = ['สมหญิง', 'มาลี', 'สุดารัตน์', 'วันเพ็ญ', 'กาญจนา', 'นภัสสร', 'จันทร์เพ็ญ', 'ปราณี', 'อรุณี', 'พิมพ์ชนก', 'บัวผัน', 'ศิริพร'];
  const LAST = ['ใจดี', 'ริมโขง', 'สุขสันต์', 'ทองคำ', 'ศรีเลย', 'บุญเรือง', 'แก้วมณี', 'ปากชมพัฒนา', 'มีสุข', 'ชัยมงคล', 'พรหมมา', 'สายบุญ'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function fakeDonation(tsOffset = 0) {
    const g = Math.random() < 0.55 ? 'female' : 'male';
    const amt = pick([20, 20, 50, 50, 99, 100, 100, 199, 200, 300, 500, 1000]);
    const WISHES = ['ขอให้ทุกคนสุขภาพแข็งแรง', 'ขอให้คุณหมอและพยาบาลมีกำลังใจ', 'ขอให้ครอบครัวมีความสุข', 'ขอให้ รพ.ปากชม มีเครื่องมือแพทย์ที่ทันสมัย', '', '', '', ''];
    return { id: 'demo' + Math.random().toString(36).slice(2), ts: Date.now() - tsOffset, gender: g, amount: amt, wish: pick(WISHES),
      name: Math.random() < 0.08 ? 'ผู้ใจบุญ (ไม่ประสงค์ออกนาม)' : (g === 'female' ? pick(FIRST_F) : pick(FIRST_M)) + ' ' + pick(LAST) };
  }
  function startDemo() {
    $('demoBanner').hidden = false;
    for (let i = 0; i < 70; i++) {
      const d = fakeDonation((70 - i) * 60000 * Math.random() * 3);
      ingest(d, { animate: false }); state.total += d.amount; state.count++;
    }
    renderStats(); listDirty = true;
    const tick = () => {
      const d = fakeDonation(0); ingest(d, { animate: true }); state.total += d.amount; state.count++;
      renderStats(); listDirty = true;
      setTimeout(tick, 6000 + Math.random() * 9000);
    };
    setTimeout(tick, 1500);
  }

  /* ------------------------------------------------------------------ */
  /*  Form                                                               */
  /* ------------------------------------------------------------------ */
  // gender avatars
  document.querySelectorAll('#genderSeg .ava-m').forEach((i) => (i.style.backgroundImage = `url('${ava('male')}')`));
  document.querySelectorAll('#genderSeg .ava-f').forEach((i) => (i.style.backgroundImage = `url('${ava('female')}')`));
  $('genderSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.gender = b.dataset.v;
    [...$('genderSeg').children].forEach((x) => x.classList.toggle('on', x === b));
  });
  // quick amounts
  $('amountChips').innerHTML = C.QUICK_AMOUNTS.map((a) => `<button type="button" data-a="${a}">${fmt(a)}</button>`).join('');
  $('amountChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('fAmount').value = b.dataset.a; onAmount();
  });
  $('fAmount').addEventListener('input', onAmount);
  function onAmount() {
    const v = Number($('fAmount').value);
    [...$('amountChips').children].forEach((x) => x.classList.toggle('on', Number(x.dataset.a) === v));
    renderTier(); renderPay();
  }
  const TIER_RANGE = () => ({ S: [C.MIN_AMOUNT, C.TIER_MEDIUM - 1], M: [C.TIER_MEDIUM, C.TIER_LARGE - 1], L: [C.TIER_LARGE, null] });
  function buildTierCards() {
    const r = TIER_RANGE();
    $('tierCards').innerHTML = ['S', 'M', 'L'].map((t) => `
      <button type="button" class="tcard t${t}" data-t="${t}">
        <img src="${Scene.spriteURL(t)}" alt="">
        <b>${TIER_TH[t].replace('กระทง', '')}</b>
        <small>${fmt(r[t][0])}${r[t][1] ? '–' + fmt(r[t][1]) : '+'} ฿</small>
        ${t === 'L' ? '<em>+ พลุ 🎆</em>' : t === 'M' ? '<em>+ พลุ</em>' : ''}
      </button>`).join('');
  }
  $('tierCards').addEventListener('click', (e) => {
    const b = e.target.closest('.tcard'); if (!b) return;
    const t = b.dataset.t, r = TIER_RANGE()[t], cur = Number($('fAmount').value);
    if (tierOf(cur) !== t || !cur) $('fAmount').value = r[0];
    onAmount();
  });
  function renderTier() {
    const v = Number($('fAmount').value);
    const t = v ? tierOf(v) : '';
    document.querySelectorAll('.tcard').forEach((c) => c.classList.toggle('on', c.dataset.t === t));
    $('tierHint').textContent = v && v < C.MIN_AMOUNT ? `ขั้นต่ำ ${fmt(C.MIN_AMOUNT)} บาท` : (t ? `ได้${TIER_TH[t]} ${fmt(v)} บาท` : 'แตะขนาดกระทง หรือเลือกจำนวนเงิน');
    const btn = $('submitBtn');
    if (!btn.disabled) btn.textContent = t && v >= C.MIN_AMOUNT ? `ลอย${TIER_TH[t]} ${fmt(v)} บาท 🙏` : 'ลอยกระทง 🙏';
  }
  let payTimer, payQr = null;
  function payPayload(amt) {
    if (C.THAIQR_PAYLOAD) return PromptPay.withAmount(C.THAIQR_PAYLOAD, amt);
    if (C.PROMPTPAY_ID) return PromptPay.payload(C.PROMPTPAY_ID, amt);
    return '';
  }
  function renderPay() {
    clearTimeout(payTimer);
    payTimer = setTimeout(() => {
      const box = $('payBox');
      const amt = Number($('fAmount').value) || 0;
      const payload = window.qrcode ? payPayload(amt >= 1 ? amt : 0) : '';
      let html = '';
      if (payload) {
        payQr = qrcode(0, 'M'); payQr.addData(payload); payQr.make();
        const eDon = !!C.THAIQR_PAYLOAD;
        html += `<div class="pay-head"><span class="pp">PromptPay</span>${eDon ? '<span class="edon">e-Donation · ลดหย่อนภาษีได้</span>' : ''}</div>
          <div class="pay-qr-wrap"><div class="qr">${payQr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div></div>
          <div class="pay-amt">${amt >= 1 ? `สแกนจ่าย <b>${fmt(amt)} บาท</b> ยอดขึ้นอัตโนมัติ` : '<span class="warn">เลือกจำนวนเงินก่อน แล้ว QR จะใส่ยอดให้อัตโนมัติ</span>'}</div>
          <div class="pay-to">ผู้รับ: ${esc(C.PAY_NAME || C.HOSPITAL_NAME)}</div>
          <div class="pay-btns"><button type="button" class="pay-btn" id="saveQr">💾 บันทึก QR ลงเครื่อง</button></div>
          <p class="pay-tip">ใช้มือถือเครื่องเดียว? กดบันทึก QR › เปิดแอปธนาคาร › สแกน › <b>เลือกรูปจากอัลบั้ม</b></p>`;
      }
      if (C.ACCOUNT_NO) {
        html += `<div class="pay-acc"><div>หรือโอนเข้าบัญชี ${esc(C.BANK_NAME)}</div><div class="acc">${esc(C.ACCOUNT_NO)}</div><div>${esc(C.ACCOUNT_NAME)}</div>
          <button type="button" class="copy" data-copy="${esc(String(C.ACCOUNT_NO).replace(/[^0-9]/g, ''))}">คัดลอกเลขบัญชี</button></div>`;
      }
      if (!html) html = '<div style="opacity:.8">⚠️ ยังไม่ได้ตั้งค่าบัญชีรับบริจาค<br><small>(แก้ที่ชีต Settings)</small></div>';
      if (C.CONTACT) html += `<div class="pay-contact">ติดต่อ ${esc(C.CONTACT)}</div>`;
      box.innerHTML = html;
    }, 120);
  }
  // บันทึก QR เป็นรูป PNG (สำหรับคนที่ใช้มือถือเครื่องเดียว สแกนจอตัวเองไม่ได้)
  function saveQrImage() {
    if (!payQr) return;
    const amt = Number($('fAmount').value) || 0;
    const n = payQr.getModuleCount(), cell = 12, qrSize = n * cell, W = qrSize + 120, H = qrSize + 330;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#123a64'; g.fillRect(0, 0, W, 96);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 34px Mitr, sans-serif';
    g.fillText(C.THAIQR_PAYLOAD ? 'PromptPay e-Donation' : 'PromptPay', W / 2, 60);
    g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (payQr.isDark(r, c)) g.fillRect(60 + c * cell, 130 + r * cell, cell, cell);
    g.fillStyle = '#123a64'; g.font = '500 34px Mitr, sans-serif';
    g.fillText(C.PAY_NAME || C.HOSPITAL_NAME || '', W / 2, 130 + qrSize + 60);
    g.fillStyle = '#c0392b'; g.font = '600 44px Mitr, sans-serif';
    g.fillText(amt >= 1 ? `${fmt(amt)} บาท` : 'ระบุยอดเองในแอป', W / 2, 130 + qrSize + 120);
    g.fillStyle = '#666'; g.font = '300 22px Mitr, sans-serif';
    g.fillText('ลอยกระทงออนไลน์ ริมโขง · แนบสลิปที่หน้าเว็บหลังโอน', W / 2, 130 + qrSize + 165);
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `QR-ร่วมบุญ-${amt || 'ระบุยอด'}บาท.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const b = $('saveQr'); if (b) b.textContent = '✓ บันทึกแล้ว — เปิดแอปธนาคารได้เลย';
    }, 'image/png');
  }
  $('payBox').addEventListener('click', (e) => {
    if (e.target.closest('#saveQr')) return saveQrImage();
    const b = e.target.closest('[data-copy]'); if (!b) return;
    navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = 'คัดลอกแล้ว ✓'; });
  });


  // slip: compress image client-side
  $('fSlip').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    state.slip = null; $('slipDrop').classList.remove('has');
    if (!f) return;
    $('slipText').textContent = '⏳ กำลังเตรียมไฟล์…';
    try {
      state.slip = await prepareSlip(f);
      $('slipDrop').classList.add('has');
      $('slipPreview').src = state.slip.preview || '';
      $('slipText').textContent = '✓ ' + f.name;
    } catch (err) {
      $('slipText').textContent = '⚠️ ' + err.message;
    }
  });
  function readAsDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('อ่านไฟล์ไม่ได้')); r.readAsDataURL(f); }); }
  async function prepareSlip(f) {
    if (f.size > 15 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 15 MB');
    if (f.type === 'application/pdf') {
      if (f.size > 6 * 1024 * 1024) throw new Error('PDF ใหญ่เกิน 6 MB');
      const url = await readAsDataURL(f);
      return { mimeType: 'application/pdf', data: url.split(',')[1], name: f.name, preview: '' };
    }
    if (!/^image\//.test(f.type)) throw new Error('กรุณาเลือกไฟล์รูปภาพหรือ PDF');
    const url = await readAsDataURL(f);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const m = 1600, s = Math.min(1, m / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const out = cv.toDataURL('image/jpeg', 0.85);
      return { mimeType: 'image/jpeg', data: out.split(',')[1], name: f.name, preview: out };
    } catch (_) {
      // เช่น HEIC ที่เบราว์เซอร์แสดงไม่ได้ → ส่งไฟล์ดิบ
      if (f.size > 6 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 6 MB');
      return { mimeType: f.type, data: url.split(',')[1], name: f.name, preview: '' };
    }
  }

  $('donateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = (m) => { $('formErr').textContent = m; return false; };
    err('');
    const name = $('fName').value.trim();
    const amount = Number($('fAmount').value);
    if (name.length < 2) return err('กรุณากรอกชื่อ-สกุล');
    if (!state.gender) return err('กรุณาเลือกเพศ');
    if (!(amount >= C.MIN_AMOUNT)) return err(`จำนวนเงินขั้นต่ำ ${fmt(C.MIN_AMOUNT)} บาท`);
    if (!state.slip) return err('กรุณาแนบสลิปโอนเงิน');
    if (!$('fConsent').checked) return err('กรุณายินยอมการแสดงชื่อและเก็บข้อมูล (หรือเลือก “ไม่ประสงค์ออกนาม”)');

    const body = {
      name, gender: state.gender, amount, wish: $('fWish').value.trim(), phone: $('fPhone').value.trim(),
      receipt: $('fReceipt').checked, anonymous: $('fAnon').checked, website: $('fWebsite').value,
      slip: { mimeType: state.slip.mimeType, data: state.slip.data, name: state.slip.name },
    };
    const btn = $('submitBtn');
    btn.disabled = true; btn.textContent = 'กำลังส่งข้อมูล… 🌸';
    try {
      let res;
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 900));
        res = { ok: true, donation: { id: 'local' + Date.now(), ts: Date.now(), name: body.anonymous ? 'ผู้ใจบุญ (ไม่ประสงค์ออกนาม)' : name, gender: body.gender, amount, size: tierOf(amount), wish: body.wish } };
      } else res = await apiPost(body);
      if (!res.ok) throw new Error(res.error || 'ส่งข้อมูลไม่สำเร็จ');
      const d = res.donation;
      if (ingest(d, { animate: true })) { state.total += d.amount; state.count++; renderStats(); listDirty = true; }
      showThanks(d);
    } catch (ex) {
      err('❌ ' + (ex.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'));
    } finally {
      btn.disabled = false; renderTier();
    }
  });

  function showThanks(d) {
    $('donateForm').hidden = true; $('thanks').hidden = false;
    $('thanksText').innerHTML = `ขอบคุณ <b>${esc(d.name)}</b><br>ที่ร่วมบุญ ${fmt(d.amount)} บาท (${TIER_TH[d.size]})<br>ตัวการ์ตูนของคุณกำลังเดินไปลอยกระทงที่แม่น้ำโขง 🌸`;
    $('donateForm').reset(); state.slip = null; state.gender = '';
    [...$('genderSeg').children].forEach((x) => x.classList.remove('on'));
    $('slipDrop').classList.remove('has'); $('slipText').textContent = '📎 แตะเพื่อเลือกรูปสลิป (JPG/PNG/PDF)';
    renderTier(); renderPay();
    if (getComputedStyle($('stage-wrap')).position !== 'fixed') $('stage-wrap').scrollIntoView({ behavior: 'smooth' });
  }
  $('againBtn').addEventListener('click', () => { $('thanks').hidden = true; $('donateForm').hidden = false; });
  $('formToggle').addEventListener('click', () => {
    const c = $('formPanel').classList.toggle('collapsed');
    $('formToggle').textContent = c ? '+' : '–';
  });
  $('btnDonateMobile').addEventListener('click', () => $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  // ปุ่มลอย "ร่วมบุญ" บนมือถือ: ซ่อนเมื่อฟอร์มอยู่บนจอ เพื่อไม่ให้ทับปุ่มส่ง
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((en) => document.body.classList.toggle('form-in-view', en.isIntersecting)),
      { threshold: 0.05 }).observe($('formPanel'));
  }

  /* ------------------------------------------------------------------ */
  /*  Controls & modes                                                   */
  /* ------------------------------------------------------------------ */
  let sound = false;
  $('btnSound').addEventListener('click', () => { sound = !sound; Scene.setSound(sound); $('btnSound').textContent = sound ? '🔔' : '🔇'; });
  $('btnFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => setTimeout(Scene.fit, 100));

  if (TV) {
    document.body.classList.add('tv');
    $('tvQr').hidden = false;
    const u = new URL(C.DONATE_URL || location.href); u.searchParams.delete('tv');
    const qr = qrcode(0, 'M'); qr.addData(u.toString()); qr.make();
    $('tvQrCode').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
    $('tvQrUrl').textContent = u.host + u.pathname;
    // OBS Browser Source เล่นเสียงได้เองโดยไม่ต้องคลิก → ใช้ ?sound=1
    if (qs.has('sound')) { sound = true; Scene.setSound(true); }
    else document.addEventListener('click', () => { if (!sound) { sound = true; Scene.setSound(true); } }, { once: true });
    startLiveBar();
    startTicker();
  }

  /* ---------------- Facebook Live: แถบ LIVE + นาฬิกา + นับถอยหลัง ---------------- */
  function startLiveBar() {
    $('liveBar').hidden = false;
    const tick = () => {
      $('livePage').textContent = C.FB_PAGE_NAME || '';
      const now = new Date();
      $('liveClock').textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.';
      const endStr = String(qs.get('end') || C.EVENT_END || '').trim();
      const end = endStr ? new Date(/^\d{1,2}:\d{2}$/.test(endStr) ? todayAt(endStr) : endStr) : null;
      const cd = $('liveCountdown');
      if (end && !isNaN(end)) {
        cd.hidden = false;
        const left = Math.floor((end - now) / 1000);
        if (left > 0) {
          const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), sec = left % 60;
          cd.innerHTML = `ปิดรับบริจาคใน <b>${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}</b>`;
          cd.classList.toggle('urgent', left < 900);
        } else { cd.innerHTML = '🙏 ขอบคุณทุกท่านที่ร่วมบุญ'; cd.classList.remove('urgent'); }
      } else cd.hidden = true;
    };
    tick(); setInterval(tick, 1000);
  }
  function todayAt(hhmm) {
    const d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // วันที่ตามเวลาไทย
    return `${d}T${hhmm.padStart(5, '0')}:00+07:00`;
  }

  /* ---------------- แถบข้อความวิ่ง: ข้อความประชาสัมพันธ์ + คำอธิษฐานล่าสุด ---------------- */
  function startTicker() {
    $('ticker').hidden = false;
    const build = () => {
      const wishes = [...state.donations.values()].filter((d) => d.wish).sort((a, b) => b.ts - a.ts).slice(0, 8)
        .map((d) => `✨ “${esc(d.wish)}” — ${esc(d.name)}`);
      const msgs = [];
      const base = (C.TICKER_MESSAGES || []).map(esc);
      base.forEach((m, i) => { msgs.push(m); if (wishes[i]) msgs.push(wishes[i]); });
      wishes.slice(base.length).forEach((w) => msgs.push(w));
      const html = msgs.map((m) => `<span>${m}</span>`).join('');
      $('tickerTrack').innerHTML = html + html;
      const w = $('tickerTrack').scrollWidth / 2;
      $('tickerTrack').style.animationDuration = Math.max(30, w / 90) + 's';
    };
    build(); setInterval(build, 120000);
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                               */
  /* ------------------------------------------------------------------ */
  $('eventTitle').textContent = C.EVENT_TITLE;
  Scene.start(C);
  buildTierCards();
  renderTier(); renderPay(); renderStats();
  if (DEMO) startDemo(); else loadInitial();
  setTimeout(Scene.fit, 300);
})();
