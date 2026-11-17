// 도트 캐릭터 그리기 (경기 화면 · 아바타 · 프로필 공용)
// 캐릭터 생김새·옷(상점 아이템 등)을 바꿀 때는 이 파일을 본다.
import { clamp01, hash, mkCanvas } from './util.js';

export const SW = 64, SH = 64, OX = 32, OY = 56; // 스프라이트 버퍼, 발 기준점

const C = {
  o: '#050505', skin: '#f6cfab', skinS: '#d99d76', blush: '#ff9a9a', eye: '#111', mouth: '#8c3b2e', white: '#ffffff',
};
export const SIDE = {
  L: { glove: '#f4f4f4', gloveS: '#b5b5b5', shoe: '#f4f4f4', tag: '#ffffff', band: '#f4f4f4' },
  R: { glove: '#e8302b', gloveS: '#a01c18', shoe: '#1b1b1b', tag: '#ff4b45', band: '#e8302b' },
};
const HAIR = ['#1c1c1c', '#4a4a4a'];                 // 검은 머리 (기본색, 하이라이트)
const CLOTH = { c: '#1f2f6b', s: '#141f4a', p: '#131c45', ps: '#0a1030' }; // 남색 반팔(c·s) / 조금 더 진한 남색 반바지(p·ps)

