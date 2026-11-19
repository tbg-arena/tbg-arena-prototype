// 콤비네이션 API
// - 회원: 내 콤비 목록(열림·잠김) · 열린 콤비를 필살기로 장착
// - 코치: 콤비 추가 · 수정 · 삭제 (모르는 동작은 저장 전에 막음. 회원에게 열리는지는 배운 기술로 자동 계산)
require('./migrate');
const { route } = require('../core/router');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid } = require('../core/util');
const { addPrivateFields, privateMember, viewFor } = require('../fighter/model');
const { checkText, combosOf, allCombos, comboView } = require('./model');

// 홈 '필살기' 카드: 열린 콤비 수 + 지금 필살기가 콤비로 장착한 거면 그 콤비 글자 (직접 만든 필살기면 null → 기술 이름으로 보여줌)
addPrivateFields((m) => {
  const list = combosOf(m.id, m.finisher);
  return { comboOpen: list.filter((c) => c.open).length, finisherCombo: list.find((c) => c.equipped)?.text || null };
});

route('GET', '/api/me/combos', 'member', async (req, res, { me }) => {
  const list = combosOf(me.id, me.finisher);
  // 열린 것 먼저, 그 안에서는 코치가 정한 순서 (앞쪽이 쉬운 콤비)
  send(res, 200, [...list.filter((c) => c.open), ...list.filter((c) => !c.open)].map(({ ids, ...c }) => c));
});

route('POST', '/api/me/combos/:id/equip', 'member', async (req, res, { me, params }) => {
  const c = combosOf(me.id).find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '콤비를 찾을 수 없어요.');
  if (!c.open) return fail(res, 409, `아직 안 배운 동작이 있어요: ${c.missing.join(', ')}`);
  me.finisher = c.ids;
  save(); send(res, 200, privateMember(me, viewFor(me)));
});

// ── 코치
const list = () => allCombos().map(comboView);
// 글자 정리: 줄바꿈 · 여러 칸 띄어쓰기는 한 칸으로
const readText = (body) => String(body.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const dupe = (text, id) => db.combos.some((c) => c.text === text && c.id !== id);

route('GET', '/api/coach/combos', 'coach', async (req, res) => send(res, 200, list()));

route('POST', '/api/coach/combos', 'coach', async (req, res, { body }) => {
  const text = readText(body), bad = checkText(text);
  if (bad) return fail(res, 400, bad);
  if (dupe(text)) return fail(res, 409, '이미 있는 콤비예요.');
  if (db.combos.length >= 300) return fail(res, 400, '콤비는 300개까지 만들 수 있어요.');
  db.combos.push({ id: uid(), text });
  save(); send(res, 201, list());
});

// 장착된 필살기는 기술 id 로 저장돼 있어서, 콤비를 고치거나 지워도 회원 필살기는 그대로
route('PUT', '/api/coach/combos/:id', 'coach', async (req, res, { params, body }) => {
  const c = db.combos.find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '콤비를 찾을 수 없어요.');
  const text = readText(body), bad = checkText(text);
  if (bad) return fail(res, 400, bad);
  if (dupe(text, c.id)) return fail(res, 409, '이미 있는 콤비예요.');
  c.text = text;
  save(); send(res, 200, list());
});

route('DELETE', '/api/coach/combos/:id', 'coach', async (req, res, { params }) => {
  if (!db.combos.some((x) => x.id === params.id)) return fail(res, 404, '콤비를 찾을 수 없어요.');
  db.combos = db.combos.filter((x) => x.id !== params.id);
  save(); send(res, 200, list());
});
