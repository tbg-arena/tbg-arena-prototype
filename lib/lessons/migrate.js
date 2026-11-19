// 커리큘럼을 DB로 (core/migrations.js 참고)
// - db.curriculum 이 없으면 curriculum.js 기본 31주로 채운다 (이후엔 코치가 화면에서 추가·수정·삭제)
// - 예전 받은 기록은 주차 '번호'만 있어서, 그 번호의 주차 id(weekId)와 완주 표시(final)를 붙인다
//   (코치가 중간에 주차를 끼워 넣거나 지워도 기록이 가리키는 주차가 밀리지 않게)
const { addMigration } = require('../core/migrations');
const { uid } = require('../core/util');
const { WEEKS } = require('./curriculum');

addMigration((db) => {
  let changed = false;
  if (!Array.isArray(db.curriculum)) {
    db.curriculum = WEEKS.map(({ title, content, points, skill, stats }) => ({ id: uid(), title, content, points, skill, stats }));
    changed = true;
  }
  for (const l of db.lessons || []) {
    if (l.weekId) continue;
    l.weekId = db.curriculum[l.week - 1]?.id || null;
    l.final = l.week === WEEKS.length;
    changed = true;
  }
  return changed;
});

// 스텝 분류 · 새 세부 기술(스웨이 · 체크 훅 · 핀) 도입 전 데이터: 임시로 비슷한 동작에 붙여 뒀던 것을 제 동작으로
// - 커리큘럼: 기본값 그대로인 주차만 (코치가 고친 주차는 건드리지 않음)
// - 회원 기술: 수업으로 받은 이름 그대로인 기술만
const RENAMED = { 스웨이: ['defense', 'back', 'sway'], '체크 훅': ['hook', 'hook', 'checkhook'], '핀·블라인드': ['jab', 'jab', 'pin'] };
addMigration((db) => {
  let changed = false;
  for (const w of db.curriculum || []) {
    const def = WEEKS.find((d) => d.title === w.title);
    const old = def?.skill && RENAMED[def.skill[0]];
    if (def?.skill && def.skill[1] === 'step' && w.skill === null) { w.skill = def.skill; changed = true; } // 스텝 주차: 기술 없음 → 스텝 기술
    else if (old && w.skill?.[0] === def.skill[0] && w.skill[2] === old[1]) { w.skill = def.skill; changed = true; }
  }
  for (const s of db.skills || []) {
    const r = RENAMED[s.name];
    if (r && s.category === r[0] && s.move === r[1]) { s.move = r[2]; changed = true; }
  }
  return changed;
});
