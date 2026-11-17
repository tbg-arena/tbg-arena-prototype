// 선수 API: 내 정보 · 내 전략 · 내 콤보 · 랭킹(회원 목록) · 선수 분석
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { memberById } = require('../members/model');
const { unseenOf } = require('../fights/model');
const { STRATEGY, viewFor, skillsView, publicMember, privateMember } = require('./model');
const { skillsOf } = require('../skills/model');
const { CATEGORIES, COMBO_MAX } = require('../fights/engine');

addMeta({ strategy: STRATEGY, comboMax: COMBO_MAX });

route('GET', '/api/me', 'member', async (req, res, { me }) => {
  // 아직 안 본 경기 = 코치 승인으로 치러진 경기 (상대 이름과 함께)
  const unseen = unseenOf(me).map((f) => {
    const oid = f.a === me.id ? f.b : f.a;
    return { id: f.id, name: memberById(oid)?.name || (f.a === me.id ? f.bName : f.aName) };
  });
  const view = viewFor(me);
  send(res, 200, {
    member: privateMember(me, view),
    skills: skillsView(me.id, view),
    pendingForMe: db.callouts.filter((c) => c.opponentId === me.id && c.status === 'pending_opponent').length,
    unseenFights: unseen,
  });
});

route('PUT', '/api/me/strategy', 'member', async (req, res, { me, body }) => {
  const s = { ...me.strategy };
  for (const k of ['stance', 'guard', 'style']) if (STRATEGY[k].includes(body[k])) s[k] = body[k];
  if (Array.isArray(body.focus)) {
    const r = body.focus.filter((x) => STRATEGY.focus.includes(x));
    if (r.length) s.focus = r;
  }
  me.strategy = s; save();
  send(res, 200, privateMember(me, viewFor(me)));
});

// 콤보 루틴: 내 기술 id 2개 이상(공격 1개 이상), 최대 5개
route('PUT', '/api/me/combos', 'member', async (req, res, { me, body }) => {
  const own = skillsOf(me.id).filter((s) => CATEGORIES[s.category]);
  const mine = new Set(own.map((s) => s.id));
  const attack = new Set(own.filter((s) => CATEGORIES[s.category].group === 'attack').map((s) => s.id));
  const list = Array.isArray(body.combos) ? body.combos : null;
  if (!list || list.length > COMBO_MAX.combos) return fail(res, 400, `콤보는 최대 ${COMBO_MAX.combos}개까지 만들 수 있어요.`);
  for (const c of list) {
    if (!Array.isArray(c) || c.length < COMBO_MAX.min || c.length > COMBO_MAX.max) return fail(res, 400, `콤보 하나에 기술은 ${COMBO_MAX.min}~${COMBO_MAX.max}개예요.`);
    if (!c.every((id) => mine.has(id))) return fail(res, 400, '내 기술로만 콤보를 만들 수 있어요.');
    if (!c.some((id) => attack.has(id))) return fail(res, 400, '콤보에 공격 기술이 하나는 있어야 해요.');
  }
  me.combos = list.map((c) => c.map(String)); save();
  send(res, 200, privateMember(me, viewFor(me)));
});

route('GET', '/api/members', 'any', async (req, res, { me }) => {
  const view = viewFor(me);
  send(res, 200, db.members.map((m) => publicMember(m, view)).sort((a, b) => b.points - a.points || b.power - a.power));
});

route('GET', '/api/members/:id', 'any', async (req, res, { me, params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const view = viewFor(me);
  send(res, 200, { member: { ...publicMember(m, view), strategy: m.strategy }, skills: skillsView(m.id, view).map(({ name, category, mastery }) => ({ name, category, mastery })) });
});
