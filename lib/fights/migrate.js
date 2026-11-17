// 경기 관련 예전 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');

// 코치 관전 여부(seenCoach) 도입 전 경기는 코치가 이미 본 것으로 처리
addMigration((db) => {
  let coachSeen = 0;
  for (const f of db.fights) if (f.seenCoach === undefined) { f.seenCoach = true; coachSeen++; }
  return coachSeen > 0;
});
