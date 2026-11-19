// 회원 관련 예전 데이터 정리 (core/migrations.js 참고)
const store = require('../core/store');
const { addMigration } = require('../core/migrations');
const { rebuildRecords } = require('../fights/model');
const { MOVES } = require('../fights/engine');
const { uid, now } = require('../core/util');

// 신 등급 (m.god — 윤경만 코치. 예전 스크립트가 운영 DB에 넣어 둔 표시, 캐릭터 후광도 이걸 봄 fighter/model)
// 능력치 5개 100 + 모든 세부 기술(MOVES 전부) 숙련 100. 없는 기술은 새로 만든다.
// 이름이 아니라 m.god 을 보므로 동명이인이 신 등급이 되지 않는다. 새 신 등급 회원은 DB에서 m.god = true 로.
// GOD_V: 판 번호. 회원의 m.godV 가 이보다 낮을 때 한 번만 적용 → 이후 코치가 낮춰도 다시 덮어쓰지 않음
//   기술(세부 기술)을 새로 추가하면 GOD_V 를 1 올려 배포 → 신 등급 회원에게 새 기술까지 100으로 다시 맞춰짐
//   2: 스텝 분류(워킹·점프·사이드·피벗·L 스텝) · 스웨이 · 체크 훅 · 핀·블라인드 추가
const GOD_V = 2;
const GOD_LEVEL = 100; // 능력치 · 숙련 최대값 (코치 슬라이더 · 숙련 · 화면 막대가 모두 100 기준)
addMigration((db) => {
  let changed = false;
  for (const m of db.members) {
    if (!m.god || (m.godV || 1) >= GOD_V) continue;
    m.godV = GOD_V; changed = true;
    for (const k of Object.keys(m.stats)) m.stats[k] = GOD_LEVEL;
    for (const [category, moves] of Object.entries(MOVES)) for (const [move, name] of moves) {
      const have = db.skills.filter((s) => s.memberId === m.id && s.category === category && s.move === move);
      if (have.length) have.forEach((s) => { s.mastery = GOD_LEVEL; });
      else db.skills.push({ id: uid(), memberId: m.id, name, category, move, mastery: GOD_LEVEL, desc: '', createdAt: now() });
    }
    // 이미 있던 다른 이름의 기술도 (예: 수업으로 받은 '가드') 같이 100
    for (const s of db.skills) if (s.memberId === m.id) s.mastery = GOD_LEVEL;
  }
  return changed;
});

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
