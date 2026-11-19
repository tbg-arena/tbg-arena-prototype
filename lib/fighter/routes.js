// 선수 API: 내 정보 · 내 전략 · 필살기 콤보 · 랭킹(회원 목록) · 선수 분석
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { memberById } = require('../members/model');
const { unseenOf } = require('../fights/model');
const { STRATEGY, viewFor, skillsView, publicMember, privateMember } = require('./model');
const { skillsOf } = require('../skills/model');
const { CATEGORIES, FIN_LEN } = require('../fights/engine');

addMeta({ strategy: STRATEGY, finLen: FIN_LEN });

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
    pendingForMe: db.callouts.filter((c) => c.opponentId === me.id && c.status === 'pending_coach').length,
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

// 필살기 콤보 (회원당 1개): 내 기술 id FIN_LEN 범위 (펀치 없이 디펜스·스텝만도 됨). null 이면 해제
route('PUT', '/api/me/finisher', 'member', async (req, res, { me, body }) => {
  const c = body.finisher;
  if (c != null) {
    const own = skillsOf(me.id).filter((s) => CATEGORIES[s.category]);
    if (!Array.isArray(c) || c.length < FIN_LEN.min || c.length > FIN_LEN.max) return fail(res, 400, `필살기 콤보는 기술 ${FIN_LEN.min}~${FIN_LEN.max}개예요.`);
    if (!c.every((id) => own.some((s) => s.id === id))) return fail(res, 400, '내 기술로만 필살기를 만들 수 있어요.');
  }
  me.finisher = c ? c.map(String) : null;
  delete me.combos; // 일반 콤보는 없어짐 (예전 데이터 정리)
  save(); send(res, 200, privateMember(me, viewFor(me)));
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
