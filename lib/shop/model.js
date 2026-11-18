// 상점: 코인 · 보유 아이템 · 장착 (다른 기능에서도 가져다 쓰는 함수)
// 다른 기능과의 연결은 이 파일 아래쪽에서 등록한다: 경기·출석 코인 지급, 캐릭터 장비 색, 내 코인 표시
const { db } = require('../core/db');
const { addLook, addPrivateFields } = require('../fighter/model');
const { onFightResult } = require('../fights/model');
const { onAttend, onAttendCancel } = require('../attendance/model');
const { ITEMS, DEFAULT_EQUIP } = require('./items');

// 코인 (초안): 경기 승·무·패, KO/TKO 로 이기면 추가, 출석 체크 1회
const COIN = { win: 30, draw: 15, lose: 10, finish: 10, attend: 20 };

const itemById = (id) => ITEMS.find((it) => it.id === id);
// 이 회원이 볼 수 있는 아이템인지 (gender: 'F' = 여자 회원만, 'M' = 남자 회원만)
const fitsMember = (it, m) => !it.gender || it.gender === (m.gender === 'F' ? 'F' : 'M');

function fightCoins(f, id) {
  const { winnerId, method } = f.result || {};
  if (!winnerId) return COIN.draw;
  if (winnerId !== id) return COIN.lose;
  return COIN.win + (method === 'KO' || method === 'TKO' ? COIN.finish : 0);
}
// 경기 코인을 주고, 얼마 줬는지 경기에 기록 (중계 보기 전엔 coinsFor 가 빼고 보여준다)
function giveFightCoins(f, members) {
  f.coins = {};
  for (const m of members) {
    if (!m) continue;
    const n = fightCoins(f, m.id);
    f.coins[m.id] = n;
    m.coins = (m.coins || 0) + n;
  }
}

// 보는 회원 기준 코인: 아직 중계를 안 본 경기에서 받은 코인은 뺀다 (결과가 새지 않도록)
function coinsFor(m, view) {
  let n = m.coins || 0;
  if (view) for (const f of db.fights) if (view.hidden.has(f.id)) n -= f.coins?.[m.id] || 0;
  return n;
}

const owned = (m) => new Set([...ITEMS.filter((it) => it.basic).map((it) => it.id), ...(m.owned || [])]);
// 부위별 장착 아이템 (없거나, 목록에서 사라졌거나, 가지고 있지 않거나, 성별이 안 맞는 아이템이면 기본템)
function equippedOf(m) {
  const mine = owned(m);
  const out = {};
  for (const [slot, def] of Object.entries(DEFAULT_EQUIP)) {
    const id = m.equipped?.[slot];
    const it = itemById(id);
    out[slot] = it?.slot === slot && mine.has(id) && fitsMember(it, m) ? id : def;
  }
  return out;
}
// 장착한 아이템 색을 합친 것 → 캐릭터 그림에 쓰임
function lookFor(m) {
  const look = {};
  for (const id of Object.values(equippedOf(m))) Object.assign(look, itemById(id).look);
  return look;
}

// ── 다른 기능에 연결
onFightResult((f, A, B) => giveFightCoins(f, [A, B]));
onAttend((m) => { m.coins = (m.coins || 0) + COIN.attend; });
onAttendCancel((m) => { m.coins = Math.max(0, (m.coins || 0) - COIN.attend); }); // 오늘 출석 취소 → 출석 코인 회수
addLook((m) => lookFor(m));
addPrivateFields((m, view) => ({ coins: coinsFor(m, view) }));

module.exports = { COIN, itemById, fitsMember, giveFightCoins, coinsFor, owned, equippedOf, lookFor };
