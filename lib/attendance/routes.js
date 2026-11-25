// 출석 API — 회원이 체육관에 와서 직접 출석 (위치 확인). 출석하면 능력치가 성장 (오를수록 둔화)
// 코치: 체육관 위치 설정 · 회원 출석 기록 보기 (출석을 넣거나 지우지는 않음)
require('./migrate');
const { route } = require('../core/router');
const { db, save } = require('../core/db');
const { send, fail } = require('../core/http');
const { today, clamp, now } = require('../core/util');
const { memberById } = require('../members/model');
const { refresh, runAttendHooks, RADIUS, gym, distanceM, readPos } = require('./model');

const STAT_MAX = 99;
const ATTEND_GAIN = 1.5; // 출석 1회당 능력치 성장 기준치 (높을수록 성장 둔화)

const daysOf = (m) => [...new Set(m.attendLog || [])].sort();

// 출석 1회분 능력치 성장 → 오른 정수 칸 { power: 1, ... }
function grow(m) {
  const gains = {};
  for (const k of Object.keys(m.stats)) {
    const cur = m.stats[k];
    const g = ATTEND_GAIN * (0.6 + Math.random() * 0.8) * (1 - cur / (STAT_MAX + 20));
    m.stats[k] = clamp(cur + g, 0, Math.max(STAT_MAX, cur)); // 코치가 준 100은 출석해도 99로 깎지 않음
    gains[k] = Math.floor(m.stats[k]) - Math.floor(cur);
  }
  return gains;
}

const meters = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);

// 회원: 출석 화면 정보 (달력 · 오늘 출석 여부 · 출석 반경). 커리어 탭 훈련 카드도 days 를 씀
route('GET', '/api/me/attendance', 'member', async (req, res, { me }) => {
  refresh(me);
  send(res, 200, { days: daysOf(me), today: today(), attended: !!me.attended, attendCount: me.attendCount || 0, radius: gym() ? RADIUS : null });
});

// 회원: 출석 체크 { lat, lng, accuracy } — 체육관 반경 안일 때만
route('POST', '/api/me/attend', 'member', async (req, res, { me, body }) => {
  const g = gym();
  if (!g) return send(res, 409, { error: '아직 체육관 위치가 등록되지 않았어요. 코치에게 알려 주세요.', code: 'NO_GYM' });
  const pos = readPos(body);
  if (!pos) return fail(res, 400, '위치를 받지 못했어요. 다시 시도해 주세요.');
  refresh(me);
  if (me.attended) return fail(res, 409, '오늘은 이미 출석했어요.');
  const dist = distanceM(pos, g);
  if (dist > RADIUS) {
    const fuzzy = pos.accuracy > RADIUS ?` 위치 오차가 커요(±${meters(pos.accuracy)}). 와이파이를 켜고 다시 해 보세요.` : '';
    return send(res, 409, { error: `체육관에서만 출석할 수 있어요. 지금 체육관에서 약 ${meters(dist)} 떨어져 있어요.${fuzzy}`, code: 'TOO_FAR', distance: Math.round(dist) });
  }
  me.attended = true; me.attendDay = today(); me.attendCount = (me.attendCount || 0) + 1;
  me.attendLog = [...daysOf(me), today()]; // 출석한 날짜 기록 (달력)
  const gains = grow(me);
  runAttendHooks(me); // shop: 출석 코인
  save(); send(res, 200, { gains, days: daysOf(me), attendCount: me.attendCount });
});

// ── 코치: 체육관 위치 (체육관 안에서 '지금 위치로 저장')
route('GET', '/api/coach/gym', 'coach', async (req, res) => {
  send(res, 200, { gym: gym(), radius: RADIUS });
});

// { lat, lng } 를 체육관 위치로 저장 (출석 반경은 RADIUS 로 고정)
route('PUT', '/api/coach/gym', 'coach', async (req, res, { body }) => {
  const pos = readPos(body);
  if (!pos) return fail(res, 400, '위치를 받지 못했어요. 다시 시도해 주세요.');
  db.gym = { lat: pos.lat, lng: pos.lng, setAt: now() };
  save(); send(res, 200, { gym: gym(), radius: RADIUS });
});

// ── 코치: 회원 출석 기록 달력 (보기만)
route('GET', '/api/coach/members/:id/attendance', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  send(res, 200, { days: daysOf(m), today: today(), attendCount: m.attendCount || 0 });
});
