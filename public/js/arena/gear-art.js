// 상점·옷장용 장비 그림 (32×32 도트, 실제 상품 느낌)
// 아이템의 art 설정(lib/shop/items.js)으로 그린다. 경기 화면 속 작은 글러브(5×5)는 sprite.js 가 따로 그린다.
//
// 글러브 art: { type: 'glove', body, accent?(투톤 색), cuff, piping, closure: 'lace' | 'velcro',
//              lace?(끈 색), strap?(벨크로 색), label?(손목 위 작은 로고 패치 색), text?: ['줄1', '줄2'], textColor? }
// 트렁크 art: { type: 'trunks', body, band, bandText?(허리 밴드 글자 색), stripe?(옆선 색), hem?(밑단 색), vPanel?, split?(밑단 옆트임),
//              boxy?(박스핏: 통이 곧게 떨어지고 기장이 길다) }
// 티셔츠 art: { type: 'shirt', body, collar?(목 둘레 색), print?(가슴 글자 색), text?: ['줄1', …], sleeveless?(탱크탑),
//              cut?: 'muscle'(굵은 어깨 · 깊은 진동) | 'racer'(가운데로 모인 어깨끈) — 탱크탑만, crop?(배꼽 위 기장) — 탱크탑만,
//              fabric?: 'washed'(빛바랜 얼룩) | 'mesh'(구멍 격자), bare?(상의 탈의 — 옷 대신 단련된 맨몸) }
// 복싱화 art: { type: 'shoe', body, height: 'low' | 'mid' | 'high', sole, accent?(옆면 사선 띠), lace?, collar?(발목 패드 색), }
import { mkCanvas } from './util.js';

const N = 32;
const OUTLINE = '#0b0b0b';

// ── 색 계산
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
// 명암 단계: +2 아주 밝게 … -2 아주 어둡게 (어두운 색은 밝게, 밝은 색은 어둡게 할 때 차이가 더 잘 보이도록)
function tone(c, k) {
  if (!k) return c;
  const lum = rgb(c).reduce((s, v) => s + v, 0) / 765;
  if (k > 0) return mix(c, '#ffffff', (k === 1 ? 0.22 : 0.48) + (lum < 0.2 ? 0.12 : 0));
  return mix(c, '#000000', (k === -1 ? 0.22 : 0.42) + (lum > 0.8 ? 0.06 : 0));
}

// ── 도트 글꼴 (높이 5, 글자마다 폭이 다름)
const FONT = {
  A: ['010', '101', '111', '101', '101'], E: ['111', '100', '110', '100', '111'], I: ['1', '1', '1', '1', '1'], U: ['101', '101', '101', '101', '111'],
  L: ['100', '100', '100', '100', '111'], N: ['1001', '1101', '1011', '1001', '1001'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], V: ['101', '101', '101', '101', '010'],
  W: ['10001', '10001', '10101', '10101', '01010'], G: ['011', '100', '101', '101', '011'], P: ['110', '101', '110', '100', '100'],
  C: ['011', '100', '100', '100', '011'], O: ['010', '101', '101', '101', '010'], B: ['110', '101', '110', '101', '110'],
  X: ['101', '101', '010', '101', '101'], F: ['111', '100', '110', '100', '100'],
  D: ['110', '101', '101', '101', '110'], Y: ['101', '101', '010', '010', '010'],
};

function grid() {
  const px = new Array(N * N).fill(null);
  return {
    get: (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? null : px[y * N + x]),
    set: (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c; },
    px,
  };
}
// 빈 칸 중 그림에 닿은 칸을 외곽선으로
function outline(G) {
  const add = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (G.get(x, y)) continue;
    if (G.get(x - 1, y) || G.get(x + 1, y) || G.get(x, y - 1) || G.get(x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) G.set(x, y, OUTLINE);
}
// 원단 질감: 지금까지 칠한 칸(= 몸판 · 소매, 목둘레 · 프린트를 그리기 전)에 무늬를 얹는다
//   washed: 빛바랜 얼룩 (밝은 점 · 어두운 점을 듬성듬성) / mesh: 2칸 간격 구멍 격자
function fabric(G, kind) {
  if (!kind) return;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = G.get(x, y);
    if (!c) continue;
    if (kind === 'mesh' && x % 2 === 0 && y % 2 === 1) G.set(x, y, mix(c, '#000000', 0.35));
    if (kind === 'washed') {
      if ((x * 3 + y * 5) % 7 === 0 && (x + y) % 3 !== 0) G.set(x, y, mix(c, '#ffffff', 0.1));
      else if ((x * 5 + y * 2) % 11 === 0) G.set(x, y, mix(c, '#000000', 0.12));
    }
  }
}

