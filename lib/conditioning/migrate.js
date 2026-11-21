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
  return changed;
});
