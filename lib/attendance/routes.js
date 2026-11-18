// 출석 API — 코치: 출석 체크 (체육관에 실제로 나온 회원만 능력치가 성장, 오를수록 둔화) / 회원: 내 출석 날짜
require('./migrate');
const { route } = require('../core/router');
const { save } = require('../core/db');
const { send, fail } = require('../core/http');
const { today, clamp } = require('../core/util');
const { memberById } = require('../members/model');
const { privateMember } = require('../fighter/model');
const { refresh, runAttendHooks, runAttendChecks, runRecordChecks, runRecordAdds, runRecordRemoves } = require('./model');

const STAT_MAX = 99;
const ATTEND_GAIN = 1.5; // 출석 1회당 능력치 성장 기준치 (높을수록 성장 둔화)
const GAIN_KEEP_DAYS = 120; // 날짜별로 오른 능력치를 이만큼만 보관 (그보다 오래된 출석을 지우면 능력치는 그대로)

const daysOf = (m) => [...new Set(m.attendLog || [])].sort();
const lastDay = (m) => { const d = daysOf(m); return d[d.length - 1] || null; };

// 출석 1회분 능력치 성장. 오른 양은 날짜별로 보관해 두고 그 출석을 지우면 되돌림
function grow(m, date) {
  const gains = {}, delta = {};
  for (const k of Object.keys(m.stats)) {
    const cur = m.stats[k];
    const g = ATTEND_GAIN * (0.6 + Math.random() * 0.8) * (1 - cur / (STAT_MAX + 20));
    m.stats[k] = clamp(cur + g, 0, Math.max(STAT_MAX, cur)); // 코치가 준 100은 출석해도 99로 깎지 않음
    gains[k] = Math.floor(m.stats[k]) - Math.floor(cur);
    delta[k] = m.stats[k] - cur;
  }
  const cut = new Date(Date.parse(today() + 'T00:00:00Z') - GAIN_KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  m.attendGains = Object.fromEntries(Object.entries({ ...(m.attendGains || {}), [date]: delta }).filter(([d]) => d >= cut));
  return gains;
}
function ungrow(m, date) {
  const delta = m.attendGains?.[date];
  if (!delta) return;
  for (const [k, d] of Object.entries(delta)) if (k in m.stats) m.stats[k] = clamp(m.stats[k] - d, 0, Math.max(STAT_MAX, m.stats[k]));
  delete m.attendGains[date];
}

route('POST', '/api/coach/members/:id/attend', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  refresh(m);
  if (m.attended) return fail(res, 409, '오늘 이미 출석 체크했습니다.');
  const blocked = runAttendChecks(m); // 예: 수강권 없음 → { error, code }
  if (blocked) return send(res, 409, blocked);
  m.attended = true; m.attendDay = today(); m.attendCount = (m.attendCount || 0) + 1;
  m.attendLog = [...daysOf(m), today()]; // 출석한 날짜 기록 (달력)
  const gains = grow(m, today());
  runAttendHooks(m);
  save(); send(res, 200, { ...privateMember(m), gains });
});

// 회원: 내 출석 날짜 (달력용, 'YYYY-MM-DD' 오름차순)
route('GET', '/api/me/attendance', 'member', async (req, res, { me }) => {
  send(res, 200, { days: daysOf(me) });
});

// ── 코치: 출석 기록 달력
// - 지난 날짜 추가 = 그날 출석 체크와 같음: 누적 출석 +1 · 능력치 성장 · 출석 코인 · 그 날짜 수강권 차감
//   (누적 출석 수 = 출석 날짜 수 로 맞춰 둠 — passes/migrate 참고)
// - 삭제 (지난 날짜 · 오늘) = 그 출석을 없던 일로: 누적 출석 -1 · 출석 코인 회수 · 그날 오른 능력치 되돌림 · 수강권 복구
// - 오늘 출석 체크는 POST /attend (출석 버튼 · 달력 오늘 칸)
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isPastDate = (s) => isDay(s) && s < today();
const view = (m, extra = {}) => ({ days: daysOf(m), today: today(), attendCount: m.attendCount || 0, ...extra });

route('GET', '/api/coach/members/:id/attendance', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, view(m));
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
  m.attendDay = lastDay(m);
  m.attendCount = (m.attendCount || 0) + 1;
  const gains = grow(m, date);
  runRecordAdds(m, date); // passes: 수강권 차감, shop: 출석 코인
  save(); send(res, 200, view(m, { gains }));
});

route('DELETE', '/api/coach/members/:id/attendance/:date', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  const date = params.date;
  if (!isDay(date) || date > today()) return fail(res, 400, '오늘까지의 날짜만 지울 수 있어요.');
  refresh(m);
  if (!daysOf(m).includes(date)) return fail(res, 404, date === today() ? '오늘 출석 기록이 없어요.' : '그 날은 출석 기록이 없어요.');
  m.attendLog = daysOf(m).filter((d) => d !== date);
  m.attendCount = Math.max(0, (m.attendCount || 0) - 1);
  ungrow(m, date);
  if (date === today()) m.attended = false;
  m.attendDay = lastDay(m);
  runRecordRemoves(m, date); // passes: 수강권 복구, shop: 출석 코인 회수
  save(); send(res, 200, view(m));
});
