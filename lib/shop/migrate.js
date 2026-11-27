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

// 신 등급 전용 복장: 신 등급 회원(m.god — 운영 DB에선 윤경만 코치)에게 한 번 지급 + 착용
// 이름이 아니라 m.god 을 본다 (동명이인 방지 — members/migrate.js 와 같은 이유)
// GOD_OUTFIT_V: 판 번호. 회원의 m.godOutfitV 가 이보다 낮을 때 한 번만 → 이후 본인이 갈아입어도 다시 덮어쓰지 않음
const GOD_OUTFIT_V = 1;
const GOD_OUTFIT = { shirt: 'god-shirtless', trunks: 'god-boxy-trunks', shoes: 'god-black-boots' };
addMigration((db) => {
  let changed = false;
  for (const m of db.members) {
    if (!m.god || (m.godOutfitV || 0) >= GOD_OUTFIT_V) continue;
    m.godOutfitV = GOD_OUTFIT_V; changed = true;
    m.owned = [...new Set([...(m.owned || []), ...Object.values(GOD_OUTFIT)])];
    m.equipped = { ...(m.equipped || {}), ...GOD_OUTFIT };
  }
  return changed;
});
