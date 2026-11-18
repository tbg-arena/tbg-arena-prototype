// 수강권 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');
const { chargeLogged, fillUnknownDays } = require('./model');

addMigration((db) => {
  let changed = false;
  if (!Array.isArray(db.passes)) { db.passes = []; changed = true; } // 수강권 기능 도입 전 데이터
  // 삭제된 회원의 수강권 정리
  const alive = new Set(db.members.map((m) => m.id));
  const n = db.passes.length;
  db.passes = db.passes.filter((p) => alive.has(p.memberId));
  if (db.passes.length !== n) changed = true;
  for (const m of db.members) {
    // 출석 기록은 있는데 수강권에 차감 안 된 날 차감 (수강권 기능 전 마지막 출석일 등)
    if (chargeLogged(m)) changed = true;
    // 날짜 없는 예전 출석에 날짜를 채워 누적 출석 = 달력 = 수강권 사용 (기존 운영 데이터 맞추기)
    if (fillUnknownDays(m)) changed = true;
  }
  return changed;
});
