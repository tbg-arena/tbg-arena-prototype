// 컨디셔닝 기록 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');

addMigration((db) => {
  let changed = false;
  if (!Array.isArray(db.conditioning)) { db.conditioning = []; changed = true; } // 컨디셔닝 기능 도입 전 데이터
  // 삭제된 회원의 기록 정리
  const alive = new Set(db.members.map((m) => m.id));
  const n = db.conditioning.length;
  db.conditioning = db.conditioning.filter((c) => alive.has(c.memberId));
  if (db.conditioning.length !== n) changed = true;
  // 예전 기록: reps(횟수) → amount + unit 'rep' (거리 · 시간 · 칼로리 단위가 생기기 전)
  for (const c of db.conditioning) {
    if (c.unit) continue;
    c.unit = 'rep'; c.amount = c.reps ?? null; delete c.reps; changed = true;
  }
  return changed;
});
