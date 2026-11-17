// 콜아웃 API: 회원 도전장 보내기·취소, 코치 승인(승인하면 바로 경기)
const { route } = require('../core/router');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid, now } = require('../core/util');
const { memberById } = require('../members/model');
const { skillsOf } = require('../skills/model');
const { runFight, seenBy } = require('../fights/model');

// live: 경기는 치러졌지만 보는 사람이 아직 중계를 안 봄 → '경기 중'으로 표시
function calloutView(c, me) {
  const f = c.fightId && db.fights.find((x) => x.id === c.fightId);
  return { ...c, challenger: memberById(c.challengerId)?.name, opponent: memberById(c.opponentId)?.name, live: !!f && !seenBy(f, me) };
}

route('GET', '/api/callouts', 'any', async (req, res, { me, session }) => {
  let list = db.callouts;
  if (session.role === 'member') list = list.filter((c) => c.challengerId === me.id || c.opponentId === me.id);
  send(res, 200, list.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map((c) => calloutView(c, me)));
});

route('POST', '/api/callouts', 'member', async (req, res, { me, body }) => {
  const opp = memberById(body.opponentId);
  if (!opp || opp.id === me.id) return fail(res, 400, '상대를 선택해주세요.');
  if (!skillsOf(me.id).length) return fail(res, 400, '배운 기술이 없습니다. 코치에게 기술 등록을 받으세요.');
  if (!skillsOf(opp.id).length) return fail(res, 400, '상대에게 등록된 기술이 없습니다.');
  const dup = db.callouts.find((c) => c.status === 'pending_coach' &&
    ((c.challengerId === me.id && c.opponentId === opp.id) || (c.challengerId === opp.id && c.opponentId === me.id)));
  if (dup) return fail(res, 409, '이미 대기 중인 콜아웃이 있습니다.');
  const c = {
    id: uid(), challengerId: me.id, opponentId: opp.id,
    message: String(body.message || '').slice(0, 80),
    status: 'pending_coach', createdAt: now(), fightId: null,
  };
  db.callouts.push(c); save();
  send(res, 201, calloutView(c));
});

route('POST', '/api/callouts/:id/cancel', 'member', async (req, res, { me, params }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c || c.challengerId !== me.id) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (c.status !== 'pending_coach') return fail(res, 409, '취소할 수 없는 상태입니다.');
  c.status = 'cancelled'; save(); send(res, 200, calloutView(c));
});

// ── 코치
route('POST', '/api/coach/callouts/:id', 'coach', async (req, res, { params, body }) => {
  const c = db.callouts.find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '콜아웃을 찾을 수 없습니다.');
  if (c.status !== 'pending_coach') return fail(res, 409, '이미 처리된 콜아웃입니다.');
  c.coachNote = String(body.note || '').slice(0, 80);
  if (!body.approve) { c.status = 'rejected'; save(); return send(res, 200, calloutView(c)); }
  // 코치가 승인하면 상대 수락 없이 바로 경기
  const A = memberById(c.challengerId), B = memberById(c.opponentId);
  if (!A || !B) return fail(res, 404, '선수 정보가 없습니다.');
  const fight = runFight(A, B);
  c.status = 'done'; c.fightId = fight.id;
  save(); send(res, 200, calloutView(c));
});