// 글자 (줄마다 가운데 정렬). shadow 색이 있으면 오른쪽 아래로 1칸 그림자를 먼저 깐다
function text(G, lines, cx, y0, color, shadow) {
  const dots = [];
  lines.forEach((line, li) => {
    const glyphs = [...line].map((ch) => FONT[ch] || ['000', '000', '000', '000', '000']);
    let x = Math.round(cx - (glyphs.reduce((w, g) => w + g[0].length + 1, 0) - 1) / 2);
    for (const g of glyphs) {
      g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '1') dots.push([x + rx, y0 + li * 6 + ry]); }));
      x += g[0].length + 1;
    }
  });
  if (shadow) for (const [x, y] of dots) G.set(x + 1, y + 1, shadow);
  for (const [x, y] of dots) G.set(x, y, color);
}

// ── 글러브 (손등이 보이게 세운 모습: 위 = 주먹, 오른쪽 = 엄지, 아래 = 손목)
function glove(a) {
  const G = grid();
  const inE = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const fist = (x, y) => inE(x, y, 14.5, 11, 10.5, 9.2);
  const hand = (x, y) => x >= 6 && x <= 22 && y >= 12 && y <= 21;
  const thumb = (x, y) => x >= 20 && inE(x, y, 23.4, 15.2, 4.3, 6.3);
  const body = (x, y) => fist(x, y) || hand(x, y);
  // 빛은 왼쪽 위 앞에서: 면의 방향(n)과 빛 방향의 내적으로 밝기 단계
  const shade = (dx, dy) => { const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)); const v = -0.45 * dx - 0.55 * dy + 0.7 * nz; return v > 0.93 ? 2 : v > 0.72 ? 1 : v > 0.2 ? 0 : v > -0.3 ? -1 : -2; };
  const accent = (x, y) => a.accent && x + y * 0.62 > 23.5; // 투톤: 오른쪽 아래가 두 번째 색
  const colorAt = (x, y) => (accent(x, y) ? a.accent : a.body);

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let k;
    if (thumb(x, y)) k = shade((x + 0.5 - 23.4) / 4.3, (y + 0.5 - 15.2) / 6.3);
    else if (fist(x, y)) k = shade((x + 0.5 - 14.5) / 10.5, (y + 0.5 - 11) / 9.2);
    else if (hand(x, y)) k = shade((x + 0.5 - 14.5) / 9, 0.3);
    else continue;
    G.set(x, y, tone(colorAt(x, y), k));
  }
  // 엄지와 손등 사이 박음질 선
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (thumb(x, y) && !thumb(x - 1, y) && body(x - 1, y)) G.set(x, y, tone(colorAt(x, y), -2));
  }
  // 주먹 패드와 손등 사이 주름
  for (let x = 7; x <= 19; x++) {
    const y = Math.round(13.4 - 0.045 * (x - 13.5) ** 2);
    if (body(x, y) && !thumb(x, y)) G.set(x, y, tone(colorAt(x, y), -1));
  }

  // 손목 (커프)
  const cuffTop = 21, cuffBot = 30;
  for (let y = cuffTop; y <= cuffBot; y++) {
    const x0 = y === cuffBot ? 9 : 8, x1 = y === cuffBot ? 20 : 21;
    for (let x = x0; x <= x1; x++) {
      let k = x <= 9 ? 1 : x >= 20 ? -1 : 0;
      if (y === cuffBot) k = -1;
      G.set(x, y, tone(a.cuff, k));
    }
  }
  // 손등과 손목 사이 파이핑
  for (let x = 7; x <= 22; x++) G.set(x, cuffTop, tone(a.piping, x <= 8 ? 1 : x >= 21 ? -1 : 0));

  if (a.closure === 'lace') {
    // 끈 구멍 + 교차하는 끈 + 위쪽 매듭
    for (const y of [23, 25, 27, 29]) { G.set(12, y, tone(a.cuff, -2)); G.set(17, y, tone(a.cuff, -2)); }
    for (let y = 22; y <= 29; y++) {
      const odd = (y - 22) % 2 === 1;
      if (y === 22) for (let x = 13; x <= 16; x++) G.set(x, y, a.lace);
      else if (odd) { G.set(13, y, a.lace); G.set(16, y, a.lace); }
      else { G.set(14, y, a.lace); G.set(15, y, a.lace); }
    }
    // 매듭: 가운데 묶음 + 양쪽 고리
    for (const [x, y] of [[14, 21], [15, 21], [13, 20], [12, 19], [12, 20], [16, 20], [17, 19], [17, 20], [11, 20], [18, 20]]) G.set(x, y, a.lace);
  } else {
    // 벨크로 스트랩 (손목보다 조금 넓고, 오른쪽에 당기는 탭)
    const s = a.strap || a.cuff;
    for (let y = 24; y <= 28; y++) for (let x = 7; x <= 22; x++) {
      const k = y === 24 ? 1 : y === 28 ? -1 : x >= 21 ? -1 : 0;
      G.set(x, y, tone(s, k));
    }
    for (let x = 8; x <= 21; x += 2) { G.set(x, 25, tone(s, -1)); G.set(x + 1, 27, tone(s, -1)); } // 박음질
    for (let y = 25; y <= 27; y++) G.set(23, y, tone(s, -1));
  }
  // 손등 가운데 작은 로고 패치 (수놓은 로고 느낌)
  if (a.label) {
    for (let y = 15; y <= 17; y++) for (let x = 10; x <= 18; x++) G.set(x, y, (y === 15 || y === 17) && (x === 10 || x === 18) ? tone(colorAt(x, y), 0) : a.label);
    for (const x of [11, 12, 14, 16, 17]) G.set(x, 16, tone(a.body, -1));
  }
  // 손등 로고 글자
  if (a.text) {
    const h = a.text.length * 6 - 1;
    text(G, a.text, 14.5, Math.round(10.5 - h / 2), a.textColor || '#ffffff', tone(colorAt(14, 10), -2));
  }
  outline(G);
  return G;
}

