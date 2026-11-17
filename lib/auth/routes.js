// 인증 API: 회원 로그인(전화번호) · 코치 로그인(PIN) · 로그아웃
const { route } = require('../core/router');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid, now, digits } = require('../core/util');

const COACH_PIN = process.env.COACH_PIN || '1234';

route('POST', '/api/login', null, async (req, res, { body }) => {
  const phone = digits(body.phone);
  if (phone.length < 10) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
  const m = db.members.find((x) => x.phone === phone);
  if (!m) return fail(res, 404, '등록되지 않은 번호입니다. 코치에게 회원 등록을 요청하세요.');
  const token = uid() + uid();
  db.sessions[token] = { role: 'member', memberId: m.id, at: now() };
  save(); send(res, 200, { token, role: 'member' });
});

route('POST', '/api/coach/login', null, async (req, res, { body }) => {
  if (String(body.pin || '') !== COACH_PIN) return fail(res, 401, 'PIN이 올바르지 않습니다.');
  const token = uid() + uid();
  db.sessions[token] = { role: 'coach', at: now() };
  save(); send(res, 200, { token, role: 'coach' });
});

route('POST', '/api/logout', 'any', async (req, res, { token }) => {
  delete db.sessions[token]; save(); send(res, 200, { ok: true });
});

module.exports = { COACH_PIN };
