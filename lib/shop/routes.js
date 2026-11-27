// 상점 API (회원): 상점·옷장 목록 · 구매 · 착용
require('./migrate');
const { route } = require('../core/router');
const { save } = require('../core/db');
const { send, fail } = require('../core/http');
const { viewFor } = require('../fighter/model');
const { SLOTS, ITEMS, REQUIRE_LABEL } = require('./items');
const { COIN, itemById, fitsMember, coinsFor, owned, equippedOf } = require('./model');

// 구매 조건 확인용 기록 (보는 회원 기준: 아직 중계를 안 본 경기는 빼고)
function progressOf(me, view) {
  const r = view?.rec.get(me.id) || me;
  return { points: r.points, fans: r.fans, wins: r.wins, kos: r.kos, attendCount: me.attendCount || 0 };
}
const requireOf = (it, have) => Object.entries(it.require || {})
  .map(([key, need]) => ({ key, label: REQUIRE_LABEL[key] || key, need, have: have[key] || 0, ok: (have[key] || 0) >= need }));

function shopView(me) {
  const view = viewFor(me);
  const have = progressOf(me, view);
  const mine = owned(me), eq = equippedOf(me);
  return {
    coins: coinsFor(me, view),
    coinRules: COIN, // 코인 얻는 방법 (화면 안내용)
    slots: SLOTS,
    equipped: eq,
    items: ITEMS.filter((it) => fitsMember(it, me)).map((it) => {
      const req = requireOf(it, have);
      return {
        id: it.id, slot: it.slot, brand: it.brand, name: it.name, desc: it.desc || '', price: it.price, basic: !!it.basic, look: it.look, art: it.art,
        owned: mine.has(it.id), equipped: eq[it.slot] === it.id, require: req, unlocked: req.every((x) => x.ok),
      };
    }),
  };
}

route('GET', '/api/shop', 'member', async (req, res, { me }) => {
  send(res, 200, shopView(me));
});

route('POST', '/api/shop/buy', 'member', async (req, res, { me, body }) => {
  const it = itemById(body.itemId);
  if (!it || !fitsMember(it, me)) return fail(res, 404, '없는 아이템이에요.');
  if (owned(me).has(it.id)) return fail(res, 409, '이미 가진 아이템이에요.');
  const view = viewFor(me);
  if (!requireOf(it, progressOf(me, view)).every((x) => x.ok)) return fail(res, 403, '아직 구매 조건을 채우지 못했어요.');
  if (coinsFor(me, view) < it.price) return fail(res, 400, '코인이 부족해요.');
  me.coins = (me.coins || 0) - it.price;
  me.owned = [...(me.owned || []), it.id];
  me.equipped = { ...equippedOf(me), [it.slot]: it.id }; // 사면 바로 착용
  save(); send(res, 200, shopView(me));
});

// { itemIds: [...] } 여러 부위 한 번에 (옷장에서 겹쳐 입어 본 것) · 예전 화면은 { itemId }
// 하나라도 못 입는 게 있으면 아무것도 안 바꾼다 (일부만 입혀지지 않게)
route('POST', '/api/shop/equip', 'member', async (req, res, { me, body }) => {
  const ids = Array.isArray(body.itemIds) ? body.itemIds.slice(0, 10) : [body.itemId];
  const its = ids.map(itemById);
  if (!its.length || its.some((it) => !it || !owned(me).has(it.id) || !fitsMember(it, me))) return fail(res, 404, '가진 아이템만 착용할 수 있어요.');
  me.equipped = { ...equippedOf(me), ...Object.fromEntries(its.map((it) => [it.slot, it.id])) };
  save(); send(res, 200, shopView(me));
});
