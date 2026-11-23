// 기본 전략 추천: 배운 기술 숙련 · 능력치 · 최근 컨디셔닝 기록으로 스타일 · 가드 · 공략 부위를 고른다
// 점수는 fights/engine.js 의 실제 보정값을 따라간다 — 엔진 수치를 바꾸면 여기도 같이 볼 것
//   인파이팅: 훅·어퍼·바디 비중 ×1.3, 공격권 ×1.35 (지치면 줄어듦 → 체력·유산소가 받쳐 줘야 함)
//   아웃복싱: 잽 비중 ×1.6 (스피드로 공격권)
//   카운터:  받아치기 4% → 12% (디펜스·스텝 숙련이 높을수록 더)
// 스탠스는 몸에 정해진 것이라 추천하지 않는다.
const { db } = require('../core/db');
const { today } = require('../core/util');

const RECENT_DAYS = 28;
const CARDIO = ['m', 'sec', 'kcal']; // 거리 · 시간 · 칼로리 운동 = 유산소
const KEEP_MARGIN = 1.2; // 다른 스타일이 지금 스타일보다 20% 넘게 높아야 바꾸자고 함

function recommendStrategy(m, skills) {
  if (!skills.length) return null; // 배운 게 없으면 추천할 근거가 없음
  const sum = (cats) => skills.filter((s) => cats.includes(s.category)).reduce((t, s) => t + s.mastery, 0);
  const best = (cats) => Math.max(0, ...skills.filter((s) => cats.includes(s.category)).map((s) => s.mastery));
  const st = m.stats;

  // 최근 4주 유산소 운동한 날 수 (같은 날 여러 종목은 하루로)
  const from = new Date(Date.parse(today() + 'T00:00:00Z') - RECENT_DAYS * 864e5).toISOString().slice(0, 10);
  const cardioDays = new Set((db.conditioning || []).filter((c) => c.memberId === m.id && c.day >= from && CARDIO.includes(c.unit)).map((c) => c.day)).size;

  // 점수 = 그 스타일이 자주 쓰는 분류의 숙련 합 + 받쳐 주는 능력치
  // + 인파이팅은 최근 유산소 (덤: 하루 1.25점 · 최대 15점 — 운동 루틴만으로 스타일이 뒤집히지 않게)
  const scores = [
    { v: '인파이팅', score: sum(['hook', 'uppercut', 'body']) + st.stamina + Math.min(cardioDays, 12) * 1.25,
      why: cardioDays >= 4 ? `훅·어퍼·바디 숙련에 최근 4주 유산소 ${cardioDays}일 — 압박을 버틸 체력이 있어요` : '훅·어퍼·바디 숙련이 가장 높아요' },
    { v: '아웃복싱', score: sum(['jab']) + st.speed, why: '잽·스트레이트 숙련이 가장 높아요' },
    { v: '카운터', score: sum(['defense', 'step']) + st.iq, why: '디펜스·스텝 숙련이 높아 받아치기에 유리해요' },
  ].sort((a, b) => b.score - a.score);
  // 지금 스타일을 확실히(KEEP_MARGIN) 넘어설 때만 바꾸자고 한다 — 숙련 +1 같은 작은 변화로 추천이 오락가락하지 않게
  const cur = scores.find((x) => x.v === m.strategy?.style);
  const style = cur && cur !== scores[0] && scores[0].score < cur.score * KEEP_MARGIN
    ? { v: cur.v, why: '지금 스타일이 잘 맞아요 — 다른 스타일과 차이가 크지 않아요' }
    : scores[0];

  // 가드: 배운 디펜스 기술 이름으로 (숄더롤 / 블로킹 계열), 둘 다 배웠으면 숙련 높은 쪽
  const named = (re) => Math.max(0, ...skills.filter((s) => s.category === 'defense' && re.test(s.name)).map((s) => s.mastery));
  const roll = named(/숄더\s*롤|필리\s*셸/), block = named(/블로킹|블록|커버/);
  const guard = roll && roll >= block ? { v: '숄더롤', why: '숄더롤을 배워서 잽 방어 · 카운터가 올라가요' }
    : block ? { v: '하이가드', why: '블로킹을 배워서 얼굴 펀치 방어가 올라가요' }
    : { v: '밸런스', why: '가드 기술을 아직 안 배워서 고르게 막는 게 나아요' };

  // 공략 부위: 바디샷이 헤드 펀치만큼 숙련되면 바디도
  const body = best(['body']), head = best(['jab', 'hook', 'uppercut']);
  const focus = body && body >= head * 0.8 ? { v: ['헤드', '바디'], why: '바디샷 숙련이 헤드 펀치 못지않아요' }
    : { v: ['헤드'], why: body ? '헤드 펀치 숙련이 바디샷보다 확실히 높아요' : '바디샷을 아직 안 배웠어요' };

  return { style: { v: style.v, why: style.why }, guard, focus, cardioDays };
}

module.exports = { recommendStrategy };
