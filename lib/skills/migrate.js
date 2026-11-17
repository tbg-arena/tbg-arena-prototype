// 기술 관련 예전 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');
const { CATEGORIES, guessMove, validMove } = require('../fights/engine');

addMigration((db) => {
  // 복싱 전용 전환: 펀치는 이름으로 세부 분류, 복싱이 아닌 기술(킥·태클·그라운드·서브미션 등)은 제거
  const boxingCat = (name) => (/파운딩|엘보|니킥|킥/.test(name) ? null : /바디|리버/.test(name) ? 'body' : /어퍼/.test(name) ? 'uppercut' : /훅/.test(name) ? 'hook' : 'jab');
  db.skills = db.skills.filter((s) => {
    if (CATEGORIES[s.category]) return true;
    const c = s.category === 'punch' ? boxingCat(s.name) : null;
    if (c) s.category = c;
    return !!c;
  });
  // 세부 기술(move)이 없는 예전 기술은 이름으로 채운다
  let moved = 0;
  for (const s of db.skills) if (!validMove(s.category, s.move)) { s.move = guessMove(s.category, s.name); moved++; }
  return moved > 0;
});
