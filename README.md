# 🥊 TBG ARENA

TBG 체육관 회원 전용 **복싱 육성 시뮬레이션** 모바일 웹 게임.
체육관에서 **실제로 배운 기술**이 내 선수의 기술이 되고, **체육관에 실제로 나올수록** 강해집니다. 앱 안에서 버튼으로 키우는 요소는 없고, 회원끼리 **콜아웃**해서 겨룹니다.

## 개발 스펙

| 구분 | 사용 기술 |
| --- | --- |
| 언어 | JavaScript (서버: Node.js CommonJS / 클라이언트: 브라우저 ES2020+), HTML5, CSS3 |
| 런타임 | Node.js 18 이상 (내장 `fetch` 사용) |
| 서버 | Node.js 내장 `http` 모듈로 직접 구현한 REST API (프레임워크·npm 의존성 없음) |
| 프론트엔드 | Vanilla JS SPA, 브라우저 기본 ES 모듈 `import`/`export` (프레임워크·번들러·빌드 과정 없음), 모바일 우선 레이아웃 |
| 그래픽 | HTML5 Canvas 2D: 160×100 도트 버퍼를 nearest-neighbor로 확대해 그리는 픽셀 아트 애니메이션 |
| 사운드 | Web Audio API로 8비트 효과음 실시간 합성 (음원 파일 없음) |
| 폰트 | Pretendard (본문), Galmuri (도트 폰트), jsDelivr CDN |
| 앱 형태 | PWA 매니페스트 (`manifest.webmanifest`): 홈 화면에 추가해 앱처럼 실행 |
| 인증 | 회원은 전화번호, 코치는 PIN(`COACH_PIN`)으로 로그인 → 토큰을 `localStorage`에 저장 |
| 저장소 | 로컬: JSON 파일(`data/db.json`) / 배포: Upstash Redis (REST API) |
| 배포 | Vercel: `public/` 정적 호스팅 + `api/index.js` 서버리스 함수 1개 |


```bash
npm start                 # http://localhost:3000
COACH_PIN=9876 npm start  # 코치 PIN 지정 (기본값 1234 → 운영 시 꼭 변경)
```

- 외부 패키지 없음 (Node.js 18+)
- 로컬에서는 데이터가 `data/db.json` 에 저장 (gitignore)
- 같은 Wi‑Fi 휴대폰에서 `http://<PC IP>:3000` 접속 → 홈 화면에 추가하면 앱처럼 실행

## Vercel 배포

`server.js` 하나로 로컬 서버와 Vercel 서버리스(`api/index.js`)를 같이 씁니다. 저장소는 `lib/core/store.js` 가 자동 선택:
Redis 환경변수가 있으면 **Upstash Redis**, 없으면 로컬 파일.

1. Vercel에서 이 GitHub 레포를 Import (Framework: Other, 빌드 설정은 비워 두면 `public/` 이 정적 파일로, `api/` 가 함수로 배포됨)
2. 프로젝트 → **Storage** → **Upstash for Redis** 생성 후 연결 → `KV_REST_API_URL`, `KV_REST_API_TOKEN` 자동 등록
3. **Settings → Environment Variables** 에 `COACH_PIN` 추가 (기본값 1234 그대로 두지 말 것)
4. Redeploy

- 정적 파일은 `public/`, `/api/*` 는 서버리스 함수 하나가 처리
- 요청마다 Redis에서 DB를 불러와 처리 후 저장. 경기 중계 데이터는 경기별 키(`tbg:fight:<id>`)로 분리
- 동시에 여러 서버 인스턴스가 쓰면 마지막 저장이 이기는 구조라, 체육관 규모(동시 사용 적음)를 전제로 함

## 게임 루프

```
코치: 회원 등록 → 배운 기술 등록(분류·숙련도) → 출석 체크
회원: 전화번호로 입장 → 전략 설정
      → 콜아웃 → [코치 승인] → 자동 경기 → 중계 관전
```

