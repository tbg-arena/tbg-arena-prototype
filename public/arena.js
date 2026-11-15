// TBG ARENA — 픽셀 아트 경기 연출 (사이드뷰, Canvas 2D)
// 저해상도 월드 버퍼(160×100)에 도트 캐릭터를 그리고, 카메라 줌/쉐이크와 함께 확대 출력한다.
// 경기 이벤트(e.act = {att, cat})를 받아 펀치·킥·태클·그라운드·서브미션·다운·KO를 연출한다.
(function () {
  const LW = 160, LH = 100;          // 월드(도트) 해상도
  const FLOOR = 76, CX = LW / 2;     // 발 위치, 링 중앙
  const SW = 64, SH = 64, OX = 32, OY = 56; // 스프라이트 버퍼, 발 기준점
  const STRIKES = ['punch', 'kick', 'knee', 'elbow', 'jab', 'hook', 'uppercut', 'body'];
  // 복싱 기술별 동작: seq(연속 동작) · 궤적(trail) · 맞는 반응(hit) · 라벨
  function boxingMove(a) {
    const n = a.name || '';
    switch (a.cat) {
      case 'jab':
        if (/원투|1-2|원-투/.test(n)) return { seq: [['jab', 0.2], ['cross', 0.26]], trail: 'straight', hit: 'hit', label: 'ONE-TWO' };
        if (/더블|트리플/.test(n)) return { seq: [['jab', 0.18], ['jab', 0.2]], trail: 'straight', hit: 'hit', label: 'DOUBLE JAB' };
        if (/스트레이트|크로스/.test(n)) return { seq: [['cross', 0.28]], trail: 'straight', hit: 'hit', label: 'STRAIGHT' };
        return { seq: [['jab', 0.2]], trail: 'straight', hit: 'hit', label: 'JAB' };
      case 'hook': return { seq: [['hook', 0.38]], trail: 'arc', hit: 'hitSide', label: 'HOOK!' };
      case 'uppercut': return { seq: [['upper', 0.42]], trail: 'up', hit: 'hitUp', label: 'UPPERCUT!', dy: 3 };
      case 'body': return { seq: [['body', 0.34]], trail: 'low', hit: 'hitBody', label: 'BODY!', dy: 12 };
    }
    return null;
  }
  const DODGE_LABEL = { slip: 'SLIP', duck: 'DUCK', block: 'BLOCK', parry: 'PARRY', back: 'BACKSTEP' };
  const FONT = 'Galmuri11, "Galmuri11", monospace';

  const C = {
    o: '#050505', skin: '#f6cfab', skinS: '#d99d76', blush: '#ff9a9a', eye: '#111', mouth: '#8c3b2e', white: '#ffffff',
  };
  const SIDE = {
    L: { glove: '#f4f4f4', gloveS: '#b5b5b5', trunk: '#f4f4f4', stripe: '#111111', shoe: '#f4f4f4', tag: '#ffffff', band: '#111111' },
    R: { glove: '#e8302b', gloveS: '#a01c18', trunk: '#e8302b', stripe: '#ffffff', shoe: '#1b1b1b', tag: '#ff4b45', band: '#ffffff' },
  };
  const HAIR = [['#1c1c1c', '#4a4a4a'], ['#3b2a20', '#6a4c39'], ['#e9e9e9', '#ffffff'], ['#7a7a7a', '#a8a8a8']];

  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const bump = (t) => Math.sin(Math.PI * clamp01(t));
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  const logoImg = new Image(); logoImg.src = '/logo.png';
  let logoDark = null; // 밝은 매트용 검정 로고
  logoImg.onload = () => {
    logoDark = mkCanvas(logoImg.width, logoImg.height);
    const g = logoDark.getContext('2d'); g.drawImage(logoImg, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, logoImg.width, logoImg.height);
  };
  try { document.fonts?.load(`700 16px Galmuri11`); } catch {}

  // ───────── 도트 캐릭터 ─────────
  function lookOf(id) {
    const h = hash(id);
    return { hair: h % 6, hc: HAIR[(h >>> 3) % HAIR.length], phase: ((h >>> 7) % 100) / 16 };
  }

  // 파츠 그룹: 외곽선을 먼저 모두 그리고 채우기를 덮어 한 덩어리 실루엣을 만든다
  function group(g, parts) {
    g.fillStyle = C.o;
    for (const p of parts) if (!p.no) shape(g, p, 1);
    for (const p of parts) { g.fillStyle = p.c; shape(g, p, 0); }
  }
  function shape(g, p, o) {
    if (p.l) { // limb: (x0,y0)→(x1,y1) 두께 t
      const [x0, y0, x1, y1] = p.l, t = p.t + o * 2;
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n - t / 2), Math.round(y0 + (y1 - y0) * i / n - t / 2), t, t);
    } else g.fillRect(Math.round(p.x) - o, Math.round(p.y) - o, p.w + o * 2, p.h + o * 2);
  }
  const rc = (x, y, w, h, c, no) => ({ x, y, w, h, c, no });
  const lb = (x0, y0, x1, y1, t, c) => ({ l: [x0, y0, x1, y1], t, c });
  const glove = (x, y, st) => [rc(x, y, 5, 5, st.glove), rc(x, y + 4, 5, 1, st.gloveS, 1), rc(x + 1, y + 1, 1, 1, C.white, 1)];

  function drawHead(g, hx, hy, look, st, face) {
    const [hc, hl] = look.hc;
    const outer = [rc(hx + 2, hy + 1, 9, 10, C.skin), rc(hx + 1, hy + 2, 11, 8, C.skin)];
    // 머리 밖으로 삐져나오는 헤어
    if (look.hair === 0) outer.push(rc(hx + 2, hy - 1, 2, 2, hc), rc(hx + 5, hy - 2, 2, 3, hc), rc(hx + 8, hy - 1, 2, 2, hc), rc(hx, hy + 1, 2, 3, hc));
    if (look.hair === 2) outer.push(rc(hx + 4, hy - 3, 4, 4, hc));
    if (look.hair === 3) outer.push(rc(hx - 3, hy + 3, 4, 3, hc));
    if (look.hair === 4) outer.push(rc(hx - 3, hy + 3, 4, 1, st.band), rc(hx - 2, hy + 5, 3, 1, st.band));
    group(g, outer);
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(hx + x, hy + y, w, h); };
    R(1, 3, 1, 6, C.skinS); R(5, 6, 1, 2, C.skinS); // 뒤통수 그늘, 귀
    // 헤어
    if (look.hair === 0 || look.hair === 3 || look.hair === 5) { R(2, 1, 9, 1, hc); R(1, 2, 11, 2, hc); R(1, 4, 4, 2, hc); R(9, 4, 2, 1, hc); }
    if (look.hair === 5) { R(1, 6, 3, 3, hc); R(10, 4, 2, 2, hc); }
    if (look.hair === 1 || look.hair === 4) { R(2, 1, 9, 1, hc); R(1, 2, 11, 1, hc); R(1, 3, 3, 2, hc); }
    if (look.hair === 2) { R(4, 1, 4, 2, hc); R(1, 3, 2, 3, C.skinS); }
    if (look.hair === 3) { R(-2, 3, 1, 1, st.band === '#ffffff' ? '#e8302b' : '#ffffff'); }
    if (look.hair === 4) { R(1, 3, 11, 2, st.band); }
    if (look.hair !== 2) R(3, 2, 3, 1, hl); else R(5, -2, 1, 2, hl);
    // 얼굴 (오른쪽을 본다)
    if (face === 'ko') {
      R(8, 5, 1, 1, C.eye); R(10, 5, 1, 1, C.eye); R(9, 6, 1, 1, C.eye); R(8, 7, 1, 1, C.eye); R(10, 7, 1, 1, C.eye);
      R(9, 9, 2, 1, C.mouth); R(10, 10, 1, 1, '#ff6b6b');
    } else if (face === 'hit') {
      R(8, 5, 1, 1, C.eye); R(9, 6, 1, 1, C.eye); R(8, 7, 1, 1, C.eye); R(11, 5, 1, 3, C.eye);
      R(10, 8, 2, 2, C.mouth);
    } else if (face === 'happy') {
      R(8, 6, 1, 1, C.eye); R(9, 5, 1, 1, C.eye); R(10, 6, 1, 1, C.eye);
      R(9, 8, 3, 1, C.mouth); R(10, 9, 1, 1, C.mouth); R(6, 8, 2, 1, C.blush);
    } else {
      if (face === 'blink') { R(8, 7, 2, 1, C.eye); R(11, 7, 1, 1, C.eye); }
      else { R(8, 5, 2, 3, C.eye); R(8, 5, 1, 1, C.white); R(11, 5, 1, 3, C.eye); }
      if (face === 'effort') { R(8, 4, 2, 1, C.eye); R(10, 9, 2, 1, C.mouth); }
      else R(10, 9, 1, 1, C.mouth);
      R(6, 8, 2, 1, C.blush);
    }
  }

  // pose: { kind, k(0..1), hand, face, kneel, gdt }
  function drawSprite(g, look, st, pose) {
    g.clearRect(0, 0, SW, SH);
    g.save(); g.translate(OX, OY);
    const k = pose.k || 0;
    let ux = 0, uy = pose.bob || 0, hdx = 0, hdy = 0, face = pose.face || 'normal';
    let bL = [-6, 0], fL = [4, 0];             // 발 위치
    let bG = [5, -20], fG = [8, -22];          // 글러브 (몸통 기준)
    let fLeg = null;
    switch (pose.kind) {
      case 'punch': ux = k * 3; if (pose.hand) { bG = [8 + k * 15, -23]; fG = [6, -21]; } else fG = [8 + k * 13, -23]; break;
      case 'elbow': ux = k * 4; fG = [6 + k * 3, -27 + k]; bG = [5, -21]; fLeg = null; break;
      case 'kick': ux = -k * 3; uy -= k; fLeg = 'kick'; bL = [-5, 0]; break;
      case 'knee': ux = k * 2; fLeg = 'knee'; fG = [10, -22]; bG = [8, -21]; break;
      case 'shoot': ux = k * 7; uy += k * 7; fG = [10, -16]; bG = [8, -15]; bL = [-6 - k * 4, 0]; fL = [4 + k * 2, 0]; if (k > 0.2) face = 'effort'; break;
      case 'clinch': ux = 2; fG = [12, -26]; bG = [10, -24]; break;
      case 'hit': ux = -3 * k; hdx = -Math.round(k); hdy = -Math.round(k); fG = [6, -21]; bG = [4, -19]; face = 'hit'; break;
      case 'dodge': ux = -4 * k; uy += 2 * k; hdx = -Math.round(k); break;
      case 'win': uy += pose.bob ? -1 : 0; fG = [5, -39]; bG = [-3, -38]; face = 'happy'; break;
      case 'gnp': fG = [9 + k * 2, -21 + k * 10]; bG = [6, -19]; face = 'effort'; break;
      // ── 복싱: 공격
      case 'jab': ux = k * 2; fG = [8 + k * 15, -24]; bG = [6, -25]; break;
      case 'cross': ux = k * 4; bG = [8 + k * 17, -24]; fG = [6, -26]; bL = [-6 + k * 2, 0]; break;
      case 'hook': {
        const p = pose.p ?? k;
        if (p < 0.3) { const w = p / 0.3; ux = -w; fG = [8 - w * 5, -24, 3 - w * 2, -22]; }
        else { const s = Math.sin(Math.min(1, (p - 0.3) / 0.35) * Math.PI / 2) * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1); ux = s * 3; fG = [3 + s * 10, -24 - s * 3, 3 + s * 4, -22 - s * 5]; }
        bG = [6, -26]; break;
      }
      case 'upper': {
        const p = pose.p ?? k;
        if (p < 0.35) { const w = p / 0.35; uy += Math.round(w * 3); fG = [7, -22 + w * 8]; }
        else { const s = Math.min(1, (p - 0.35) / 0.3), lift = s * (p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1); uy += Math.round(3 - lift * 5); ux = lift * 3; fG = [7 + lift * 5, -14 - lift * 16, 7 + lift * 3, -13 - lift * 5]; }
        bG = [6, -26]; break;
      }
      case 'body': uy += Math.round(k * 5); ux = k * 3; hdx = Math.round(k); fG = [8 + k * 13, -19]; bG = [6, -25]; bL = [-6 - k * 2, 0]; fL = [4 + k * 2, 0]; break;
      // ── 복싱: 디펜스
      case 'slip': ux = -3 * k; hdx = -Math.round(2 * k); hdy = Math.round(k); fG = [7, -24]; bG = [5, -24]; break;
      case 'duck': uy += Math.round(7 * k); ux = -k; fG = [7, -23]; bG = [5, -23]; break;
      case 'block': ux = -k; fG = [9, -28]; bG = [8, -26]; if (k > 0.3) face = 'effort'; break;
      case 'parry': ux = -k; fG = [11 - k * 2, -24 + k * 7]; bG = [6, -25]; break;
      // ── 복싱: 맞는 반응
      case 'hitUp': ux = -2 * k; uy -= Math.round(k); hdx = -Math.round(k); hdy = -Math.round(2 * k); fG = [6, -24]; bG = [4, -23]; face = 'hit'; break;
      case 'hitSide': ux = -2 * k; hdx = -Math.round(2 * k); hdy = Math.round(k); fG = [7, -20]; bG = [3, -19]; face = 'hit'; break;
      case 'hitBody': uy += Math.round(3 * k); ux = -2 * k; hdx = Math.round(2 * k); fG = [7, -17]; bG = [5, -16]; face = 'hit'; break;
    }
    if (pose.ko) face = 'ko';
    else if (pose.down && face !== 'hit') face = 'hit';
    if (pose.kneel) { uy += 3; }
    ux = Math.round(ux); uy = Math.round(uy);

    // 1. 뒷다리
    const legs = [];
    if (pose.kneel) {
      legs.push(lb(-2, -8 + uy, -7, -1, 3, C.skin), rc(-9, -2, 3, 2, st.shoe));
      group(g, legs);
    } else {
      group(g, [lb(-2, -9, bL[0], -2, 3, C.skin), rc(bL[0] - 2, -2, 4, 2, st.shoe)]);
    }
    // 2. 몸 (앞다리 + 트렁크 + 몸통)
    const body = [];
    if (pose.kneel) body.push(lb(2, -8 + uy, 6, -1, 3, C.skin), rc(5, -2, 3, 2, st.shoe));
    else if (fLeg === 'kick') {
      const tx = 2 + k * 18, ty = -10 - k * 8;
      body.push(lb(2, -9, tx, ty, 3, C.skin), rc(tx - 1, ty - 2, 3, 4, st.shoe));
    } else if (fLeg === 'knee') {
      const kx = 2 + k * 8, ky = -9 - k * 6;
      body.push(lb(2, -9, kx, ky, 3, C.skin), lb(kx, ky, kx - 1, ky + 7, 3, C.skin), rc(kx - 3, ky + 6, 4, 2, st.shoe));
    } else body.push(lb(2, -9, fL[0], -2, 3, C.skin), rc(fL[0] - 1, -2, 4, 2, st.shoe));
    body.push(rc(-5 + Math.round(ux / 3), -13 + Math.round(uy / 2), 10, 5, st.trunk));
    body.push(rc(-4 + ux, -20 + uy, 8, 8, C.skin));
    group(g, body);
    g.fillStyle = st.stripe; g.fillRect(-5 + Math.round(ux / 3), -13 + Math.round(uy / 2), 10, 1);
    g.fillRect(-1 + Math.round(ux / 3), -12 + Math.round(uy / 2), 1, 4);
    g.fillStyle = C.skinS; g.fillRect(-4 + ux, -20 + uy, 2, 8);
    // 3. 머리
    drawHead(g, -6 + ux + hdx, -31 + uy + hdy, look, st, face);
    // 4. 뒷팔 → 5. 앞팔
    const sh = [ux, -17 + uy];
    for (const [gp, sx] of [[bG, -1], [fG, 1]]) {
      const gx = Math.round(ux + gp[0]), gy = Math.round(uy + gp[1]);
      if (gp.length > 2) {
        const ex = Math.round(ux + gp[2]), ey = Math.round(uy + gp[3]);
        group(g, [lb(sh[0] + sx, sh[1], ex, ey, 2, C.skin), lb(ex, ey, gx + 2, gy + 2, 2, C.skin), ...glove(gx, gy, st)]);
      } else group(g, [lb(sh[0] + sx, sh[1], gx + 2, gy + 2, 2, C.skin), ...glove(gx, gy, st)]);
    }
    g.restore();
  }

  // 회원 아바타 / 포즈 이미지 (UI용)
  const imgCache = new Map();
  function spriteURL(id, opts = {}) {
    const key = `${id}|${opts.side || 'L'}|${opts.pose || 'bust'}|${opts.scale || 4}|${opts.p ?? ''}`;
    if (imgCache.has(key)) return imgCache.get(key);
    const look = lookOf(id), st = SIDE[opts.side || 'L'];
    const sp = mkCanvas(SW, SH);
    const pose = { kind: opts.pose === 'bust' ? 'idle' : opts.pose || 'idle', k: 1, hand: 0 };
    if (opts.pose === 'shoot') pose.k = 0.8;
    if (opts.p != null) { pose.p = opts.p; pose.k = Math.sin(Math.PI * opts.p); }
    drawSprite(sp.getContext('2d'), look, st, pose);
    const sc = opts.scale || 4;
    let sx = 0, sy = 0, w = SW, h = SH;
    if (!opts.pose || opts.pose === 'bust') { sx = OX - 9; sy = OY - 35; w = 20; h = 20; }
    else { const wide = ['punch', 'kick', 'shoot', 'jab', 'cross', 'hook', 'upper', 'body'].includes(opts.pose); sx = OX - 15; sy = OY - 41; w = wide ? 46 : 32; h = 43; }
    const out = mkCanvas(w * sc, h * sc);
    const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
    o.drawImage(sp, sx, sy, w, h, 0, 0, w * sc, h * sc);
    const url = out.toDataURL();
    imgCache.set(key, url);
    return url;
  }

  // ───────── 아레나 ─────────
  class Arena {
    constructor(canvas, L, R, opts = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.demo = !!opts.demo;
      this.world = mkCanvas(LW, LH); this.w = this.world.getContext('2d');
      this.order = [L.id, R.id];
      this.f = { [L.id]: this.mk('L', L, 1), [R.id]: this.mk('R', R, -1) };
      this.pos = 'stand'; this.top = null;
      this.rt = 0; this.gt = 0; this.stop = 0; this.slow = 1; this.slowT = 0;
      this.fx = []; this.parts = []; this.q = []; this.speed = 1;
      this.shake = 0; this.flash = 0; this.invert = 0; this.bars = 0; this.tbars = 0; this.hype = 0; this.lockOn = 0;
      this.cam = { x: CX, y: 52, z: 1.15, punch: 0, fx: CX, fy: 52, fz: 0 };
      this.crowd = Array.from({ length: 2 }, (_, row) => Array.from({ length: 26 }, (_, i) => ({ x: i * 7 - 4 + row * 3 + (hash(i + 'c' + row) % 3), p: (hash(i + 'p' + row) % 100) / 15, s: hash(i + 's' + row) % 3 })));
      this.resize();
      this._rs = () => this.resize();
      window.addEventListener('resize', this._rs);
      this.layout(true);
      this.running = true; this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
      if (this.demo) this.demoTick();
    }
    mk(side, p, d) {
      return { side, d, id: p.id, name: p.name || '', look: lookOf(p.id), st: SIDE[side], sp: mkCanvas(SW, SH),
        x: CX - d * 40, tx: CX, y: 0, vy: 0, kx: 0, lying: 0, tLying: 0, hand: 0, anim: null, ko: false, down: false, win: false, flash: 0, blink: 2 + Math.random() * 3 };
    }
    other(id) { return this.f[this.order[0] === id ? this.order[1] : this.order[0]]; }
    get fighters() { return this.order.map((id) => this.f[id]); }
    resize() {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = this.c.clientWidth || 320;
      this.dpr = dpr; this.cw = Math.round(w * dpr); this.ch = Math.round(w * LH / LW * dpr);
      this.c.width = this.cw; this.c.height = this.ch;
      this.c.style.height = (w * LH / LW) + 'px';
    }
    destroy() {
      this.running = false;
      clearTimeout(this.demoTimer);
      window.removeEventListener('resize', this._rs);
    }
    later(ms, fn) { this.q.push({ at: this.gt + ms / 1000, fn }); }
    sfx(name, lvl = 1) {
      if (this.demo || this.silent || !window.SFX) return;
      if ((this.speed >= 3 && lvl < 1) || (this.speed >= 8 && lvl < 2)) return;
      window.SFX.play(name);
    }

    // ── 위치
    layout(snap) {
      const [a, b] = this.fighters;
      const t = this.gt;
      if (this.pos === 'ground') {
        const top = this.f[this.top] || a, bot = this.other(top.id);
        const mid = CX + Math.sin(t * 0.4) * 3;
        const back = -bot.d;
        bot.tx = mid - back * 13; bot.tLying = 1;
        top.tx = mid - back * 3; top.tLying = top.ko ? 1 : 0;
      } else {
        const gap = this.pos === 'clinch' ? 15 : 29 + Math.sin(t * 1.3) * 3;
        const mid = CX + Math.sin(t * 0.55) * (this.pos === 'clinch' ? 3 : 12);
        a.tx = mid - gap / 2; b.tx = mid + gap / 2;
        for (const f of [a, b]) if (!f.ko && !f.down) f.tLying = 0;
      }
      if (snap) for (const f of [a, b]) { f.x = f.tx; f.lying = f.tLying; }
    }
    headPos(f) {
      const a = -f.lying * Math.PI / 2, lx = 0, ly = -25;
      const x = lx * Math.cos(a) - ly * Math.sin(a), y = lx * Math.sin(a) + ly * Math.cos(a);
      return [f.x + f.d * x, FLOOR + f.y - f.lying * 6 + (this.isMount(f) ? -3 : 0) + y];
    }
    isMount(f) { return this.pos === 'ground' && this.top === f.id && !f.ko && f.lying < 0.5; }

    // ── 이벤트 연출
    play(e, prevHp, result) {
      const a = e.act;
      const att = a ? this.f[a.att] : null;
      const def = att ? this.other(att.id) : null;
      const strike = a && STRIKES.includes(a.cat);
      const landed = ['strike', 'big', 'down', 'finish'].includes(e.type);
      const dmgOf = (id) => Math.max(0, Math.round((prevHp?.[id] ?? e.hp?.[id] ?? 0) - (e.hp?.[id] ?? 0)));

      if (e.type === 'round') {
        if (/시작/.test(e.text)) {
          for (const f of this.fighters) { f.ko = f.down = f.win = false; f.tLying = 0; f.anim = null; }
          this.pos = 'stand'; this.top = null; this.layout(true);
          for (const f of this.fighters) f.x = CX - f.d * 34;
          this.banner(`ROUND ${e.r}`, 1.1, { sub: 'FIGHT!', bars: true });
          this.hype = 1;
          this.sfx('bell', 2);
        } else { this.banner('END OF ROUND', 0.9, { bars: true, small: true }); this.sfx('bell2', 2); }
        return;
      }

      if (strike && att) {
        att.hand ^= 1;
        const mv = boxingMove(a);
        const kind = mv ? mv.seq[0][0] : this.isMount(att) ? 'gnp' : a.cat;
        let dur = mv ? mv.seq[0][1] : a.cat === 'kick' ? 0.5 : a.cat === 'knee' ? 0.42 : 0.34;
        att.anim = { kind, t0: this.gt, dur, hand: att.hand };
        this.whoosh(att, mv ? mv.trail : kind);
        this.sfx(a.cat === 'kick' ? 'kick' : 'whoosh', 0);
        // 원투·더블 잽: 이어지는 펀치
        let lead = 0;
        if (mv) for (const [k2, d2] of mv.seq.slice(1)) {
          lead += dur * 0.85; dur = d2;
          this.later(lead * 1000, () => { att.anim = { kind: k2, t0: this.gt, dur: d2, hand: att.hand }; this.whoosh(att, mv.trail); this.sfx('whoosh', 0); });
        }
        if (a.counter) { this.text('COUNTER!', att, '#ff4b45', 1.1, -10); this.invert = 0.08; this.sfx('counter', 1); }
        if (landed) {
          const big = e.type !== 'strike';
          this.later((lead + dur * 0.45) * 1000, () => {
            const [hx, hy] = this.headPos(def);
            const px = hx - def.d * 4, py = hy + (mv ? mv.dy || 1 : a.cat === 'kick' ? 4 : 1);
            def.anim = { kind: mv ? mv.hit : 'hit', t0: this.gt, dur: big ? 0.5 : 0.32 };
            if (mv && !big) this.text(mv.label, att, a.cat === 'jab' ? '#cfcfcf' : '#ffffff', a.cat === 'jab' ? 0.7 : 0.9, -20, att.d * 6);
            if (mv && a.cat === 'body') this.spray(px, py, -def.d, 8, ['#cfefff', '#9fd8ff']);
            if (mv && a.cat === 'uppercut') this.spray(px, py - 2, 0, 6, ['#ffffff']);
            def.flash = big ? 0.1 : 0.06;
            def.kx = -def.d * (big ? 90 : 45);
            this.stop = big ? 0.16 : 0.06;
            this.sfx(e.type === 'down' ? 'down' : big ? 'big' : 'hit', e.type === 'down' ? 2 : big ? 1 : 0);
            this.burst(px, py, big);
            this.spray(px, py, -def.d, big ? 14 : 6, big ? ['#ffffff', '#cfefff', '#ff4b45'] : ['#ffffff', '#cfefff']);
            this.shake = big ? 1 : 0.35;
            this.cam.punch = big ? 0.35 : 0.08; this.cam.fx = px; this.cam.fy = py;
            const d = dmgOf(def.id);
            if (d) this.num(`-${d}`, px, py - 6, big);
            if (big) {
              this.flash = 0.5; this.hype = Math.min(1.5, this.hype + 0.8);
              this.text(e.type === 'down' ? 'DOWN!' : ['BIG HIT!', 'BAM!', 'CRACK!'][Math.floor(Math.random() * 3)], def, '#ffffff', e.type === 'down' ? 1.6 : 1.3, -16);
            }
            if (e.type === 'down') {
              this.slowmo(0.35, 0.6);
              def.down = true; def.tLying = 1; def.vy = -70;
              this.stars(def, 1.6);
              this.later(1300, () => { if (!def.ko) { def.down = false; def.tLying = 0; } });
            }
          });
        } else if (e.type === 'miss') {
          this.later((lead + dur * 0.3) * 1000, () => {
            const dk = a.dodge;
            def.anim = { kind: dk && dk !== 'back' ? dk : 'dodge', t0: this.gt, dur: dk === 'duck' ? 0.5 : 0.4 };
            if (dk === 'back') def.kx = -def.d * 70;
            if (dk === 'block') { const [hx, hy] = this.headPos(def); this.burst(hx - def.d * 6, hy + 2, false); }
            this.text(dk ? DODGE_LABEL[dk] : 'MISS', def, dk ? '#ffffff' : '#8a8a8a', dk ? 0.9 : 0.8, -12);
            this.sfx(dk === 'block' ? 'hit' : 'miss', 0);
          });
        }
      } else if (a && att) {
        if (a.cat === 'takedown') {
          att.anim = { kind: 'shoot', t0: this.gt, dur: 0.5 };
          if (e.type === 'miss') this.later(260, () => { this.text('SPRAWL!', def, '#ffffff', 1, -12); this.dust(def.x, 6); this.sfx('sprawl', 1); });
          else this.later(300, () => {
            this.shake = 0.8; this.stop = 0.1; this.flash = 0.25; def.vy = -60;
            this.cam.punch = 0.2; this.cam.fx = def.x; this.cam.fy = FLOOR - 10;
            this.text('TAKEDOWN!', att, '#ffffff', 1.2, -16);
            this.sfx('slam', 1);
            this.later(220, () => this.dust((att.x + def.x) / 2, 14));
          });
        } else if (a.cat === 'clinch' && e.type !== 'miss') {
          att.anim = { kind: 'shoot', t0: this.gt, dur: 0.3 };
          this.text('CLINCH', att, '#bdbdbd', 0.8, -14);
        } else if (a.cat === 'ground' && e.type === 'td' && this.top && e.top && e.top !== this.top) {
          this.later(150, () => { this.text('SWEEP!', att, '#ff4b45', 1.2, -14); this.shake = 0.5; this.dust(CX, 10); this.sfx('sweep', 1); });
        } else if (a.cat === 'submission') {
          if (e.type === 'sub') { this.lock(1.6); this.text('LOCKED!', att, '#ff4b45', 1.2, -18); this.sfx('lock', 1); }
          else if (e.type === 'miss') this.text('...', att, '#8a8a8a', 0.9, -12);
          else if (e.type === 'info') { this.text('ESCAPE!', def, '#ffffff', 1, -14); this.sfx('escape', 1); }
        }
      }

      const apply = () => { this.pos = e.pos || 'stand'; this.top = e.top || null; };
      if (a && a.cat === 'takedown' && e.type === 'td') this.later(300, apply); else apply();

      if (e.type === 'finish') this.finish(e, result);
    }

    finish(e, result) {
      const method = result?.method;
      this.tbars = 1;
      if (!result || method === '판정') {
        this.later(250, () => {
          this.pos = 'stand'; this.top = null;
          this.banner(result?.winnerId ? 'DECISION' : 'DRAW', 3, { bars: true });
          this.sfx('bell2', 2);
          if (result?.winnerId) this.later(900, () => { this.f[result.winnerId].win = true; this.hype = 1.5; this.sfx('crowd', 2); this.sfx('fanfare', 2); });
        });
        return;
      }
      const loser = this.other(result.winnerId), winner = this.f[result.winnerId];
      const sub = method === '서브미션';
      this.later(sub ? 300 : 360, () => {
        if (sub) {
          this.lock(2.2, true); this.slowmo(0.5, 0.8); this.sfx('lock', 2);
          this.cam.punch = 0.5; this.cam.fx = (loser.x + winner.x) / 2; this.cam.fy = FLOOR - 8;
          [0, 260, 520].forEach((ms) => this.later(ms, () => { this.text('TAP', loser, '#ffffff', 1, -6 - Math.random() * 10, (Math.random() - 0.5) * 14); this.shake = 0.3; this.sfx('tap', 2); }));
          this.later(900, () => { this.banner('TAP OUT', 3.2, { bars: true, big: true }); this.hype = 2; this.flash = 0.6; this.sfx('bell2', 2); this.sfx('crowd', 2); });
          this.later(1600, () => this.sfx('fanfare', 2));
          this.later(1600, () => { this.pos = 'stand'; this.top = null; winner.win = true; loser.ko = true; loser.tLying = 1; });
        } else {
          // 드라마틱 KO: 히트스톱 → 반전 플래시 → 슬로모션 날아감 → 바운드 → 배너
          this.stop = 0.28; this.invert = 0.12; this.flash = 1; this.shake = 1.6;
          this.sfx('ko', 2);
          this.slowmo(0.25, 1.5);
          const [hx, hy] = this.headPos(loser);
          this.cam.punch = 0.6; this.cam.fx = hx; this.cam.fy = hy + 14;
          this.burst(hx - loser.d * 4, hy, true, true);
          this.spray(hx, hy, -loser.d, 26, ['#ffffff', '#ff4b45', '#cfefff']);
          loser.ko = true; loser.tLying = 1; loser.vy = -150; loser.kx = -loser.d * 160;
          loser.anim = { kind: 'hit', t0: this.gt, dur: 0.6 };
          this.speedLines = { t0: this.rt, dur: 1.4 };
          this.later(700, () => { this.stars(loser, 99); });
          this.later(420, () => { this.banner(method === 'KO' ? 'K.O.' : 'T.K.O.', 3.4, { bars: true, big: true }); this.hype = 2; this.sfx('bell2', 2); this.sfx('crowd', 2); });
          this.later(1500, () => { winner.win = true; this.sfx('fanfare', 2); });
        }
      });
    }

    // 결과 바로 보기 — 마지막 상태로 즉시 이동
    snap(e, result) {
      this.q = []; this.fx = []; this.parts = []; this.stop = 0; this.slow = 1; this.speed = 4; this.lockOn = 0;
      if (e) { this.pos = e.pos; this.top = e.top; }
      this.tbars = 1;
      if (result && result.method !== '판정') {
        const loser = this.other(result.winnerId);
        this.pos = 'stand'; this.top = null;
        loser.ko = true; loser.tLying = 1; this.f[result.winnerId].win = true;
        if (result.method !== '서브미션') this.stars(loser, 99);
        this.banner(result.method === 'KO' ? 'K.O.' : result.method === 'TKO' ? 'T.K.O.' : 'TAP OUT', 3, { bars: true, big: true });
      } else {
        this.pos = 'stand'; this.top = null;
        if (result?.winnerId) this.f[result.winnerId].win = true;
        this.banner(result?.winnerId ? 'DECISION' : 'DRAW', 3, { bars: true });
      }
      this.layout(true);
    }

    // ── 데모 (로그인 화면)
    demoTick() {
      const [a, b] = this.fighters;
      const att = Math.random() < 0.5 ? a : b;
      const r = Math.random();
      const [cat, name] = r < 0.3 ? ['jab', '잽'] : r < 0.5 ? ['jab', '원투'] : r < 0.72 ? ['hook', '훅'] : r < 0.88 ? ['body', '바디샷'] : ['uppercut', '어퍼컷'];
      const type = Math.random() < 0.3 ? 'miss' : Math.random() < 0.18 ? 'big' : 'strike';
      const dodge = type === 'miss' ? ['slip', 'duck', 'block', 'parry', 'back'][Math.floor(Math.random() * 5)] : undefined;
      this.play({ type, act: { att: att.id, cat, name, dodge }, pos: 'stand', top: null });
      this.demoTimer = setTimeout(() => this.running && this.demoTick(), 700 + Math.random() * 900);
    }

    // ── 효과 생성
    burst(x, y, big, huge) { this.fx.push({ kind: 'burst', x, y, t0: this.rt, dur: huge ? 0.6 : big ? 0.4 : 0.22, big, huge }); }
    whoosh(f, kind) { this.fx.push({ kind: 'whoosh', f, t0: this.rt, dur: 0.22, low: kind === 'kick', style: kind }); }
    text(text, f, color, size = 1, dy = -14, dx = 0) {
      const [hx, hy] = this.headPos(f);
      this.fx.push({ kind: 'text', text, x: hx + dx, y: hy + dy, t0: this.rt, dur: 1, color, size });
    }
    num(text, x, y, big) { this.fx.push({ kind: 'text', text, x: x + (Math.random() - 0.5) * 6, y, t0: this.rt, dur: 0.8, color: big ? '#ff4b45' : '#ffffff', size: big ? 1.15 : 0.85, num: true }); }
    lock(dur, tap) { this.fx = this.fx.filter((x) => x.kind !== 'lock'); this.fx.push({ kind: 'lock', t0: this.rt, dur, tap }); }
    stars(f, dur) { this.fx = this.fx.filter((x) => !(x.kind === 'stars' && x.f === f)); this.fx.push({ kind: 'stars', f, t0: this.rt, dur }); }
    banner(text, dur = 1.2, o = {}) {
      this.fx = this.fx.filter((x) => x.kind !== 'banner');
      this.fx.push({ kind: 'banner', text, t0: this.rt, dur, ...o });
      if (o.bars) { this.tbars = 1; if (!o.big) setTimeout(() => { if (!this.fx.some((x) => x.kind === 'banner' && x.big)) this.tbars = 0; }, dur * 1000 / Math.min(this.speed, 3)); }
    }
    slowmo(f, dur) { this.slow = f; this.slowT = dur; }
    spray(x, y, dir, n, cols) {
      for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: dir * (30 + Math.random() * 90) + (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 70, life: 0.4 + Math.random() * 0.5, c: cols[i % cols.length], g: 260, s: Math.random() < 0.3 ? 2 : 1 });
    }
    dust(x, n) {
      for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y: FLOOR - 1, vx: (Math.random() - 0.5) * 60, vy: -10 - Math.random() * 25, life: 0.5 + Math.random() * 0.4, c: i % 2 ? '#9c9c9c' : '#c4c4c4', g: 30, s: 2 });
    }

    // ── 루프
    loop(ts) {
      if (!this.running) return;
      const raw = Math.min(0.1, Math.max(0, (ts - this.last) / 1000)); this.last = ts;
      const sp = Math.min(this.speed, 3);
      const rdt = raw * sp;
      this.rt += rdt;
      // 히트스톱 / 슬로모션
      let gdt = rdt;
      if (this.stop > 0) { this.stop -= raw; gdt = 0; }
      else if (this.slowT > 0) { this.slowT -= raw; gdt *= this.slow; if (this.slowT <= 0) this.slow = 1; }
      this.gt += gdt;
      // 예약 실행
      if (this.q.length) {
        const due = this.q.filter((x) => x.at <= this.gt);
        if (due.length) { this.q = this.q.filter((x) => x.at > this.gt); due.forEach((x) => x.fn()); }
      }
      this.update(gdt, rdt);
      this.draw();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt, rdt) {
      this.layout();
      const k = 1 - Math.exp(-dt * 6);
      for (const f of this.fighters) {
        f.x += (f.tx - f.x) * k + f.kx * dt;
        f.kx *= Math.exp(-dt * 7);
        f.x = Math.max(16, Math.min(LW - 16, f.x));
        if (f.vy || f.y < 0) {
          f.vy += 420 * dt; f.y += f.vy * dt;
          if (f.y >= 0) {
            f.y = 0;
            if (f.vy > 90) { f.vy = -f.vy * 0.32; this.dust(f.x - f.d * 10, 8); this.shake = Math.max(this.shake, 0.6); this.sfx('bounce', 1); }
            else f.vy = 0;
          }
        }
        const rate = f.ko ? 5 : 9;
        f.lying += (f.tLying - f.lying) * (1 - Math.exp(-dt * rate));
        f.flash = Math.max(0, f.flash - rdt);
        f.blink -= dt; if (f.blink < -0.12) f.blink = 2 + Math.random() * 3;
      }
      for (const p of this.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.y > FLOOR + 2 && p.g > 100) { p.y = FLOOR + 2; p.vy *= -0.3; p.vx *= 0.6; } }
      this.parts = this.parts.filter((p) => p.life > 0).slice(-160);
      this.fx = this.fx.filter((x) => this.rt - x.t0 < x.dur);
      this.shake = Math.max(0, this.shake - rdt * 2.6);
      this.flash = Math.max(0, this.flash - rdt * 3);
      this.invert = Math.max(0, this.invert - rdt);
      this.hype = Math.max(0, this.hype - rdt * 0.35);
      this.bars += (this.tbars - this.bars) * (1 - Math.exp(-rdt * 10));
      // 카메라: 두 선수 중간을 따라가고, 타격 순간 임팩트 지점으로 펀치 줌
      const [a, b] = this.fighters;
      const lockFx = this.fx.find((x) => x.kind === 'lock');
      const baseZ = this.demo ? 1.05 : (this.pos === 'stand' ? 1.18 : 1.35) + (lockFx ? 0.25 : 0);
      const mx = (a.x + b.x) / 2;
      const tx = lerp(mx, this.cam.fx, Math.min(1, this.cam.punch * 2));
      const ty = lerp(this.pos === 'stand' ? 54 : 60, this.cam.fy, Math.min(1, this.cam.punch * 2));
      const kk = 1 - Math.exp(-rdt * 8);
      this.cam.x += (tx - this.cam.x) * kk; this.cam.y += (ty - this.cam.y) * kk;
      this.cam.z += (baseZ + this.cam.punch - this.cam.z) * (1 - Math.exp(-rdt * 14));
      this.cam.punch = Math.max(0, this.cam.punch - rdt * (this.slow < 1 ? 0.25 : 0.9));
    }

    // ── 그리기 (월드 버퍼)
    draw() {
      const w = this.w;
      w.imageSmoothingEnabled = false;
      this.drawStage(w);
      // 그림자
      for (const f of this.fighters) {
        const sw = 12 + f.lying * 16, sx = f.x - f.d * f.lying * 12;
        w.fillStyle = 'rgba(0,0,0,.28)';
        w.fillRect(Math.round(sx - sw / 2), FLOOR - 1, Math.round(sw), 2);
        w.fillRect(Math.round(sx - sw / 2 + 2), FLOOR + 1, Math.round(sw - 4), 1);
      }
      // 누운 선수 먼저
      const fs = [...this.fighters].sort((p, q) => q.lying - p.lying);
      for (const f of fs) this.drawFighter(w, f);
      for (const x of this.fx) this.drawWorldFx(w, x);
      for (const p of this.parts) { w.globalAlpha = Math.min(1, p.life * 3); w.fillStyle = p.c; w.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
      w.globalAlpha = 1;
      this.present();
    }

    drawStage(w) {
      const t = this.rt;
      w.fillStyle = '#000'; w.fillRect(0, 0, LW, LH);
      // 스포트라이트 빔
      w.save(); w.globalAlpha = 0.06 + this.hype * 0.03; w.fillStyle = '#fff';
      for (const [x0, x1] of [[CX - 46, CX - 8], [CX + 8, CX + 46]]) {
        w.beginPath(); w.moveTo(x0 + 30, 0); w.lineTo(x1 + 18, 0); w.lineTo(x1, FLOOR); w.lineTo(x0, FLOOR); w.closePath(); w.fill();
      }
      w.restore();
      // 관중 (실루엣) — 흥분하면 점프
      this.crowd.forEach((row, ri) => {
        const by = 26 + ri * 9;
        for (const c of row) {
          const j = Math.round(Math.max(0, Math.sin(t * 9 + c.p)) * this.hype * 2.5);
          w.fillStyle = ri ? '#161616' : '#0e0e0e';
          w.fillRect(c.x, by - 5 - j - c.s, 4, 4); w.fillRect(c.x - 1, by - 1 - j - c.s, 6, 8);
          if (this.hype > 0.6 && Math.sin(t * 9 + c.p) > 0.6 && c.s === 1) { w.fillRect(c.x - 2, by - 8 - j, 1, 4); w.fillRect(c.x + 5, by - 8 - j, 1, 4); }
        }
      });
      // 카메라 플래시
      const flashes = 0.04 + this.hype * 0.35;
      if (Math.random() < flashes) this.fx.push({ kind: 'camflash', x: 2 + Math.random() * (LW - 4), y: 10 + Math.random() * 24, t0: this.rt, dur: 0.09 });
      // 매트
      const top = 52;
      w.fillStyle = '#d8d8d8'; w.fillRect(0, top, LW, LH - top);
      w.fillStyle = '#bcbcbc'; w.fillRect(0, top, LW, 3);
      // 디더 그늘 (가장자리)
      w.fillStyle = '#b4b4b4';
      for (let y = top + 3; y < 84; y += 1) for (let x = (y % 2); x < LW; x += 2) {
        const e = Math.abs(x - CX) / CX;
        if (e > 0.72 || (y < top + 6 && x % 4 === 0)) w.fillRect(x, y, 1, 1);
      }
      if (logoDark) { w.globalAlpha = 0.13; w.drawImage(logoDark, CX - 26, top + 7, 52, 15); w.globalAlpha = 1; }
      // 뒤쪽 로프 & 포스트
      for (const [i, y] of [[0, 32], [1, 39], [2, 46]].map(([i, y]) => [i, y])) {
        w.fillStyle = i === 1 ? '#ff4b45' : '#f0f0f0'; w.globalAlpha = 0.85; w.fillRect(10, y, LW - 20, 1); w.globalAlpha = 1;
      }
      for (const x of [8, LW - 11]) { w.fillStyle = '#fff'; w.fillRect(x, 28, 3, 26); w.fillStyle = '#000'; w.fillRect(x, 28, 3, 2); }
      // 앞 에이프런
      w.fillStyle = '#000'; w.fillRect(0, 84, LW, LH - 84);
      w.fillStyle = '#fff'; w.fillRect(0, 84, LW, 1);
      w.fillStyle = '#ff4b45'; w.fillRect(0, 86, LW, 1);
      if (logoImg.complete && logoImg.naturalWidth) w.drawImage(logoImg, CX - 13, 89, 26, 9);
      w.fillStyle = '#3a3a3a';
      for (let x = 6; x < LW; x += 12) if (Math.abs(x - CX) > 20) w.fillRect(x, 93, 6, 1);
      // 앞 포스트
      for (const x of [0, LW - 4]) { w.fillStyle = '#fff'; w.fillRect(x, 58, 4, 32); w.fillStyle = '#ff4b45'; w.fillRect(x, 58, 4, 3); }
    }

    drawFighter(w, f) {
      const t = this.gt;
      let pose = { kind: 'idle', k: 0, hand: f.hand, face: f.blink < 0 ? 'blink' : 'normal' };
      const an = f.anim;
      if (an) {
        const p = (t - an.t0) / an.dur;
        if (p > 1) f.anim = null;
        else {
          pose.kind = an.kind; pose.hand = an.hand; pose.p = p;
          pose.k = an.kind === 'shoot' ? Math.min(1, easeOut(p * 1.6)) * (p > 0.8 ? (1 - p) * 5 : 1) : bump(p);
          if (['punch', 'kick', 'knee', 'elbow', 'gnp', 'jab', 'cross', 'hook', 'upper', 'body'].includes(an.kind)) pose.face = 'effort';
        }
      }
      if (!f.anim && this.pos === 'clinch' && f.lying < 0.5) pose.kind = 'clinch';
      if (f.win && !f.anim) pose.kind = 'win';
      pose.ko = f.ko; pose.down = f.down;
      pose.kneel = this.isMount(f);
      const standing = f.lying < 0.5 && !pose.kneel;
      pose.bob = standing && this.pos !== 'ground' ? (Math.sin(t * (f.win ? 12 : 7) + f.look.phase) > 0.2 ? 1 : 0) : 0;
      if (f.win) pose.bob = Math.sin(t * 10) > 0 ? 1 : 0;
      const g = f.sp.getContext('2d');
      drawSprite(g, f.look, f.st, pose);
      if (f.flash > 0) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over'; }
      w.save();
      const winHop = f.win ? -Math.round(Math.abs(Math.sin(t * 5)) * 3) : 0;
      w.translate(Math.round(f.x), Math.round(FLOOR + f.y - f.lying * 6 + (pose.kneel ? -3 : 0) + winHop));
      w.scale(f.d, 1);
      if (f.lying > 0.02) w.rotate(-f.lying * Math.PI / 2);
      w.drawImage(f.sp, -OX, -OY);
      w.restore();
    }

    drawWorldFx(w, x) {
      const p = (this.rt - x.t0) / x.dur;
      if (x.kind === 'camflash') {
        w.fillStyle = '#fff'; w.fillRect(Math.round(x.x), Math.round(x.y), 1, 1);
        w.globalAlpha = 0.6; w.fillRect(Math.round(x.x) - 1, Math.round(x.y), 3, 1); w.fillRect(Math.round(x.x), Math.round(x.y) - 1, 1, 3); w.globalAlpha = 1;
      } else if (x.kind === 'burst') {
        // 도트 임팩트: 별 모양 광선 + 링
        const R = (x.huge ? 22 : x.big ? 13 : 7) * easeOut(p * 1.4);
        const n = x.big ? 10 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (x.big ? 0.2 : 0.4);
          const len = i % 2 ? R : R * 0.6;
          for (let r = R * 0.35; r < len; r += 1) {
            w.fillStyle = r > len - 2 ? '#ff4b45' : '#ffffff';
            if (!x.big && r > len - 2) w.fillStyle = '#ffffff';
            w.fillRect(Math.round(x.x + Math.cos(a) * r), Math.round(x.y + Math.sin(a) * r), 1, 1);
          }
        }
        if (p < 0.35) { w.fillStyle = '#fff'; const s = x.big ? 5 : 3; w.fillRect(Math.round(x.x - s / 2), Math.round(x.y - s / 2), s, s); }
        if (x.big) {
          w.strokeStyle = '#fff'; w.globalAlpha = 1 - p; w.lineWidth = 1;
          w.beginPath(); w.arc(Math.round(x.x) + 0.5, Math.round(x.y) + 0.5, R * 1.25, 0, Math.PI * 2); w.stroke(); w.globalAlpha = 1;
        }
      } else if (x.kind === 'whoosh') {
        const f = x.f, [hx, hy] = this.headPos(f);
        w.globalAlpha = 1 - p; w.fillStyle = '#fff';
        if (x.style === 'arc') { // 훅: 바깥에서 휘어 들어오는 궤적
          for (let i = 0; i < 7; i++) { const t = (i / 6) * Math.min(1, p * 1.6), ang = -Math.PI * 0.9 + t * Math.PI * 0.9; w.fillRect(Math.round(f.x + f.d * (6 + Math.cos(ang) * 9)), Math.round(hy + 3 + Math.sin(ang) * 6), 2, 1); }
          w.globalAlpha = 1;
        } else if (x.style === 'up') { // 어퍼컷: 아래에서 위로
          for (let i = 0; i < 3; i++) { const len = 5 + i * 2, xx = f.x + f.d * (11 + i * 2); w.fillRect(Math.round(xx), Math.round(hy + 12 - p * 12 - len + i * 2), 1, len); }
          w.globalAlpha = 1;
        } else {
        const y0 = x.low ? FLOOR - 16 : x.style === 'low' ? hy + 12 : hy + 2;
        for (let i = 0; i < 3; i++) {
          const len = 6 + i * 2, xx = f.x + f.d * (10 + p * 10);
          w.fillRect(Math.round(f.d > 0 ? xx - len : xx), Math.round(y0 + (i - 1) * 3), len, 1);
        }
        w.globalAlpha = 1;
        }
      } else if (x.kind === 'stars') {
        const [hx, hy] = this.headPos(x.f);
        for (let i = 0; i < 3; i++) {
          const a = this.rt * 4 + (i * Math.PI * 2) / 3;
          const sx = Math.round(hx + Math.cos(a) * 8), sy = Math.round(hy - 7 + Math.sin(a) * 3);
          w.fillStyle = i === 1 ? '#ff4b45' : '#fff';
          w.fillRect(sx, sy - 1, 1, 3); w.fillRect(sx - 1, sy, 3, 1);
        }
      } else if (x.kind === 'lock') {
        const [a, b] = this.fighters;
        const mx = Math.round((a.x + b.x) / 2), my = FLOOR - 10;
        const pulse = Math.sin(this.rt * 16) > 0 ? 1 : 0;
        const r = 11 + pulse;
        w.fillStyle = x.tap ? '#ff4b45' : '#fff';
        for (let i = 0; i < 16; i++) {
          if (i % 2) continue;
          const an = (i / 16) * Math.PI * 2 + this.rt * 2;
          w.fillRect(Math.round(mx + Math.cos(an) * r), Math.round(my + Math.sin(an) * r * 0.6), 2, 1);
        }
      }
    }

    // ── 화면 출력 (카메라 + 오버레이)
    present() {
      const c = this.ctx, W = this.cw, H = this.ch;
      const z = this.cam.z, vw = LW / z, vh = LH / z;
      const x0 = Math.max(0, Math.min(LW - vw, this.cam.x - vw / 2));
      const y0 = Math.max(0, Math.min(LH - vh, this.cam.y - vh / 2));
      const S = W / vw;
      const shx = (Math.random() - 0.5) * 8 * this.shake * this.dpr, shy = (Math.random() - 0.5) * 8 * this.shake * this.dpr;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      c.drawImage(this.world, x0, y0, vw, vh, shx - 4 * this.dpr * this.shake, shy, W + 8 * this.dpr * this.shake, H);
      const toS = (wx, wy) => [(wx - x0) * S + shx, (wy - y0) * S + shy];
      const px = H / 100; // 화면 기준 단위

      // 이름표
      if (!this.demo) for (const f of this.fighters) {
        if (!f.name) continue;
        const [hx, hy] = this.headPos(f);
        const [sx, sy] = toS(hx, hy - (f.lying > 0.5 ? 10 : 12));
        c.font = `700 ${Math.round(5.2 * px)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(f.name).width + 6 * px;
        c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(Math.round(sx - tw / 2), Math.round(sy - 4 * px), Math.round(tw), Math.round(8 * px));
        c.fillStyle = f.st.tag; c.fillRect(Math.round(sx - tw / 2), Math.round(sy + 4 * px - px * 0.8), Math.round(tw), Math.max(1, Math.round(px * 0.8)));
        c.fillStyle = '#fff'; c.fillText(f.name, sx, sy);
      }

      // 스피드 라인 (KO 슬로모션)
      if (this.speedLines && this.rt - this.speedLines.t0 < this.speedLines.dur) {
        const p = (this.rt - this.speedLines.t0) / this.speedLines.dur;
        c.save(); c.globalAlpha = 0.55 * (1 - p); c.fillStyle = '#fff';
        const cx = W / 2, cy = H / 2;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2 + (hash(i) % 10) / 20;
          const r0 = Math.max(W, H) * (0.42 + ((hash(i * 7 + Math.floor(this.rt * 20)) % 20) / 100));
          const r1 = Math.max(W, H) * 0.9;
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          c.lineTo(cx + Math.cos(a + 0.025) * r1, cy + Math.sin(a + 0.025) * r1);
          c.lineTo(cx + Math.cos(a - 0.025) * r1, cy + Math.sin(a - 0.025) * r1);
          c.fill();
        }
        c.restore();
      }

      // 서브미션 비네트
      const lockFx = this.fx.find((x) => x.kind === 'lock');
      if (lockFx) {
        const pulse = 0.35 + Math.sin(this.rt * 10) * 0.12;
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.7);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, lockFx.tap ? `rgba(120,0,0,${pulse + 0.2})` : `rgba(0,0,0,${pulse + 0.25})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }

      // 텍스트 FX
      for (const x of this.fx) {
        if (x.kind !== 'text') continue;
        const p = (this.rt - x.t0) / x.dur;
        const pop = p < 0.12 ? 1.7 - (p / 0.12) * 0.7 : 1;
        const [sx, sy] = toS(x.x, x.y - easeOut(p) * (x.num ? 10 : 6));
        const size = Math.round(9 * px * x.size * pop);
        c.save();
        c.globalAlpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        c.font = `700 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = Math.max(2, size * 0.28); c.strokeStyle = '#000';
        c.strokeText(x.text, sx, sy);
        c.fillStyle = x.color; c.fillText(x.text, sx, sy);
        c.restore();
      }

      // 레터박스
      if (this.bars > 0.01) {
        const bh = Math.round(this.bars * H * 0.13);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
      }

      // 배너
      const bn = this.fx.find((x) => x.kind === 'banner');
      if (bn) this.drawBanner(c, bn, W, H, px);

      // 플래시 / 반전
      if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.flash * 0.8)})`; c.fillRect(0, 0, W, H); }
      if (this.invert > 0) { c.globalCompositeOperation = 'difference'; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    }

    drawBanner(c, x, W, H, px) {
      const p = (this.rt - x.t0) / x.dur;
      const tin = clamp01((this.rt - x.t0) / 0.22);
      const out = p > 0.85 ? (1 - p) / 0.15 : 1;
      c.save();
      c.globalAlpha = out;
      // 슬래시 띠
      const bandH = (x.big ? 30 : x.small ? 14 : 22) * px;
      const cy = H / 2;
      c.fillStyle = 'rgba(0,0,0,.72)';
      c.beginPath(); c.moveTo(0, cy - bandH / 2 + 4 * px); c.lineTo(W, cy - bandH / 2 - 4 * px); c.lineTo(W, cy + bandH / 2 - 4 * px); c.lineTo(0, cy + bandH / 2 + 4 * px); c.fill();
      c.fillStyle = '#fff'; c.fillRect(0, cy - bandH / 2 - 6 * px + (1 - tin) * 20 * px, W * tin, Math.max(2, px));
      c.fillStyle = '#ff4b45'; c.fillRect(W * (1 - tin), cy + bandH / 2 + 4 * px, W * tin, Math.max(2, px));
      // 글자: 왼쪽에서 오버슈트로 날아 들어옴
      const ov = tin < 1 ? (1 - easeOut(tin)) * -W * 0.7 + Math.sin(tin * Math.PI) * 6 * px : 0;
      const shakeT = x.big && p < 0.15 ? (Math.random() - 0.5) * 4 * px : 0;
      const size = Math.round((x.big ? 26 : x.small ? 10 : 17) * px);
      c.font = `700 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tx = W / 2 + ov + shakeT, ty = cy - (x.sub ? 3 * px : 0) + shakeT;
      c.fillStyle = '#ff4b45'; c.fillText(x.text, tx + 2 * px, ty + 2 * px);
      c.lineWidth = Math.max(3, size * 0.16); c.strokeStyle = '#000'; c.lineJoin = 'round'; c.strokeText(x.text, tx, ty);
      c.fillStyle = '#fff'; c.fillText(x.text, tx, ty);
      if (x.sub && p > 0.45) {
        const sp = clamp01((p - 0.45) / 0.1);
        const s2 = Math.round(9 * px * (1.8 - sp * 0.8));
        c.font = `700 ${s2}px ${FONT}`;
        c.lineWidth = Math.max(2, s2 * 0.25); c.strokeText(x.sub, W / 2, cy + 9 * px);
        c.fillStyle = '#ff4b45'; c.fillText(x.sub, W / 2, cy + 9 * px);
      }
      c.restore();
    }
  }

  window.Arena = Arena;
  window.PixelFighter = { url: spriteURL };
})();
