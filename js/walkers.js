/* =====================================================================
 *  ตัวการ์ตูนชุดไทย (ชาย: เสื้อราชปะแตน+โจงกระเบน / หญิง: ชุดไทยสไบ+ผ้าซิ่น)
 *  เดินไปรับกระทงที่โต๊ะ → ลงบันได → ไปที่แพ → ลอยกระทง → ไหว้ → จางหาย
 * ===================================================================== */
(function () {
  const layer = document.getElementById('walkers');
  const SKIN = '#ffd9b8', SKIN_D = '#f3b98f', BLUSH = '#ff9fae';

  // เส้นทางเดิน (พิกัดภาพ 2576x1450)
  // เดินเข้ามาจากขอบขวา → หยุดหลังโต๊ะรับกระทง (ทางเดินขวาล่าง)
  const PATH_TO_TABLE = [[2660, 1150], [2520, 1120], [2372, 1092]];
  const PATH_TO_RAFT = [[2372, 1092], [2300, 1035], [2215, 960], [2120, 890], [2058, 866], [2020, 920], [1994, 990], [1950, 1035], [1820, 1080],
    [1660, 1136], [1500, 1196], [1350, 1250], [1200, 1300], [1086, 1340], [1010, 1318], [905, 1258], [810, 1196], [742, 1158]];
  // ขากลับ: เดินย้อนขึ้นบันได → ทางเดิน → ออกนอกเฟรมทางขวา (เดินผ่านหลังโต๊ะ)
  const PATH_LEAVE = PATH_TO_RAFT.slice(4).reverse().concat([[2150, 905], [2260, 990], [2350, 1050], [2480, 1085], [2700, 1110]]);
  const STAIRS = { x0: 1960, x1: 1080 };              // ช่วงบันได (เดินกระเด้งเป็นขั้น)

  const heightAt = (y) => Math.max(66, Math.min(245, 68 + (y - 680) * 0.31));

  /* ------------------------------ art ------------------------------ */
  function heldKrathong(tier) {
    const s = tier === 'L' ? 1.25 : tier === 'M' ? 1.05 : 0.88;
    return `<g class="held" transform="translate(60 120) scale(${s})">
      <ellipse cx="0" cy="8" rx="20" ry="6" fill="#2d5a1f"/><ellipse cx="0" cy="5" rx="19" ry="5" fill="#cfdca6"/>
      ${[-15, -8, -1, 6, 13].map((dx, i) => `<path d="M${dx - 4} 6 Q${dx} -8 ${dx + 2} -12 Q${dx + 5} -8 ${dx + 5} 6Z" fill="${i % 2 ? '#3b8a2d' : '#2f6e22'}"/>`).join('')}
      ${tier !== 'S' ? `<path d="M-7 2 Q-2 -18 0 -${tier === 'L' ? 26 : 20} Q2 -18 7 2Z" fill="#4aa23a" ${tier === 'L' ? 'stroke="#f2c14e" stroke-width="1.2"' : ''}/>` : ''}
      <circle cx="-10" cy="0" r="3.6" fill="#ff5d8f"/><circle cx="10" cy="0" r="3.6" fill="#ffcf3f"/><circle cx="0" cy="3" r="3.2" fill="#ff9f1c"/>
      <rect x="-13" y="-12" width="2.4" height="12" fill="#fff6d8"/>
      <path class="flame" d="M-11.8 -13 q-3 -4 0 -9 q3 5 0 9z" fill="#ffd25a"/>
      <circle cx="-11.8" cy="-16" r="7" fill="rgba(255,190,80,.35)"/>
    </g>`;
  }

  function face(female) {
    return `
      <ellipse cx="34" cy="58" rx="5" ry="7" fill="${SKIN_D}"/><ellipse cx="86" cy="58" rx="5" ry="7" fill="${SKIN_D}"/>
      <circle cx="60" cy="52" r="30" fill="${SKIN}"/>
      <g class="eyes">
        <ellipse cx="49" cy="58" rx="4.2" ry="5.4" fill="#2b1a12"/><ellipse cx="71" cy="58" rx="4.2" ry="5.4" fill="#2b1a12"/>
        <circle cx="50.5" cy="56" r="1.6" fill="#fff"/><circle cx="72.5" cy="56" r="1.6" fill="#fff"/>
        ${female ? '<path d="M44 53 l-3 -2 M46 52 l-2 -3 M76 53 l3 -2 M74 52 l2 -3" stroke="#2b1a12" stroke-width="1.3" stroke-linecap="round"/>' : ''}
      </g>
      <ellipse cx="42" cy="67" rx="5.5" ry="3.2" fill="${BLUSH}" opacity=".75"/><ellipse cx="78" cy="67" rx="5.5" ry="3.2" fill="${BLUSH}" opacity=".75"/>
      <path d="M55 69 q5 5 10 0" stroke="#a2453a" stroke-width="2" fill="${female ? '#e86a6a' : 'none'}" stroke-linecap="round"/>`;
  }

  function boySVG(tier) {
    return `<svg viewBox="0 0 120 200" width="120" height="200">
      <ellipse cx="60" cy="196" rx="30" ry="5" fill="rgba(0,0,0,.35)"/>
      <g class="body">
        <g class="legL"><path d="M42 124 h18 v20 q0 8 -9 8 q-9 0 -9 -8z" fill="#3a2a8c"/><rect x="45.5" y="148" width="11" height="38" rx="4" fill="#fffef6"/><path d="M42 184 h16 q6 0 6 6 v4 h-22z" fill="#1f1a17"/></g>
        <g class="legR"><path d="M60 124 h18 v20 q0 8 -9 8 q-9 0 -9 -8z" fill="#4232a0"/><rect x="63.5" y="148" width="11" height="38" rx="4" fill="#fffef6"/><path d="M60 184 h16 q6 0 6 6 v4 h-22z" fill="#1f1a17"/></g>
        <g class="armL arm"><path d="M38 90 q-10 4 -11 26 l9 2 q2 -14 8 -20z" fill="#fbfbf4" stroke="#d8d3c0" stroke-width="1"/><circle cx="31" cy="119" r="5.5" fill="${SKIN}"/></g>
        <path d="M37 88 q23 -9 46 0 l3 36 q-26 7 -52 0z" fill="#fdfdf8" stroke="#d8d3c0" stroke-width="1.2"/>
        <path d="M36 118 h48 v12 q-24 7 -48 0z" fill="#4a3aa8"/><path d="M36 118 h48" stroke="#f2c14e" stroke-width="2"/>
        <rect x="52" y="82" width="16" height="8" rx="2" fill="#fdfdf8" stroke="#d8d3c0"/>
        <line x1="60" y1="90" x2="60" y2="118" stroke="#e2dccb" stroke-width="1"/>
        ${[95, 102, 109].map(y => `<circle cx="60" cy="${y}" r="2" fill="#f2c14e" stroke="#b8781a" stroke-width=".6"/>`).join('')}
        <g class="armR arm"><path d="M82 90 q10 4 11 26 l-9 2 q-2 -14 -8 -20z" fill="#fbfbf4" stroke="#d8d3c0" stroke-width="1"/><circle cx="89" cy="119" r="5.5" fill="${SKIN}"/></g>
        <g class="hold"><path d="M38 92 q-6 18 10 26 M82 92 q6 18 -10 26" stroke="#fbfbf4" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="48" cy="120" r="5.5" fill="${SKIN}"/><circle cx="72" cy="120" r="5.5" fill="${SKIN}"/>${heldKrathong(tier)}</g>
        <g class="wai"><path d="M40 92 q-8 14 16 12 M80 92 q8 14 -16 12" stroke="#fbfbf4" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M56 106 q4 -22 8 0 z" fill="${SKIN}" stroke="${SKIN_D}"/></g>
        <g class="head">${face(false)}
          <path d="M30 50 q0 -32 30 -32 q30 0 30 32 q-6 -12 -14 -14 q-4 8 -16 8 q-14 0 -16 -8 q-10 4 -14 14z" fill="#1d1512"/>
          <path d="M44 28 q8 -6 18 -4" stroke="#4a3a33" stroke-width="2" fill="none" stroke-linecap="round"/>
        </g>
      </g></svg>`;
  }

  function girlSVG(tier) {
    return `<svg viewBox="0 0 120 200" width="120" height="200">
      <ellipse cx="60" cy="196" rx="30" ry="5" fill="rgba(0,0,0,.35)"/>
      <g class="body">
        <g class="legL"><path d="M44 186 h14 q6 0 6 5 v3 h-20z" fill="#b8781a"/></g>
        <g class="legR"><path d="M62 186 h14 q6 0 6 5 v3 h-20z" fill="#b8781a"/></g>
        <g class="armL arm"><path d="M40 90 q-10 6 -10 26 l8 1 q1 -14 7 -20z" fill="${SKIN}"/><circle cx="33" cy="118" r="5" fill="${SKIN}"/><rect x="29" y="108" width="9" height="3" rx="1.5" fill="#f2c14e"/></g>
        <g class="skirt">
          <path d="M38 118 h44 l8 70 q-30 6 -60 0z" fill="#8b1e3f"/>
          <path d="M33 168 q27 5 54 0 l2 10 q-29 6 -58 0z" fill="#f2c14e"/>
          <path d="M36 150 q24 4 48 0" stroke="#d99a2b" stroke-width="2" fill="none"/>
          <path d="M60 120 v66" stroke="#6d1530" stroke-width="2"/>
        </g>
        <path d="M40 86 q20 -8 40 0 l2 34 q-22 5 -44 0z" fill="#f7c9d6"/>
        <path d="M38 114 h44 v7 h-44z" fill="#f2c14e"/><circle cx="60" cy="117.5" r="4" fill="#ffe08a" stroke="#b8781a"/>
        <path d="M40 86 q10 -4 18 -2 l26 34 q-6 4 -12 2z" fill="#e8a82a"/>
        <path d="M44 88 l34 30" stroke="#ffe08a" stroke-width="1.5" stroke-dasharray="2 3"/>
        <g class="armR arm"><path d="M80 90 q10 6 10 26 l-8 1 q-1 -14 -7 -20z" fill="${SKIN}"/><circle cx="87" cy="118" r="5" fill="${SKIN}"/><rect x="82" y="108" width="9" height="3" rx="1.5" fill="#f2c14e"/></g>
        <g class="hold"><path d="M41 92 q-6 18 9 26 M79 92 q6 18 -9 26" stroke="${SKIN}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="50" cy="120" r="5" fill="${SKIN}"/><circle cx="70" cy="120" r="5" fill="${SKIN}"/>${heldKrathong(tier)}</g>
        <g class="wai"><path d="M42 92 q-8 14 15 12 M78 92 q8 14 -15 12" stroke="${SKIN}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M56 106 q4 -22 8 0 z" fill="${SKIN}" stroke="${SKIN_D}"/></g>
        <g class="head">
          <path d="M28 56 q-4 26 10 36 l44 0 q14 -10 10 -36z" fill="#1d1512"/>
          ${face(true)}
          <path d="M29 52 q0 -34 31 -34 q31 0 31 34 q-8 -16 -18 -18 q-6 6 -13 6 q-9 0 -13 -6 q-12 4 -18 18z" fill="#1d1512"/>
          <circle cx="60" cy="16" r="11" fill="#1d1512"/>
          <g transform="translate(74 22)"><circle r="5" fill="#fff"/><circle cx="6" cy="4" r="4" fill="#ff8a2a"/><circle cx="-3" cy="6" r="3.4" fill="#fff"/><circle r="1.8" fill="#ffd86b"/></g>
          <path d="M52 8 q8 -4 16 0" stroke="#f2c14e" stroke-width="2.4" fill="none"/>
        </g>
      </g></svg>`;
  }

  /* ---------------------------- walker ----------------------------- */
  const walkers = [];

  function polyLen(path) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return L; }
  function pointAt(path, d) {
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (d <= seg) { const f = seg ? d / seg : 0; return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dx: x1 - x0 }; }
      d -= seg;
    }
    const n = path.length - 1; return { x: path[n][0], y: path[n][1], dx: path[n][0] - path[n - 1][0], end: true };
  }

  function spawn(d, onRelease) {
    const el = document.createElement('div');
    el.className = 'walker';
    const female = d.gender === 'female';
    el.innerHTML = (female ? girlSVG(d.size) : boySVG(d.size)) + `<div class="tag">${escapeHtml(shortName(d.name))}</div>`;
    layer.appendChild(el);
    const q = (s) => el.querySelector(s);
    const w = {
      d, el, female, onRelease,
      parts: { legL: q('.legL'), legR: q('.legR'), armL: q('.armL'), armR: q('.armR'), hold: q('.hold'), wai: q('.wai'), body: q('.body'), head: q('.head'), skirt: q('.skirt') },
      state: 'toTable', dist: 0, t: 0, phase: 0, x: PATH_TO_TABLE[0][0], y: PATH_TO_TABLE[0][1], face: -1, stateT: 0,
      lenA: polyLen(PATH_TO_TABLE), lenB: polyLen(PATH_TO_RAFT),
    };
    w.parts.hold.style.display = 'none';
    w.parts.wai.style.display = 'none';
    el.style.opacity = 0;
    walkers.push(w);
    return w;
  }

  function pose(w, walkAmt, bounce) {
    const s = Math.sin(w.phase), a = s * 22 * walkAmt;
    const P = w.parts;
    if (w.female) {
      P.legL.setAttribute('transform', `translate(${s * 4 * walkAmt} ${-Math.max(0, s) * 4 * walkAmt})`);
      P.legR.setAttribute('transform', `translate(${-s * 4 * walkAmt} ${-Math.max(0, -s) * 4 * walkAmt})`);
      P.skirt.setAttribute('transform', `rotate(${s * 2.5 * walkAmt} 60 118)`);
    } else {
      P.legL.setAttribute('transform', `rotate(${a} 51 126)`);
      P.legR.setAttribute('transform', `rotate(${-a} 69 126)`);
    }
    P.armL.setAttribute('transform', `rotate(${-a * 0.8} 40 92)`);
    P.armR.setAttribute('transform', `rotate(${a * 0.8} 80 92)`);
    P.head.setAttribute('transform', `rotate(${Math.sin(w.phase * 0.5) * 2 * walkAmt} 60 80)`);
    P.body.setAttribute('transform', `translate(0 ${-Math.abs(Math.cos(w.phase)) * 3 * walkAmt - bounce})`);
  }

  function place(w, extraScaleY = 1) {
    const h = heightAt(w.y);
    const s = h / 200;
    w.el.style.transform = `translate(${w.x - 60 * s * w.face}px, ${w.y - 196 * s * extraScaleY}px) scale(${s * w.face}, ${s * extraScaleY})`;
    w.el.style.zIndex = Math.round(w.y);
    const tag = w.el.querySelector('.tag');
    tag.style.transform = `translate(-50%, -4px) scale(${w.face}, 1) scale(${Math.min(2.4, 0.55 / s)})`;
    tag.style.transformOrigin = '50% 100%';
  }

  function update(dt) {
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i];
      w.t += dt; w.stateT += dt;
      const h = heightAt(w.y);
      const speed = h * 0.62;                      // px/s ตามระยะ
      if (w.el.style.opacity !== '1' && w.state === 'toTable') w.el.style.opacity = Math.min(1, w.t * 2);
      if (w.state === 'toTable' || w.state === 'toRaft' || w.state === 'leave') {
        const onStairs = w.state !== 'toTable' && w.x < STAIRS.x0 && w.x > STAIRS.x1;
        w.dist += speed * dt * (onStairs ? 0.85 : 1);
        w.phase += dt * (onStairs ? 9 : 10);
        const path = w.state === 'toTable' ? PATH_TO_TABLE : w.state === 'toRaft' ? PATH_TO_RAFT : PATH_LEAVE;
        const p = pointAt(path, w.dist);
        w.x = p.x; w.y = p.y;
        if (Math.abs(p.dx) > 2) w.face = p.dx < 0 ? -1 : 1;
        const bounce = onStairs ? Math.abs(Math.sin(w.phase)) * 5 : 0;
        pose(w, 1, bounce);
        if (p.end) {
          if (w.state === 'leave') { w.el.remove(); walkers.splice(i, 1); continue; }  // ออกนอกเฟรมแล้ว
          w.stateT = 0; w.dist = 0;
          if (w.state === 'toTable') { w.state = 'pick'; w.face = 1; }
          else { w.state = 'release'; w.face = -1; }
        }
        place(w);
      } else if (w.state === 'pick') {
        pose(w, 0, 0); place(w);
        if (w.stateT > 0.5 && w.parts.hold.style.display === 'none') {
          w.parts.hold.style.display = '';
          w.parts.armL.style.display = 'none'; w.parts.armR.style.display = 'none';
          Scene.sparkle(w.x + 30, w.y - heightAt(w.y) * 0.55, 14, 40);
        }
        if (w.stateT > 1.4) { w.state = 'toRaft'; w.stateT = 0; }
      } else if (w.state === 'release') {
        // ก้มลงวางกระทง
        const k = Math.min(1, w.stateT / 0.8);
        pose(w, 0, 0);
        w.parts.body.setAttribute('transform', `translate(0 ${k * 16}) rotate(${-k * 10} 60 190)`);
        place(w, 1 - k * 0.08);
        if (w.stateT > 0.9 && !w.released) {
          w.released = true;
          w.parts.hold.style.display = 'none';
          if (w.onRelease) w.onRelease(w.d);
        }
        if (w.stateT > 1.7) { w.state = 'wai'; w.stateT = 0; w.parts.wai.style.display = ''; }
      } else if (w.state === 'wai') {
        const k = Math.max(0, 1 - w.stateT / 0.4);
        w.parts.body.setAttribute('transform', `translate(0 ${k * 16 + Math.sin(Math.min(1, w.stateT / 1.2) * Math.PI) * 6})`);
        w.face = 1; place(w);
        if (w.stateT > 2.2) {
          // ไหว้เสร็จ → เดินกลับขึ้นบันได แล้วออกนอกเฟรม
          w.parts.wai.style.display = 'none';
          w.parts.armL.style.display = ''; w.parts.armR.style.display = '';
          w.parts.body.removeAttribute('transform');
          w.state = 'leave'; w.stateT = 0; w.dist = 0;
        }
      }
    }
  }

  function shortName(n) { n = String(n || ''); return n.length > 26 ? n.slice(0, 25) + '…' : n; }
  function escapeHtml(s) { return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ---------------------------- queue ------------------------------ */
  const queue = [];
  let lastSpawn = -99;
  function enqueue(d, onRelease) { queue.push({ d, onRelease }); }
  function pump(dt, t) {
    const max = (window.LK_CONFIG && LK_CONFIG.MAX_WALKERS) || 4;
    if (queue.length > 14) {
      // คิวยาวเกิน: ปล่อยกระทงตรงลงน้ำเลย เพื่อไม่ให้ค้าง
      while (queue.length > 8) { const j = queue.shift(); j.onRelease && j.onRelease(j.d); }
    }
    const busy = walkers.filter((w) => w.state !== 'leave').length;   // คนที่กำลังเดินกลับไม่นับ
    if (queue.length && busy < max && t - lastSpawn > 3.2) {
      const j = queue.shift(); spawn(j.d, j.onRelease); lastSpawn = t;
    }
    update(dt);
  }

  // avatar icons for UI (data-URI of the head)
  function avatar(gender) {
    const svg = (gender === 'female' ? girlSVG('S') : boySVG('S'))
      .replace('viewBox="0 0 120 200" width="120" height="200"', 'viewBox="22 4 76 76" width="76" height="76"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  }

  window.Walkers = { enqueue, pump, avatar, get active() { return walkers.length; }, get queued() { return queue.length; } };
})();
