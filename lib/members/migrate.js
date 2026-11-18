// 회원 관련 예전 데이터 정리 (core/migrations.js 참고)
const store = require('../core/store');
const { addMigration } = require('../core/migrations');
const { rebuildRecords } = require('../fights/model');
// const { MOVES } = require('../fights/engine');
// const { uid, now } = require('../core/util');

// 신 등급: 능력치 100 + 모든 세부 기술 숙련 100 + 캐릭터 후광(fighter/model 의 look.halo)
// m.god 로 한 번만 적용 — 이후 코치가 낮춰도 다시 덮어쓰지 않음
// [꺼 둠] 배포 DB에 적용 끝남 (능력치 · 기술 · m.god 은 DB에 남아 유지, 후광도 m.god 을 보고 계속 나옴).
//   이름만 보고 매 요청마다 돌아서, 켜 두면 나중에 윤경만으로 등록하거나 이름을 바꾼 회원도 신 등급이 된다.
//   다른 회원에게 다시 쓸 때만 주석을 풀고 GOD_NAMES 를 바꿔 배포 → 적용 확인 후 다시 주석 처리.
// const GOD_NAMES = ['윤경만'];
// addMigration((db) => {
//   let changed = false;
//   for (const m of db.members) {
//     if (m.god || !GOD_NAMES.includes(m.name)) continue;
//     m.god = true; changed = true;
//     for (const k of Object.keys(m.stats)) m.stats[k] = 100;
//     for (const [category, moves] of Object.entries(MOVES)) for (const [move, name] of moves) {
//       const have = db.skills.filter((s) => s.memberId === m.id && s.category === category && s.move === move);
//       if (have.length) have.forEach((s) => { s.mastery = 100; });
//       else db.skills.push({ id: uid(), memberId: m.id, name, category, move, mastery: 100, desc: '', createdAt: now() });
//     }
//   }
//   return changed;
// });

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
