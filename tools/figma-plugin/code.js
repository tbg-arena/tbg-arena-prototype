/* TBG ARENA 시안 생성기 — Figma 플러그인 본체
 *
 * HEX 팔레트(줄당 1개 시안)를 받아 → 역할(배경·글자·메인·포인트·완료·상대 코너·보조선)로 나누고
 * → 대표 화면 5개(홈 · 필살기 · 콜아웃 · 랭킹 · 커리어)를 시안별로 그린다.
 *
 * 지금 앱의 디자인 언어는 그대로: 블랙 베이스 · 2px 각진 모서리 · 하드 섀도(번짐 0) · 도트 서체 숫자 ·
 * 섹션 제목 앞 네모 · 칸 나뉜 능력치 막대. 색은 Figma 변수(모드 = 시안)에 묶어서 모드만 바꾸면 시안이 바뀐다.
 */
figma.showUI(__html__, { width: 380, height: 660, themeColors: true });

// ─────────────────────────── 색 계산
function hexToRgb(hex) {
  hex = String(hex).replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
function rgbToHex(c) {
  const h = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return ('#' + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
}
function lum(hex) {
  const c = hexToRgb(hex);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}
// 배경 위 글자로 쓸 때 대비가 모자라면 글자색 쪽으로 조금씩 밝힌다 (원래 색감은 최대한 유지)
function lift(color, bg, target, toward) {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(color, toward, t);
    if (contrast(c, bg) >= target) return c;
  }
  return toward;
}
const onColor = (fill, light, dark) => (contrast(fill, light) >= contrast(fill, dark) ? light : dark);
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA 큰 글자' : '면·장식 전용');

// 시안 하나 = 사용자가 고른 역할 + 거기서 계산한 구조 색
function buildTheme(input) {
  const r = input.roles;
  const bg = r.bg;
  const ink = r.ink || '#EDEDED';
  const c = { bg, ink };
  c.surface = mix(bg, ink, 0.045);
  c.surface2 = mix(bg, ink, 0.1);
  c.line = mix(bg, ink, 0.14);
  c.line2 = r.sub ? r.sub : mix(bg, ink, 0.3);
  c.muted = lift(mix(bg, ink, 0.55), bg, 4.6, ink);
  c.main = r.main || '#B11226';
  c.mainDeep = mix(c.main, '#000000', 0.5);
  c.point = r.point || ink;
  c.corner = r.corner || c.line2;
  c.done = r.done || r.corner || ink;
  for (const k of ['main', 'point', 'done', 'corner']) {
    c[k + 'Text'] = lift(c[k], bg, 4.5, ink);
    c['on' + k[0].toUpperCase() + k.slice(1)] = onColor(c[k], ink, '#111111');
  }
  // 배경과 거의 같은 색(예: 네이비)은 테두리로 모양을 잡아 준다
  c.doneEdge = contrast(c.done, bg) < 1.8 ? lift(c.done, bg, 3, ink) : c.done;
  c.cornerEdge = contrast(c.corner, bg) < 1.8 ? lift(c.corner, bg, 3, ink) : c.corner;
  c.dark = '#0D0D0D';
  c.skin = mix(ink, c.point, 0.28);
  // 버튼 · 안내 배너 · 선택 강조 색
  //  차분(기본): 빨강을 쓰지 않음 — 버튼은 글자색 면 + 회색 하드 섀도, 배너는 카드 면 + 흰 테두리, 알림 숫자는 포인트
  //  강조: 이전 시안 — 버튼 · 배너 · 선택 그림자를 메인 빨강으로
  if (input.calm) {
    c.btn = ink; c.onBtn = bg; c.btnShadow = c.line2;
    c.selShadow = c.line2;
    c.alertFill = c.surface2; c.alertEdge = ink; c.onAlert = ink; c.onAlertSub = c.muted;
    c.dot = c.point; c.onDot = c.onPoint;
  } else {
    c.btn = c.main; c.onBtn = c.onMain; c.btnShadow = c.mainDeep;
    c.selShadow = c.main;
    c.alertFill = c.main; c.alertEdge = c.main; c.onAlert = c.onMain; c.onAlertSub = c.onMain;
    c.dot = c.main; c.onDot = c.onMain;
  }
  return { name: input.name, hexes: input.hexes, roles: r, calm: !!input.calm, c };
}

const VAR_ROLES = ['bg', 'surface', 'surface2', 'line', 'line2', 'ink', 'muted',
  'main', 'mainDeep', 'mainText', 'onMain', 'point', 'pointText', 'onPoint',
  'done', 'doneText', 'doneEdge', 'onDone', 'corner', 'cornerText', 'cornerEdge', 'onCorner',
  'btn', 'onBtn', 'btnShadow', 'selShadow', 'alertFill', 'alertEdge', 'onAlert', 'onAlertSub', 'dot', 'onDot'];

let CUR = null; // 지금 그리는 시안
const VARS = { on: false };

// ─────────────────────────── 변수 (모드 = 시안)
function setupVariables(themes, label) {
  const rgba = (hex) => Object.assign(hexToRgb(hex), { a: 1 });
  try {
    const col = figma.variables.createVariableCollection(label);
    try {
      col.renameMode(col.modes[0].modeId, themes[0].name);
      const modeIds = [col.modes[0].modeId];
      for (let i = 1; i < themes.length; i++) modeIds.push(col.addMode(themes[i].name));
      const vars = {};
      for (const role of VAR_ROLES) {
        const v = figma.variables.createVariable('color/' + role, col, 'COLOR');
        themes.forEach((t, i) => v.setValueForMode(modeIds[i], rgba(t.c[role])));
        vars[role] = v;
      }
      // 프레임에 모드 지정이 실제로 먹는지 먼저 확인 — 안 먹으면 모든 시안이 첫 번째 색으로 보인다
      if (themes.length > 1 && !modeSticks(col, modeIds[1])) throw new Error('explicit mode not applied');
      themes.forEach((t, i) => { t.vars = vars; t.col = col; t.modeId = modeIds[i]; });
      return '변수 1세트 · 모드 ' + themes.length + '개 (모드를 바꾸면 시안 전환)';
    } catch (e) {
      // 요금제 모드 개수 제한 · 모드 지정 실패 → 시안마다 컬렉션 하나씩 (모드 지정이 필요 없음)
      col.remove();
      for (const t of themes) {
        const c2 = figma.variables.createVariableCollection(label + ' / ' + t.name);
        const vars = {};
        for (const role of VAR_ROLES) {
          const v = figma.variables.createVariable('color/' + role, c2, 'COLOR');
          v.setValueForMode(c2.modes[0].modeId, rgba(t.c[role]));
          vars[role] = v;
        }
        t.vars = vars; t.col = null;
      }
      return '시안별 변수 컬렉션 ' + themes.length + '개 (모드 제한·지정 실패로 시안마다 따로)';
    }
  } catch (e) {
    return '변수 없이 색 직접 지정 (' + (e && e.message ? e.message : e) + ')';
  }
}

// role 이름이면 시안 색(변수 연결), '#' 로 시작하면 그 색 그대로
function P(role, opacity) {
  const raw = role[0] === '#';
  const hex = raw ? role : CUR.c[role];
  if (!hex) throw new Error('알 수 없는 색 역할: ' + role);
  let p = { type: 'SOLID', color: hexToRgb(hex), opacity: opacity == null ? 1 : opacity };
  if (!raw && VARS.on && CUR.vars && CUR.vars[role]) p = figma.variables.setBoundVariableForPaint(p, 'color', CUR.vars[role]);
  return p;
}
const hexOf = (role) => (role[0] === '#' ? role : CUR.c[role]);

// ─────────────────────────── 서체
const FONTS = {};
async function setupFonts() {
  const list = await figma.listAvailableFontsAsync();
  const byFam = {};
  for (const f of list) (byFam[f.fontName.family] = byFam[f.fontName.family] || []).push(f.fontName.style);
  const style = (fam, prefs) => {
    const s = byFam[fam];
    if (!s) return null;
    for (const p of prefs) if (s.indexOf(p) >= 0) return { family: fam, style: p };
    return null;
  };
  const UI = ['Pretendard', 'Pretendard Variable', 'Pretendard JP', 'Noto Sans KR', 'Spoqa Han Sans Neo', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Inter'];
  for (const fam of UI) {
    const r = style(fam, ['Regular', 'Medium']);
    const b = style(fam, ['Bold', 'SemiBold', 'Semibold']);
    if (r && b) {
      FONTS.r = r; FONTS.b = b;
      FONTS.h = style(fam, ['ExtraBold', 'Black', 'Heavy', 'Bold']) || b;
      FONTS.uiFamily = fam;
      break;
    }
  }
  if (!FONTS.r) { FONTS.r = { family: 'Inter', style: 'Regular' }; FONTS.b = { family: 'Inter', style: 'Bold' }; FONTS.h = FONTS.b; FONTS.uiFamily = 'Inter'; }
  // 도트 서체: 한글 되는 것 우선, 없으면 영문 도트 (한글 글자는 자동으로 본문 서체)
  const PX = [['Galmuri11', true, 1], ['Galmuri9', true, 1], ['DungGeunMo', true, 1], ['NeoDunggeunmo', true, 1],
    ['Silkscreen', false, 0.9], ['VT323', false, 1.4], ['Press Start 2P', false, 0.7]];
  for (const [fam, ko, scale] of PX) {
    const s = style(fam, ['Bold', 'Regular']);
    if (s) { FONTS.px = s; FONTS.pxKo = ko; FONTS.pxScale = scale; FONTS.pxFamily = fam; break; }
  }
  if (!FONTS.px) { FONTS.px = FONTS.h; FONTS.pxKo = true; FONTS.pxScale = 1; FONTS.pxFamily = FONTS.uiFamily + ' (도트 서체 없음)'; }
  await Promise.all([FONTS.r, FONTS.b, FONTS.h, FONTS.px].map((f) => figma.loadFontAsync(f)));
}

// ─────────────────────────── 노드 도우미
const SIZE = new Map(); // 부모에 붙인 뒤 적용할 크기 규칙 (FILL 은 부모 안에서만 됨)
const JUST = { start: 'MIN', center: 'CENTER', end: 'MAX', between: 'SPACE_BETWEEN' };
const ALIGN = { start: 'MIN', center: 'CENTER', end: 'MAX', base: 'BASELINE' };

function add(parent, kids) {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}
function sizing(node, o) {
  const w = o.fillW || o.grow ? 'FILL' : null;
  const h = o.fillH ? 'FILL' : null;
  if (w || h) SIZE.set(node, { w, h });
}
// 위에서 아래로 FILL 적용 (부모가 먼저 넓이를 가져야 자식이 채울 수 있다)
function applySizing(node) {
  if (!('children' in node)) return;
  for (const k of node.children) {
    const s = SIZE.get(k);
    if (s) {
      try {
        if (s.w) k.layoutSizingHorizontal = s.w;
        if (s.h) k.layoutSizingVertical = s.h;
        if (k.type === 'TEXT' && s.w) k.textAutoResize = 'HEIGHT';
      } catch (e) { /* 자동 레이아웃 밖이면 무시 */ }
    }
    applySizing(k);
  }
}

function F(o, kids) {
  o = o || {};
  const f = figma.createFrame();
  f.name = o.name || 'frame';
  f.fills = o.fill ? [P(o.fill, o.fo)] : [];
  f.clipsContent = !!o.clip;
  f.layoutMode = o.dir === 'h' ? 'HORIZONTAL' : 'VERTICAL';
  f.itemSpacing = o.gap || 0;
  const p = o.p == null ? 0 : o.p;
  const pd = Array.isArray(p) ? (p.length === 2 ? [p[0], p[1], p[0], p[1]] : p) : [p, p, p, p];
  f.paddingTop = pd[0]; f.paddingRight = pd[1]; f.paddingBottom = pd[2]; f.paddingLeft = pd[3];
  f.primaryAxisAlignItems = JUST[o.justify || 'start'];
  f.counterAxisAlignItems = ALIGN[o.align || (o.dir === 'h' ? 'center' : 'start')];
  if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.cgap != null ? o.cgap : (o.gap || 0); }
  f.layoutSizingHorizontal = 'HUG';
  f.layoutSizingVertical = 'HUG';
  if (o.w) { f.resize(o.w, Math.max(1, f.height)); f.layoutSizingHorizontal = 'FIXED'; }
  if (o.h) { f.resize(f.width, o.h); f.layoutSizingVertical = 'FIXED'; }
  if (o.stroke) {
    f.strokes = [P(o.stroke)];
    f.strokeWeight = o.sw || 1;
    f.strokeAlign = 'INSIDE';
    if (o.dash) f.dashPattern = o.dash === 'dot' ? [1.5, 2.5] : [5, 3];
  }
  f.cornerRadius = o.r != null ? o.r : 2;
  if (o.shadow) {
    const s = o.so || 4;
    f.effects = [{ type: 'DROP_SHADOW', color: Object.assign(hexToRgb(hexOf(o.shadow)), { a: 1 }), offset: { x: s, y: s }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false }];
  }
  if (o.opacity != null) f.opacity = o.opacity;
  sizing(f, o);
  if (kids) add(f, kids);
  return f;
}

const HANGUL = /[ㄱ-힝]/;
function T(str, o) {
  o = o || {};
  str = String(str);
  const t = figma.createText();
  let px = !!o.px;
  if (px && !FONTS.pxKo && HANGUL.test(str)) px = false;
  t.fontName = px ? FONTS.px : FONTS[o.w || (o.px ? 'h' : 'r')];
  t.characters = str;
  t.fontSize = Math.round((o.size || 14) * (px ? FONTS.pxScale : 1));
  t.fills = [P(o.color || 'ink', o.opacity)];
  t.letterSpacing = { value: o.ls != null ? o.ls : (px ? 0 : -0.2), unit: 'PIXELS' };
  if (o.lh) t.lineHeight = { value: o.lh, unit: 'PERCENT' };
  if (o.align) t.textAlignHorizontal = o.align.toUpperCase();
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  t.name = o.name || str.slice(0, 24);
  sizing(t, o);
  return t;
}

function R(w, h, role, o) {
  o = o || {};
  const r = figma.createRectangle();
  r.resize(w || 1, h || 1);
  r.fills = role ? [P(role, o.fo)] : [];
  if (o.stroke) { r.strokes = [P(o.stroke)]; r.strokeWeight = 1; r.strokeAlign = 'INSIDE'; }
  r.cornerRadius = o.r || 0;
  r.name = o.name || 'rect';
  sizing(r, o);
  return r;
}

function border(f, role, side) {
  f.strokes = [P(role)];
  f.strokeAlign = 'INSIDE';
  f.strokeTopWeight = side === 'top' ? 1 : 0;
  f.strokeBottomWeight = side === 'bottom' ? 1 : 0;
  f.strokeLeftWeight = side === 'left' ? 1 : 0;
  f.strokeRightWeight = 0;
  return f;
}
function absolute(parent, child, x, y) {
  parent.appendChild(child);
  child.layoutPositioning = 'ABSOLUTE';
  child.x = x; child.y = y;
  return child;
}
const col = (o, kids) => F(Object.assign({ gap: 2 }, o), kids);
const row = (o, kids) => F(Object.assign({ dir: 'h', gap: 8 }, o), kids);

// ─────────────────────────── 그림 (SVG → 노드)
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  callout: '<path d="M3 10v4h3l7 4V6L6 10H3z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
  rank: '<path d="M4 20V12M10 20V6M16 20v-9M22 20H2"/>',
  career: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8"/>',
};
function icon(name, role, size) {
  size = size || 22;
  const hex = hexOf(role);
  const body = ICONS[name].replace(/<(path|circle)\s/g, `<$1 fill="none" stroke="${hex}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" `);
  const n = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${body}</svg>`);
  n.name = 'icon/' + name;
  n.fills = [];
  for (const v of n.findAll((x) => 'strokes' in x && x.strokes.length)) v.strokes = [P(role)];
  return n;
}

// 자리표시 도트 복서 (실제 캐릭터 스프라이트로 교체할 자리)
const SPRITE = [
  '....kkkk....',
  '...kssssk...',
  '...kskskk...',
  '...kssssk...',
  '....kssk....',
  '.gg.kiik.gg.',
  'gggkiiiikggg',
  'gggkiiiikggg',
  '.gg.kiik.gg.',
  '....kiik....',
  '...kmmmmk...',
  '...kmmmmk...',
  '...ks..sk...',
  '...ks..sk...',
  '..kkk..kkk..',
];
function sprite(px, o) {
  o = o || {};
  const c = CUR.c;
  const pal = { k: c.dark, s: c.skin, i: o.top || c.ink, g: o.glove || c.main, m: o.trunks || c.cornerEdge };
  let rects = '';
  SPRITE.forEach((line, y) => line.split('').forEach((ch, x) => {
    if (pal[ch]) rects += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${pal[ch]}"/>`;
  }));
  const w = SPRITE[0].length * px, h = SPRITE.length * px;
  const n = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects}</svg>`);
  n.name = 'sprite · 자리표시';
  n.fills = [];
  return n;
}
function spriteBox(size, px, o) {
  o = o || {};
  const box = F({ name: 'sprite-box', w: size, h: Math.round(size * 1.05), fill: 'surface2', justify: 'end', align: 'center', r: 0, clip: true, stroke: o.stroke }, [
    sprite(px, o),
    R(size, Math.max(4, Math.round(size / 9)), 'line2', { name: 'floor' }),
  ]);
  return box;
}

// ─────────────────────────── 공통 부품
function logo() {
  return row({ name: 'logo', gap: 8 }, [
    T('TBG', { size: 22, w: 'h', ls: -1 }),
    F({ name: 'arena-tag', fill: 'ink', p: [3, 5, 2, 5], r: 0 }, [T('ARENA', { px: true, size: 11, color: 'bg', ls: 2 })]),
  ]);
}
function coinChip(n) {
  return row({ name: 'coin', gap: 6, p: [5, 9], stroke: 'pointText' }, [
    R(8, 8, 'point', { name: 'coin-dot' }),
    T('COIN', { px: true, size: 10, color: 'pointText' }),
    T(String(n), { px: true, size: 13 }),
  ]);
}
function topbar(o) {
  o = o || {};
  const left = o.back
    ? row({ name: 'back', gap: 6, p: [6, 6, 6, 0] }, [T('←', { size: 17, w: 'b', color: 'muted' }), T(o.back, { size: 14, w: 'b', color: 'muted' })])
    : logo();
  const kids = [left];
  if (o.title) kids.push(T(o.title, { size: 16, w: 'h' }));
  kids.push(coinChip(o.coin == null ? 120 : o.coin));
  const f = row({ name: 'topbar', justify: 'between', p: [14, 16, 12, 16], fillW: true, fill: 'bg', r: 0 }, kids);
  return border(f, 'line', 'bottom');
}
function sectionTitle(title, sub) {
  return row({ name: 'section-title', gap: 8, fillW: true, p: [18, 0, 0, 0], wrap: true, cgap: 4 }, [
    R(8, 8, 'main', { name: 'square' }),
    T(title, { px: true, size: 13 }),
    sub ? T(sub, { size: 12, color: 'muted' }) : null,
  ]);
}
function card(o, kids) {
  return F(Object.assign({ name: 'card', fill: 'surface', stroke: 'line', p: 16, gap: 10, fillW: true }, o), kids);
}
const BADGE = {
  main: ['main', 'onMain', null], point: ['point', 'onPoint', null], done: ['done', 'onDone', 'doneEdge'],
  corner: ['corner', 'onCorner', 'cornerEdge'], line: [null, 'ink', 'line2'], muted: [null, 'muted', 'line'],
  pointLine: [null, 'pointText', 'pointText'], mainLine: [null, 'mainText', 'mainText'], doneLine: [null, 'doneText', 'doneEdge'],
};
function badge(text, kind) {
  const k = BADGE[kind || 'line'];
  return row({ name: 'badge/' + (kind || 'line'), gap: 4, p: [3, 7], fill: k[0], stroke: k[2], r: 0 }, [T(text, { size: 11, w: 'h', color: k[1], ls: 0 })]);
}
const BTN = {
  primary: { fill: 'btn', color: 'onBtn', shadow: 'btnShadow' },
  ink: { fill: 'ink', color: 'bg', shadow: 'selShadow' },
  line: { fill: 'bg', stroke: 'line2', color: 'ink' },
  point: { fill: 'point', color: 'onPoint', shadow: 'btnShadow' },
};
function btn(label, kind, o) {
  o = o || {};
  const s = BTN[kind || 'primary'];
  return row({ name: 'button/' + (kind || 'primary') + (o.sm ? '/sm' : ''), justify: 'center', gap: 6, p: o.sm ? [8, 12] : [15, 16],
    fill: s.fill, stroke: s.stroke, shadow: s.shadow, so: o.sm ? 2 : 4, fillW: o.block, grow: o.grow }, [
    T(label, { size: o.sm ? 13 : 16, w: 'h', color: s.color }),
  ]);
}
function seg(items, on, o) {
  o = o || {};
  return row({ name: 'segmented', gap: 6, fillW: true }, items.map((lb, i) => row({ name: 'seg/' + lb, justify: 'center', p: [10, 4], grow: true,
    fill: i === on ? 'ink' : 'bg', stroke: i === on ? 'ink' : 'line2' }, [T(lb, { size: o.size || 13, w: 'b', color: i === on ? 'bg' : 'muted' })])));
}
function codeBox(code, o) {
  o = o || {};
  return row({ name: 'code', w: o.w || 44, h: 28, justify: 'center', fill: 'bg', stroke: 'line2' }, [T(code, { px: true, size: 11 })]);
}
// 칸 나뉜 도트 게이지 — 한 가지 색, 오늘 오른 만큼만 포인트 색
function cells(n, filled, plus, o) {
  o = o || {};
  const kids = [];
  for (let i = 0; i < n; i++) {
    const role = i < filled - plus ? (o.color || 'ink') : i < filled ? 'point' : 'surface2';
    kids.push(R(4, o.h || 8, role, { grow: true, name: 'cell' }));
  }
  return row({ name: 'gauge', gap: 2, grow: !o.fixed, fillW: o.fixed }, kids);
}
function statRow(code, label, val, plus) {
  const N = 24, MAX = 40;
  const filled = Math.round((val / MAX) * N);
  const pc = plus ? Math.max(1, Math.round((plus / MAX) * N)) : 0;
  return row({ name: 'stat/' + code, gap: 10, fillW: true }, [
    row({ w: 74, gap: 5 }, [T(code, { px: true, size: 11 }), T(label, { size: 13, w: 'b', color: 'muted' })]),
    cells(N, filled, pc),
    row({ w: 62, gap: 4, justify: 'end' }, [
      plus ? T('+' + plus, { px: true, size: 10, color: 'pointText' }) : null,
      T(String(val), { px: true, size: 13 }),
    ]),
  ]);
}
function checkBox(done) {
  return done
    ? row({ name: 'check/on', w: 22, h: 22, justify: 'center', fill: 'done', stroke: 'doneEdge', r: 0 }, [T('✓', { size: 13, w: 'h', color: 'onDone' })])
    : F({ name: 'check/off', w: 22, h: 22, stroke: 'pointText', sw: 2, r: 0 });
}
function avatar(size, o) { return spriteBox(size, Math.max(2, Math.floor(size / 16)), o); }

function tabbar(active, dots) {
  dots = dots || {};
  const TABS = [['home', '홈'], ['callout', '콜아웃'], ['rank', '랭킹'], ['career', '커리어']];
  const tw = 390 / TABS.length;
  const tb = row({ name: 'tabbar', w: 390, gap: 0, fill: 'bg', p: [0, 0, 22, 0], r: 0, align: 'start' }, TABS.map(([id, lb]) => {
    const on = id === active;
    const c = on ? 'ink' : 'muted';
    const t = F({ name: 'tab/' + id, w: tw, gap: 4, align: 'center', p: [11, 0, 10, 0] }, [icon(id, c), T(lb, { size: 11, w: 'b', color: c })]);
    if (on) absolute(t, R(28, 3, 'main', { name: 'active-bar' }), (tw - 28) / 2, 0);
    if (dots[id]) absolute(t, row({ name: 'dot', p: [1, 4], fill: 'dot', r: 0 }, [T(String(dots[id]), { px: true, size: 10, color: 'onDot' })]), tw / 2 + 6, 5);
    return t;
  }));
  return border(tb, 'line2', 'top');
}
function stickyBar(kids, o) {
  o = o || {};
  const f = F({ name: 'sticky-cta', w: 390, fill: 'bg', p: [12, 16, o.bottom || 12, 16], gap: 8 }, kids);
  return border(f, 'line', 'top');
}

// 휴대폰 한 화면 (390 폭, 최소 844 높이, 탭바·하단 고정 버튼은 위에 띄움)
function phone(name, o, kids) {
  const ph = F({ name, w: 390, fill: 'bg', gap: 0, clip: true, r: 0 });
  ph.appendChild(topbar(o.top));
  const extra = (o.tab ? 76 : 0) + (o.sticky ? 100 : 0) + 24;
  ph.appendChild(F({ name: 'content', fillW: true, p: [8, 16, extra, 16], gap: 10 }, kids));
  applySizing(ph);
  if (ph.height < 844) { ph.resize(390, 844); ph.layoutSizingVertical = 'FIXED'; }
  let bottom = ph.height;
  if (o.tab) {
    const tb = tabbar(o.tab, o.dots);
    absolute(ph, tb, 0, 0);
    applySizing(tb);
    tb.y = bottom - tb.height;
    tb.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
    bottom = tb.y;
  }
  if (o.sticky) {
    const sb = stickyBar(o.sticky, { bottom: o.tab ? 12 : 30 });
    absolute(ph, sb, 0, 0);
    applySizing(sb);
    sb.y = bottom - sb.height;
    sb.constraints = { horizontal: 'STRETCH', vertical: 'MAX' };
  }
  return ph;
}

// ─────────────────────────── 페이지 1 · 홈
function fighterCard() {
  const head = row({ name: 'p-head', gap: 14, align: 'end', p: [16, 16, 14, 16], fillW: true, fill: 'bg', r: 0 }, [
    spriteBox(82, 5),
    col({ grow: true, gap: 6 }, [
      badge('3 WIN STREAK', 'main'),
      T('박태풍', { size: 24, w: 'h', ls: -0.8 }),
      row({ gap: 6 }, [T('3승 1패', { size: 13, w: 'b' }), T('· KO/TKO 1', { size: 13, color: 'muted' })]),
    ]),
    col({ align: 'end', gap: 2 }, [T('POWER', { px: true, size: 10, color: 'muted', ls: 1 }), T('1000', { px: true, size: 30 })]),
  ]);
  border(head, 'line', 'bottom');
  const body = col({ name: 'p-body', fillW: true, p: [14, 16, 16, 16], gap: 9 }, [
    row({ gap: 6, wrap: true, fillW: true }, [badge('진도 14 / 31주', 'pointLine'), badge('바디 훅 마스터', 'line')]),
    statRow('PWR', '파워', 22, 1.5),
    statRow('SPD', '스피드', 25),
    statRow('STA', '체력', 24, 0.5),
    statRow('IQ', 'IQ', 22),
    statRow('DEF', '맷집', 20),
    row({ fillW: true, justify: 'between', p: [6, 0, 0, 0] }, [
      row({ gap: 6 }, [T('랭킹 포인트', { size: 12, color: 'muted' }), T('34', { px: true, size: 13 })]),
      row({ gap: 6 }, [T('팬', { size: 12, color: 'muted' }), T('22', { px: true, size: 13 })]),
    ]),
  ]);
  return card({ name: 'fighter-card', p: 0, gap: 0, clip: true }, [head, body]);
}
function todayCard() {
  const item = (done, title, sub, action) => row({ name: 'todo', gap: 10, fillW: true, align: done ? 'center' : 'start' }, [
    checkBox(done),
    col({ grow: true, gap: 2 }, [
      T(title, { size: 14, w: 'b', color: done ? 'muted' : 'ink', fillW: true }),
      T(sub, { size: 12, color: done ? 'muted' : 'pointText', fillW: true }),
    ]),
    action,
  ]);
  return card({ name: 'today', stroke: 'pointText', p: 14, gap: 12 }, [
    row({ fillW: true, gap: 8 }, [badge('TODAY', 'point'), T('오늘 할 일 2개 중 1개 끝', { size: 12, color: 'muted', grow: true })]),
    item(true, '체육관 출석 완료', '누적 14회 · 코치 확인'),
    item(false, '12주 · 바디 훅 배웠어요', '파워 +1.5 · 체력 +0.5 · 콤비 2개 열림', btn('적용', 'primary', { sm: true })),
  ]);
}
function tile(code, title, sub, status) {
  return F({ name: 'tile/' + code, w: 175, fill: 'surface', stroke: 'line', p: 14, gap: 8 }, [
    row({ fillW: true, justify: 'between' }, [codeBox(code), status]),
    T(title, { size: 15, w: 'h' }),
    T(sub, { size: 12, color: 'muted', fillW: true, lh: 140 }),
  ]);
}
function skillChip(name, mastery, kind, o) {
  o = o || {};
  const dash = kind === 'defense' ? 'dash' : kind === 'step' ? 'dot' : null;
  return row({ name: 'skill/' + name, gap: 6, p: [8, 10], fill: o.locked ? null : 'bg', stroke: o.on ? 'ink' : 'line2', dash, shadow: o.on ? 'selShadow' : null, so: 2,
    grow: o.grow, justify: o.grow ? 'center' : 'start', opacity: o.locked ? 0.55 : null }, [
    T(name, { size: 13, w: 'b', color: o.locked ? 'muted' : 'ink' }),
    o.locked ? T('LOCK', { px: true, size: 9, color: 'muted' }) : T(String(mastery), { px: true, size: 11, color: 'muted' }),
    o.isNew ? badge('NEW', 'point') : null,
  ]);
}
function lineLegend() {
  const it = (dash, lb) => row({ gap: 6 }, [F({ w: 18, h: 12, stroke: 'ink', dash, r: 0 }), T(lb, { size: 11, color: 'muted' })]);
  return row({ name: 'legend', gap: 12, fillW: true, wrap: true }, [it(null, '펀치'), it('dash', '디펜스'), it('dot', '스텝')]);
}
function pageHome() {
  return phone('01 홈', { tab: 'home', dots: { callout: 1 }, top: {} }, [
    todayCard(),
    fighterCard(),
    sectionTitle('내 준비', '탭해서 바로 바꿔요'),
    row({ name: 'tiles', gap: 8, wrap: true, fillW: true }, [
      tile('GYM', '출석 · 수강권', '오늘 출석 완료 · 누적 14회 · 잔여 6회', badge('완료', 'done')),
      tile('STR', '기본 전략', '오소독스 · 하이가드 · 인파이팅', badge('바꾸기', 'line')),
      tile('FIN', '필살기', '원 · 투 · 바디 훅 (3타)', badge('장착 중', 'done')),
      tile('GEAR', '옷장 · 상점', 'COIN 120 · 새 글러브 1개', badge('NEW', 'point')),
    ]),
    sectionTitle('내 기술 (6)', '배운 기술만 경기에 나와요'),
    seg(['전체 6', '펀치 4', '디펜스 1', '스텝 1'], 0, { size: 12 }),
    row({ name: 'skills', gap: 6, wrap: true, fillW: true }, [
      skillChip('잽', 34, 'punch'), skillChip('원', 30, 'punch'), skillChip('투', 26, 'punch'),
      skillChip('바디 훅', 10, 'punch', { isNew: true }), skillChip('슬립', 22, 'defense'), skillChip('L 스텝', 18, 'step'),
    ]),
    lineLegend(),
  ]);
}

// ─────────────────────────── 페이지 2 · 필살기
function slot(n, name) {
  return col({ name: 'slot/' + n, grow: true, align: 'center', gap: 2, p: [10, 4], fill: 'bg', stroke: 'line2' }, [
    T(String(n).padStart(2, '0'), { px: true, size: 10, color: 'muted' }),
    T(name, { size: 15, w: 'h' }),
  ]);
}
function comboRow(names, state, kind, sub) {
  const dash = kind === 'defense' ? 'dash' : kind === 'step' ? 'dot' : null;
  const eq = state === 'equipped', locked = state === 'locked';
  const right = eq ? badge('장착 중', 'done') : locked ? T('LOCK', { px: true, size: 10, color: 'muted' }) : btn('장착', 'line', { sm: true });
  return row({ name: 'combo/' + names.join('-'), gap: 12, p: [12, 14], fillW: true, fill: locked ? 'bg' : 'surface', stroke: eq ? 'ink' : 'line2', dash, shadow: eq ? 'selShadow' : null, so: 3, opacity: locked ? 0.6 : null }, [
    col({ w: 34, align: 'center', gap: 0 }, [T(String(names.length), { px: true, size: 18, color: locked ? 'muted' : 'pointText' }), T('타', { size: 10, color: 'muted' })]),
    col({ grow: true, gap: 2 }, [T(names.join(' · '), { size: 14, w: 'b', fillW: true }), T(sub, { size: 12, color: 'muted', fillW: true })]),
    right,
  ]);
}
function pageFinisher() {
  const arrow = () => T('→', { size: 13, color: 'muted' });
  return phone('02 필살기', {
    top: { back: '홈', title: '필살기' },
    sticky: [row({ fillW: true, gap: 8 }, [btn('한 칸 지우기', 'line', { grow: true }), btn('저장 · 장착', 'primary', { grow: true })]),
      T('3타 · 저장하면 다음 경기부터 바로 나가요', { size: 12, color: 'muted', fillW: true, align: 'center' })],
  }, [
    card({ name: 'equipped', stroke: 'ink', shadow: 'selShadow', so: 4, gap: 12 }, [
      row({ fillW: true, justify: 'between' }, [T('장착 중인 필살기', { size: 13, w: 'b', color: 'muted' }), row({ gap: 6 }, [badge('3타', 'pointLine'), badge('장착 중', 'done')])]),
      row({ fillW: true, gap: 6 }, [slot(1, '원'), arrow(), slot(2, '투'), arrow(), slot(3, '바디 훅')]),
      row({ fillW: true, gap: 8, p: 10, fill: 'surface2', align: 'start' }, [badge('HIT', 'mainLine'),
        T('경기 막판에 한 번 터져요. 방어 동작 다음 펀치는 더 세게 들어가요.', { size: 12, color: 'muted', grow: true, lh: 145 })]),
    ]),
    sectionTitle('콤비에서 고르기', '배운 기술로만 된 콤비가 열려요'),
    row({ fillW: true, gap: 6 }, [badge('열림 3', 'doneLine'), badge('잠김 5', 'muted'), lineLegend()]),
    comboRow(['원', '투', '바디 훅'], 'equipped', 'punch', '12주에 열림 · 파워형'),
    comboRow(['잽', '슬립', '훅'], 'open', 'defense', '피하고 받아치기 · 카운터형'),
    comboRow(['잽', 'L 스텝', '투'], 'open', 'step', '빠지면서 꽂기 · 아웃복싱형'),
    comboRow(['투', '훅', '어퍼컷'], 'locked', 'punch', '어퍼컷을 배우면 열려요 (16주)'),
    sectionTitle('직접 만들기', '기술을 순서대로 누르세요'),
    row({ name: 'draft', fillW: true, gap: 6, p: 12, fill: 'bg', stroke: 'pointText', dash: 'dash', wrap: true }, [
      badge('원', 'line'), arrow(), badge('투', 'line'), arrow(), badge('바디 훅', 'line'), R(2, 18, 'point', { name: 'caret' }),
    ]),
    seg(['펀치 5', '디펜스 1', '스텝 1'], 0),
    row({ name: 'pick-grid', gap: 8, wrap: true, fillW: true }, [
      ['잽', 34], ['원', 30], ['투', 26], ['훅', 22], ['바디 훅', 10, 'new'], ['어퍼컷', 0, 'lock'],
    ].map(([n, m, f]) => F({ w: 114 }, [skillChip(n, m, 'punch', { grow: true, isNew: f === 'new', locked: f === 'lock', fillW: true })])
    )),
  ]);
}

// ─────────────────────────── 페이지 3 · 콜아웃
function stepper(steps, cur) {
  const kids = [];
  steps.forEach((s, i) => {
    const done = i < cur, now = i === cur;
    kids.push(col({ name: 'step/' + s, align: 'center', gap: 4, grow: true }, [
      row({ w: 26, h: 26, justify: 'center', fill: done ? 'done' : now ? 'point' : 'bg', stroke: done ? 'doneEdge' : now ? 'point' : 'line2', r: 0 }, [
        T(done ? '✓' : String(i + 1), { px: !done, size: 12, w: 'h', color: done ? 'onDone' : now ? 'onPoint' : 'muted' })]),
      T(s, { size: 11, w: 'b', color: now ? 'pointText' : done ? 'ink' : 'muted' }),
    ]));
  });
  return row({ name: 'stepper', fillW: true, gap: 0, align: 'start' }, kids);
}
function opponentRow(name, rec, power, diff, tag, sel, glove) {
  return row({ name: 'opponent/' + name, gap: 12, p: [10, 12], fillW: true, fill: 'surface', stroke: sel ? 'ink' : 'line', shadow: sel ? 'selShadow' : null, so: 3 }, [
    avatar(40, { glove }),
    col({ grow: true, gap: 3 }, [
      row({ gap: 6 }, [T(name, { size: 15, w: 'h' }), tag]),
      T(rec, { size: 12, color: 'muted' }),
    ]),
    col({ align: 'end', gap: 1 }, [T('POWER', { px: true, size: 9, color: 'muted' }), T(String(power), { px: true, size: 15 }), T(diff, { px: true, size: 10, color: 'muted' })]),
    sel ? checkBox(true) : F({ w: 22, h: 22, stroke: 'line2', r: 0 }),
  ]);
}
function pageCallout() {
  return phone('03 콜아웃', {
    tab: 'callout', dots: { callout: 1 }, top: {},
    sticky: [btn('최강펀치 님에게 도전장 보내기', 'primary', { block: true }),
      T('코치가 승인하면 경기 · 이기면 RANK PT +3 예상', { size: 12, color: 'muted', fillW: true, align: 'center' })],
  }, [
    row({ name: 'incoming', gap: 10, p: [14, 16], fillW: true, fill: 'alertFill', stroke: 'alertEdge', shadow: CUR.calm ? 'line2' : 'ink', so: 4 }, [
      col({ grow: true, gap: 4 }, [
        CUR.calm ? badge('받은 도전장', 'point') : null,
        T('김번개 님의 도전장!', { size: 15, w: 'h', color: 'onAlert' }),
        T('“다음 주 토요일 한 판?”', { size: 13, color: 'onAlert', fillW: true }),
        T('받으면 코치에게 승인 요청이 가요', { size: 12, color: 'onAlertSub', opacity: CUR.calm ? 1 : 0.8 }),
      ]),
      btn('받기', CUR.calm ? 'primary' : 'ink', { sm: true }),
    ]),
    card({ name: 'sent', gap: 12 }, [
      row({ fillW: true, justify: 'between' }, [T('내가 보낸 도전장', { size: 14, w: 'b' }), T('vs 이강철 · 어제', { size: 12, color: 'muted' })]),
      stepper(['보냄', '코치 승인', '경기'], 1),
    ]),
    sectionTitle('누구에게 도전할까요?', '실력이 비슷할수록 포인트가 커요'),
    seg(['추천', '랭킹 위', '최근 상대'], 0),
    opponentRow('최강펀치', '4승 2패 · KO 2', 1040, '+40', badge('비슷', 'pointLine'), true, CUR.c.cornerEdge),
    opponentRow('박소라', '2승 2패 · KO 0', 990, '-10', badge('비슷', 'pointLine'), false, CUR.c.point),
    opponentRow('김번개', '6승 1패 · KO 4', 1180, '+180', badge('강적', 'mainLine'), false, CUR.c.main),
    col({ name: 'message', fillW: true, gap: 6, p: [6, 0, 0, 0] }, [
      T('한 마디 (선택)', { size: 12, w: 'b', color: 'muted' }),
      row({ fillW: true, p: [12, 14], fill: 'bg', stroke: 'line2' }, [T('봐주지 않는다', { size: 15 }), R(2, 18, 'ink', { name: 'caret' })]),
      row({ gap: 6, wrap: true, fillW: true }, [badge('한 판 붙자', 'line'), badge('오늘 스파링?', 'line'), badge('봐주지 않는다', 'pointLine')]),
    ]),
  ]);
}

// ─────────────────────────── 페이지 4 · 랭킹
function podium(rank, name, pts, h, glove) {
  const first = rank === 1;
  return col({ name: 'podium/' + rank, grow: true, align: 'center', gap: 6 }, [
    first ? badge('CHAMP', 'point') : F({ h: 20, w: 1 }),
    avatar(first ? 56 : 46, { glove }),
    T(name, { size: 13, w: 'h' }),
    col({ name: 'block', fillW: true, h, align: 'center', p: [8, 0], gap: 2, fill: first ? 'point' : 'surface2', stroke: first ? 'point' : 'line2' }, [
      T(String(rank), { px: true, size: 22, color: first ? 'onPoint' : 'ink' }),
      T(pts + 'pt', { px: true, size: 11, color: first ? 'onPoint' : 'muted' }),
    ]),
  ]);
}
function rankRow(rank, name, rec, pts, trend, me) {
  const tc = trend[0] === '▲' ? 'doneText' : trend[0] === '▼' ? 'mainText' : 'muted';
  return row({ name: 'rank/' + rank, gap: 12, p: [10, 14], fillW: true, fill: 'surface', stroke: me ? 'ink' : 'line', shadow: me ? 'selShadow' : null, so: 3 }, [
    T(String(rank), { px: true, size: 18, color: me ? 'ink' : 'muted', align: 'center' }),
    avatar(36),
    col({ grow: true, gap: 1 }, [row({ gap: 6 }, [T(name, { size: 14, w: 'h' }), me ? badge('나', 'point') : null]), T(rec, { size: 12, color: 'muted' })]),
    col({ align: 'end', gap: 0 }, [T(pts + 'pt', { px: true, size: 15 }), T(trend, { px: true, size: 10, color: tc })]),
  ]);
}
function pageRank() {
  return phone('04 랭킹', {
    tab: 'rank', dots: { callout: 1 }, top: {},
    sticky: [row({ name: 'my-rank', fillW: true, gap: 12 }, [
      col({ w: 40, h: 40, justify: 'center', align: 'center', fill: 'ink' }, [T('6', { px: true, size: 20, color: 'bg' })]),
      col({ grow: true, gap: 1 }, [T('나 · 34pt', { size: 14, w: 'h' }), T('5위까지 1pt · 한 번 이기면 +3pt', { size: 12, color: 'pointText' })]),
      btn('도전', 'primary', { sm: true }),
    ])],
  }, [
    seg(['이번 시즌', '전체', '출석왕'], 0),
    row({ name: 'podium', fillW: true, gap: 8, align: 'end', p: [10, 0, 4, 0] }, [
      podium(2, '최강펀치', 41, 62, CUR.c.cornerEdge),
      podium(1, '김번개', 52, 86, CUR.c.main),
      podium(3, '박소라', 38, 48, CUR.c.point),
    ]),
    sectionTitle('4위부터', '매주 월요일 0시 집계'),
    rankRow(4, '이강철', '4승 3패 · KO 1', 36, '▲1'),
    rankRow(5, '한도윤', '3승 2패 · KO 2', 35, '–'),
    rankRow(6, '박태풍', '3승 1패 · KO 1', 34, '▲2', true),
    rankRow(7, '오세진', '2승 3패 · KO 0', 30, '▼1'),
    rankRow(8, '정하루', '2승 2패 · KO 1', 28, '▼2'),
  ]);
}

// ─────────────────────────── 페이지 5 · 커리어
function stat(label, val, role) {
  return col({ grow: true, align: 'center', gap: 2 }, [T(val, { px: true, size: 26, color: role || 'ink' }), T(label, { size: 11, w: 'b', color: 'muted' })]);
}
function formBox(r) {
  const w = r === 'W';
  return row({ name: 'form/' + r, w: 30, h: 30, justify: 'center', fill: w ? 'done' : 'bg', stroke: w ? 'doneEdge' : 'mainText', r: 0 }, [T(r, { px: true, size: 13, color: w ? 'onDone' : 'mainText' })]);
}
function historyRow(date, r, opp, how, pt) {
  return row({ name: 'fight/' + date, gap: 12, p: [10, 14], fillW: true, fill: 'surface', stroke: 'line' }, [
    T(date, { px: true, size: 11, color: 'muted' }),
    formBox(r),
    col({ grow: true, gap: 1 }, [T('vs ' + opp, { size: 14, w: 'b' }), T(how, { size: 12, color: 'muted' })]),
    T(pt, { px: true, size: 13, color: pt[0] === '+' ? 'pointText' : 'muted' }),
  ]);
}
function goal(title, sub, n, done) {
  return col({ name: 'goal/' + title, fillW: true, gap: 6 }, [
    row({ fillW: true, justify: 'between' }, [T(title, { size: 14, w: 'b' }), T(done + ' / ' + n, { px: true, size: 12, color: 'pointText' })]),
    cells(n, done, 0, { fixed: true, h: 10 }),
    T(sub, { size: 12, color: 'muted' }),
  ]);
}
function pageCareer() {
  return phone('05 커리어', { tab: 'career', dots: { callout: 1 }, top: {} }, [
    card({ name: 'summary', gap: 14 }, [
      row({ fillW: true }, [stat('승', '3'), stat('패', '1'), stat('KO', '1', 'mainText'), stat('승률', '75%', 'pointText')]),
      row({ fillW: true, justify: 'between', p: [12, 0, 0, 0] }, [
        T('최근 5경기', { size: 12, w: 'b', color: 'muted' }),
        row({ gap: 4 }, ['W', 'W', 'L', 'W', 'W'].map(formBox)),
      ]),
    ]),
    sectionTitle('지난 경기', '11.18 토 · 체육관 링'),
    card({ name: 'last-fight', p: 0, gap: 0, clip: true }, [
      row({ fillW: true, justify: 'between', p: [10, 14], fill: 'bg' }, [row({ gap: 6 }, [badge('WIN', 'done'), badge('KO', 'main')]), T('R3 · 2:14', { px: true, size: 12, color: 'muted' })]),
      row({ fillW: true, justify: 'center', gap: 18, p: [16, 14, 8, 14] }, [
        col({ align: 'center', gap: 6 }, [spriteBox(64, 4), T('박태풍', { size: 13, w: 'h' })]),
        T('VS', { px: true, size: 20, color: 'pointText' }),
        col({ align: 'center', gap: 6 }, [spriteBox(64, 4, { glove: CUR.c.cornerEdge }), T('김번개', { size: 13, w: 'h', color: 'muted' })]),
      ]),
      col({ fillW: true, gap: 10, p: [8, 14, 14, 14] }, [
        T('피니시 · 바디 훅 (필살기 3타째)', { size: 14, w: 'b', fillW: true, align: 'center' }),
        row({ gap: 6, wrap: true, fillW: true, justify: 'center' }, [badge('RANK PT +3', 'pointLine'), badge('COIN +40', 'pointLine'), badge('바디 훅 숙련 +2', 'line')]),
        btn('경기 다시보기 ▶', 'line', { block: true }),
      ]),
    ]),
    sectionTitle('경기 기록', '4경기'),
    historyRow('11.18', 'W', '김번개', 'KO · R3', '+3'),
    historyRow('11.04', 'W', '오세진', '판정 · 3R', '+2'),
    historyRow('10.21', 'L', '최강펀치', '판정 · 3R', '0'),
    historyRow('10.07', 'W', '정하루', '판정 · 3R', '+2'),
    sectionTitle('목표', '하나씩 채우면 뱃지'),
    card({ name: 'goals', gap: 16 }, [
      goal('31주 완주', '커리큘럼 14주까지 왔어요 · 완주하면 뱃지', 31, 14),
      goal('바디 훅 마스터', '같은 기술로 3번 피니시하면 칭호', 3, 1),
    ]),
  ]);
}

// ─────────────────────────── 이유 설명 카드 · 팔레트 시트
const NOTES = {
  home: ['오늘 할 일을 맨 위로', [
    '출석·배운 것 넣기를 목록 아래가 아니라 첫 카드(TODAY)로. 체육관 다녀온 직후 가장 먼저 할 행동이 엄지 닿는 첫 화면에 있다.',
    '적용 전에 “파워 +1.5 · 체력 +0.5 · 콤비 2개 열림”을 미리 보여 줘서 버튼을 누를 이유가 분명하다.',
    '긴 목록 5줄 → 2×2 타일. 각 타일 오른쪽 위에 상태(완료/장착 중/NEW)가 있어 들어가 보지 않아도 할 일이 보인다.',
    '능력치 막대는 한 가지 색, 오늘 오른 칸만 포인트 색. 무엇이 변했는지 한눈에 보인다.',
  ]],
  finisher: ['보면서 고르고, 엄지로 저장', [
    '모달 → 전용 화면. 장착 중인 콤보를 큰 칸(01·02·03)으로 맨 위에 두어 지금 상태부터 확인한다.',
    '“직접 만들기” 전에 열린 콤비를 먼저 보여 준다. 대부분은 고르기만 하면 되니 탭 수가 줄어든다.',
    '콤비 종류는 색 대신 선 모양(실선·대시·점선) — 색약이어도 구분되고, 화면 색은 3개로 유지된다.',
    '잠긴 콤비에 “어퍼컷을 배우면 열려요”처럼 여는 방법을 적어 다음 수업 동기를 준다. 저장 버튼은 하단 고정.',
  ]],
  callout: ['받은 도전 → 보낸 도전 → 새 도전 순서', [
    { calm: '받은 도전장은 카드 면 + 흰 테두리 + “받은 도전장” 포인트 태그. 빨강 없이도 맨 위 · 테두리 · 버튼으로 가장 먼저 눈에 든다.',
      loud: '받은 도전장은 메인 색 배너 + “받기” 버튼. 기다리게 하면 안 되는 일을 가장 크게.' },
    '보낸 도전장은 3단계 진행 표시(보냄 → 코치 승인 → 경기). “왜 아직 경기가 안 열리지?”라는 질문이 사라진다.',
    '상대 목록에 POWER 차이와 “비슷/강적” 태그. 선택된 줄은 지금 앱의 하드 섀도 강조를 그대로 쓴다.',
    '빠른 문구 칩으로 키보드 없이 한 마디. 보내기 버튼 아래에 예상 보상(+3)을 적어 결과를 미리 안다.',
  ]],
  rank: ['내 위치가 항상 보이는 랭킹', [
    '1~3위는 시상대로 짧게, 챔피언만 포인트 색. 4위부터는 목록.',
    '내 순위를 하단에 고정하고 “5위까지 1pt · 한 번 이기면 +3pt”로 다음 목표를 숫자로 보여 준다.',
    '고정 바의 “도전” 버튼이 콜아웃으로 바로 이어진다 — 보는 화면이 행동 화면이 된다.',
    '순위 변동 ▲▼ 는 완료·메인 색 + 기호를 같이 써서 색만으로 의미를 전달하지 않는다.',
  ]],
  career: ['기록은 숫자보다 흐름', [
    '승·패·KO·승률을 도트 숫자 4칸으로 요약하고, 최근 5경기 W/L 블록으로 흐름을 보여 준다.',
    'W는 면(완료 색), L은 선(메인 색) — 색 + 모양 두 가지로 구분해 흑백 출력에서도 읽힌다.',
    '지난 경기 카드에 피니시 기술과 받은 보상(RANK PT · COIN · 숙련)을 한 곳에 모아 성취감을 준다.',
    '목표(31주 완주 · 기술 마스터)를 능력치와 같은 칸 게이지로 그려 화면 사이 시각 언어가 이어진다.',
  ]],
};
function note(pageId, mainHex) {
  const [head, list] = NOTES[pageId];
  const items = list.map((s) => (typeof s === 'string' ? s : CUR.calm ? s.calm : s.loud));
  if (CUR.calm && pageId === 'home') items.push('버튼은 빨강 대신 흰 면 + 회색 하드 섀도. 빨강은 글러브 · 탭 표시 · KO 같은 “복싱 장면”에만 남겨서 버튼이 화면에서 튀지 않는다.');
  return F({ name: 'WHY · ' + pageId, w: 390, fill: '#F6F5F1', stroke: '#E3E1DA', p: 20, gap: 12, r: 8 }, [
    T('WHY THIS WORKS', { px: true, size: 11, color: '#8A877F' }),
    T(head, { size: 18, w: 'h', color: '#151515', fillW: true }),
    ...items.map((s) => row({ fillW: true, gap: 10, align: 'start' }, [R(7, 7, mainHex, { name: 'bullet' }), T(s, { size: 13, color: '#33322E', lh: 155, grow: true })])),
  ]);
}

function paletteSheet(theme) {
  const c = theme.c;
  const swatch = (role, label, use, base) => {
    const ratio = contrast(c[role], base || c.bg);
    return row({ name: 'swatch/' + role, fillW: true, gap: 14, p: [10, 0], align: 'center' }, [
      F({ w: 56, h: 56, fill: role, stroke: 'line2', r: 0 }),
      col({ grow: true, gap: 2 }, [
        row({ gap: 8 }, [T(label, { size: 14, w: 'h' }), T(c[role], { px: true, size: 12, color: 'muted' })]),
        T(use, { size: 12, color: 'muted', fillW: true }),
      ]),
      col({ align: 'end', gap: 2 }, [T(ratio.toFixed(1) + ':1', { px: true, size: 13 }), T(grade(ratio), { size: 10, w: 'b', color: 'muted' })]),
    ]);
  };
  const given = theme.hexes.map((h) => F({ w: 64, h: 40, fill: h.toUpperCase(), stroke: 'line2', r: 0, name: h }));
  return F({ name: '00 컬러 시스템', w: 520, fill: 'bg', p: 28, gap: 14, stroke: 'line', r: 0 }, [
    row({ gap: 8 }, [logo(), badge('COLOR', 'point')]),
    T(theme.name, { size: 30, w: 'h', ls: -1, fillW: true }),
    T('받은 HEX', { size: 12, w: 'b', color: 'muted' }),
    row({ gap: 6, wrap: true, fillW: true }, given),
    sectionTitle('역할', '오른쪽 숫자 = 배경 대비'),
    swatch('main', '메인', theme.calm ? '글러브 · 활성 탭 표시 · 섹션 네모 · KO / 연승 태그 (버튼 · 안내에는 안 씀)' : '주요 버튼 · 글러브 · 선택 강조 그림자 (면으로만 씀)'),
    theme.calm ? swatch('btn', '버튼', '주요 버튼 면 (글자색과 같음) · 그림자는 회색 ' + c.btnShadow) : null,
    swatch('point', '포인트', 'NEW · 챔피언 · 오른 능력치 · 코인'),
    swatch('done', '완료', '장착 중 · 출석 완료 · 승리(W)'),
    swatch('corner', '상대 코너', '상대 선수 · 블루 코너 (경기 화면에서만)'),
    swatch('ink', '글자', '본문 · 숫자'),
    swatch('muted', '보조 글자', '설명 · 비활성 탭 (자동 계산, 대비 4.5 이상)'),
    swatch('surface', '카드', '배경에서 4.5%만 밝힘 (자동 계산)'),
    sectionTitle('규칙'),
    ...[
      '한 화면에 쓰는 색은 메인 · 포인트 · 완료 셋. 상대 코너 색은 경기 장면에만.',
      theme.calm ? '버튼 · 안내 배너 · 선택 강조에는 빨강을 쓰지 않음. 버튼은 흰 면, 배너는 카드 면 + 흰 테두리, 알림 숫자는 포인트 색.' : null,
      '메인 색 위 글자색은 대비가 더 높은 쪽으로 자동 선택 (' + c.onMain + ').',
      '글자로 쓸 땐 대비 4.5:1 이 될 때까지 자동으로 밝힘 → 메인 글자 ' + c.mainText + ' · 포인트 글자 ' + c.pointText + '.',
      '능력치는 한 가지 색, 오른 만큼만 포인트. 종류는 색이 아니라 선 모양(실선·대시·점선).',
      '모서리 2px · 그림자 번짐 0 · 숫자는 도트 서체 — 지금 앱의 블랙 & 화이트 언어 유지.',
    ].filter(Boolean).map((s) => row({ fillW: true, gap: 10, align: 'start' }, [R(6, 6, 'main'), T(s, { size: 13, color: 'ink', grow: true, lh: 150 })])),
    sectionTitle('부품 미리보기'),
    row({ gap: 10, wrap: true, fillW: true }, [btn('저장 · 장착', 'primary'), btn('한 칸 지우기', 'line'), btn('도전', 'primary', { sm: true })]),
    row({ gap: 6, wrap: true, fillW: true }, [badge('NEW', 'point'), badge('장착 중', 'done'), badge('3 WIN STREAK', 'main'), badge('비슷', 'pointLine'), badge('강적', 'mainLine'), badge('LOCK', 'muted')]),
    statRow('PWR', '파워', 22, 1.5),
  ]);
}

// ─────────────────────────── 생성
const PAGES = { home: pageHome, finisher: pageFinisher, callout: pageCallout, rank: pageRank, career: pageCareer };
const PAGE_ORDER = ['home', 'finisher', 'callout', 'rank', 'career'];

function applyMode(node, col, modeId) {
  try { node.setExplicitVariableModeForCollection(col, modeId); } // 새 API: 컬렉션 객체
  catch (e) { node.setExplicitVariableModeForCollection(col.id, modeId); } // 옛 API: 컬렉션 id
}
function modeSticks(col, modeId) {
  const f = figma.createFrame();
  try {
    applyMode(f, col, modeId);
    return !!f.explicitVariableModes && f.explicitVariableModes[col.id] === modeId;
  } catch (e) {
    return false;
  } finally {
    f.remove();
  }
}
function setMode(node, theme) {
  if (VARS.on && theme.col) applyMode(node, theme.col, theme.modeId);
}

async function generate(msg) {
  const say = (t) => figma.ui.postMessage({ type: 'status', text: t });
  say('서체 불러오는 중…');
  await setupFonts();

  const themes = msg.themes.map((t) => buildTheme(Object.assign({}, t, { calm: msg.calm !== false })));
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const page = figma.currentPage;
  // 지금 페이지에 이미 있는 것들 아래쪽 빈 자리에 그린다
  let baseX = 0, baseY = 0;
  if (page.children.length) {
    let minX = Infinity, maxY = -Infinity;
    for (const n of page.children) { minX = Math.min(minX, n.x); maxY = Math.max(maxY, n.y + n.height); }
    baseX = Math.round(minX); baseY = Math.round(maxY + 400);
  }
  const style = msg.calm !== false ? '차분한 버튼' : '빨강 버튼';

  VARS.on = !!msg.vars;
  let varInfo = '변수 안 씀';
  if (VARS.on) varInfo = setupVariables(themes, 'TBG ARENA 컬러 · ' + stamp);
  if (VARS.on && !themes[0].vars) VARS.on = false;

  const pages = PAGE_ORDER.filter((id) => msg.pages.indexOf(id) >= 0);
  let y = baseY;
  const made = [];
  const holders = [];
  for (let ti = 0; ti < themes.length; ti++) {
    CUR = themes[ti];
    say(`${ti + 1}/${themes.length} · ${CUR.name} 그리는 중…`);
    const nodes = [];
    let x = 0;
    if (msg.sheet) {
      const s = paletteSheet(CUR);
      applySizing(s);
      s.x = x; s.y = 0; nodes.push(s); setMode(s, CUR);
      x += s.width + 80;
    }
    for (const id of pages) {
      const ph = PAGES[id]();
      setMode(ph, CUR);
      ph.x = x; ph.y = 0; nodes.push(ph);
      if (msg.notes) {
        const n = note(id, CUR.c.main);
        applySizing(n);
        n.x = x; n.y = ph.height + 40; nodes.push(n);
      }
      x += 390 + 60;
      await new Promise((r) => setTimeout(r, 0)); // UI 멈춤 방지
    }
    // 시안 한 줄 = 섹션 하나
    let maxH = 0, maxW = 0;
    for (const n of nodes) { maxH = Math.max(maxH, n.y + n.height); maxW = Math.max(maxW, n.x + n.width); }
    const pos = nodes.map((n) => [n.x, n.y]);
    let holder = null;
    try {
      holder = figma.createSection();
      holder.name = String.fromCharCode(65 + ti) + ' · ' + CUR.name + ' · ' + style;
      page.appendChild(holder);
      holder.x = baseX; holder.y = y;
      nodes.forEach((n, i) => { holder.appendChild(n); n.x = pos[i][0] + 80; n.y = pos[i][1] + 120; });
      holder.resizeWithoutConstraints(maxW + 160, maxH + 200);
      holder.fills = [{ type: 'SOLID', color: hexToRgb('#E9E8E4') }];
      holders.push(holder);
    } catch (e) {
      // 섹션을 못 쓰면 화면을 페이지로 꺼낸 뒤(먼저 꺼내야 같이 안 지워짐) 빈 섹션만 지운다
      nodes.forEach((n, i) => { page.appendChild(n); n.x = baseX + pos[i][0] + 80; n.y = y + pos[i][1] + 120; });
      if (holder) { try { holder.remove(); } catch (e2) { /* 무시 */ } }
    }
    made.push(...nodes);
    y += maxH + 360;
  }
  figma.viewport.scrollAndZoomIntoView(holders.length ? holders : made);
  figma.currentPage.selection = holders.length ? holders : [];
  const msgText = `완료 · 시안 ${themes.length}개 × 화면 ${pages.length}개 · ${varInfo} · 서체 ${FONTS.uiFamily} / ${FONTS.pxFamily}`;
  figma.notify('TBG ARENA 시안을 만들었어요');
  say(msgText);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate') {
    try {
      await generate(msg);
      figma.ui.postMessage({ type: 'done' });
    } catch (e) {
      console.error(e);
      figma.ui.postMessage({ type: 'error', text: String(e && e.message ? e.message : e) });
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
