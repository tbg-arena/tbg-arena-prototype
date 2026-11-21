// 컨디셔닝: 코치가 넣은 체력운동 기록
// 기록 1개 = 운동 1종목 { id, memberId, day, exercise, kg(null = 맨몸), amount, unit, sets, memo, at }
//   unit: 'rep' 횟수 · 'm' 거리(미터) · 'sec' 시간(초) · 'kcal' 칼로리   (예전 기록의 reps 는 migrate.js 가 amount + 'rep' 로 바꿈)
//   amount: 그 단위의 양 (횟수 운동은 비워도 됨, 거리 · 시간 · 칼로리는 꼭 있음)
// 능력치는 올리지 않는다 (능력치는 출석 · 배운 것으로만). 대신 최고 기록(PR)과 이번 주 운동량으로 동기를 준다.
const { db } = require('../core/db');
const { today } = require('../core/util');

// 단위: 이름 · 최대값 (입력 검사)
const UNITS = {
  rep: { label: '회', max: 999 },
  m: { label: 'm', max: 100000 },
  sec: { label: '초', max: 36000 },
  kcal: { label: 'kcal', max: 5000 },
};

const DAY = 864e5;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const mondayOf = (d) => new Date(Date.parse(d + 'T00:00:00Z') - ((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
const volumeOf = (e) => (e.kg && e.unit === 'rep' && e.amount ? e.kg * e.amount * e.sets : 0); // 들어 올린 무게 합 (kg × 횟수 × 세트)

// 시간은 "1:30" (분:초) · "90" (초) 둘 다 받는다
function parseAmount(v, unit) {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  if (unit === 'sec' && /^\d{1,3}:\d{1,2}$/.test(s)) { const [m, sec] = s.split(':').map(Number); return sec < 60 ? m * 60 + sec : NaN; }
  return Number(s.replace(/,/g, ''));
}

// 입력 한 줄 검사 → { item } 또는 { error }
function cleanItem(x, i) {
  const n = i + 1;
  const exercise = String(x?.exercise ?? '').trim().slice(0, 30);
  if (!exercise) return { error: `${n}번째 운동 이름을 적어 주세요.` };
  const unit = UNITS[x.unit] ? x.unit : 'rep';
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const kg = num(x.kg), sets = num(x.sets);
  const amount = parseAmount(x.amount ?? x.reps, unit); // reps = 예전 화면에서 보낸 값
  if (kg != null && !(Number.isFinite(kg) && kg > 0 && kg <= 300 && Math.round(kg * 2) === kg * 2)) return { error: `${exercise}: 무게는 0.5kg 단위로 300kg까지 적어 주세요. (맨몸이면 비워 두기)` };
  const U = UNITS[unit];
  if (amount == null && unit !== 'rep') return { error: `${exercise}: ${unit === 'sec' ? '시간(예: 1:30)' : unit === 'm' ? '거리(m)' : '칼로리'}를 적어 주세요.` };
  if (amount != null && !(Number.isInteger(amount) && amount >= 1 && amount <= U.max)) {
    return { error: `${exercise}: ${unit === 'sec' ? '시간은 "1:30"(분:초) 또는 초로, 10시간까지' : `${U.label}는 1~${U.max.toLocaleString()} 사이 정수로`} 적어 주세요.` };
  }
  if (!(Number.isInteger(sets) && sets >= 1 && sets <= 50)) return { error: `${exercise}: 세트는 1~50 사이로 적어 주세요.` };
  return { item: { exercise, kg, amount, unit, sets, memo: String(x.memo ?? '').trim().slice(0, 40) } };
}

// 회원 한 명의 컨디셔닝 화면 데이터
function viewOf(memberId) {
  const list = db.conditioning.filter((c) => c.memberId === memberId);
  // 최고 기록: 날짜 순으로 훑으며 종목(+단위)별 최고를 넘은 기록에 표시 (같은 값이 또 나오면 처음 것만)
  //   무게를 적은 운동 = 가장 무거운 무게 / 그 밖 = 한 세트에 가장 많이(많이 · 오래 · 멀리) 한 양
  const asc = list.slice().sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at);
  const best = new Map(), flag = new Map();
  for (const e of asc) {
    const by = e.kg ? 'kg' : e.amount ? e.unit : null;
    if (!by) continue;
    const v = by === 'kg' ? e.kg : e.amount, key = `${e.exercise}|${by}`, b = best.get(key);
    if (!b || v > b.value) { flag.set(e.id, b ? 'pr' : 'first'); best.set(key, { exercise: e.exercise, by, value: v, kg: by === 'kg' ? v : null, day: e.day }); }
  }
  const entries = list.slice().sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at).map((e) => ({ ...e, mark: flag.get(e.id) || null }));
  const t = today(), mon = mondayOf(t);
  const week = entries.filter((e) => e.day >= mon && e.day <= t);
  const sumOf = (unit) => week.filter((e) => e.unit === unit && e.amount).reduce((s, e) => s + e.amount * e.sets, 0);
  return {
    entries,
    prs: [...best.values()].sort((a, b) => b.day.localeCompare(a.day)),
    week: {
      days: new Set(week.map((e) => e.day)).size, sets: week.reduce((s, e) => s + e.sets, 0), volume: Math.round(week.reduce((s, e) => s + volumeOf(e), 0)),
      meters: sumOf('m'), seconds: sumOf('sec'), kcal: sumOf('kcal'), // 유산소 합계 (양 × 세트)
    },
    total: { days: new Set(entries.map((e) => e.day)).size, count: entries.length },
  };
}

module.exports = { UNITS, isDay, cleanItem, viewOf };
