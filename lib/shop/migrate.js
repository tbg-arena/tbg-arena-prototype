// 상점 도입 전 데이터 정리 (core/migrations.js 참고)
// 코인이 0에서 시작하지 않도록, 그동안의 출석·경기만큼 코인을 한 번 채워 준다
const { addMigration } = require('../core/migrations');
const { COIN, giveFightCoins } = require('./model');

addMigration((db) => {
  let changed = false;
  for (const m of db.members) if (m.coins === undefined) { m.coins = (m.attendCount || 0) * COIN.attend; changed = true; }
  const byId = new Map(db.members.map((m) => [m.id, m]));
  for (const f of db.fights) if (!f.coins) { giveFightCoins(f, [byId.get(f.a), byId.get(f.b)]); changed = true; }
  return changed;
});
