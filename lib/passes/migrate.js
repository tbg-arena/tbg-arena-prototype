// 수강권 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');

addMigration((db) => {
  let changed = false;
  if (!Array.isArray(db.passes)) { db.passes = []; changed = true; } // 수강권 기능 도입 전 데이터
  // 삭제된 회원의 수강권 정리
  const alive = new Set(db.members.map((m) => m.id));
  const n = db.passes.length;
  db.passes = db.passes.filter((p) => alive.has(p.memberId));
  return changed || db.passes.length !== n;
});
