// 프로필 · 상점 캐릭터 = AI 로 그린 정면 하이 가드 그림(public/img/pose — 히트맨 그림체, 기본 차림: 흰 글러브 · 남색 상의 · 남색 트렁크 · 검정 복싱화)을
// 회원 장비 색으로 바꿔 칠한 것. AI 그림은 색이 조금씩 흔들려서, 색 성질(남색 · 흰 회색 · 검정)과 위치(허리 흰 띠 위/아래, 머리/발)로 부위를 나눈다
import { gearArtCanvas } from './gear-art.js';

// 기본 4장 + 헤어별 그림(<기본>-<hairArt>.png — GPT 헤어 그림에서 머리만 갈아 끼움, 모두 위에 같은 여백이라 몸 크기가 같음)
const HAIRS = { M: ['buzz', 'bald', 'blond-buzz', 'mohawk', 'bandana-m'], F: ['ponytail', 'bun', 'bandana', 'long', 'cornrow'] };
const BASE = { M: ['M-tee', 'M-bare'], F: ['F-tee', 'F-bra'] };
const NAMES = Object.entries(BASE).flatMap(([g, bs]) => bs.flatMap((b) => [b, ...HAIRS[g].map((h) => `${b}-${h}`)]));
const load = (n) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('pose 그림 없음: ' + n)); i.src = `/img/pose/${n}.png`; });
const IMG = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, await load(n)])));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// 그림마다 한 번: 칸별 부위 (0 = 그대로, 1 상의, 2 트렁크, 3 글러브, 4 머리카락, 5 신발, 6 탱크탑이 덮는 배) + 부위별 평균 밝기
// tank = 브라 그림에서 브라 아래 드러난 배까지 상의로 덮어 탱크탑 모양 (어깨 · 팔은 맨살)
const roleCache = new Map();
function roles(img, tank) {
  const ck = img.src + (tank ? '|tank' : '');
  if (roleCache.has(ck)) return roleCache.get(ck);
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const kind = (i) => {
    const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), L = lum(r, gg, b);
    if (!d[i + 3]) return '';
    if (b > r + 18 && b > 45 && L < 120) return 'navy'; // 진한 남색 그늘까지 (검정 머리카락은 파랑이 거의 안 섞이고, 흰 띠 · 글러브 그늘은 밝음)
    if (mx - mn < 30 && L > 130) return 'white';
    if (L < 70) return 'dark';
    if (r > gg && gg > b && r - b > 50) return 'skin';
    return '';
  };
  const K = Array.from({ length: W * H }, (_, p) => kind(p * 4));
  // 허리 흰 띠 = 몸 중간(38~70% — 위는 가슴 높이 흰 글러브)에서 흰 회색이 많은 줄 중 가장 위 (트렁크 밑단 띠가 더 길 수 있어서 '가장 많은 줄'이 아님)
  const whites = []; for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (K[y * W + x] === 'white') n++; whites.push(n); }
  const lo = Math.floor(H * 0.38), hi = Math.floor(H * 0.7), most = Math.max(...whites.slice(lo, hi));
  let waist = lo; while (waist < hi && whites[waist] < most * 0.6) waist++;
  const R = new Uint8Array(W * H), sum = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, k = K[p];
    let role = 0;
    if (k === 'navy') role = y < waist - 1 ? 1 : 2;
    else if (k === 'white') role = y < waist - 1 && y > H * 0.22 ? 3 : 0; // 위 22% 흰색 = 두건 (글러브 아님)
    else if (k === 'dark') {
      // 눈 = 얼굴 안 가로 막대: 위 3칸 안과 좌우 4칸 안에 피부가 있는 검정 (머리카락은 위가 머리카락)
      const skinAt = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && xx < W && yy >= 0 && K[yy * W + xx] === 'skin'; };
      const eye = [1, 2, 3].some((k) => skinAt(0, -k)) && ([1, 2, 3, 4].some((k) => skinAt(-k, 0)) || [1, 2, 3, 4].some((k) => skinAt(k, 0)));
      if (y < waist - 1 && !eye) role = 4; // 허리 위 검정 = 머리카락 (긴 머리는 가슴까지)
      else if (y > H * 0.75) role = 5;
    }
    R[p] = role;
  }
  if (tank) {
    // 브라 가로 범위(양끝 1칸 안쪽) · 브라 아래 ~ 허리 띠 위의 피부 = 탱크탑 몸판
    let x0 = W, x1 = -1, y1 = -1;
    for (let p = 0; p < W * H; p++) if (R[p] === 1) { const x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = y1 + 1; y < waist - 1; y++) for (let x = x0 + 1; x < x1; x++) if (K[y * W + x] === 'skin') R[y * W + x] = 6;
  }
  for (let p = 0; p < W * H; p++) if (R[p]) { sum[R[p]] += lum(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); cnt[R[p]]++; }
  const avg = sum.map((s, i) => (cnt[i] ? s / cnt[i] : 1));
  // 부위 영역 사각형 (상품 그림을 늘려 입힐 자리). 글러브 · 신발은 왼쪽/오른쪽 따로
  const box = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const role = R[y * W + x] === 6 ? 1 : R[y * W + x]; if (!role || role === 4) continue;
    const key = role === 3 || role === 5 ? role + (x < W / 2 ? 'L' : 'R') : String(role);
    const b = (box[key] ||= { x0: W, x1: -1, y0: H, y1: -1 });
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
  }
  // 상의는 가슴 위쪽이 들어 올린 글러브에 가려서, 상품 그림(가슴 프린트)을 글러브 아래 보이는 몸통에 대응 (그 위 어깨 · 소매는 그림 맨 윗줄 색)
  if (box[1] && box['3L'] && box['3R']) box[1] = { ...box[1], y0: Math.max(box[1].y0, Math.min(box['3L'].y1, box['3R'].y1) - 2) };
  const out = { W, H, d, R, avg, box };
  roleCache.set(ck, out);
  return out;
}

