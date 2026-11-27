// 정면 전신 캐릭터 (상점 피팅룸 · 경기 입장 · 랭킹 상위)
// 상점의 32×32 상품 그림(gear-art.js)을 몸에 그대로 입혀서, 프린트 · 메쉬 · 워시드 · 옆트임까지 입은 모습에서 보이게 한다.
//   상의 · 트렁크 = 원래 크기 그대로 / 글러브 · 복싱화 = 절반 크기, 왼쪽은 좌우 뒤집기
//   머리 = 경기 캐릭터와 같은 머리(sprite.js drawHead)를 2배로 — 헤어 · 얼굴이 경기 화면과 똑같다
// p = { id, gender, look } — look.arts 는 서버(lib/shop/model.js lookFor)가 입은 아이템 그림 설정을 실어 보낸다
import { mkCanvas } from './util.js';
import { drawHead, lookOf, SIDE, C } from './sprite.js';
import { gearArtCanvas } from './gear-art.js';
import { kitFromLook } from './hitman.js';
import { poseCanvas } from './pose-img.js';

export const FW = 56, FH = 108; // 그림 크기 (점 단위)
const O = '#050505';
const cache = new Map();

// 피부 막대 (팔 · 다리): 외곽선 + 피부 + 오른쪽 그늘
function limb(g, x, y, w, h) {
  g.fillStyle = O; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = C.skin; g.fillRect(x, y, w, h);
  g.fillStyle = C.skinS; g.fillRect(x + w - 1, y, 1, h);
}
// 32×32 그림을 절반(16×16)으로. flipX = 좌우, flipY = 위아래 뒤집기
function half(g, art, x, y, flipX, flipY) {
  g.save();
  g.translate(x + (flipX ? 16 : 0), y + (flipY ? 16 : 0));
  g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  g.drawImage(gearArtCanvas(art), 0, 0, 16, 16);
  g.restore();
}

function draw(look) {
  const arts = look.gear.arts || {};
  const cv = mkCanvas(FW, FH), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  // 뒤에서 앞으로: 다리 · 팔 · 몸통 → 상의 → 트렁크 → 복싱화 · 글러브 → 머리
  limb(g, 19, 80, 5, 14); limb(g, 32, 80, 5, 14);   // 다리 (트렁크 밑으로)
  limb(g, 12, 38, 4, 21); limb(g, 40, 38, 4, 21);   // 팔 (소매 · 탱크탑 진동둘레 밑으로)
  limb(g, 19, 38, 18, 26);                           // 몸통 (크롭탑 · 탱크탑 사이로 보이는 맨살)
  if (arts.shirt) g.drawImage(gearArtCanvas(arts.shirt), 12, 31);
  // 트렁크는 상의 밑단 바로 아래 (가슴 프린트 · 허리 밴드 로고 둘 다 보이게 — 파는 건 프린트라 상의를 가리지 않는다)
  if (arts.trunks) g.drawImage(gearArtCanvas(arts.trunks), 12, 57);
  if (arts.shoes) { half(g, arts.shoes, 12, 89, true); half(g, arts.shoes, 28, 89, false); }
  // 글러브: 상점 그림은 주먹이 위 · 손목이 아래라, 내린 팔에 달 땐 위아래를 뒤집어 손목이 팔에 이어지게.
  // 엄지(그림 오른쪽)는 몸 안쪽으로 — 왼손(화면 왼쪽)은 그대로, 오른손은 좌우도 뒤집기
  if (arts.gloves) { half(g, arts.gloves, 6, 54, false, true); half(g, arts.gloves, 34, 54, true, true); }
  // 머리: 22×20 칸에 그린 경기 캐릭터 머리를 2배로 (목 = 상의 목둘레 위)
  const hc = mkCanvas(22, 20);
  drawHead(hc.getContext('2d'), 5, 6, look, SIDE.L, '');
  g.drawImage(hc, 5, 0, 44, 40);
  return cv;
}

// 기본 캐릭터 그림 = AI 로 그린 정면 하이 가드 그림(pose-img.js)을 회원 장비 색으로 칠한 것 (글러브 · 상의 · 트렁크 · 신발 · 머리 색)
const urlCache = new Map();
function charURL(p, bust) {
  const look = lookOf(p), key = (bust ? 'b|' : 'f|') + look.gender + JSON.stringify(look.gear);
  if (urlCache.has(key)) return urlCache.get(key);
  const cv = poseCanvas(kitFromLook(look), look.gender === 'F', look.gear.arts, look.gear.hairArt); // 상품 그림(프린트 · 로고) · 헤어까지
  // 얼굴 = 머리 꼭대기부터 그림 폭만큼 정사각 (머리 + 양옆 글러브). 그림 위엔 솟은 머리용 여백이 있어서 꼭대기를 찾음
  let top = 0;
  if (bust) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; while (top < cv.height && ![...Array(cv.width).keys()].some((x) => d[(top * cv.width + x) * 4 + 3])) top++; }
  const out = bust ? mkCanvas(cv.width, cv.width) : cv;
  if (bust) out.getContext('2d').drawImage(cv, 0, -Math.max(0, top - 2));
  const url = out.toDataURL();
  urlCache.set(key, url);
  return url;
}
export const baseURL = (p) => charURL(p, false);
export const bustURL = (p) => charURL(p, true);
export const figureURL = (p) => baseURL(p);

// (예전) 상점 그림을 조립한 정면 전신 — 기본 캐릭터 그림으로 바꾸면서 안 씀. 옷 색 입히기 단계에서 지울 것
export function composedFigureURL(p, scale = 2) {
  const look = lookOf(p);
  const key = `${scale}|${look.gender}|${JSON.stringify(look.gear)}`;
  if (cache.has(key)) return cache.get(key);
  const src = draw(look), out = mkCanvas(FW * scale, FH * scale), o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(src, 0, 0, FW * scale, FH * scale);
  const url = out.toDataURL();
  cache.set(key, url);
  return url;
}