### 선수
- 능력치: ⚡파워 💨스피드 🫁스태미나 🧠IQ 🛡맷집 → **전투력**
- 능력치는 **코치 출석 체크 때만** 성장 (하루 1회, 5개 능력치 모두 조금씩, 높을수록 둔화)

### 기술 (코치 = admin 이 등록)
- **현재는 복싱 기술만** 지원. 분류: 👊 잽·스트레이트 / 🪝 훅 / ⤴️ 어퍼컷 / 🎯 바디샷 / 🛡️ 디펜스
  - 잽·스트레이트: 정확도 ↑ 데미지 ↓ · 훅/어퍼컷: 데미지·KO 확률 ↑ · 바디샷: 상대 체력(스태미나) 소모
  - 디펜스(슬립·위빙·더킹·패리·블로킹 등): 공격으로는 안 나오고, 숙련이 높을수록 덜 맞고 카운터 확률 ↑
- 서버 시작 시 예전 MMA 기술은 정리됨: 펀치는 이름으로 세부 분류(훅/어퍼/바디/그 외 잽·스트레이트), 킥·태클·그라운드·서브미션은 삭제
- **배운 기술만 경기에 나오고, 숙련이 높을수록 자주 나오고 잘 들어간다**
- 숙련은 코치가 수업에서 본 실력대로 직접 조정(±5)하고, 경기에서 성공한 기술은 +1
- 같은 기술로 5번 피니시하면 `○○ 마스터` 칭호

### 전략
- 스탠스(오소독스/사우스포), 가드(하이가드/숄더롤/밸런스), 스타일(인파이팅/카운터/아웃복싱), 공략 부위(헤드·바디)

### 경기 엔진 (`lib/fights/engine.js`)
- 3라운드 × 3분 복싱
- 공격권은 스피드·스타일·체력, 성공률은 숙련·스피드·IQ·상대 가드·상대 디펜스 숙련
- 피니시: KO / TKO (다운 후 카운트 아웃 포함), 아니면 심판 3명 10-9 채점 판정
- 결과: Elo 방식 랭킹 포인트(피니시 보너스), 팬, 전적, 피니시 칭호

### 경기 애니메이션 (`public/js/arena/`)
- 사이드뷰 도트 아트: 160×100 월드 버퍼를 nearest-neighbor로 확대, 성별(남/여)로 구분되는 2등신 캐릭터 (화이트 코너 / 레드 코너)
- 복싱 기술별 모션: 잽(앞손 스냅) · 스트레이트(뒷손+체중) · 원투/더블 잽(연속 펀치) · 훅(와인드업→팔 굽혀 휘두르기, 곡선 궤적) · 어퍼컷(숙였다 올려치기, 수직 궤적) · 바디샷(낮게 숙여 치기)
- 맞는 반응도 기술별: 고개가 옆으로(훅) / 위로(어퍼컷) / 몸이 접힘(바디). 디펜스는 기술 이름으로 슬립·위빙/더킹·블로킹·패리·백스텝 동작
- 히트스톱, 피격 화이트 플래시, 임팩트 버스트, 땀 파티클, 넉백, 카메라 펀치 줌, 관중 점프·카메라 플래시
- KO: 반전 플래시 → 슬로모션으로 날아가 바운드 → 스피드 라인 → 레터박스 + K.O. 배너 → 승자 세리머니
- 테이크다운 슬램·먼지, 마운트 파운딩, 서브미션 비네트·TAP, 라운드 인트로(ROUND N → FIGHT!)
- 효과음 (`public/js/arena/sfx.js`): Web Audio로 8비트 소리를 실시간 합성(음원 파일 없음). 중계 화면 우상단 ♪ 버튼으로 켜고 끔(설정 기억), 3x·8x 배속에선 자잘한 소리 생략
- `spriteURL(id, {pose})` (`public/js/arena/sprite.js`) 로 같은 캐릭터를 아바타·프로필에도 사용, 로그인 화면은 데모 스파링