// ── 트렁크 (앞모습)
function trunks(a) {
  const G = grid();
  const bandTop = 5, bandBot = 10, bot = a.boxy ? 29 : 27;
  for (let y = bandTop; y <= bandBot; y++) {
    const x0 = y === bandTop ? 5 : 4, x1 = y === bandTop ? 26 : 27;
    for (let x = x0; x <= x1; x++) G.set(x, y, tone(a.band, y === bandTop ? 1 : y === bandBot ? -1 : x <= 5 ? 1 : x >= 26 ? -1 : 0));
  }
  for (let y = bandBot + 1; y <= bot; y++) {
    const grow = a.boxy ? 1 + Math.floor((y - bandBot) / 9) : Math.floor((y - bandBot) / 7);
    const x0 = 4 - grow, x1 = 27 + grow;
    const gap = a.boxy ? (y >= 22 ? Math.floor((y - 21) * 0.4) : -1) : y >= 19 ? Math.floor((y - 18) * 0.6) : -1; // 다리 사이 (박스핏은 늦게 · 좁게)
    for (let x = x0; x <= x1; x++) {
      if (gap >= 0 && x >= 15 - gap && x <= 16 + gap) continue;
      const slit = y - (bot - 4); // 옆트임: 밑단 바깥쪽을 아래로 갈수록 넓게 파냄
      if (a.split && slit > 0 && (x - x0 < slit || x1 - x < slit)) continue;
      const dx = (x + 0.5 - 16) / (x1 - x0 + 2) * 2;
      let k = dx < -0.75 ? 1 : dx > 0.8 ? -2 : dx > 0.5 ? -1 : 0;
      if (gap >= 0 && (x === 14 - gap || x === 17 + gap)) k = -1; // 다리 안쪽 그늘
      if (y < 19 && (x === 15 || x === 16)) k = -1;                // 가운데 주름
      let c = a.body;
      if (a.stripe && (x === x0 + 2 || x === x0 + 3 || x === x1 - 2 || x === x1 - 3)) c = a.stripe; // 옆선
      if (a.hem && y >= bot - 1) c = a.hem; // 밑단
      G.set(x, y, tone(c, k));
    }
  }
  // 대조색 V자 하단 패널 (메쉬 쇼츠)
  if (a.vPanel) {
    for (let y = 16; y <= bot; y++) for (let x = 4; x <= 27; x++) {
      if (G.get(x, y) && y >= 16 + Math.abs(x - 15.5) * 0.55) G.set(x, y, tone(a.vPanel, x < 10 ? 1 : x > 22 ? -1 : 0));
    }
  }
  // 허리 밴드 가운데 로고 패치 (색 띠 위에 흰 글자 느낌)
  if (a.bandText) {
    for (let y = 6; y <= 9; y++) for (let x = 8; x <= 23; x++) G.set(x, y, (y === 6 || y === 9) && (x === 8 || x === 23) ? tone(a.band, 0) : a.bandText);
    for (let x = 10; x <= 21; x++) if ((x - 10) % 3 !== 2) G.set(x, 7 + ((x - 10) % 3 === 1 ? 1 : 0), tone(a.band, 1));
  }
  // 끈 매듭
  for (const [x, y] of [[15, 11], [16, 11], [14, 12], [17, 12]]) G.set(x, y, tone(a.band, -1));
  outline(G);
  return G;
}

