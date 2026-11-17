// 상점 판매 목록 (초안 — 가격·조건·브랜드는 나중에 조정)
//   slot: 장착 부위 / basic: 처음부터 누구나 가진 기본템 / require: 구매 조건 (보는 회원 기준 전적)
//   gender: 'F' 면 여자 회원만, 'M' 이면 남자 회원만 보고 살 수 있음 (없으면 모두)
//   look: 캐릭터 그림에 쓰는 색 (public/js/arena/sprite.js 가 읽는다)
//     글러브 — 기본: glove(본색) gloveS(손목·그늘)
//              브랜드: gloveArt(5줄 × 5글자 무늬, 위 = 주먹 쪽 · 아래 = 손목) + palette(글자 → 색)
//              trail: 경기에서 펀치 궤적 색
//     상의 — shirt: 본색, shirtS: 그늘, shirtMark: 가슴 프린트 색, sleeveless: 탱크탑 (팔이 맨살)
//     트렁크 — trunks: 본색, trunksS: 허리 밴드, trunksMark: 허리 밴드 가운데 로고 2칸
//     헤어 — hair: 'default'(성별 기본 머리) | 'bald'(빡빡이) | 'buzz'(스포츠머리) | 'mohawk'(모히칸)
//            | 'ponytail'(포니테일) | 'bob'(단발) | 'bun'(똥머리) — 모양은 sprite.js drawHead
//   art: 상점·옷장에 보이는 32×32 그림 설정 (없으면 내 캐릭터 얼굴에 씌운 모습으로 보여 준다 — 헤어)
//   (public/js/arena/gear-art.js 가 그린다 — 설정 항목은 그 파일 맨 위 참고)
const SLOTS = [['gloves', '글러브'], ['shirt', '상의'], ['trunks', '트렁크'], ['hair', '헤어']];

