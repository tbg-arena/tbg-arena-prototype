// 컨디셔닝 API: 회원 — 내가 한 운동 보기 / 코치 — 회원 운동 넣기 · 잘못 넣은 기록 삭제
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid, now, today } = require('../core/util');
const { memberById } = require('../members/model');
const { EXERCISES, isDay, cleanItem, viewOf } = require('./model');

addMeta({ conditioningExercises: EXERCISES });

// 회원: 내 컨디셔닝 기록 · 최고 기록 · 이번 주 운동량
route('GET', '/api/conditioning', 'member', async (req, res, { me }) => {
  send(res, 200, viewOf(me.id));
});

// 코치: 회원 목록 (오늘 출석 여부 · 마지막 운동일 · 기록 수) — 입력할 회원 고르기
route('GET', '/api/coach/conditioning', 'coach', async (req, res) => {
  const last = new Map(), count = new Map();
  for (const c of db.conditioning) {
    count.set(c.memberId, (count.get(c.memberId) || 0) + 1);
    if (!last.has(c.memberId) || c.day > last.get(c.memberId)) last.set(c.memberId, c.day);
  }
  send(res, 200, db.members.map((m) => ({ id: m.id, name: m.name, attended: !!m.attended, lastDay: last.get(m.id) || null, count: count.get(m.id) || 0 }))
    .sort((a, b) => (b.attended - a.attended) || a.name.localeCompare(b.name, 'ko')));
});

// 코치: 회원 한 명의 기록
route('GET', '/api/coach/members/:id/conditioning', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, viewOf(m.id));
});

// 코치: 운동 넣기 { day?(기본 오늘), items: [{ exercise, kg?, reps?, sets, memo? }] }
route('POST', '/api/coach/members/:id/conditioning', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const day = body.day ? String(body.day) : today();
  if (!isDay(day)) return fail(res, 400, '날짜를 확인해 주세요.');
  if (day > today()) return fail(res, 400, '앞으로의 날짜에는 넣을 수 없어요.');
  const raw = Array.isArray(body.items) ? body.items : [];
  if (!raw.length) return fail(res, 400, '운동을 하나 이상 넣어 주세요.');
  if (raw.length > 20) return fail(res, 400, '한 번에 20개까지 넣을 수 있어요.');
  const items = [];
  for (let i = 0; i < raw.length; i++) {
    const r = cleanItem(raw[i], i);
    if (r.error) return fail(res, 400, r.error);
    items.push(r.item);
  }
  const at = now();
  items.forEach((it, i) => db.conditioning.push({ id: uid(), memberId: m.id, day, ...it, at: at + i }));
  save();
  send(res, 201, viewOf(m.id));
});

// 코치: 잘못 넣은 기록 삭제
route('DELETE', '/api/coach/conditioning/:id', 'coach', async (req, res, { params }) => {
  const c = db.conditioning.find((x) => x.id === params.id);
  if (!c) return fail(res, 404, '기록을 찾을 수 없습니다.');
  db.conditioning = db.conditioning.filter((x) => x.id !== c.id);
  save();
  send(res, 200, viewOf(c.memberId));
});
