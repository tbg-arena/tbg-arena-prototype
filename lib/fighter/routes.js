// 선수 API: 내 정보 · 내 전략 · 랭킹(회원 목록) · 선수 분석
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { memberById } = require('../members/model');
const { unseenOf } = require('../fights/model');
const { STRATEGY, viewFor, skillsView, publicMember, privateMember } = require('./model');

addMeta({ strategy: STRATEGY });

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