// 상품 그림(32×32) → 그림이 있는 범위만 잘라 둔 점 배열 (테두리 검정은 바탕색으로 채울 자리)
const OUTLINE = [11, 11, 11];
const texCache = new Map();
function artTex(art) {
  const key = JSON.stringify(art);
  if (texCache.has(key)) return texCache.get(key);
  const cv = gearArtCanvas(art), n = cv.width, d = cv.getContext('2d').getImageData(0, 0, n, n).data;
  let x0 = n, x1 = -1, y0 = n, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const t = { d, n, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  texCache.set(key, t);
  return t;
}

// kit = hitman.js kitFromLook 결과 { gloves, trunks, shoes, hairColor, top, topKind }, F = 여자, hairArt = 상점 헤어 그림 이름 (없으면 기본 머리)
// arts = 회원이 입은 상품 그림 설정 { shirt, trunks, gloves, shoes } — 주면 바탕색 대신 상품 그림(프린트 · 로고 · 옆선)을 부위에 입힌다 (피팅룸 · 결과 이미지)
export function poseCanvas(kit, F, arts, hairArt) {
  const kind = kit.topKind;
  const name = F ? (kind === 'tee' ? 'F-tee' : 'F-bra') : kind ? 'M-tee' : 'M-bare';
  const { W, H, d, R, avg, box } = roles(IMG[`${name}-${hairArt}`] || IMG[name], F && kind === 'tank');
  const TEX = {}; for (const [role, a] of [[1, arts?.shirt], [2, arts?.trunks], [3, arts?.gloves], [5, arts?.shoes]]) if (a) TEX[role] = artTex(a);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), id = g.createImageData(W, H), o = id.data;
  // 부위별 바꿀 색 · 기준 밝기(그림의 기본 차림 색이 이 밝기일 때 바꿀 색 그대로)
  const target = { 1: kit.top || '#22336e', 2: kit.trunks, 3: kit.gloves, 4: kit.hairColor, 5: kit.shoes };
  const T = {}; for (const k in target) { const rgb = hex(target[k]); T[k] = { rgb, L: Math.max(lum(...rgb), 1) }; }
  // 박스핏 트렁크: 트렁크 밑단(흰 띠) 아래 허벅지를 그림 높이의 4%만큼 더 덮어 길게 (외곽선은 그대로 두어 다리 모양 유지)
  const ext = new Uint8Array(W * H);
  if (kit.boxy && box[2]) {
    const E = Math.round(H * 0.04), b = box[2], bots = {};
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) if (R[y * W + x] === 2) bots[x] = y;
    // 밑단 흰 띠는 트렁크보다 양옆으로 몇 칸 더 나와 있어서, 바깥 줄은 가장 가까운 트렁크 줄의 밑단 높이를 쓴다
    const near = (x) => { for (let k = 0; k <= 5; k++) { if (bots[x - k] != null) return bots[x - k]; if (bots[x + k] != null) return bots[x + k]; } return -1; };
    for (let x = b.x0 - 5; x <= b.x1 + 5; x++) {
      const bot = bots[x] ?? near(x);
      if (bot < 0) continue;
      for (let y = bot - 2; y <= Math.min(H - 1, bot + E); y++) {
        const p = y * W + x, i = p * 4, r = d[i], gg = d[i + 1], bb = d[i + 2], mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
        if (R[p] || !d[i + 3]) continue;
        if ((r > gg && gg > bb && r - bb > 50) || (mx - mn < 30 && lum(r, gg, bb) > 60)) ext[p] = 1; // 피부 · 흰 회색 밑단 (검정 외곽선 제외)
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const i = p * 4, raw = R[p], role = raw === 6 ? 1 : raw;
    if (ext[p]) { o[i + 3] = d[i + 3]; for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.round(T[2].rgb[ch] * 0.92); continue; } // 탱크탑 배 = 상의와 같은 색 · 그림 (명암 기준만 피부 평균)
    o[i + 3] = d[i + 3];
    if (!role) { o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; continue; }
    // 원래 밝기 / 부위 평균 밝기 = 명암 비율 → 바꿀 색에 곱함 (흰 글러브처럼 밝은 색은 위쪽에서 잘리니 살짝 낮춤)
    const t = T[role], k = lum(d[i], d[i + 1], d[i + 2]) / avg[raw], f = t.L > 200 ? 0.97 : 1;
    const tx = TEX[role];
    if (tx) {
      // 상품 그림 입히기: 부위 사각형 → 상품 그림 범위로 늘려 대응, 명암(k)은 원래 그림에서 (글씨가 묻히지 않게 범위를 좁힘)
      const x = p % W, y = (p - x) / W, side = role === 3 || role === 5 ? (x < W / 2 ? 'L' : 'R') : '', b = box[role + side];
      let u = (x - b.x0 + 0.5) / (b.x1 - b.x0 + 1), v = Math.max(0, (y - b.y0 + 0.5) / (b.y1 - b.y0 + 1));
      if ((role === 3 && side === 'R') || (role === 5 && side === 'L')) u = 1 - u; // 오른손 글러브 엄지는 몸 안쪽, 왼발 신발 앞코는 바깥쪽
      const ax = tx.x0 + Math.min(tx.w - 1, Math.floor(u * tx.w)), ay = tx.y0 + Math.min(tx.h - 1, Math.floor(v * tx.h)), j = (ay * tx.n + ax) * 4;
      const outl = !tx.d[j + 3] || (tx.d[j] === OUTLINE[0] && tx.d[j + 1] === OUTLINE[1] && tx.d[j + 2] === OUTLINE[2]);
      const src = outl ? t.rgb : [tx.d[j], tx.d[j + 1], tx.d[j + 2]], kk = Math.max(0.6, Math.min(1.2, k));
      for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.min(255, Math.round(src[ch] * kk));
      continue;
    }
    for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.min(255, Math.round(t.rgb[ch] * k * f));
  }
  g.putImageData(id, 0, 0);
  return c;
}