// ───────── 도트 캐릭터 ─────────
// 기본 캐릭터: 성별로만 구분 (남자 = 삐죽머리, 여자 = 머리띠). p = 회원 id 또는 { id, gender }
export function lookOf(p) {
  const id = typeof p === 'object' && p ? p.id : p;
  const gender = typeof p === 'object' && p?.gender === 'F' ? 'F' : 'M';
  return { gender, phase: ((hash(id) >>> 7) % 100) / 16 };
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
  const [hc, hl] = HAIR, girl = look.gender === 'F';
  const outer = [rc(hx + 2, hy + 1, 9, 10, C.skin), rc(hx + 1, hy + 2, 11, 8, C.skin)];
  // 머리 밖으로 삐져나오는 헤어: 남자 = 삐죽머리, 여자 = 뒷머리 + 두건 매듭 꼬리
  if (girl) outer.push(rc(hx, hy + 4, 3, 6, hc), rc(hx - 2, hy + 2, 3, 2, st.band), rc(hx - 4, hy + 4, 3, 2, st.band));
  else outer.push(rc(hx + 2, hy - 1, 2, 2, hc), rc(hx + 5, hy - 2, 2, 3, hc), rc(hx + 8, hy - 1, 2, 2, hc), rc(hx, hy + 1, 2, 3, hc));
  group(g, outer);
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(hx + x, hy + y, w, h); };
  R(1, 3, 1, 6, C.skinS); R(5, 6, 1, 2, C.skinS); // 뒤통수 그늘, 귀
  // 헤어
  R(2, 1, 9, 1, hc); R(1, 2, 11, 2, hc); R(9, 4, 2, 1, hc);
  if (girl) { // 두건: 정수리를 덮고 뒤로 묶음
    R(0, 4, 5, 3, hc); R(0, 7, 3, 3, hc);
    R(2, 1, 9, 1, st.band); R(1, 2, 11, 2, st.band); R(1, 4, 2, 1, st.band);
    R(1, 3, 11, 1, st.gloveS); R(3, 2, 1, 1, st.gloveS); R(7, 2, 1, 1, st.gloveS); R(-3, 5, 1, 1, st.gloveS);
  } else { R(1, 4, 4, 2, hc); R(3, 2, 2, 1, hl); }
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
export function drawSprite(g, look, st, pose) {
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
    case 'hook': case 'shorthook': { // 숏 훅: 팔을 짧게 접어 작은 궤적
      const p = pose.p ?? k, A = pose.kind === 'shorthook' ? 0.6 : 1;
      if (p < 0.3) { const w = p / 0.3 * A; ux = -w; fG = [8 - w * 5, -24, 3 - w * 2, -22]; }
      else { const s = Math.sin(Math.min(1, (p - 0.3) / 0.35) * Math.PI / 2) * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1) * A; ux = s * 3; fG = [3 + s * 10, -24 - s * 3, 3 + s * 4, -22 - s * 5]; }
      bG = [6, -26]; break;
    }
    case 'overhand': { // 뒷손을 위로 크게 돌려 내려친다
      const p = pose.p ?? k;
      if (p < 0.35) { const w = p / 0.35; ux = -w; uy += Math.round(w); bG = [4 - w * 2, -27 - w * 6, 2, -24 - w * 3]; }
      else { const s = Math.min(1, (p - 0.35) / 0.3) * (p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1); ux = s * 5; uy += Math.round(1 + s); bG = [2 + s * 16, -33 + s * 10, 3 + s * 7, -29 + s * 3]; }
      fG = [6, -22]; break;
    }
    case 'upper': case 'shortupper': { // 숏 어퍼: 붙은 거리에서 짧게
      const p = pose.p ?? k, A = pose.kind === 'shortupper' ? 0.6 : 1;
      if (p < 0.35) { const w = p / 0.35 * A; uy += Math.round(w * 3); fG = [7, -22 + w * 8]; }
      else { const s = Math.min(1, (p - 0.35) / 0.3), lift = s * (p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1) * A; uy += Math.round(3 * A - lift * 5); ux = lift * 3; fG = [7 + lift * 5, -14 - lift * 16, 7 + lift * 3, -13 - lift * 5]; }
      bG = [6, -26]; break;
    }
    case 'bodyhook': { // 무릎을 굽혀 옆구리로 휘두른다
      const p = pose.p ?? k, s = Math.sin(Math.PI * clamp01(p));
      uy += Math.round(s * 5); ux = s * 2; hdx = Math.round(s);
      fG = [3 + s * 11, -17 - s, 3 + s * 4, -17 - s * 3]; bG = [6, -25]; bL = [-6 - s * 2, 0]; fL = [4 + s * 2, 0]; break;
    }
    case 'bodyupper': { // 몸을 낮췄다가 명치로 올려친다
      const p = pose.p ?? k, s = Math.sin(Math.PI * clamp01(p));
      uy += Math.round(s * 4); ux = s * 2;
      fG = [7 + s * 7, -12 - s * 7, 7 + s * 3, -12]; bG = [6, -25]; break;
    }
    case 'body': uy += Math.round(k * 5); ux = k * 3; hdx = Math.round(k); fG = [8 + k * 13, -19]; bG = [6, -25]; bL = [-6 - k * 2, 0]; fL = [4 + k * 2, 0]; break;
    // ── 복싱: 디펜스
    case 'slip': ux = -3 * k; hdx = -Math.round(2 * k); hdy = Math.round(k); fG = [7, -24]; bG = [5, -24]; break;
    case 'duck': uy += Math.round(7 * k); ux = -k; fG = [7, -23]; bG = [5, -23]; break;
    case 'weave': { // U자로 숙여 펀치 밑을 지나 빠져나감
      const p = pose.p ?? k;
      uy += Math.round(Math.sin(Math.PI * p) * 6); ux = -2 + Math.cos(Math.PI * p) * 2; hdx = Math.round(Math.sin(Math.PI * p)); fG = [7, -23]; bG = [5, -23]; break;
    }
    case 'roll': ux = -2 * k; hdx = -Math.round(2 * k); fG = [5 - k, -19]; bG = [8, -27]; if (k > 0.3) face = 'effort'; break; // 앞어깨를 세우고 뒷손은 턱
    case 'back': ux = -4 * k; hdx = -Math.round(2 * k); bL = [-8 - k * 2, 0]; fL = [2 - k * 2, 0]; fG = [8, -25]; bG = [6, -26]; break;
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
  body.push(rc(-5 + Math.round(ux / 3), -13 + Math.round(uy / 2), 10, 5, CLOTH.p)); // 반바지
  body.push(rc(-4 + ux, -20 + uy, 8, 8, CLOTH.c));                                   // 반팔 티
  group(g, body);
  g.fillStyle = CLOTH.ps; g.fillRect(-5 + Math.round(ux / 3), -13 + Math.round(uy / 2), 10, 1); // 허리 밴드
  g.fillStyle = CLOTH.s; g.fillRect(-4 + ux, -20 + uy, 2, 8);
  // 3. 머리
  drawHead(g, -6 + ux + hdx, -31 + uy + hdy, look, st, face);
  // 4. 뒷팔 → 5. 앞팔
  const sh = [ux, -17 + uy];
  for (const [gp, sx] of [[bG, -1], [fG, 1]]) {
    const gx = Math.round(ux + gp[0]), gy = Math.round(uy + gp[1]);
    const ex = gp.length > 2 ? Math.round(ux + gp[2]) : gx + 2, ey = gp.length > 2 ? Math.round(uy + gp[3]) : gy + 2;
    const x0 = sh[0] + sx, y0 = sh[1], dl = Math.max(1, Math.hypot(ex - x0, ey - y0)), sl = Math.min(3, dl) / dl;
    const sleeve = lb(x0, y0, Math.round(x0 + (ex - x0) * sl), Math.round(y0 + (ey - y0) * sl), 3, CLOTH.c); // 반팔 소매
    if (gp.length > 2) group(g, [lb(x0, y0, ex, ey, 2, C.skin), lb(ex, ey, gx + 2, gy + 2, 2, C.skin), sleeve, ...glove(gx, gy, st)]);
    else group(g, [lb(x0, y0, gx + 2, gy + 2, 2, C.skin), sleeve, ...glove(gx, gy, st)]);
  }
  g.restore();
}

// 회원 아바타 / 포즈 이미지 (UI용)
const imgCache = new Map();
export function spriteURL(p, opts = {}) {
  const look = lookOf(p);
  const key = `${look.gender}|${opts.side || 'L'}|${opts.pose || 'bust'}|${opts.scale || 4}|${opts.p ?? ''}`;
  if (imgCache.has(key)) return imgCache.get(key);
  const st = SIDE[opts.side || 'L'];
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