### 캐릭터 스킨
기본 캐릭터는 **성별로만 구분**합니다: 남자 = 삐죽머리, 여자 = 뒤로 묶는 두건 (둘 다 검은 머리), 옷은 공통으로 **남색 반팔·반바지** (반바지가 조금 더 진한 남색).
성별은 코치가 회원 등록/수정 때 고르며, 값이 없는 기존 회원은 남자로 표시됩니다. 신발·두건 색은 코너로 정해집니다: 화이트 코너(흰 신발·두건) / 레드 코너(검정 두건·신발). 경기에서 코너는 이름표 밑줄과 체력바 색으로도 구분됩니다.
글러브·상의·트렁크와 헤어스타일은 **옷장에서 고른 것**이 보입니다 (아래). 장비 정보가 없는 캐릭터(로그인 화면 데모 등)는 코너 색 글러브(흰색 / 검정). 여자 두건은 기본 머리일 때만 보여요.

![가능한 캐릭터](docs/characters.png)

### 상점 · 옷장 (꾸미기 전용)
- 홈의 **옷장 · 상점** 카드로 들어갑니다 (탭바에는 없음). 글러브 · 상의 · 트렁크 · 헤어로 나눠 봐요 (처음엔 글러브)
- **코인**으로 장비를 삽니다: 경기 승 30 · 무 15 · 패 10 (KO/TKO 승 +10), 출석 체크 +20. 상점 도입 전 경기·출석만큼은 한 번 소급 지급
- **기본템**(누구나): 글러브 흰색·검정, 남색 반팔, 남색 트렁크, 기본 머리
- **브랜드템**: 조건(승·팬·출석·KO·랭킹 포인트)을 채워야 구매 가능. 지금은 초안으로
  - 글러브: EVERLAST(3승, 300) · TWINS(팬 60 + 출석 10회, 350) · WINNING(5승 + 출석 20회, 400)
  - 상의: NO BOXING NO LIFE 로고 티셔츠(출석 10회, 200)
  - 트렁크: EVERLAST(팬 100, 250)
  - 헤어: 스포츠머리(100) · 빡빡이(150) · 모히칸(팬 30, 250)
  - 브랜드 글러브는 5×5 도트 무늬(`gloveArt`)로 그리고, 경기에서 펀치 궤적도 브랜드 색
- 장비는 능력치에 영향 없음. 산 장비는 옷장에서 언제든 바꿔 입기 (안 산 아이템은 착용 정보가 남아 있어도 기본템으로 보임)
- 중계를 보기 전에는 그 경기에서 받은 코인이 안 보입니다 (결과가 새지 않도록)
- 판매 목록·가격·조건: `lib/shop/items.js` / 코인 지급량: `lib/shop/model.js` 의 `COIN`

## 구조

**기능별로 나눠져 있습니다.** 서버(`lib/<기능>/`)와 화면(`public/js/features/<기능>/`, `public/css/<기능>.css`)이 같은 기능 이름을 씁니다.
한 기능을 고칠 때는 보통 그 기능 폴더만 건드리면 되고, 두 사람이 서로 다른 기능을 맡으면 같은 파일을 고칠 일이 거의 없습니다.

| 기능 | 하는 일 | 서버 `lib/` | 화면 `public/js/features/` |
| --- | --- | --- | --- |
| auth | 로그인·로그아웃 | `auth/routes.js` | `auth/login.js` |
| members | 코치 회원 관리 (등록·수정·삭제) | `members/` | `members/coach.js` (회원·기술 탭) |
| attendance | 출석 체크 → 능력치 성장 | `attendance/` | `attendance/admin.js` (출석 버튼) |
| skills | 배운 기술 등록·숙련 조정 | `skills/` | `skills/` (기술 목록, 코치 기술 관리) |
| fighter | 게임 속 선수: 내 정보·전략·랭킹·선수 분석 | `fighter/` | `fighter/` (홈·랭킹 탭, 선수 분석) |
| callouts | 콜아웃 → 코치 승인 | `callouts/routes.js` | `callouts/` (회원 콜아웃 탭, 코치 승인 탭) |
| fights | 경기 실행·전적·중계 | `fights/` (`engine.js` = 경기 엔진) | `fights/` (커리어·코치 경기 탭, 중계 화면) |
| shop | 코인·상점·옷장 (장비 꾸미기) | `shop/` (`items.js` = 판매 목록) | `shop/member.js` (옷장·상점 화면 `#/shop`, 홈에서 들어감) |

