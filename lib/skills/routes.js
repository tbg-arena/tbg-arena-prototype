// 기술 API (코치): 회원이 배운 기술 등록·수정(숙련 조정)·삭제
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid, now, clamp } = require('../core/util');
const { CATEGORIES, MOVES, guessMove, validMove, FIN_LEN } = require('../fights/engine');
const { memberById } = require('../members/model');
const { skillsOf } = require('./model');

addMeta({ categories: CATEGORIES, moves: MOVES });

route('POST', '/api/coach/members/:id/skills', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const name = String(body.name || '').trim().slice(0, 24);
  const category = CATEGORIES[body.category] ? body.category : null;
  const mastery = clamp(parseInt(body.mastery, 10) || 10, 1, 100);
  if (!name || !category) return fail(res, 400, '기술 이름과 분류를 입력해주세요.');
  if (skillsOf(m.id).length >= 30) return fail(res, 400, '기술은 최대 30개까지 등록할 수 있습니다.');
  if (skillsOf(m.id).some((s) => s.name === name)) return fail(res, 409, '이미 등록된 기술입니다.');
  const move = validMove(category, body.move) ? body.move : guessMove(category, name);
  const s = { id: uid(), memberId: m.id, name, category, move, mastery, desc: String(body.desc || '').slice(0, 60), createdAt: now() };
  db.skills.push(s); save();
  send(res, 201, s);
});

route('PUT', '/api/coach/skills/:id', 'coach', async (req, res, { params, body }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  if (body.mastery != null) s.mastery = clamp(parseInt(body.mastery, 10) || 1, 1, 100);
  if (body.name) s.name = String(body.name).trim().slice(0, 24);
  if (CATEGORIES[body.category]) s.category = body.category;
  if (validMove(s.category, body.move)) s.move = body.move;
  else if (!validMove(s.category, s.move)) s.move = guessMove(s.category, s.name);
  save(); send(res, 200, s);
});

route('DELETE', '/api/coach/skills/:id', 'coach', async (req, res, { params }) => {
  const s = db.skills.find((x) => x.id === params.id);
  if (!s) return fail(res, 404, '기술을 찾을 수 없습니다.');
  db.skills = db.skills.filter((x) => x.id !== s.id);
  // 지운 기술은 필살기 콤보에서 빼고, 2개 미만으로 남으면 필살기 해제
  const m = memberById(s.memberId);
  if (m?.finisher) { const f = m.finisher.filter((id) => id !== s.id); m.finisher = f.length >= FIN_LEN.min ? f : null; }
  save(); send(res, 200, { ok: true });
});