// ── 티셔츠 (앞모습: 반팔, 둥근 목, 가슴 프린트)
function shirt(a) {
  if (a.bare) return torso();
  if (a.sleeveless) return tank(a);
  const G = grid();
  const collar = a.collar || tone(a.body, 1);
  for (let y = 4; y <= 30; y++) {
    // 몸통 (어깨에서 살짝 좁아졌다가 내려감)
    const x0 = y <= 5 ? 6 : 4, x1 = y <= 5 ? 25 : 27;
    for (let x = x0; x <= x1; x++) {
      const k = x <= 5 ? 1 : x >= 26 ? -1 : y === 30 ? -1 : 0;
      G.set(x, y, tone(a.body, k));
    }
    // 소매 (아래로 비스듬히)
    if (y >= 5 && y <= 13) {
      const w = y === 5 ? 1 : y === 6 ? 2 : 3, hem = y >= 12;
      for (let i = 1; i <= w; i++) { G.set(x0 - i, y, tone(a.body, hem ? -1 : 0)); G.set(x1 + i, y, tone(a.body, hem ? -2 : -1)); }
    }
  }
  // 겨드랑이 주름
  for (let y = 12; y <= 14; y++) { G.set(4, y, tone(a.body, -1)); G.set(27, y, tone(a.body, -2)); }
  fabric(G, a.fabric);
  // 둥근 목: 안쪽(뒤판)은 어둡게, 테두리는 립 색
  for (let x = 12; x <= 19; x++) G.set(x, 4, tone(a.body, -2));
  for (let x = 13; x <= 18; x++) G.set(x, 5, tone(a.body, -2));
  for (const [x, y] of [[11, 4], [12, 5], [13, 6], [14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [19, 5], [20, 4], [11, 3], [20, 3]]) G.set(x, y, collar);
  for (let x = 12; x <= 19; x++) G.set(x, 3, null);
  // 가슴 프린트
  if (a.text) text(G, a.text, 15.5, 7, a.print || '#ffffff', null);
  outline(G);
  return G;
}

// ── 상의 탈의: 단련된 맨몸 (넓은 어깨 → 좁은 허리 V자, 가슴 · 식스팩 · 옆구리 사선). 빛은 왼쪽 위에서
const SKIN = '#e8b088';
function torso() {
  const G = grid();
  const span = (y) => (y <= 3 ? [13, 18] : y === 4 ? [12, 19] : y === 5 ? [7, 24] : y === 6 ? [4, 27] : y <= 12 ? [3, 28] : [3 + Math.round((y - 12) * 0.3), 28 - Math.round((y - 12) * 0.3)]);
  for (let y = 1; y <= 30; y++) {
    const [x0, x1] = span(y);
    for (let x = x0; x <= x1; x++) G.set(x, y, tone(SKIN, x <= x0 + 1 ? 1 : x >= x1 - 1 ? -1 : 0));
  }
  const S = (x, y, k) => G.get(x, y) && G.set(x, y, tone(SKIN, k));
  for (let x = 13; x <= 18; x++) S(x, 4, -1);                               // 턱 밑 그늘
  for (const [x, y] of [[8, 6], [9, 6], [10, 7], [11, 7], [12, 7], [23, 6], [22, 6], [21, 7], [20, 7], [19, 7]]) S(x, y, -1); // 쇄골
  for (let y = 4; y <= 6; y++) { S(4 + (6 - y) * 2, y + 1, 1); S(5 + (6 - y) * 2, y + 1, 1); } // 왼쪽 어깨 빛
  // 가슴: 아랫선은 둥글게 처지고, 윗면은 밝게
  for (const [cx, sgn] of [[10, 1], [21, -1]]) {
    for (let dx = -5; dx <= 5; dx++) {
      const x = cx + dx, y = 13 + (Math.abs(dx) >= 4 ? -1 : 0) + (Math.abs(dx) === 5 ? -1 : 0);
      S(x, y, -2); S(x, y + 1, -1);
      if (Math.abs(dx) <= 3 && sgn > 0) { S(x, 9, 1); S(x, 10, 1); }
      if (Math.abs(dx) <= 2 && sgn < 0) S(x, 9, 1);
    }
  }
  for (let y = 8; y <= 28; y++) { S(15, y, -1); S(16, y, y > 15 ? -2 : -1); } // 가슴 · 배 가운데 골
  // 식스팩: 가로 마디 3줄, 덩어리마다 왼쪽 위 1칸 빛
  for (const y of [18, 22, 26]) for (let x = 11; x <= 20; x++) if (x !== 15 && x !== 16) S(x, y, -2);
  for (const y of [16, 20, 24]) for (const x of [12, 18]) { S(x, y, 1); S(x + 1, y, 1); }
  for (let y = 16; y <= 27; y++) { S(10, y, -1); S(21, y, -2); }               // 복근 바깥선
  // 옆구리 사선 (V라인이 허리 밴드 쪽으로 모임)
  for (let i = 0; i <= 6; i++) { S(7 + Math.round(i * 0.5), 24 + i, -1); S(24 - Math.round(i * 0.5), 24 + i, -2); }
  outline(G);
  return G;
}

// ── 탱크탑 (소매 없음). cut: tank(기본: 가는 끈 · 깊게 파인 목) | muscle(굵은 어깨 · 깊은 진동) | racer(가운데로 모인 끈)
//    crop: 배꼽 위에서 끝나는 기장 + 밑단 고무 밴드
const TANK = {
  tank: { straps: [10, 11, 20, 21], top: 7, span: (y) => (y === 7 ? [9, 22] : y === 8 ? [8, 23] : [7, 24]) },
  muscle: { straps: [10, 11, 12, 13, 18, 19, 20, 21], top: 7, span: (y) => (y < 14 ? [10, 21] : y === 14 ? [8, 23] : [7, 24]) },
  racer: { straps: [12, 13, 18, 19], top: 8, span: (y) => (y === 8 ? [11, 20] : y === 9 ? [10, 21] : y === 10 ? [9, 22] : [8, 23]) },
};
function tank(a) {
  const G = grid();
  const trim = a.collar || tone(a.body, 1);
  const S = TANK[a.cut] || TANK.tank, bot = a.crop ? 21 : 30;
  for (let y = S.top; y <= bot; y++) {
    const [x0, x1] = S.span(y); // 진동둘레 곡선
    for (let x = x0; x <= x1; x++) G.set(x, y, tone(a.body, x <= x0 + 1 ? 1 : x >= x1 - 1 ? -1 : y === bot ? -1 : 0));
  }
  const half = S.straps.length / 2;
  for (let y = 3; y < S.top; y++) S.straps.forEach((x, i) => G.set(x, y, tone(a.body, i === 0 || i === half ? 1 : 0))); // 어깨끈
  fabric(G, a.fabric);
  if (S === TANK.tank) {
    // 목선: 끈 사이를 깊게 파고 테두리
    for (let y = 7; y <= 10; y++) for (let x = 12 + Math.max(0, y - 8); x <= 19 - Math.max(0, y - 8); x++) G.set(x, y, null);
    for (const [x, y] of [[12, 8], [13, 9], [14, 10], [15, 11], [16, 11], [17, 10], [18, 9], [19, 8], [12, 7], [19, 7]]) G.set(x, y, trim);
    for (const [x, y] of [[9, 7], [8, 8], [22, 7], [23, 8]]) G.set(x, y, trim); // 진동둘레 테두리
  } else {
    // 얕은 둥근 목: 안쪽 끈 사이만 두 줄 파고 테두리
    const l = S.straps[half - 1] + 1, r = S.straps[half] - 1;
    for (let x = l; x <= r; x++) G.set(x, S.top, null);
    for (let x = l + 1; x <= r - 1; x++) G.set(x, S.top + 1, null);
    G.set(l, S.top + 1, trim); G.set(r, S.top + 1, trim);
    for (let x = l + 1; x <= r - 1; x++) G.set(x, S.top + 2, trim);
  }
  if (a.crop) { const [x0, x1] = S.span(bot); for (let x = x0; x <= x1; x++) { G.set(x, bot - 1, trim); G.set(x, bot, tone(trim, -1)); } }
  if (a.text) text(G, a.text, 15.5, a.crop ? 12 : 15, a.print || '#ffffff', null);
  outline(G);
  return G;
}

// ── 복싱화 (옆모습: 왼쪽 = 뒤꿈치, 오른쪽 = 발끝). height: low(발목 아래) · mid · high(종아리까지 올라오는 복싱 부츠)
function shoe(a) {
  const G = grid();
  const top = { low: 15, mid: 10, high: 5 }[a.height] ?? 10;
  const front = (y) => (y < 18 ? 16 : y === 18 ? 19 : y === 19 ? 22 : y === 20 ? 25 : y === 21 ? 26 : 27); // 발등 → 발끝 경사
  const back = (y) => (y < 22 ? 7 : 6);
  const slope = 7 / (20 - top); // 옆면 사선 띠: 뒤꿈치 아래 → 발목 앞 위
  for (let y = top; y <= 24; y++) for (let x = back(y); x <= front(y); x++) {
    const k = x <= back(y) + 1 ? 1 : y === 24 ? -1 : y >= 21 && x >= front(y) - 1 ? -1 : 0;
    const band = a.accent && y > top + 1 && y <= 23 && Math.abs(x - 8 - (23 - y) * slope) <= 1;
    G.set(x, y, tone(band ? a.accent : a.body, k));
  }
  // 발목 패드 (맨 윗줄)
  for (let x = back(top); x <= front(top); x++) G.set(x, top, tone(a.collar || a.body, 1));
  // 끈: 발등 앞쪽을 따라 두 칸씩
  for (let y = top + 2; y <= 20; y += 2) { const x = front(y) - 2; G.set(x, y, a.lace || '#f2f2f2'); G.set(x - 1, y, a.lace || '#f2f2f2'); }
  // 밑창 (얇은 고무창, 발끝은 둥글게)
  for (let y = 25; y <= 27; y++) {
    const x0 = y === 27 ? 6 : 5, x1 = y === 26 ? 28 : 27;
    for (let x = x0; x <= x1; x++) G.set(x, y, tone(a.sole, y === 25 ? 1 : y === 27 ? -1 : 0));
  }
  // 낮은 신발은 위가 비어 보여서, 그림을 칸 세로 가운데로 올린다 (발목 높이만큼의 절반)
  const up = Math.floor((top - 5) / 2);
  if (up) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) G.set(x, y, y + up < N ? G.get(x, y + up) : null);
  outline(G);
  return G;
}

const cache = new Map(), canvases = new Map();
// art 설정 → 32×32 캔버스 (figure.js 가 정면 전신에 그대로 입힌다)
export function gearArtCanvas(art) {
  const key = JSON.stringify(art);
  if (canvases.has(key)) return canvases.get(key);
  const G = art.type === 'trunks' ? trunks(art) : art.type === 'shirt' ? shirt(art) : art.type === 'shoe' ? shoe(art) : glove(art);
  const cv = mkCanvas(N, N), g = cv.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = G.get(x, y); if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
  canvases.set(key, cv);
  return cv;
}
// art 설정 → 그림 주소 (scale 배 확대)
export function gearArtURL(art, scale = 1) {
  const key = `${scale}|${JSON.stringify(art)}`;
  if (cache.has(key)) return cache.get(key);
  const cv = gearArtCanvas(art);
  let url;
  if (scale === 1) url = cv.toDataURL();
  else {
    const out = mkCanvas(N * scale, N * scale), o = out.getContext('2d');
    o.imageSmoothingEnabled = false; o.drawImage(cv, 0, 0, N * scale, N * scale);
    url = out.toDataURL();
  }
  cache.set(key, url);
  return url;
}
