// 상점 판매 목록 (초안 — 가격·조건·브랜드는 나중에 조정)
//   slot: 장착 부위 / basic: 처음부터 누구나 가진 기본템 / require: 구매 조건 (보는 회원 기준 전적)
//   gender: 'F' 면 여자 회원만, 'M' 이면 남자 회원만 보고 살 수 있음 (없으면 모두)
//   look: 캐릭터 그림에 쓰는 색 (public/js/arena/sprite.js 가 읽는다)
//     글러브 — 기본: glove(본색) gloveS(손목·그늘)
//              브랜드: gloveArt(5줄 × 5글자 무늬, 위 = 주먹 쪽 · 아래 = 손목) + palette(글자 → 색)
//              trail: 경기에서 펀치 궤적 색
//     상의 — shirt: 본색, shirtS: 그늘, shirtMark: 가슴 프린트 색, shirtGraphic: 큰 가슴 그래픽 색, sleeveless: 탱크탑
//     트렁크 — trunks: 본색, trunksS: 허리 밴드, trunksMark: 허리 로고, trunksStripe: 옆 줄, trunksPanel: V자 패널
//     복싱화 — shoe: 신발 색 (없으면 코너 색 — 기본 복싱화)
//     헤어 — hairArt: 정지 화면 그림 이름 (public/img/chars/<M|F>-<hairArt>.png, 없으면 남 spiky · 여 bob)
//            hair: 경기 화면(옛 도트 캐릭터) 머리 모양 'default'(성별 기본 머리) | 'bald'(빡빡이) | 'buzz'(스포츠머리) | 'mohawk'(모히칸)
//            | 'blond-buzz'(금태양 머리) | 'ponytail'(포니테일) | 'bob'(단발) | 'bun'(똥머리) — 모양은 sprite.js drawHead
//   art: 상점·옷장에 보이는 32×32 그림 설정 (없으면 내 캐릭터 얼굴에 씌운 모습으로 보여 준다 — 헤어)
//   (public/js/arena/gear-art.js 가 그린다 — 설정 항목은 그 파일 맨 위 참고)
const SLOTS = [['gloves', '글러브'], ['shirt', '상의'], ['trunks', '트렁크'], ['shoes', '복싱화'], ['hair', '헤어']];

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

  { id: 'shoes-basic', slot: 'shoes', brand: 'TBG', name: '기본 복싱화', desc: '경기에선 코너 색(흰 · 검)으로 보여요', basic: true, price: 0, look: {},
    art: { type: 'shoe', height: 'mid', body: '#2a2a2a', sole: '#e6e6e6', collar: '#3a3a3a', lace: '#d9d9d9' } },

  { id: 'hair-default', slot: 'hair', brand: 'TBG', name: '기본 머리', desc: '남자 삐죽머리 · 여자 단발', basic: true, price: 0, look: { hair: 'default' } },

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
  {
    id: 'boxraw-night-gloves', slot: 'gloves', brand: 'BOXRAW', name: '나이트 트레이닝 글러브', desc: '차콜 바탕에 골드 라벨을 얹은 절제된 트레이닝 스타일',
    price: 300, require: { attendCount: 10 },
    look: { gloveArt: ['KKKKK', 'KGGKK', 'KKKKK', 'KKKKK', 'KKKKK'], palette: { K: '#202124', G: '#c7a55b' }, trail: '#c7a55b' },
    art: { type: 'glove', body: '#202124', cuff: '#202124', piping: '#c7a55b', closure: 'velcro', strap: '#303236', label: '#c7a55b' },
  },
  {
    id: 'nbnl-corner-gloves', slot: 'gloves', brand: 'NO BOXING NO LIFE', name: '코너 컬러 글러브', desc: '오프화이트 가죽과 네이비 손목 밴드의 클래식 조합',
    price: 320, require: { fans: 50 },
    look: { gloveArt: ['WWWWN', 'WNNWW', 'WWWWW', 'WWWWW', 'NNNNN'], palette: { W: '#f1eee7', N: '#172747' } },
    art: { type: 'glove', body: '#f1eee7', cuff: '#172747', piping: '#172747', closure: 'velcro', strap: '#172747', text: ['NBNL'], textColor: '#172747' },
  },
  {
    id: 'mizuno-rush-gloves', slot: 'gloves', brand: 'MIZUNO', name: '러시 레드 글러브', desc: '레드 바탕에 화이트 포인트를 준 스피드 스타일',
    price: 350, require: { wins: 3, attendCount: 5 },
    look: { gloveArt: ['RRRRR', 'RWWRR', 'RRRRR', 'RWWRR', 'RRRRR'], palette: { R: '#c8102e', W: '#f7f7f5' }, trail: '#ef3340' },
    art: { type: 'glove', body: '#c8102e', cuff: '#a50d26', piping: '#f7f7f5', closure: 'velcro', strap: '#a50d26', label: '#f7f7f5' },
  },

  {
    id: 'nbnl-championship-gloves', slot: 'gloves', brand: 'NO BOXING NO LIFE', name: '챔피언십 글러브 · 아이보리 올리브', desc: '멕시코산 소가죽 시합용 끈 글러브, 아이보리 바탕에 올리브 손목',
    price: 450, require: { wins: 5, fans: 60 },
    look: { gloveArt: ['IIIII', 'IHIII', 'IIIII', 'OIOIO', 'OOOOO'], palette: { I: '#e9e2cc', H: '#ffffff', O: '#5c6139' }, trail: '#c2b98a' },
    art: { type: 'glove', body: '#e9e2cc', cuff: '#5c6139', piping: '#5c6139', closure: 'lace', lace: '#e9e2cc', text: ['NBNL'], textColor: '#3f4326' },
  },

  // ── 남자 상의
  {
    id: 'nbnl-logo-tee', slot: 'shirt', gender: 'M', brand: 'NO BOXING NO LIFE', name: '로고 티셔츠', desc: '복싱 없인 못 사는 사람들의 검정 로고 티',
    price: 200, require: { attendCount: 10 },
    look: { shirt: '#1a1a1a', shirtS: '#0c0c0c', shirtMark: '#ffffff' },
    art: { type: 'shirt', body: '#1a1a1a', collar: '#3a3a3a', print: '#ffffff', text: ['NO', 'BOXING', 'NO', 'LIFE'] },
  },
  {
    id: 'boxraw-sparring-club-tee', slot: 'shirt', gender: 'M', brand: 'BOXRAW', name: '스파링 클럽 워시드 티', desc: '워시드 차콜 바탕에 앞가슴 표식과 스파링 클럽 그래픽을 넣은 오버사이즈 티셔츠',
    price: 250, require: { attendCount: 8 },
    look: { shirt: '#34363a', shirtS: '#222326', shirtMark: '#c7a55b', shirtGraphic: '#e4e0d8' },
    art: { type: 'shirt', body: '#34363a', collar: '#4a4c50', print: '#e4e0d8', text: ['SPAR', 'CLUB'], fabric: 'washed' },
  },

  {
    id: 'boxraw-wdpb-tee', slot: 'shirt', gender: 'M', brand: 'BOXRAW', name: '위 돈 플레이 복싱 오버사이즈 티', desc: '빛바랜 그린 바탕에 크게 박힌 슬로건, 워시드 오버사이즈 핏',
    price: 260, require: { attendCount: 12 },
    look: { shirt: '#3e4a3a', shirtS: '#2a3327', shirtMark: '#ece6d6', shirtGraphic: '#ece6d6' },
    art: { type: 'shirt', body: '#3e4a3a', collar: '#536050', print: '#ece6d6', text: ['DONT', 'PLAY', 'BOXING'], fabric: 'washed' },
  },
  {
    id: 'boxraw-muscle-tank', slot: 'shirt', gender: 'M', brand: 'BOXRAW', name: '리니얼 머슬 탱크', desc: '어깨는 넓게 남기고 진동을 깊게 판 블랙 머슬 탱크',
    price: 220, require: { attendCount: 6 },
    look: { shirt: '#1a1a1a', shirtS: '#0c0c0c', shirtMark: '#c7a55b', sleeveless: true },
    art: { type: 'shirt', sleeveless: true, cut: 'muscle', body: '#1a1a1a', collar: '#3a3a3a', print: '#c7a55b', text: ['BXR'] },
  },
  {
    id: 'nbnl-core-logo-tee', slot: 'shirt', gender: 'M', brand: 'NO BOXING NO LIFE', name: '코어 로고 티 · 네이비', desc: '네이비 바탕에 가슴 가운데 작은 NBNL 로고',
    price: 200, require: { attendCount: 5 },
    look: { shirt: '#1c2438', shirtS: '#121827', shirtMark: '#f1eee7' },
    art: { type: 'shirt', body: '#1c2438', collar: '#2c3650', print: '#f1eee7', text: ['NBNL'] },
  },
  {
    id: 'nbnl-cable-mesh-tee', slot: 'shirt', gender: 'M', brand: 'NO BOXING NO LIFE', name: '케이블 메쉬 티', desc: '바람이 잘 통하는 구멍 격자 원단의 블랙 트레이닝 티',
    price: 280, require: { attendCount: 15 },
    look: { shirt: '#1a1a1a', shirtS: '#0c0c0c' },
    art: { type: 'shirt', body: '#2a2a2a', collar: '#3a3a3a', fabric: 'mesh' },
  },

  // ── 남자 헤어 (브랜드 없음 — 상점 카드에 이름만)
  { id: 'hair-buzz', slot: 'hair', gender: 'M', brand: '', name: '스포츠머리', desc: '짧고 단정하게 깎은 머리', price: 100, look: { hair: 'buzz', hairArt: 'buzz' } },
  { id: 'hair-bald', slot: 'hair', gender: 'M', brand: '', name: '빡빡이', desc: '반짝이는 민머리, 시합 전 각오', price: 150, look: { hair: 'bald', hairArt: 'bald' } },
  { id: 'hair-blond-buzz', slot: 'hair', gender: 'M', brand: '', name: '금태양 머리', desc: '옆은 바짝 밀고 짧게 탈색한 금발, 거친 금태양 스타일', price: 180, look: { hair: 'blond-buzz', hairArt: 'blond-buzz' } },
  { id: 'hair-mohawk', slot: 'hair', gender: 'M', brand: '', name: '모히칸', desc: '가운데만 세운 머리, 관중 시선 집중', price: 250, require: { fans: 30 }, look: { hair: 'mohawk', hairArt: 'mohawk' } },

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
  {
    id: 'nbnl-jalisco-fight-tank', slot: 'shirt', gender: 'F', brand: 'NO BOXING NO LIFE', name: '할리스코 파이트 클럽 탱크', desc: '카키 바탕과 짙은 목선, 중앙 파이트 클럽 프린트의 링 트레이닝 탱크',
    price: 240, require: { attendCount: 8 },
    look: { shirt: '#91835c', shirtS: '#6d6246', shirtMark: '#f1eee7', sleeveless: true },
    art: { type: 'shirt', sleeveless: true, body: '#91835c', collar: '#292a28', print: '#f1eee7', text: ['NBNL'] },
  },
  {
    id: 'boxraw-tammy-racer-crop', slot: 'shirt', gender: 'F', brand: 'BOXRAW', name: '태미 레이서 크롭 탑', desc: '가운데로 모인 레이서 끈과 짧은 기장의 브라운 크롭 탑',
    price: 240, require: { attendCount: 8 },
    look: { shirt: '#6b4e3d', shirtS: '#4e3829', sleeveless: true },
    art: { type: 'shirt', sleeveless: true, cut: 'racer', crop: true, body: '#6b4e3d', collar: '#8a6a55' },
  },
  // ── 여자 헤어
  { id: 'hair-ponytail', slot: 'hair', gender: 'F', brand: '', name: '포니테일', desc: '높게 묶어 시합에도 걸리적거리지 않게', price: 120, look: { hair: 'ponytail', hairArt: 'ponytail' } },
  { id: 'hair-bun', slot: 'hair', gender: 'F', brand: '', name: '똥머리', desc: '정수리에 동그랗게 올린 머리', price: 150, require: { fans: 20 }, look: { hair: 'bun', hairArt: 'bun' } },
  { id: 'hair-bandana', slot: 'hair', gender: 'F', brand: '', name: '두건', desc: '이마를 덮는 흰 두건, 옆으로 묶은 매듭', price: 120, look: { hair: 'default', hairArt: 'bandana' } },
  { id: 'hair-shoulder', slot: 'hair', gender: 'F', brand: '', name: '어깨 기장 생머리', desc: '어깨에 닿는 자연스러운 생머리', price: 120, look: { hair: 'bob', hairArt: 'shoulder' } },
  { id: 'hair-long', slot: 'hair', gender: 'F', brand: '', name: '긴 생머리', desc: '허리까지 내려오는 곧은 생머리', price: 150, look: { hair: 'bob', hairArt: 'long' } },
  { id: 'hair-long-wavy', slot: 'hair', gender: 'F', brand: '', name: '긴 웨이브', desc: '굵게 굽이치는 긴 머리', price: 180, require: { fans: 20 }, look: { hair: 'bob', hairArt: 'long-wavy' } },
  { id: 'hair-pigtails', slot: 'hair', gender: 'F', brand: '', name: '양갈래', desc: '양옆으로 높게 묶은 머리', price: 150, look: { hair: 'ponytail', hairArt: 'pigtails' } },
  { id: 'hair-double-bun', slot: 'hair', gender: 'F', brand: '', name: '양쪽 번', desc: '양쪽 위로 동그랗게 올린 머리', price: 180, require: { fans: 20 }, look: { hair: 'bun', hairArt: 'double-bun' } },

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
  {
    id: 'mizuno-red-corner-trunks', slot: 'trunks', gender: 'M', brand: 'MIZUNO', name: '미즈노 레드 코너 트렁크', desc: '복싱 게임 유니폼에서 가져온 선명한 레드 바탕, 흰 밴드와 양옆 흰 줄',
    price: 280, require: { fans: 60 },
    look: { trunks: '#c8102e', trunksS: '#f1eee7', trunksMark: '#172747', trunksStripe: '#f1eee7' },
    art: { type: 'trunks', body: '#c8102e', band: '#f1eee7', bandText: '#172747', stripe: '#f1eee7', hem: '#f1eee7' },
  },
  {
    id: 'nbnl-mesh-corner-shorts', slot: 'trunks', gender: 'F', brand: 'NO BOXING NO LIFE', name: '메쉬 코너 쇼츠', desc: '검정 메쉬 바탕에 아이보리 V자 패널이 크게 들어간 트레이닝 쇼츠',
    price: 280, require: { attendCount: 12 },
    look: { trunks: '#202124', trunksS: '#f1eee7', trunksMark: '#c8102e', trunksPanel: '#f1eee7' },
    art: { type: 'trunks', body: '#202124', band: '#f1eee7', bandText: '#c8102e', vPanel: '#f1eee7' },
  },
  {
    id: 'nbnl-airshift-shorts', slot: 'trunks', brand: 'NO BOXING NO LIFE', name: '에어시프트 퍼포먼스 쇼츠', desc: '밑단 옆을 튼 가벼운 블랙 폴리 쇼츠',
    price: 260, require: { attendCount: 10 },
    look: { trunks: '#151515', trunksS: '#2a2a2a', trunksMark: '#f2f2f0' },
    art: { type: 'trunks', body: '#181818', band: '#2a2a2a', bandText: '#f2f2f0', split: true },
  },

  // ── 복싱화 (미즈노 한국 사이트의 복싱화 라인 · BOXRAW 장비)
  {
    id: 'mizuno-finisher-low', slot: 'shoes', brand: 'MIZUNO', name: '피니셔 스펙트라 로우', desc: '발목 아래로 낮게 떨어지는 가벼운 흰색 복싱화, 네이비 사선 포인트',
    price: 300, require: { attendCount: 10 },
    look: { shoe: '#f2f2f0' },
    art: { type: 'shoe', height: 'low', body: '#f2f2f0', accent: '#172747', sole: '#172747', collar: '#d9d9d6', lace: '#172747' },
  },
  {
    id: 'mizuno-finisher-mid', slot: 'shoes', brand: 'MIZUNO', name: '피니셔 스펙트라 미드', desc: '발목을 잡아 주는 미드컷, 블랙 바탕에 레드 사선',
    price: 330, require: { wins: 3, attendCount: 10 },
    look: { shoe: '#1b1b1b' },
    art: { type: 'shoe', height: 'mid', body: '#1b1b1b', accent: '#c8102e', sole: '#f2f2f0', collar: '#2e2e2e', lace: '#f2f2f0' },
  },
  {
    id: 'mizuno-wave-monster', slot: 'shoes', brand: 'MIZUNO', name: '웨이브 몬스터', desc: '종아리까지 감싸는 하이컷 복싱 부츠, 레드 바탕에 흰 사선',
    price: 400, require: { wins: 5, fans: 60 },
    look: { shoe: '#c8102e' },
    art: { type: 'shoe', height: 'high', body: '#c8102e', accent: '#f2f2f0', sole: '#f2f2f0', collar: '#a50d26', lace: '#f2f2f0' },
  },
  {
    id: 'boxraw-ring-boots', slot: 'shoes', brand: 'BOXRAW', name: '링 하이컷 복싱화', desc: '차콜 바탕에 골드 사선, 절제된 하이컷 링 부츠',
    price: 380, require: { attendCount: 20 },
    look: { shoe: '#202124' },
    art: { type: 'shoe', height: 'high', body: '#202124', accent: '#c7a55b', sole: '#2e2f33', collar: '#303236', lace: '#c7a55b' },
  },
];

// 아무것도 안 고른 회원이 입는 기본템
const DEFAULT_EQUIP = { gloves: 'gloves-basic-white', shirt: 'shirt-basic-navy', trunks: 'trunks-basic-navy', shoes: 'shoes-basic', hair: 'hair-default' };
// 구매 조건 이름 (화면 표시용)
const REQUIRE_LABEL = { points: '랭킹 포인트', fans: '팬', wins: '승', kos: 'KO/TKO', attendCount: '출석' };

module.exports = { SLOTS, ITEMS, DEFAULT_EQUIP, REQUIRE_LABEL };
