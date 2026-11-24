/* =====================================================================
 *  Scene: stage fitting, canvas effects, krathong on the Mekong,
 *  sky lanterns, fireworks, ripples, props (table + hospital sign)
 *  ทุกพิกัดเป็น "พิกัดภาพพื้นหลัง" ขนาด 2576 x 1450
 * ===================================================================== */
(function () {
  const W = 2576, H = 1450;
  const stage = document.getElementById('stage');
  const wrap = document.getElementById('stage-wrap');
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');

  /* ------------------------------------------------------------------ */
  /*  Geometry of the photo                                              */
  /* ------------------------------------------------------------------ */
  // พื้นที่ผิวน้ำ (ไม่รวมแพไม้ไผ่และตลิ่ง)
  const WATER = [[0, 668], [1640, 668], [1590, 720], [1450, 830], [1325, 925], [1300, 1062], [705, 1094],
    [272, 1290], [205, 1450], [0, 1450]];
  const RELEASE_POINT = { x: 648, y: 1112 };        // จุดปล่อยกระทงข้างแพ
  const GYRE = { cx: 870, cy: 900, rx: 540, ry: 190 }; // วงน้ำวน — กระทงไหลวนไปมา

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inWater = (x, y) => inPoly(x, y, WATER);
  // perspective factor: far (horizon) small, near big
  const persp = (y) => Math.max(0.1, Math.min(1.15, Math.pow(Math.max(0, (y - 655)) / 640, 1.08)));

  /* ------------------------------------------------------------------ */
  /*  Stage fitting                                                      */
  /* ------------------------------------------------------------------ */
  let scale = 1, renderScale = 1;
  function fit() {
    const vw = wrap.clientWidth, vh = wrap.clientHeight;
    const mobile = getComputedStyle(wrap).position !== 'fixed';
    let s, ox, oy;
    if (mobile) { s = vw / W; ox = 0; oy = 0; }
    else {
      s = Math.max(vw / W, vh / H);                    // cover
      ox = (vw - W * s) / 2;
      oy = Math.min(0, (vh - H * s) * 0.6);
    }
    scale = s;
    stage.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
    const dpr = window.devicePixelRatio || 1;
    const rs = Math.max(0.45, Math.min(1, s * dpr * 1.05));
    if (Math.abs(rs - renderScale) > 0.02 || !canvas.width) {
      renderScale = rs;
      canvas.width = Math.round(W * rs);
      canvas.height = Math.round(H * rs);
      buildSprites();
    }
  }
  window.addEventListener('resize', fit);

  /* ------------------------------------------------------------------ */
  /*  Sprites                                                            */
  /* ------------------------------------------------------------------ */
  const PALETTES = [
    { a: '#ff9f1c', b: '#ffcf3f', c: '#ff5d8f', d: '#fff2a8' },  // ดาวเรือง + บานไม่รู้โรยชมพู
    { a: '#f6d32d', b: '#ffffff', c: '#c86dd7', d: '#ffe9f3' },  // เหลือง + กล้วยไม้ม่วง
    { a: '#ff7b39', b: '#ffd27a', c: '#ff3b5c', d: '#fff0c9' },  // ส้มแดง
  ];
  const sprites = {};     // key: tier+palette
  let glowSprite, reflSprite, lanternSprite, flameSprite;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function drawKrathongSprite(tier, pal) {
    const S = 220, c = mk(S, S), g = c.getContext('2d');
    const cx = S / 2, wl = 160;                     // waterline
    const R = tier === 'L' ? 92 : tier === 'M' ? 84 : 78;
    // trunk base
    let grd = g.createLinearGradient(0, wl - 20, 0, wl + 14);
    grd.addColorStop(0, '#6f8f3f'); grd.addColorStop(1, '#22361a');
    g.fillStyle = grd; g.beginPath(); g.ellipse(cx, wl, R, R * 0.27, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d7e2b0'; g.beginPath(); g.ellipse(cx, wl - 9, R * 0.97, R * 0.24, 0, 0, Math.PI * 2); g.fill();
    if (tier === 'L') { g.strokeStyle = '#e8b847'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, wl - 4, R * 0.99, R * 0.26, 0, 0, Math.PI * 2); g.stroke(); }
    // folded banana-leaf points (กลีบตองพับ) – back half first then front
    const ring = (rx, ry, y0, n, len, colA, colB, back) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const s = Math.sin(a);
        if (back ? s > 0 : s <= 0) continue;
        const x = cx + Math.cos(a) * rx, y = y0 + s * ry;
        const ox = Math.cos(a) * len * 0.45, tip = len;
        g.fillStyle = i % 2 ? colA : colB;
        g.beginPath();
        g.moveTo(x - 11, y + 2);
        g.quadraticCurveTo(x - 8 + ox * 0.5, y - tip * 0.6, x + ox, y - tip);
        g.quadraticCurveTo(x + 8 + ox * 0.5, y - tip * 0.6, x + 11, y + 2);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(220,255,180,.45)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + ox * 0.9, y - tip * 0.9); g.stroke();
      }
    };
    const n1 = tier === 'L' ? 22 : 18;
    ring(R * 0.88, R * 0.22, wl - 12, n1, 24, '#3f8a31', '#2e6a22', true);
    ring(R * 0.6, R * 0.15, wl - 20, n1 - 4, 20, '#4a9a3a', '#347a28', true);
    // flowers ring (back)
    const flower = (x, y, r, col, center) => {
      g.fillStyle = col;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.4, r * 0.55, r * 0.42, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = center; g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
    };
    const fl = (back) => {
      const n = tier === 'L' ? 14 : 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2, s = Math.sin(a);
        if (back ? s > 0 : s <= 0) continue;
        const x = cx + Math.cos(a) * R * 0.48, y = wl - 26 + s * R * 0.12;
        flower(x, y, tier === 'S' ? 13 : 15, i % 3 === 0 ? pal.c : (i % 3 === 1 ? pal.a : pal.b), i % 3 === 0 ? pal.d : '#b35a00');
      }
    };
    fl(true);
    // center cone (บายศรี) for M / L
    if (tier !== 'S') {
      const top = tier === 'L' ? 34 : 58, baseY = wl - 26, bw = tier === 'L' ? 38 : 30;
      grd = g.createLinearGradient(cx - bw, 0, cx + bw, 0);
      grd.addColorStop(0, '#2c6b20'); grd.addColorStop(.5, '#58b444'); grd.addColorStop(1, '#2c6b20');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(cx - bw, baseY); g.quadraticCurveTo(cx - bw * 0.5, top + 30, cx, top); g.quadraticCurveTo(cx + bw * 0.5, top + 30, cx + bw, baseY); g.closePath(); g.fill();
      // leaf scales
      g.strokeStyle = 'rgba(210,255,170,.55)'; g.lineWidth = 1.4;
      for (let k = 1; k < 5; k++) { const yy = baseY - (baseY - top) * k / 5, ww = bw * (1 - k / 5.4); g.beginPath(); g.moveTo(cx - ww, yy + 6); g.quadraticCurveTo(cx, yy - 6, cx + ww, yy + 6); g.stroke(); }
      if (tier === 'L') {
        g.strokeStyle = '#f2c14e'; g.lineWidth = 2.2;
        for (let k = 1; k < 5; k += 2) { const yy = baseY - (baseY - top) * k / 5, ww = bw * (1 - k / 5.4); g.beginPath(); g.moveTo(cx - ww, yy + 6); g.quadraticCurveTo(cx, yy - 6, cx + ww, yy + 6); g.stroke(); }
        // jasmine garland dots
        g.fillStyle = '#fffdf0';
        for (let k = 0; k < 9; k++) { const a = Math.PI * (0.1 + 0.8 * k / 8); g.beginPath(); g.arc(cx - Math.cos(a) * bw * 0.85, baseY - 6 + Math.sin(a) * 9, 3.2, 0, Math.PI * 2); g.fill(); }
      }
      flower(cx, top + 2, tier === 'L' ? 11 : 9, pal.c, pal.d);
    }
    fl(false);
    ring(R * 0.88, R * 0.22, wl - 12, n1, 20, '#4a9a3a', '#2f7424', false);
    // candle + incense (front-left / right)
    const candleX = tier === 'S' ? cx - 4 : cx - 26, candleTop = tier === 'S' ? 86 : 100;
    g.fillStyle = '#fff6d8'; g.fillRect(candleX - 5, candleTop, 10, wl - 22 - candleTop);
    g.fillStyle = '#e9dcb0'; g.fillRect(candleX + 2, candleTop, 3, wl - 22 - candleTop);
    const incX = tier === 'S' ? cx + 14 : cx + 26;
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = '#7a3b1b'; g.lineWidth = 2.2; g.beginPath();
      g.moveTo(incX + k * 5 - 5, wl - 24); g.lineTo(incX + k * 7 - 9, 60 + k * 3); g.stroke();
      g.fillStyle = '#ff5a1f'; g.beginPath(); g.arc(incX + k * 7 - 9, 60 + k * 3, 2.4, 0, Math.PI * 2); g.fill();
    }
    // warm candle-light tint (ให้ดูสว่างอบอุ่นเหมือนในภาพจริง)
    g.globalCompositeOperation = 'source-atop';
    const warm = g.createRadialGradient(candleX, candleTop, 4, candleX, candleTop + 30, 120);
    warm.addColorStop(0, 'rgba(255,200,90,.65)'); warm.addColorStop(.5, 'rgba(255,150,50,.3)'); warm.addColorStop(1, 'rgba(60,20,0,.25)');
    g.fillStyle = warm; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    return { canvas: c, size: S, wl, flame: { x: candleX, y: candleTop - 2 }, incense: { x: incX - 2, y: 60 } };
  }

  function buildSprites() {
    for (const t of ['S', 'M', 'L']) PALETTES.forEach((p, i) => { sprites[t + i] = drawKrathongSprite(t, p); });
    // glow
    glowSprite = mk(128, 128);
    let g = glowSprite.getContext('2d');
    let grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,210,120,.95)'); grd.addColorStop(.25, 'rgba(255,160,60,.45)'); grd.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    // reflection streak on water
    reflSprite = mk(64, 256);
    g = reflSprite.getContext('2d');
    grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,190,90,.55)'); grd.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(32, 60, 26, 190, 0, 0, Math.PI * 2); g.fill();
    // flame
    flameSprite = mk(40, 70);
    g = flameSprite.getContext('2d');
    grd = g.createRadialGradient(20, 48, 2, 20, 44, 26);
    grd.addColorStop(0, '#fffbe0'); grd.addColorStop(.45, '#ffc83a'); grd.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(20, 4); g.quadraticCurveTo(36, 40, 20, 62); g.quadraticCurveTo(4, 40, 20, 4); g.fill();
    // sky lantern (โคมลอย)
    lanternSprite = mk(80, 110);
    g = lanternSprite.getContext('2d');
    grd = g.createRadialGradient(40, 60, 4, 40, 55, 60);
    grd.addColorStop(0, 'rgba(255,220,150,.6)'); grd.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 80, 110);
    grd = g.createLinearGradient(0, 30, 0, 85);
    grd.addColorStop(0, '#ff9b3b'); grd.addColorStop(.7, '#ffd27c'); grd.addColorStop(1, '#fff2c2');
    g.fillStyle = grd; g.beginPath(); g.moveTo(26, 30); g.quadraticCurveTo(40, 24, 54, 30); g.lineTo(58, 84); g.quadraticCurveTo(40, 90, 22, 84); g.closePath(); g.fill();
  }

  /* ------------------------------------------------------------------ */
  /*  Name tags (pre-rendered)                                           */
  /* ------------------------------------------------------------------ */
  function makeTag(name, tier) {
    const fs = 26, padX = 14;
    const c0 = mk(4, 4).getContext('2d');
    c0.font = `500 ${fs}px Mitr, sans-serif`;
    const label = name.length > 22 ? name.slice(0, 21) + '…' : name;
    const tw = Math.ceil(c0.measureText(label).width);
    const w = tw + padX * 2, h = fs + 14, stick = 26;
    const c = mk(w + 4, h + stick + 4), g = c.getContext('2d');
    g.strokeStyle = '#8a5a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 + 2, h); g.lineTo(w / 2 + 2, h + stick + 2); g.stroke();
    const r = h / 2;
    g.beginPath(); g.moveTo(2 + r, 2); g.arcTo(w + 2, 2, w + 2, h + 2, r); g.arcTo(w + 2, h + 2, 2, h + 2, r); g.arcTo(2, h + 2, 2, 2, r); g.arcTo(2, 2, w + 2, 2, r); g.closePath();
    if (tier === 'L') { const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#fff1bf'); grd.addColorStop(1, '#f3be4f'); g.fillStyle = grd; }
    else g.fillStyle = 'rgba(255,250,238,.94)';
    g.fill(); g.strokeStyle = tier === 'L' ? '#b8781a' : '#e4b062'; g.lineWidth = 2; g.stroke();
    g.font = `500 ${fs}px Mitr, sans-serif`; g.fillStyle = '#4a2600'; g.textBaseline = 'middle';
    g.fillText(label, padX + 2, h / 2 + 3);
    return { canvas: c, w: w + 4, h: h + stick + 4 };
  }

  /* ------------------------------------------------------------------ */
  /*  Krathong on water                                                  */
  /* ------------------------------------------------------------------ */
  const TIER_W = { S: 54, M: 70, L: 92 };  // ความกว้างที่ระยะใกล้ (stage px)
  const krathongs = [];
  const ripples = [];
  let hashSeed = 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function polarOf(x, y) {
    const dx = (x - GYRE.cx) / GYRE.rx, dy = (y - GYRE.cy) / GYRE.ry;
    return { th: Math.atan2(dy, dx), r: Math.hypot(dx, dy) };
  }

  function addKrathong(d, opts = {}) {
    const h = hash(d.id || String(hashSeed++));
    const tier = d.size || 'S';
    const k = {
      id: d.id, name: d.name || '', tier,
      sprite: sprites[tier + (h % PALETTES.length)],
      tag: makeTag(d.name || 'ผู้ใจบุญ', tier),
      th: 0, r: 0, rTarget: 0.25 + ((h >> 3) % 1000) / 1000 * 0.85,
      omega: (2 * Math.PI / 340) * (0.7 + ((h >> 7) % 100) / 160),
      ph1: (h % 628) / 100, ph2: ((h >> 5) % 628) / 100,
      x: 0, y: 0, born: performance.now(), fresh: !!opts.fresh, alpha: opts.fresh ? 1 : 0, dying: false,
    };
    if (opts.at) {
      const p = polarOf(opts.at.x, opts.at.y);
      k.th = p.th; k.r = p.r;
      k.x = opts.at.x; k.y = opts.at.y;
      k.alpha = 1;
    } else {
      // กระจายบนวงน้ำวน ณ ตำแหน่งสุ่ม (รายการเก่าตอนเปิดหน้า)
      for (let tries = 0; tries < 30; tries++) {
        k.th = Math.random() * Math.PI * 2; k.r = k.rTarget;
        const pos = gyrePos(k, 0);
        if (inWater(pos.x, pos.y)) { k.x = pos.x; k.y = pos.y; break; }
      }
    }
    krathongs.push(k);
    const max = (window.LK_CONFIG && LK_CONFIG.MAX_KRATHONG_ON_WATER) || 260;
    const alive = krathongs.filter(q => !q.dying);
    if (alive.length > max) alive.slice(0, alive.length - max).forEach(q => q.dying = true);
    return k;
  }

  function gyrePos(k, t) {
    const wob = Math.sin(t * 0.21 + k.ph1) * 0.06 + Math.sin(t * 0.47 + k.ph2) * 0.03;
    const r = k.r + wob;
    return { x: GYRE.cx + Math.cos(k.th) * GYRE.rx * r, y: GYRE.cy + Math.sin(k.th) * GYRE.ry * r };
  }

  function updateKrathongs(dt, t) {
    for (const k of krathongs) {
      // ค่อยๆ เคลื่อนเข้าสู่วงโคจรของตัวเอง แล้วไหลวนไปเรื่อยๆ
      k.r += (k.rTarget - k.r) * Math.min(1, dt * 0.05);
      k.th += k.omega * dt * (0.55 + 0.45 * persp(k.y));
      let p = gyrePos(k, t);
      if (!inWater(p.x, p.y)) {
        // ชนตลิ่ง/แพ → ดึงเข้าหาใจกลางแม่น้ำ
        k.rTarget = Math.max(0.2, k.rTarget * 0.985);
        k.r *= 0.995;
        p = { x: k.x + (GYRE.cx - k.x) * 0.01, y: k.y + (GYRE.cy - k.y) * 0.01 };
      }
      // smooth follow
      const f = Math.min(1, dt * 1.6);
      k.x += (p.x - k.x) * f; k.y += (p.y - k.y) * f;
      if (k.dying) k.alpha -= dt * 0.25; else if (k.alpha < 1) k.alpha = Math.min(1, k.alpha + dt * 0.5);
    }
    for (let i = krathongs.length - 1; i >= 0; i--) if (krathongs[i].alpha <= 0 && krathongs[i].dying) krathongs.splice(i, 1);
  }

  function drawKrathongs(t) {
    const list = krathongs.slice().sort((a, b) => a.y - b.y);
    const now = performance.now();
    // pass 1: reflections + glow
    ctx.globalCompositeOperation = 'lighter';
    for (const k of list) {
      const p = persp(k.y), w = TIER_W[k.tier] * p;
      const fl = 0.8 + 0.2 * Math.sin(t * 9 + k.ph1 * 3) * Math.sin(t * 5.3 + k.ph2);
      ctx.globalAlpha = 0.55 * k.alpha * fl;
      ctx.drawImage(reflSprite, k.x - w * 0.22, k.y - w * 0.05, w * 0.44, w * 1.3);
      ctx.globalAlpha = 0.95 * k.alpha * fl;
      const gs = w * 2.6;
      ctx.drawImage(glowSprite, k.x - gs / 2, k.y - w * 0.55 - gs / 2, gs, gs);
    }
    ctx.globalCompositeOperation = 'source-over';
    // pass 2: krathong bodies + flames
    for (const k of list) {
      const p = persp(k.y), w = TIER_W[k.tier] * p, sp = k.sprite, sc = w / (sp.size * 0.8);
      const bob = Math.sin(t * 1.7 + k.ph1) * 1.2 * p, rot = Math.sin(t * 1.1 + k.ph2) * 0.035;
      ctx.globalAlpha = k.alpha;
      ctx.save();
      ctx.translate(k.x, k.y + bob); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.drawImage(sp.canvas, -sp.size / 2, -sp.wl);
      // flame
      const fx = sp.flame.x - sp.size / 2, fy = sp.flame.y - sp.wl;
      const fl = 1 + 0.12 * Math.sin(t * 13 + k.ph1 * 7) + 0.08 * Math.sin(t * 23 + k.ph2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(flameSprite, fx - 10 * fl, fy - 34 * fl, 20 * fl, 36 * fl);
      ctx.globalAlpha = k.alpha * 0.5;
      ctx.drawImage(glowSprite, fx - 40, fy - 50, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    // pass 3: name tags — แสดงเฉพาะที่อ่านออก ไม่ซ้อนกัน (กระทงใหม่ได้ก่อน)
    const cands = [];
    for (const k of list) {
      const p = persp(k.y), fresh = k.fresh && now - k.born < 180000;
      if (!fresh && p < 0.42) continue;
      cands.push({ k, p, pri: (fresh ? 10 : 0) + p });
    }
    cands.sort((a, b) => b.pri - a.pri);
    const placed = [];
    for (const { k, p } of cands) {
      if (placed.length >= 34) break;
      const w = TIER_W[k.tier] * p;
      const ts = Math.max(0.5, p) * 0.62;
      const tw = k.tag.w * ts, th = k.tag.h * ts;
      const x = k.x - tw / 2 + w * 0.12, y = k.y - w * 0.62 - th;
      const box = [x, y, x + tw, y + th * 0.55];
      if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      ctx.globalAlpha = k.alpha * Math.min(1, 0.5 + p);
      ctx.drawImage(k.tag.canvas, x, y, tw, th);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /*  Ripples / sparkles / fireworks / lanterns / moon                   */
  /* ------------------------------------------------------------------ */
  function ripple(x, y, n = 3) { for (let i = 0; i < n; i++) ripples.push({ x, y, r: 0, life: 0, delay: i * 0.35 }); }
  function drawRipples(dt) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.life += dt; r.r += dt * 60;
      const a = Math.max(0, 1 - r.life / 2.2);
      if (a <= 0) { ripples.splice(i, 1); continue; }
      const p = persp(r.y);
      ctx.strokeStyle = `rgba(255,220,160,${a * 0.7})`; ctx.lineWidth = 2.2 * p + 0.5;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * p, r.r * p * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const sparks = [];
  function sparkle(x, y, n = 18, spread = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(spread * 0.4, spread);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(0.6, 1.3), t: 0, s: rnd(2, 5), hue: rnd(35, 55), g: 40 });
    }
  }
  const fireworks = [];
  function firework(x, y) {
    x = x || rnd(250, 1350); y = y || rnd(130, 420);
    fireworks.push({ x, y: 680, tx: x, ty: y, t: 0, exploded: false, hue: [30, 45, 330, 200, 55][Math.floor(Math.random() * 5)] });
  }
  function updateFireworks(dt) {
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const f = fireworks[i];
      f.t += dt;
      if (!f.exploded) {
        const k = Math.min(1, f.t / 1.1);
        const cy = 680 + (f.ty - 680) * (1 - Math.pow(1 - k, 3));
        ctx.fillStyle = `hsla(${f.hue},100%,80%,.9)`; ctx.beginPath(); ctx.arc(f.tx, cy, 3, 0, Math.PI * 2); ctx.fill();
        if (k >= 1) {
          f.exploded = true;
          for (let j = 0; j < 70; j++) {
            const a = (j / 70) * Math.PI * 2 + Math.random() * 0.1, v = rnd(90, 190);
            sparks.push({ x: f.tx, y: f.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(1.4, 2.2), t: 0, s: rnd(2, 3.5), hue: f.hue + rnd(-12, 12), g: 35 });
          }
          fireworks.splice(i, 1);
        }
      }
    }
  }
  function drawSparks(dt) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt; if (s.t > s.life) { sparks.splice(i, 1); continue; }
      s.vx *= 0.985; s.vy = s.vy * 0.985 + s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const a = 1 - s.t / s.life;
      ctx.fillStyle = `hsla(${s.hue},100%,70%,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s * (0.6 + a * 0.6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const lanterns = [];
  function initLanterns() {
    for (let i = 0; i < 26; i++) lanterns.push(newLantern(true));
  }
  function newLantern(anyY) {
    const d = rnd(0.25, 1);
    return { x: rnd(120, 1900), y: anyY ? rnd(60, 640) : rnd(600, 700), d, v: rnd(7, 16) * d, ph: rnd(0, 6), fl: rnd(0, 6) };
  }
  function drawLanterns(dt, t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lanterns) {
      L.y -= L.v * dt; L.x += Math.sin(t * 0.3 + L.ph) * 4 * dt * L.d;
      if (L.y < -60) Object.assign(L, newLantern(false));
      const a = Math.min(1, (L.y + 40) / 200) * (0.55 + 0.45 * L.d) * (0.85 + 0.15 * Math.sin(t * 3 + L.fl));
      const s = 34 * L.d;
      ctx.globalAlpha = a;
      ctx.drawImage(lanternSprite, L.x - s / 2, L.y - s * 0.7, s, s * 1.38);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const stars = Array.from({ length: 40 }, () => ({ x: rnd(0, 2000), y: rnd(0, 560), ph: rnd(0, 6), s: rnd(0.6, 1.6) }));
  function drawSky(t) {
    // moon halo
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.6);
    const grd = ctx.createRadialGradient(1466, 152, 40, 1466, 152, 200);
    grd.addColorStop(0, `rgba(255,248,220,${0.22 * pulse})`); grd.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = grd; ctx.fillRect(1266, -48, 400, 400);
    // twinkles
    for (const s of stars) {
      const a = Math.max(0, Math.sin(t * 1.3 + s.ph)) * 0.8;
      if (a < 0.05) continue;
      ctx.fillStyle = `rgba(255,245,220,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    }
    // water shimmer near shore lights
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = 560 + (i * 97) % 900, y = 700 + (i * 53) % 330;
      if (!inWater(x, y)) continue;
      const a = Math.max(0, Math.sin(t * 0.9 + i * 1.7)) * 0.12;
      ctx.fillStyle = `rgba(255,200,120,${a})`;
      ctx.fillRect(x - 30 * persp(y), y, 60 * persp(y), 1.6);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------ */
  /*  Props: krathong table + hospital sign                              */
  /* ------------------------------------------------------------------ */
  const TABLE = { x: 2284, y: 806, w: 150 };   // โต๊ะรับกระทง (บนทางเดินด้านบนบันได)
  function buildProps(cfg) {
    const props = document.getElementById('props');
    const miniK = (x, y, s, c) => `
      <g transform="translate(${x} ${y}) scale(${s})">
        <ellipse cx="0" cy="0" rx="20" ry="6" fill="#2d5a1f"/><ellipse cx="0" cy="-3" rx="19" ry="5" fill="#cfdca6"/>
        ${[-14, -7, 0, 7, 14].map((dx, i) => `<path d="M${dx - 4} -3 Q${dx} -16 ${dx + dx * .25} -19 Q${dx + 4} -16 ${dx + 4} -3Z" fill="${i % 2 ? '#3b8a2d' : '#2f6e22'}"/>`).join('')}
        <path d="M-7 -6 Q-2 -26 0 -30 Q2 -26 7 -6Z" fill="#4aa23a"/>
        <circle cx="-9" cy="-8" r="3.4" fill="${c}"/><circle cx="9" cy="-8" r="3.4" fill="#ffcf3f"/><circle cx="0" cy="-30" r="3" fill="${c}"/>
        <rect x="-3" y="-20" width="2.2" height="12" fill="#fff6d8"/><circle class="flick" cx="-1.9" cy="-22.5" r="2.4" fill="#ffd25a"/>
      </g>`;
    props.innerHTML = `
      <svg class="prop" id="table" style="left:${TABLE.x - 90}px;top:${TABLE.y - 120}px;z-index:${TABLE.y}" width="180" height="128" viewBox="0 0 180 128">
        <defs><linearGradient id="cloth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#e9c98a"/></linearGradient></defs>
        <ellipse cx="90" cy="122" rx="80" ry="7" fill="rgba(0,0,0,.35)"/>
        <rect x="22" y="66" width="7" height="56" fill="#6b3f1d"/><rect x="151" y="66" width="7" height="56" fill="#6b3f1d"/>
        <path d="M10 56 h160 l-6 34 h-148z" fill="url(#cloth)"/>
        <path d="M16 90 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 l0 -6 h-144z" fill="#c8102e" opacity=".9"/>
        <rect x="6" y="50" width="168" height="8" rx="3" fill="#8b5a2b"/>
        ${miniK(40, 50, 1, '#ff5d8f')}${miniK(78, 50, 1.1, '#c86dd7')}${miniK(118, 50, 1, '#ff7b39')}${miniK(150, 50, .85, '#ff5d8f')}
        <rect x="58" y="94" width="64" height="20" rx="5" fill="#5b2a0a"/>
        <text x="90" y="108" text-anchor="middle" font-family="Mitr" font-size="11" fill="#ffe39b">จุดรับกระทง</text>
      </svg>
      <svg class="prop" id="sign" style="left:2268px;top:905px;z-index:1180" width="300" height="300" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="wood" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7a4520"/><stop offset="1" stop-color="#4a2610"/></linearGradient>
          <linearGradient id="goldf" x1="0" x2="1"><stop offset="0" stop-color="#b8781a"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#b8781a"/></linearGradient>
          <radialGradient id="sglow"><stop offset="0" stop-color="rgba(255,200,110,.55)"/><stop offset="1" stop-color="rgba(255,160,60,0)"/></radialGradient>
        </defs>
        <ellipse cx="150" cy="110" rx="160" ry="110" fill="url(#sglow)"/>
        <rect x="58" y="150" width="14" height="148" fill="#3c1f0c"/><rect x="228" y="150" width="14" height="148" fill="#3c1f0c"/>
        <ellipse cx="150" cy="296" rx="120" ry="6" fill="rgba(0,0,0,.4)"/>
        <!-- Lanna roof crest -->
        <path d="M30 52 L150 6 L270 52 Z" fill="url(#goldf)"/><path d="M48 50 L150 14 L252 50Z" fill="#7a1220"/>
        <path d="M30 52 q-14 -8 -12 -26 q6 12 18 18z M270 52 q14 -8 12 -26 q-6 12 -18 18z" fill="url(#goldf)"/>
        <circle cx="150" cy="34" r="9" fill="#ffd86b"/><text x="150" y="39" text-anchor="middle" font-size="12">✚</text>
        <rect x="20" y="50" width="260" height="110" rx="10" fill="url(#goldf)"/>
        <rect x="27" y="57" width="246" height="96" rx="7" fill="url(#wood)"/>
        <text x="150" y="99" text-anchor="middle" textLength="226" lengthAdjust="spacingAndGlyphs" font-family="Charm, Mitr" font-weight="700" font-size="33" fill="#ffe39b" style="filter:drop-shadow(0 0 6px rgba(255,200,90,.6))">${escapeXml(cfg.HOSPITAL_NAME || 'โรงพยาบาลปากชม')}</text>
        <text x="150" y="122" text-anchor="middle" textLength="222" lengthAdjust="spacingAndGlyphs" font-family="Mitr" font-size="12" fill="#f3d9a6">PAK CHOM HOSPITAL • ${escapeXml(cfg.HOSPITAL_SUB || 'จ.เลย')}</text>
        <text x="150" y="143" text-anchor="middle" textLength="216" lengthAdjust="spacingAndGlyphs" font-family="Mitr" font-size="12" fill="#ffd27a">🪷 ลอยกระทงออนไลน์ ร่วมบุญริมโขง 🪷</text>
        <!-- little hanging lanterns -->
        <g class="swing"><line x1="40" y1="160" x2="40" y2="178" stroke="#3c1f0c"/><rect x="31" y="178" width="18" height="24" rx="6" fill="#ff8a2a"/><rect x="34" y="202" width="12" height="10" fill="#ffd27a"/></g>
        <g class="swing2"><line x1="260" y1="160" x2="260" y2="178" stroke="#3c1f0c"/><rect x="251" y="178" width="18" height="24" rx="6" fill="#ff8a2a"/><rect x="254" y="202" width="12" height="10" fill="#ffd27a"/></g>
      </svg>`;
    const style = document.createElement('style');
    style.textContent = `
      #sign .swing{transform-origin:40px 160px;animation:sw 3s ease-in-out infinite}
      #sign .swing2{transform-origin:260px 160px;animation:sw 3.4s ease-in-out infinite reverse}
      @keyframes sw{50%{transform:rotate(6deg)}}
      #table .flick{animation:fk .18s infinite alternate}@keyframes fk{to{opacity:.55;r:2}}`;
    document.head.appendChild(style);
  }
  function escapeXml(s) { return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ------------------------------------------------------------------ */
  /*  Sound (WebAudio chime — no external file)                          */
  /* ------------------------------------------------------------------ */
  let audio = null, soundOn = false;
  function chime(big) {
    if (!soundOn) return;
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const notes = big ? [784, 988, 1175, 1568] : [880, 1319];
    notes.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + i * 0.12;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
      o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + 2.3);
    });
  }
  function setSound(on) { soundOn = on; if (on) { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); chime(false); } }

  /* ------------------------------------------------------------------ */
  /*  Main loop                                                          */
  /* ------------------------------------------------------------------ */
  const hooks = [];
  let last = performance.now(), t = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawSky(t);
    drawLanterns(dt, t);
    updateFireworks(dt);
    drawRipples(dt);
    updateKrathongs(dt, t);
    drawKrathongs(t);
    drawSparks(dt);
    for (const h of hooks) h(dt, t);
    requestAnimationFrame(frame);
  }

  function start(cfg) {
    fit();
    buildProps(cfg);
    initLanterns();
    requestAnimationFrame(frame);
    // font may load late → re-render tags
    if (document.fonts) document.fonts.ready.then(() => krathongs.forEach(k => k.tag = makeTag(k.name || 'ผู้ใจบุญ', k.tier)));
  }

  window.Scene = {
    W, H, start, fit, persp, inWater, addKrathong, ripple, sparkle, firework, chime, setSound,
    RELEASE_POINT, TABLE, onFrame: (fn) => hooks.push(fn),
    get scale() { return scale; }, get count() { return krathongs.length; },
  };
})();
