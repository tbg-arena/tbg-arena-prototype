// 경기 캐릭터 꾸미기: 히트맨 시트(Sayleok 체험판, 102×67 칸)를 프레임마다 훑어 회원 장비대로 색 · 헤어 · 상의를 바꾼 시트를 만든다
// 시트는 11색뿐 — 색마다 역할이 정해져 있어 부위를 정확히 찾을 수 있다 (외곽선 없음, 가장 어두운 색 = 머리카락)
export const CW = 102, CH = 67;
const K = (r, g, b) => `${r},${g},${b}`;
const P = {
  hair: K(24, 21, 38), skinL: K(255, 206, 147), skinM: K(221, 133, 92), skinD: K(183, 79, 73),
  glove: K(181, 29, 56), gloveD: K(125, 27, 73), blue: K(34, 92, 153), navy: K(30, 35, 112),
  g1: K(185, 211, 214), g2: K(135, 160, 174), white: K(250, 239, 230),
};
const SKIN = new Set([P.skinL, P.skinM, P.skinD]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (c, t) => c.map((v) => Math.round(v * (1 - t))); // 그늘 색 = 본색을 어둡게

// kit = { gloves, trunks, shoes, top?, topKind?: 'tank' | 'bra', hair: 'spiky'|'buzz'|'bald'|'blond'|'mohawk'|'ponytail'|'bob'|'bun', hairColor?, tie? }
export function customize(sheetImg, kit) {
  const W = sheetImg.width, H = sheetImg.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(sheetImg, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  for (let cy = 0; cy < H / CH; cy++) for (let cx = 0; cx < W / CW; cx++) frame(d, W, cx * CW, cy * CH, kit);
  g.putImageData(id, 0, 0);
  return c;
}


function frame(d, W, ox, oy, kit) {
  const idx = (x, y) => ((oy + y) * W + ox + x) * 4;
  const col = (x, y) => { if (x < 0 || y < 0 || x >= CW || y >= CH) return null; const i = idx(x, y); return d[i + 3] ? K(d[i], d[i + 1], d[i + 2]) : null; };
  const put = (x, y, rgb) => { if (x < 0 || y < 0 || x >= CW || y >= CH) return; const i = idx(x, y); if (!rgb) { d[i + 3] = 0; return; } d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; };
  // 칸 안 그림 범위 · 머리카락 칸
  let bottom = -1; const hair = [];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const k = col(x, y); if (!k) continue; bottom = y; if (k === P.hair) hair.push([x, y]); }
  if (bottom < 0) return; // 빈 칸
  const shoeTop = bottom - 9;                              // 맨 아래 9줄 = 신발 (트렁크와 같은 파랑을 씀)
  // 1) 글러브 · 트렁크 · 신발 색
  const G = hex(kit.gloves), T = hex(kit.trunks), S = hex(kit.shoes);
  let tTop = 1e9, tx0 = 1e9, tx1 = -1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const k = col(x, y);
    if (k === P.glove) put(x, y, G); else if (k === P.gloveD) put(x, y, shade(G, 0.4));
    else if (k === P.blue || k === P.navy) {
      const dark = k === P.navy;
      if (y >= shoeTop) put(x, y, dark ? shade(S, 0.35) : S);
      else { put(x, y, dark ? shade(T, 0.35) : T); if (y < tTop) tTop = y; }
    }
  }
  for (let x = 0; x < CW; x++) for (let y = tTop; y <= tTop + 2; y++) { const k = col(x, y); if (k && !SKIN.has(k) && k !== P.hair) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; } }
  // 2) 상의: 트렁크 바로 위 몸통 피부 (탱크 = 7줄, 스포츠 브라 = 위쪽 3줄만 — 배가 보임, 반팔 티 = 턱 아래부터 + 소매)
  if (kit.top && tTop < 1e9) {
    const Tp = hex(kit.top), TpD = shade(Tp, 0.35), tee = kit.topKind === 'tee';
    const paint = (x, y) => { const k = col(x, y); if (k === P.skinL || k === P.skinM) { put(x, y, Tp); return true; } if (k === P.skinD) { put(x, y, TpD); return true; } return false; };
    // 몸통 = 트렁크 폭보다 양쪽 1칸 안쪽 (이 자세는 앞팔이 몸통 앞을 지나서, 넓게 칠하면 팔까지 칠해져 긴소매처럼 보임)
    // 어깨는 머리카락 바로 아래부터 (펀치 때 어깨가 턱 높이까지 올라옴). 단 머리 가운데보다 앞쪽(오른쪽) 몇 줄은 얼굴 · 턱이라 비움
    const hy1 = hair.length ? Math.max(...hair.map((q) => q[1])) : tTop - 12, hcx = hair.length ? Math.round((Math.min(...hair.map((q) => q[0])) + Math.max(...hair.map((q) => q[0]))) / 2) : 1e9;
    const chin = hy1 + 1;
    const y0 = tee ? Math.min(chin, tTop - 7) : tTop - 7, y1 = kit.topKind === 'bra' ? tTop - 5 : tTop - 1;
    const done = [];
    // 윗가슴 줄(반팔 티만)은 앞쪽으로 넓게: 펀치 때 몸이 앞(오른쪽)으로 기울어 윗가슴 · 어깨가 트렁크 폭보다 앞으로 나감
    for (let y = y0; y <= y1; y++) { const upper = tee && y < tTop - 7; for (let x = upper ? tx0 - 1 : tx0 + 1; x <= (upper ? Math.min(tx1 + 6, y <= hy1 + 3 ? hcx - 1 : hcx + 2) : tx1 - 1); x++) if (paint(x, y)) done.push([x, y]); }
    // 소매: 어깨(몸통 맨 위 4줄)에서 이어진 피부를 3칸까지만 — 어깨에 붙은 위팔만 소매, 몸 앞을 지나는 아래팔 · 주먹 쪽은 맨살
    if (tee) {
      const seen = new Set(done.map(([x, y]) => x + ',' + y));
      let front = done.filter(([, y]) => y <= y0 + 3);
      for (let step = 0; step < 3; step++) {
        const next = [];
        for (const [x, y] of front) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
          if (ny < y0 || seen.has(key)) continue; // 어깨선 위(목 · 얼굴)로는 안 번짐
          seen.add(key);
          if (paint(nx, ny)) next.push([nx, ny]);
        }
        front = next;
      }
    }
  }
  // 3) 헤어: 원래 머리카락 칸이 머리 위치. 오른쪽을 보므로 왼쪽이 뒤통수
  if (!hair.length) return;
  const set = new Set(hair.map(([x, y]) => x + ',' + y)), has = (x, y) => set.has(x + ',' + y);
  let hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
  for (const [x, y] of hair) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y; }
  const hcx = Math.round((hx0 + hx1) / 2);
  const HC = hex(kit.hairColor || '#1f1a26'), HD = shade(HC, 0.35);
  // 깎은 머리 = 가장자리 1칸 깎기 (삐죽한 끝이 사라져 둥근 머리)
  const cap = hair.filter(([x, y]) => has(x - 1, y) && has(x + 1, y) && has(x, y - 1) && (has(x, y + 1) || col(x, y + 1)));
  const style = kit.hair || 'spiky';
  const draw = (pts, rgb) => pts.forEach(([x, y]) => put(x, y, rgb));
  if (style === 'spiky') draw(hair, HC);
  else if (style === 'blond') { draw(hair, [222, 184, 88]); draw(hair.filter(([x, y]) => !has(x, y - 1)), [246, 222, 140]); }
  else {
    draw(hair.filter(([x, y]) => !cap.some(([a, b]) => a === x && b === y)), null); // 깎이는 가장자리 지우기
    if (style === 'buzz') { draw(cap, HC); cap.filter(([x, y]) => (x + y) % 3 === 0).forEach(([x, y]) => put(x, y, HD)); }
    else if (style === 'bald') { draw(cap, hex('#ffce93')); draw(cap.filter(([x]) => x <= hx0 + 2), hex('#dd855c')); const top = cap.reduce((a, b) => (b[1] < a[1] ? b : a)); put(top[0] + 1, top[1] + 1, hex('#fff1e2')); }
    else if (style === 'mohawk') {
      draw(cap, hex('#5a4a44'));                                              // 민 옆머리 (짧은 털 색)
      for (let y = hy0 - 3; y <= hy1 - 1; y++) for (let x = hcx - 1; x <= hcx + 1; x++) if (y < hy0 || has(x, y)) put(x, y, HC); // 가운데 능선
      put(hcx, hy0 - 4, HC); put(hcx - 2, hy0 - 1, HC); put(hcx + 2, hy0 - 2, HC);
    } else {
      // 여자 헤어: 깎은 둥근 머리 + 뒤쪽 덧붙임
      draw(cap, HC); cap.filter(([x, y]) => y === hy0 + 1 && x % 2).forEach(([x, y]) => put(x, y, HC.map((v) => Math.min(255, v + 40)))); // 윤기 점
      const tie = hex(kit.tie || '#e23d6b');
      if (style === 'ponytail') {
        const tail = [[0, 2], [-1, 3], [-1, 4], [-2, 5], [-2, 6], [-2, 7], [-2, 8], [-1, 9]];
        for (const [dx, dy] of tail) { put(hx0 + dx, hy0 + dy, HC); put(hx0 + dx - 1, hy0 + dy, HD); }
        put(hx0, hy0 + 2, tie); put(hx0 + 1, hy0 + 2, tie);
      } else if (style === 'bob') {
        for (let y = hy1 - 1; y <= hy1 + 3; y++) for (let x = hx0 - 1; x <= hcx; x++) { const k = col(x, y); if (!k || SKIN.has(k) || k === P.hair) put(x, y, x <= hx0 ? HD : HC); }
      } else if (style === 'bun') {
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) put(hx0 + 2 + x, hy0 - 2 + y, y > 0 ? HD : HC);
        put(hx0 + 1, hy0, tie); put(hx0 + 2, hy0, tie); put(hx0 + 3, hy0, tie);
      }
    }
  }
}

