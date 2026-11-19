// 배운 것 넣기 API (코치)
// - 출석 직후 시트: 그 회원의 오늘 주차 + 오늘 한 운동 저장
// - '배운 것' 탭: 오늘 출석한 회원에게 각자 주차를 한 번에 넣고, 넣은 것을 되돌린다
const { route } = require('../core/router');
const { addMeta } = require('../core/meta');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { refresh, onAttendRecordRemove } = require('../attendance/model');
const { addPrivateFields } = require('../fighter/model');
const { memberById } = require('../members/model');
const { WEEKS, TRAININGS, lastWeek, nextWeek, lapsOf, todayLesson, give, undoDay, train, untrain } = require('./model');

addMeta({
  weeks: WEEKS.map(({ week, title, skill }) => ({ week, title, skill: skill?.[0] || null })),
  trainings: TRAININGS,
});
// 출석 응답(코치)에 실어서, 출석 직후 시트가 바로 다음 주차를 채울 수 있게
addPrivateFields((m) => ({ lessonLast: lastWeek(m.id), lessonNext: nextWeek(m.id), lessonToday: todayLesson(m.id)?.week || null }));
// 출석을 지우면 (지난 날짜 · 오늘) 그날 넣은 주차와 운동 보너스도 없던 일로
onAttendRecordRemove((m, date) => { undoDay(m, date); untrain(m, date); });

// 전체 회원 (검색으로 출석 안 찍은 회원도 넣을 수 있게). 100명대라 한 번에 보내도 가볍다
route('GET', '/api/coach/lessons', 'coach', async (req, res) => {
  send(res, 200, db.members.map((m) => ({
    id: m.id, name: m.name, attended: refresh(m).attended,
    last: lastWeek(m.id), next: nextWeek(m.id), laps: lapsOf(m.id), today: todayLesson(m.id)?.week || null,
  })));
});

// 출석 직후 시트: { week: 숫자 | null(진도 안 나감), train: ['fit', ...] }
// 다시 저장하면 오늘 기록을 되돌리고 새로 넣는다 (주차를 고쳐 저장해도 숙련이 두 번 오르지 않게)
route('POST', '/api/coach/members/:id/today', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  if (!refresh(m).attended) return fail(res, 409, '오늘 출석한 회원만 기록할 수 있어요.');
  const week = body.week == null ? null : parseInt(body.week, 10);
  if (week !== null && !WEEKS[week - 1]) return fail(res, 400, '주차를 다시 골라 주세요.');
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
