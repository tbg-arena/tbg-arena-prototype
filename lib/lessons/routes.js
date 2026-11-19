// 배운 것 넣기 API (코치)
// - 커리큘럼: 주차 보기(누구나) · 추가 · 수정(순서 이동 포함) · 삭제 (코치)
// - 출석 직후 시트: 그 회원의 오늘 주차 + 오늘 한 운동 저장
// - '배운 것' 탭: 오늘 출석한 회원에게 각자 주차를 한 번에 넣고, 넣은 것을 되돌린다
require('./migrate');
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { uid } = require('../core/util');
const { CATEGORIES, validMove } = require('../fights/engine');
const { refresh, onAttendRecordRemove } = require('../attendance/model');
const { addPrivateFields } = require('../fighter/model');
const { memberById } = require('../members/model');
const { weeks, TRAININGS, lastWeek, nextWeek, lapsOf, todayWeek, give, undoDay, train, untrain } = require('./model');

addMeta({ trainings: TRAININGS });
// 출석 응답(코치)에 실어서, 출석 직후 시트가 바로 다음 주차를 채울 수 있게
addPrivateFields((m) => ({ lessonLast: lastWeek(m.id), lessonNext: nextWeek(m.id), lessonToday: todayWeek(m.id) }));
// 출석을 지우면 (지난 날짜 · 오늘) 그날 넣은 주차와 운동 보너스도 없던 일로
onAttendRecordRemove((m, date) => { undoDay(m, date); untrain(m, date); });

// ── 커리큘럼
const weekView = (w, i) => ({ week: i + 1, id: w.id, title: w.title, content: w.content, points: w.points, stats: w.stats, skill: w.skill?.[0] || null, skillCat: w.skill?.[1] || null, skillMove: w.skill?.[2] || null });
const curriculum = () => weeks().map(weekView);

route('GET', '/api/curriculum', 'any', async (req, res) => send(res, 200, curriculum()));

const STAT_KEYS = ['power', 'speed', 'stamina', 'iq', 'chin'];
const STAT_LIMIT = 5; // 주차 하나로 오를 수 있는 능력치 상한 (오타로 100 같은 값이 들어가지 않게)
const str = (v, n) => String(v ?? '').trim().slice(0, n);

// 코치가 보낸 주차 내용 검사 → { week } 또는 { error }
function readWeek(body) {
  const title = str(body.title, 30);
  if (!title) return { error: '주차 이름을 입력해 주세요.' };
  const points = (Array.isArray(body.points) ? body.points : []).map((p) => str(p, 40)).filter(Boolean).slice(0, 6);
  let skill = null;
  if (body.skill) {
    const name = str(body.skill.name, 24), cat = body.skill.category, move = body.skill.move;
    if (!name || !CATEGORIES[cat] || !validMove(cat, move)) return { error: '기술 이름 · 분류 · 세부 기술을 확인해 주세요.' };
    skill = [name, cat, move];
  }
  const stats = {};
  for (const k of STAT_KEYS) {
    const v = Math.round(Number(body.stats?.[k]) * 2) / 2; // 0.5 단위
    if (Number.isFinite(v) && v > 0) stats[k] = Math.min(STAT_LIMIT, v);
  }
  return { week: { title, content: str(body.content, 100), points, skill, stats } };
}
// at: 넣을 자리 (1 = 맨 앞). 없거나 범위 밖이면 맨 뒤
const placeAt = (list, item, at) => {
  const i = Number.isInteger(at) && at >= 1 && at <= list.length + 1 ? at - 1 : list.length;
  list.splice(i, 0, item);
};

route('POST', '/api/coach/curriculum', 'coach', async (req, res, { body }) => {
  const { week, error } = readWeek(body);
  if (error) return fail(res, 400, error);
  if (weeks().length >= 100) return fail(res, 400, '주차는 100개까지 만들 수 있어요.');
  placeAt(db.curriculum, { id: uid(), ...week }, parseInt(body.at, 10));
  save(); send(res, 201, curriculum());
});

route('PUT', '/api/coach/curriculum/:id', 'coach', async (req, res, { params, body }) => {
  const i = weeks().findIndex((w) => w.id === params.id);
  if (i < 0) return fail(res, 404, '주차를 찾을 수 없어요.');
  const { week, error } = readWeek(body);
  if (error) return fail(res, 400, error);
  const [cur] = db.curriculum.splice(i, 1);
  placeAt(db.curriculum, { ...cur, ...week }, body.at == null ? i + 1 : parseInt(body.at, 10));
  save(); send(res, 200, curriculum());
});

// 지워도 이미 받은 회원의 기술 · 능력치 · 기록은 그대로 (진도 계산에서만 빠진다)
route('DELETE', '/api/coach/curriculum/:id', 'coach', async (req, res, { params }) => {
  if (!weeks().some((w) => w.id === params.id)) return fail(res, 404, '주차를 찾을 수 없어요.');
  db.curriculum = weeks().filter((w) => w.id !== params.id);
  save(); send(res, 200, curriculum());
});

// ── 회원별 진도 (전체 회원: 검색으로 출석 안 찍은 회원도 넣을 수 있게. 100명대라 한 번에 보내도 가볍다)
route('GET', '/api/coach/lessons', 'coach', async (req, res) => {
  send(res, 200, db.members.map((m) => ({
    id: m.id, name: m.name, attended: refresh(m).attended,
    last: lastWeek(m.id), next: nextWeek(m.id), laps: lapsOf(m.id), today: todayWeek(m.id),
  })));
});

// 출석 직후 시트: { week: 숫자 | null(진도 안 나감), train: ['fit', ...] }
// 다시 저장하면 오늘 기록을 되돌리고 새로 넣는다 (주차를 고쳐 저장해도 숙련이 두 번 오르지 않게)
route('POST', '/api/coach/members/:id/today', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  if (!refresh(m).attended) return fail(res, 409, '오늘 출석한 회원만 기록할 수 있어요.');
  const week = body.week == null ? null : parseInt(body.week, 10);
  if (week !== null && !weeks()[week - 1]) return fail(res, 400, '주차를 다시 골라 주세요.');
  undoDay(m);
  const lesson = week ? give(m, week) : null;
  const trained = train(m, Array.isArray(body.train) ? body.train.map(String) : []);
  save(); send(res, 200, { week: lesson?.week || null, train: trained });
});

const MAX_BATCH = 200;
const idsOf = (list) => (Array.isArray(list) ? list.slice(0, MAX_BATCH) : []);

// { items: [{ memberId, week }] } → 오늘 이미 받은 회원은 건너뜀
route('POST', '/api/coach/lessons', 'coach', async (req, res, { body }) => {
  let given = 0, skipped = 0;
  for (const it of idsOf(body.items)) {
    const m = memberById(it?.memberId), week = parseInt(it?.week, 10);
    if (m && give(m, week)) given++; else skipped++;
  }
  if (!given && !skipped) return fail(res, 400, '넣을 회원을 골라 주세요.');
  if (given) save();
  send(res, 200, { given, skipped });
});

// { memberIds: [...] } → 그 회원들이 오늘 받은 주차를 없던 일로 (운동 기록은 그대로)
route('POST', '/api/coach/lessons/undo', 'coach', async (req, res, { body }) => {
  let undone = 0;
  for (const id of idsOf(body.memberIds)) { const m = memberById(id); if (m && undoDay(m)) undone++; }
  if (undone) save();
  send(res, 200, { undone });
});