// 회원 장비(look) → 꾸미기 설정. look.gear = 서버 lookFor (arts: 부위별 상점 그림 설정, hairArt: 헤어 그림 이름)
// 상의: 민소매 = 탱크탑, 크롭 · 레이서 = 스포츠 브라, 그 밖(반팔 티) = 반팔 (어깨에서 이어진 위팔만 소매)
const HAIR_OF = { spiky: ['spiky'], buzz: ['buzz'], bald: ['bald'], 'blond-buzz': ['buzz', '#d9ae49'], mohawk: ['mohawk'],
  bob: ['bob'], ponytail: ['ponytail'], bun: ['bun'], bandana: ['bob'], 'bandana-m': ['buzz'], long: ['bob'], cornrow: ['buzz'] }; // 두건 · 콘로우: 경기 캐릭터엔 그 그림이 없어 두피에 붙은 짧은 머리(buzz)로, 여자 두건만 단발로
export function kitFromLook(look) {
  const a = look.gear?.arts || {}, F = look.gender === 'F';
  const [hair, hc] = HAIR_OF[look.gear?.hairArt || (F ? 'bob' : 'spiky')] || [F ? 'bob' : 'spiky'];
  const s = a.shirt;
  return {
    gloves: a.gloves?.body || '#ececec', trunks: a.trunks?.body || '#1b2a63', shoes: a.shoes?.body || '#2a2a2a',
    hair, hairColor: hc || (F ? '#4a2f24' : '#1f1a26'),
    top: s?.body, topKind: !s ? null : s.crop || s.cut === 'racer' ? 'bra' : s.sleeveless ? 'tank' : 'tee',
  };
}
