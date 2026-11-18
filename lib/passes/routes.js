// 수강권 API: 회원 — 내 수강권 / 코치 — 회원 수강권 등록 · 내역 · 삭제
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid, now, today } = require('../core/util');
const { memberById } = require('../members/model');
const { PRESETS, isDate, endOf, groupPasses, chargeLogged } = require('./model');

addMeta({ passPresets: PRESETS });

const int = (v, a, b) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : null; };

// 회원: 내 수강권 (사용 중 · 예정 · 지난)
route('GET', '/api/passes', 'member', async (req, res, { me }) => {
  send(res, 200, groupPasses(me.id));
});

// 코치: 회원 수강권 내역
route('GET', '/api/coach/members/:id/passes', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, groupPasses(m.id));
});

// 코치: 수강권 등록 { perWeek, months, total?(기본 주 횟수 × 4 × 개월), start?(기본 오늘), memo? }
route('POST', '/api/coach/members/:id/passes', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const perWeek = int(body.perWeek, 1, 7), months = int(body.months, 1, 24);
  if (!perWeek || !months) return fail(res, 400, '주 횟수와 기간을 골라 주세요.');
  const total = body.total == null || body.total === '' ? perWeek * 4 * months : int(body.total, 1, 999);
  if (!total) return fail(res, 400, '전체 횟수를 1~999 사이로 입력해 주세요.');
  const start = body.start ? String(body.start) : today();
  if (!isDate(start)) return fail(res, 400, '시작일을 확인해 주세요.');
  const p = { id: uid(), memberId: m.id, perWeek, months, total, start, end: endOf(start, months), memo: String(body.memo || '').trim().slice(0, 60), uses: [], createdAt: now() };
  db.passes.push(p);
  chargeLogged(m); // 시작일이 과거면 그 기간에 이미 기록된 출석을 차감
  save();
  send(res, 201, groupPasses(m.id));
});

// 코치: 잘못 넣은 수강권 삭제
route('DELETE', '/api/coach/passes/:id', 'coach', async (req, res, { params }) => {
  const p = db.passes.find((x) => x.id === params.id);
  if (!p) return fail(res, 404, '수강권을 찾을 수 없습니다.');
  db.passes = db.passes.filter((x) => x.id !== p.id); save();
  send(res, 200, groupPasses(p.memberId));
});
