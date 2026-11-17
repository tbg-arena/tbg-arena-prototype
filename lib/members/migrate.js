// 회원 관련 예전 데이터 정리 (core/migrations.js 참고)
const store = require('../core/store');
const { addMigration } = require('../core/migrations');
const { rebuildRecords } = require('../fights/model');

// 훈련/컨디션 시스템 제거 이전 데이터 정리
addMigration((db) => {
  for (const m of db.members) {
    if (m.attendDay === undefined) m.attendDay = m.attended ? m.trainDay : null;
    delete m.trainDay; delete m.trainsLeft; delete m.condition; delete m.condAt; delete m.belt;
  }
  return false;
});

// 삭제된 회원이 나온 경기·콜아웃 정리 (회원 삭제 때 같이 지우기 전에 삭제된 회원 포함)
// 지워진 경기가 있으면(또는 한 번도 안 맞춰봤으면) 전적을 남은 경기로 다시 계산
addMigration(async (db) => {
  const alive = new Set(db.members.map((m) => m.id));
  const orphanFights = db.fights.filter((f) => !alive.has(f.a) || !alive.has(f.b)).map((f) => f.id);
  const callouts = db.callouts.length;
  db.fights = db.fights.filter((f) => alive.has(f.a) && alive.has(f.b));
  db.callouts = db.callouts.filter((c) => alive.has(c.challengerId) && alive.has(c.opponentId));
  const rebuild = orphanFights.length > 0 || !db.recordsV;
  if (rebuild) { rebuildRecords(db); db.recordsV = 1; }
  if (orphanFights.length) await store.dropFights(orphanFights).catch((e) => console.error(e));
  return rebuild || db.callouts.length !== callouts;
});
