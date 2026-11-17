// 출석 API (코치): 출석 체크 — 체육관에 실제로 나온 회원만 능력치가 성장 (오를수록 둔화)
const { route } = require('../core/router');
const { save } = require('../core/db');
const { send, fail } = require('../core/http');
const { today, clamp } = require('../core/util');
const { memberById } = require('../members/model');
const { privateMember } = require('../fighter/model');
const { refresh } = require('./model');

const STAT_MAX = 99;
const ATTEND_GAIN = 1.5; // 출석 1회당 능력치 성장 기준치 (높을수록 성장 둔화)

route('POST', '/api/coach/members/:id/attend', 'coach', async (req, res, { params }) => {
  const m = memberById(params.id);
  if (!m) return fail(res, 404, '회원을 찾을 수 없습니다.');
  refresh(m);
  if (m.attended) return fail(res, 409, '오늘 이미 출석 체크했습니다.');
  m.attended = true; m.attendDay = today(); m.attendCount = (m.attendCount || 0) + 1;
  const gains = {};
  for (const k of Object.keys(m.stats)) {
    const cur = m.stats[k];
    const g = ATTEND_GAIN * (0.6 + Math.random() * 0.8) * (1 - cur / (STAT_MAX + 20));
    m.stats[k] = clamp(cur + g, 0, STAT_MAX);
    gains[k] = Math.floor(m.stats[k]) - Math.floor(cur);
  }
  save(); send(res, 200, { ...privateMember(m), gains });
});
