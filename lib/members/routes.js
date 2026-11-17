// 회원 관리 API (코치): 회원 목록·등록·수정·삭제
require('./migrate');
const store = require('../core/store');
const { route } = require('../core/router');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { digits } = require('../core/util');
const { GENDER, memberById, newMember } = require('./model');
const { skillsOf } = require('../skills/model');
const { publicMember, privateMember } = require('../fighter/model');
const { rebuildRecords } = require('../fights/model');

route('GET', '/api/coach/members', 'coach', async (req, res) => {
  send(res, 200, db.members.map((m) => ({ ...privateMember(m), phone: m.phone, skills: skillsOf(m.id) })));
});

route('POST', '/api/coach/members', 'coach', async (req, res, { body }) => {
  const name = String(body.name || '').trim().slice(0, 20);
  const phone = digits(body.phone);
  if (!name) return fail(res, 400, '이름을 입력해주세요.');
  if (phone.length < 10 || phone.length > 11) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
  if (db.members.some((m) => m.phone === phone)) return fail(res, 409, '이미 등록된 전화번호입니다.');
  const m = newMember({ name, phone, gender: body.gender });
  db.members.push(m); save();
  send(res, 201, publicMember(m));
});

route('PUT', '/api/coach/members/:id', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  if (body.name) m.name = String(body.name).trim().slice(0, 20);
  if (body.gender) m.gender = GENDER(body.gender);
  if (body.phone) {
    const p = digits(body.phone);
    if (p.length < 10 || p.length > 11) return fail(res, 400, '전화번호를 정확히 입력해주세요.');
    if (db.members.some((x) => x.phone === p && x.id !== m.id)) return fail(res, 409, '이미 등록된 전화번호입니다.');
    m.phone = p;
  }
  save(); send(res, 200, publicMember(m));
});

route('DELETE', '/api/coach/members/:id', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  db.members = db.members.filter((x) => x.id !== m.id);
  db.skills = db.skills.filter((s) => s.memberId !== m.id);
  // 이 회원이 나온 경기 기록(중계 포함)과 관련 콜아웃도 함께 삭제
  const gone = db.fights.filter((f) => f.a === m.id || f.b === m.id).map((f) => f.id);
  db.fights = db.fights.filter((f) => f.a !== m.id && f.b !== m.id);
  db.callouts = db.callouts.filter((c) => c.challengerId !== m.id && c.opponentId !== m.id);
  if (gone.length) rebuildRecords(db); // 상대 선수 승패·포인트에서도 빠지도록
  await store.dropFights(gone);
  for (const [t, s] of Object.entries(db.sessions)) if (s.memberId === m.id) delete db.sessions[t];
  save(); send(res, 200, { ok: true });
});