const ITEMS = [
  // ── 기본템 (무료, 누구나)
  { id: 'gloves-basic-white', slot: 'gloves', brand: 'TBG', name: '기본 글러브 · 흰색', basic: true, price: 0, look: { glove: '#f4f4f4', gloveS: '#b5b5b5' },
    art: { type: 'glove', body: '#f2f2f2', cuff: '#f2f2f2', piping: '#d0d0d0', closure: 'velcro', strap: '#e6e6e6' } },
  { id: 'gloves-basic-black', slot: 'gloves', brand: 'TBG', name: '기본 글러브 · 검정', basic: true, price: 0, look: { glove: '#2b2b2b', gloveS: '#111111' },
    art: { type: 'glove', body: '#2a2a2a', cuff: '#2a2a2a', piping: '#4a4a4a', closure: 'velcro', strap: '#1d1d1d' } },
  { id: 'shirt-basic-navy', slot: 'shirt', brand: 'TBG', name: '기본 반팔 · 남색', basic: true, price: 0, look: { shirt: '#1f2f6b', shirtS: '#141f4a' },
    art: { type: 'shirt', body: '#1f2f6b' } },
  { id: 'trunks-basic-navy', slot: 'trunks', brand: 'TBG', name: '기본 트렁크 · 남색', basic: true, price: 0, look: { trunks: '#131c45', trunksS: '#0a1030' },
    art: { type: 'trunks', body: '#1b2a63', band: '#101a45' } },

  { id: 'hair-default', slot: 'hair', brand: 'TBG', name: '기본 머리', desc: '남자 삐죽머리 · 여자 두건', basic: true, price: 0, look: { hair: 'default' } },

  // ── 브랜드 글러브 (조건을 채우면 코인으로 구매)
  {
    id: 'everlast-pro-gloves', slot: 'gloves', brand: 'EVERLAST', name: '프로 스타일 글러브', desc: '검정 바탕에 흰 로고 띠, 빨간 손목의 클래식',
    price: 300, require: { wins: 3 },
    look: {
      gloveArt: ['KKKKK', 'KGKKK', 'WWWWK', 'KKKKK', 'RRRRR'],
      palette: { K: '#151515', G: '#5c5c5c', W: '#ffffff', R: '#d2141f' },
    },
    art: { type: 'glove', body: '#161616', cuff: '#161616', piping: '#ffffff', closure: 'velcro', strap: '#c8102e', text: ['EVER', 'LAST'], textColor: '#ffffff' },
  },
  {
    id: 'twins-special-gloves', slot: 'gloves', brand: 'TWINS', name: '스페셜 투톤 글러브', desc: '태국 명가의 화려한 파랑·노랑 투톤',
    price: 350, require: { fans: 60, attendCount: 10 },
    look: {
      gloveArt: ['BBBBY', 'BHBYY', 'BBYYY', 'BYYYY', 'KKKKK'],
      palette: { B: '#1f5fd6', H: '#8fb6ff', Y: '#ffd21f', K: '#111111' },
      trail: '#ffd21f',
    },
    art: { type: 'glove', body: '#1f5fd6', accent: '#ffd21f', cuff: '#151515', piping: '#ffd21f', closure: 'velcro', strap: '#151515', text: ['TWINS'], textColor: '#ffffff' },
  },
  {
    id: 'winning-pro-gloves', slot: 'gloves', brand: 'WINNING', name: '프로 레이스업 글러브', desc: '일본 장인이 만드는 프로 사양 끈 글러브',
    price: 400, require: { wins: 5, attendCount: 20 },
    look: {
      gloveArt: ['RRRRR', 'RHRRR', 'RRRRR', 'WRWRW', 'WWWWW'],
      palette: { R: '#d2141f', H: '#ff9a9a', W: '#ffffff' },
      trail: '#ff4b45',
    },
    art: { type: 'glove', body: '#c8102e', cuff: '#c8102e', piping: '#a50d26', closure: 'lace', lace: '#ffffff', label: '#ffffff' },
  },

  // ── 남자 상의
  {
    id: 'nbnl-logo-tee', slot: 'shirt', gender: 'M', brand: 'NO BOXING NO LIFE', name: '로고 티셔츠', desc: '복싱 없인 못 사는 사람들의 검정 로고 티',
    price: 200, require: { attendCount: 10 },
    look: { shirt: '#1a1a1a', shirtS: '#0c0c0c', shirtMark: '#ffffff' },
    art: { type: 'shirt', body: '#1a1a1a', collar: '#3a3a3a', print: '#ffffff', text: ['NO', 'BOXING', 'NO', 'LIFE'] },
  },

  // ── 남자 헤어 (브랜드 없음 — 상점 카드에 이름만)
  { id: 'hair-buzz', slot: 'hair', gender: 'M', brand: '', name: '스포츠머리', desc: '짧고 단정하게 깎은 머리', price: 100, look: { hair: 'buzz' } },
  { id: 'hair-bald', slot: 'hair', gender: 'M', brand: '', name: '빡빡이', desc: '반짝이는 민머리, 시합 전 각오', price: 150, look: { hair: 'bald' } },
  { id: 'hair-mohawk', slot: 'hair', gender: 'M', brand: '', name: '모히칸', desc: '가운데만 세운 머리, 관중 시선 집중', price: 250, require: { fans: 30 }, look: { hair: 'mohawk' } },

  // ── 여자 상의 (탱크탑)
  {
    id: 'nbnl-logo-tank', slot: 'shirt', gender: 'F', brand: 'NO BOXING NO LIFE', name: '여성용 로고 탱크탑', desc: '가슴에 NBNL 로고가 들어간 검정 탱크탑',
    price: 200, require: { attendCount: 10 },
    look: { shirt: '#1a1a1a', shirtS: '#0c0c0c', shirtMark: '#ffffff', sleeveless: true },
    art: { type: 'shirt', sleeveless: true, body: '#1a1a1a', collar: '#3a3a3a', print: '#ffffff', text: ['NBNL'] },
  },
  {
    id: 'tank-black', slot: 'shirt', gender: 'F', brand: '', name: '탱크탑 · 검정', desc: '어깨가 시원한 기본 트레이닝 탱크탑',
    price: 100, look: { shirt: '#1b1b1b', shirtS: '#0d0d0d', sleeveless: true }, art: { type: 'shirt', sleeveless: true, body: '#1b1b1b', collar: '#3a3a3a' },
  },
  {
    id: 'tbg-tank-red', slot: 'shirt', gender: 'F', brand: 'TBG', name: '로고 탱크탑', desc: '체육관 로고가 박힌 빨간 탱크탑',
    price: 150, require: { attendCount: 5 },
    look: { shirt: '#c8102e', shirtS: '#8c0b20', shirtMark: '#ffffff', sleeveless: true },
    art: { type: 'shirt', sleeveless: true, body: '#c8102e', collar: '#ffffff', print: '#ffffff', text: ['TBG'] },
  },
  // ── 여자 헤어
  { id: 'hair-ponytail', slot: 'hair', gender: 'F', brand: '', name: '포니테일', desc: '높게 묶어 시합에도 걸리적거리지 않게', price: 120, look: { hair: 'ponytail' } },
  { id: 'hair-bob', slot: 'hair', gender: 'F', brand: '', name: '단발', desc: '턱선까지 깔끔한 단발', price: 100, look: { hair: 'bob' } },
  { id: 'hair-bun', slot: 'hair', gender: 'F', brand: '', name: '똥머리', desc: '정수리에 동그랗게 올린 머리', price: 150, require: { fans: 20 }, look: { hair: 'bun' } },

  // ── 트렁크 (남자 / 여자)
  {
    id: 'everlast-classic-trunks', slot: 'trunks', gender: 'M', brand: 'EVERLAST', name: '클래식 트렁크', desc: '흰 허리 밴드의 전통 복싱 트렁크',
    price: 250, require: { fans: 100 }, look: { trunks: '#141414', trunksS: '#f2f2f2', trunksMark: '#d2141f' },
    art: { type: 'trunks', body: '#161616', band: '#f2f2f2', bandText: '#c8102e', stripe: '#f2f2f2', hem: '#f2f2f2' },
  },
  {
    id: 'everlast-women-trunks', slot: 'trunks', gender: 'F', brand: 'EVERLAST', name: '여성용 트렁크', desc: '흰 바탕에 검정 허리 밴드, 빨간 로고',
    price: 250, require: { fans: 100 }, look: { trunks: '#ececec', trunksS: '#161616', trunksMark: '#d2141f' },
    art: { type: 'trunks', body: '#f0f0f0', band: '#161616', bandText: '#c8102e', stripe: '#161616', hem: '#161616' },
  },
];

// 아무것도 안 고른 회원이 입는 기본템
const DEFAULT_EQUIP = { gloves: 'gloves-basic-white', shirt: 'shirt-basic-navy', trunks: 'trunks-basic-navy', hair: 'hair-default' };
// 구매 조건 이름 (화면 표시용)
const REQUIRE_LABEL = { points: '랭킹 포인트', fans: '팬', wins: '승', kos: 'KO/TKO', attendCount: '출석' };

module.exports = { SLOTS, ITEMS, DEFAULT_EQUIP, REQUIRE_LABEL };
