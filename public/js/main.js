// TBG ARENA - 프론트엔드 진입점 (vanilla JS SPA, 브라우저 기본 ES 모듈)
// 기능 파일을 불러오면 각자 화면·탭을 등록한다. 새 기능을 만들면 여기에 import 한 줄 추가.
// (탭 순서는 import 순서가 아니라 각 탭의 order 값으로 정해진다)
import { route } from './core/router.js';
import './core/tabs.js';

// 로그인
import './features/auth/login.js';
// 내 선수: 홈 탭 · 랭킹 탭 · 선수 분석 화면
import './features/fighter/home.js';
import './features/fighter/rank.js';
import './features/fighter/profile.js';
// 콜아웃: 회원 콜아웃 탭 · 코치 승인 탭
import './features/callouts/member.js';
import './features/callouts/coach.js';
// 회원 관리: 코치 회원·기술 탭 (출석 버튼, 기술 관리 포함)
import './features/members/coach.js';
// 배운 것 넣기: 코치 '배운 것' 탭 (오늘 출석한 회원에게 각자 주차의 기술을 넣음)
import './features/lessons/coach.js';
// 콤비네이션: 회원 '내 콤비' 화면 (#/combos, 홈에서 들어감) — 배운 기술로 된 콤비가 열리고 필살기로 장착
import './features/combos/member.js';
// 경기: 커리어 탭 · 코치 경기 탭 · 경기 중계 화면
import './features/fights/career.js';
import './features/fights/coach.js';
import './features/fights/broadcast.js';
// 상점: 회원 옷장·상점 화면 (#/shop, 홈에서 들어감)
import './features/shop/member.js';
// 수강권: 회원 '내 수강권' 화면 (#/passes, 홈 출석 카드에서 들어감). 코치 수강권 관리는 회원·기술 탭 안
import './features/passes/member.js';

route();
