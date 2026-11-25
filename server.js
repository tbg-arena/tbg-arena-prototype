// TBG ARENA - 의존성 없는 Node.js 서버 (로컬: JSON 파일 / Vercel: Redis 저장, lib/core/store.js 참고)
// 복싱 육성 시뮬레이션: 체육관 출석·실제 배운 기술 → 성장 → 콜아웃 → 자동 경기 시뮬레이션
// 기능별 코드는 lib/<기능>/ 에 있다 (README '구조' 참고)
const http = require('http');
const store = require('./lib/core/store');
const { handle } = require('./lib/core/router');
const { serveStatic } = require('./lib/core/http');

const PORT = process.env.PORT || 3000;

// ───────── 기능 등록 ─────────
// 새 기능을 만들면 여기에 한 줄 추가. 이 순서대로 API가 등록되고, 예전 데이터 정리(migrate.js)도 이 순서로 실행된다.
const { COACH_PIN } = require('./lib/auth/routes');
require('./lib/members/routes');
require('./lib/attendance/routes');
require('./lib/skills/routes');
require('./lib/fighter/routes');
require('./lib/callouts/routes');
require('./lib/fights/routes');
require('./lib/shop/routes');
require('./lib/lessons/routes');
require('./lib/combos/routes');
require('./lib/conditioning/routes');

// 요청 하나를 처리하는 함수 (API + 정적 파일)
// Vercel이 server.js 를 서버 앱으로 자동 인식해 직접 호출해도 동작하도록 이것을 내보낸다.
function app(req, res) {
  const p = new URL(req.url, 'http://x');
  const rp = p.searchParams.get('__p'); // vercel.json rewrite 형태 복원
  if (rp !== null) { p.searchParams.delete('__p'); req.url = '/api' + rp + (p.search || ''); }
  return req.url.startsWith('/api/') ? handle(req, res) : serveStatic(req, res);
}
module.exports = app;
module.exports.handle = handle;

// 로컬 실행: node server.js
if (require.main === module) {
  http.createServer(app).listen(PORT, () => {
    console.log(`🥊 TBG ARENA → http://localhost:${PORT}  (저장소: ${store.kind})`);
    if (COACH_PIN === '1234') console.log('⚠️  코치 PIN 기본값(1234) 사용 중 — COACH_PIN 환경변수로 변경하세요.');
  });
}
