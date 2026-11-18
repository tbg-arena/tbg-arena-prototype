// 출석 API — 코치: 출석 체크 (체육관에 실제로 나온 회원만 능력치가 성장, 오를수록 둔화) / 회원: 내 출석 날짜
require('./migrate');
const { route } = require('../core/router');
const { save } = require('../core/db');
const { send, fail } = require('../core/http');
const { today, clamp } = require('../core/util');
const { memberById } = require('../members/model');
const { privateMember } = require('../fighter/model');
const { refresh, runAttendHooks, runAttendChecks, runAttendCancels, runRecordChecks, runRecordAdds, runRecordRemoves } = require('./model');

const STAT_MAX = 99;
const ATTEND_GAIN = 1.5; // 출석 1회당 능력치 성장 기준치 (높을수록 성장 둔화)

route('POST', '/api/coach/members/:id/attend', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  refresh(m);
  if (m.attended) return fail(res, 409, '오늘 이미 출석 체크했습니다.');
  const blocked = runAttendChecks(m); // 예: 수강권 없음 → { error, code }
  if (blocked) return send(res, 409, blocked);
  m.attended = true; m.attendDay = today(); m.attendCount = (m.attendCount || 0) + 1;
  m.attendLog = [...(m.attendLog || []), today()]; // 출석한 날짜 기록 (달력)
  const gains = {}, delta = {};
  for (const k of Object.keys(m.stats)) {
    const cur = m.stats[k];
    const g = ATTEND_GAIN * (0.6 + Math.random() * 0.8) * (1 - cur / (STAT_MAX + 20));
    m.stats[k] = clamp(cur + g, 0, Math.max(STAT_MAX, cur)); // 코치가 준 100은 출석해도 99로 깎지 않음
    gains[k] = Math.floor(m.stats[k]) - Math.floor(cur);
    delta[k] = m.stats[k] - cur;
  }
  m.attendToday = { day: today(), delta }; // 오늘 오른 능력치 (오늘 출석을 취소하면 되돌림)
  runAttendHooks(m);
  save(); send(res, 200, { ...privateMember(m), gains });
});

// 회원: 내 출석 날짜 (달력용, 'YYYY-MM-DD' 오름차순)
route('GET', '/api/me/attendance', 'member', async (req, res, { me }) => {
  send(res, 200, { days: [...new Set(me.attendLog || [])].sort() });
});

// ── 코치: 출석 기록 정리 (달력)
// - 지난 날짜: 추가·삭제 (기능 도입 전 출석 · 수강권 없이 했던 출석 맞추기). 그 날짜 수강권에서 차감·복구, 능력치·코인·누적 출석 수는 그대로
// - 오늘: 잘못 누른 출석 취소. 수강권 1회 · 출석 표시 · 누적 출석 수 · 오늘 오른 능력치 · 출석 코인을 되돌림
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isPastDate = (s) => isDay(s) && s < today();
const daysOf = (m) => [...new Set(m.attendLog || [])].sort();

route('GET', '/api/coach/members/:id/attendance', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, { days: daysOf(m), today: today() });
});

route('POST', '/api/coach/members/:id/attendance', 'coach', async (req, res, { params, body }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const date = String(body.date || '');
  if (!isPastDate(date)) return fail(res, 400, '오늘 이전 날짜만 기록할 수 있어요. 오늘 출석은 출석 버튼으로 해 주세요.');
  if (daysOf(m).includes(date)) return fail(res, 409, '이미 출석으로 기록된 날이에요.');
  const blocked = runRecordChecks(m, date); // 예: 그 날짜에 쓸 수강권 없음 → { error, code }
  if (blocked) return send(res, 409, blocked);
  m.attendLog = [...daysOf(m), date].sort();
  runRecordAdds(m, date);
  save(); send(res, 200, { days: daysOf(m), today: today() });
});

route('DELETE', '/api/coach/members/:id/attendance/:date', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const date = params.date;
  if (date === today()) { // 오늘 출석 취소
    refresh(m);
    if (!m.attended) return fail(res, 404, '오늘 출석 기록이 없어요.');
    if (m.attendToday?.day === date) for (const [k, d] of Object.entries(m.attendToday.delta)) m.stats[k] = clamp(m.stats[k] - d, 0, Math.max(STAT_MAX, m.stats[k]));
    delete m.attendToday;
    m.attended = false; m.attendCount = Math.max(0, (m.attendCount || 0) - 1);
    m.attendLog = daysOf(m).filter((d) => d !== date);
    m.attendDay = m.attendLog[m.attendLog.length - 1] || null;
    runAttendCancels(m, date);
    save(); return send(res, 200, { days: daysOf(m), today: today(), cancelledToday: true });
  }
  if (!isPastDate(date)) return fail(res, 400, '오늘 이전 날짜만 지울 수 있어요.');
  if (!daysOf(m).includes(date)) return fail(res, 404, '그 날은 출석 기록이 없어요.');
  m.attendLog = daysOf(m).filter((d) => d !== date);
  runRecordRemoves(m, date);
  save(); send(res, 200, { days: daysOf(m), today: today() });
});
