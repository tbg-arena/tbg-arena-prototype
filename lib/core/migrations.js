// 예전 데이터 형식 정리: 각 기능의 migrate.js 가 addMigration 으로 정리 함수를 등록한다.
// 요청마다 저장소에서 불러온 직후 등록 순서대로 실행된다 (server.js 의 기능 등록 순서).
// - 여러 번 실행해도 안전해야 한다 (이미 정리된 데이터면 아무것도 안 바뀌게)
// - 저장이 필요할 만큼 바뀌었으면 true 를 돌려준다
const migrations = [];

const addMigration = (fn) => { migrations.push(fn); };

async function runMigrations(db) {
  let changed = false;
  for (const fn of migrations) if (await fn(db)) changed = true;
  return changed;
}

module.exports = { addMigration, runMigrations };