```
server.js                 # 진입점: 기능 등록 목록 + 로컬 HTTP 서버 (api/index.js 가 Vercel에서 불러감)
lib/
  core/                   # 공용 뼈대 (자주 안 바뀜)
    router.js             #   route() 로 API 등록, 요청 처리 (불러오기 → 정리 → API → 저장)
    db.js                 #   이번 요청의 데이터 db + save()
    store.js              #   저장소 (로컬 파일 / Upstash Redis)
    migrations.js meta.js http.js util.js
  <기능>/
    model.js              #   다른 기능에서도 가져다 쓰는 함수 (예: memberById, runFight)
    routes.js             #   이 기능의 API
    migrate.js            #   예전 데이터 형식 정리 (필요할 때만)
public/
  index.html              # CSS 목록 + <script type="module" src="/js/main.js">
  css/base.css            # 공용 스타일 (변수·버튼·카드·탭바·모달)
  css/<기능>.css          # 기능별 스타일
  js/
    main.js               # 진입점: 기능 import 목록
    core/                 # 공용 뼈대: state · api · ui(토스트·모달·포맷) · router(화면 이동) · tabs(탭 화면 틀)
    features/<기능>/      # 기능별 화면 · 탭
    arena/                # 도트 애니메이션: arena.js(경기 연출) · sprite.js(캐릭터) · moves.js(기술별 동작) · sfx.js(효과음)
```

## 협업 가이드

- **기능 단위로 나눠 맡기**: 한 사람이 한 기능을 서버부터 화면까지 맡으면 충돌이 거의 없습니다.
- **`core/` 는 같이 쓰는 뼈대**: 고쳐야 하면 PR을 작게 따로 올리고 상대에게 알려 주세요.
- **새 기능 추가** (예: 상점 `shop`)
  1. 서버: `lib/shop/routes.js` 를 만들고 `server.js` 의 기능 등록 목록에 `require('./lib/shop/routes');` 한 줄 추가
     - 화면에 줄 설정값은 `addMeta({ ... })`, 회원 데이터에 새 필드(예: 코인)를 넣으면 기본값은 `lib/shop/migrate.js` 에서 `addMigration` 으로 채우기
  2. 화면: `public/js/features/shop/tab.js` 에서 `memberTab({ id: 'shop', order: 50, label: '상점', icon, load, view, bind })` 로 탭 등록 → `public/js/main.js` 에 `import` 한 줄 추가 (탭 순서는 `order`)
  3. 스타일: `public/css/shop.css` 를 만들고 `index.html` 에 `<link>` 한 줄 추가
  4. 캐릭터 옷처럼 생김새가 바뀌는 건 `public/js/arena/sprite.js` (`lookOf`, `drawSprite`)
- **다른 기능에 끼어들 때는 연결 지점 사용** (그 기능 파일을 직접 고치지 않도록): 경기 끝난 뒤 `onFightResult` (fights/model), 출석 체크 뒤 `onAttend` (attendance/model), 캐릭터 장비 색 `addLook` · 본인 정보에 필드 추가 `addPrivateFields` (fighter/model). 예시는 `lib/shop/model.js` 아래쪽
- **코치 탭**은 `coachTab({...})`, `#/이름/<id>` 로 여는 단독 화면은 `addPage('이름', render)`, id 없이 여는 화면(`#/shop`)은 `addPage('이름', render, { needsId: false })` 로 등록합니다.
- **파일 이름 주의**: 새 파일에 `app.js`, `index.js`, `server.js` 는 쓰지 마세요 (Vercel이 서버 진입점으로 착각할 수 있음). 서버 코드는 `api/` 가 아니라 `lib/` 에 (`api/` 안 파일은 각각 서버리스 함수가 됨).
