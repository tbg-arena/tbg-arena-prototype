// 컨디셔닝: 코치가 넣은 체력운동 기록
// 기록 1개 = 운동 1종목 { id, memberId, day, exercise, kg(null = 맨몸), reps(null = 횟수 없음 · 시간 운동 등), sets, memo, at }
// 능력치는 올리지 않는다 (능력치는 출석 · 배운 것으로만). 대신 최고 기록(PR)과 이번 주 운동량으로 동기를 준다.
const { db } = require('../core/db');
const { today } = require('../core/util');

// 코치 입력창의 추천 목록 (직접 입력도 됨)
const EXERCISES = [
  '덤벨 컬', '해머 컬', '덤벨 숄더 프레스', '사이드 레터럴 레이즈', '덤벨 로우', '덤벨 벤치 프레스',
  '고블릿 스쿼트', '덤벨 런지', '덤벨 데드리프트', '덤벨 스내치', '푸시업', '버피', '스쿼트 점프',
  '마운틴 클라이머', '플랭크', '크런치', '러시안 트위스트', '줄넘기',
];

const DAY = 864e5;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const mondayOf = (d) => new Date(Date.parse(d + 'T00:00:00Z') - ((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
const volumeOf = (e) => (e.kg && e.reps ? e.kg * e.reps * e.sets : 0); // 들어 올린 무게 합 (kg × 횟수 × 세트)

// 입력 한 줄 검사 → { item } 또는 { error }
function cleanItem(x, i) {
  const n = i + 1;
  const exercise = String(x?.exercise ?? '').trim().slice(0, 30);
  if (!exercise) return { error: `${n}번째 운동 이름을 적어 주세요.` };
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const kg = num(x.kg), reps = num(x.reps), sets = num(x.sets);
  if (kg != null && !(Number.isFinite(kg) && kg > 0 && kg <= 300 && Math.round(kg * 2) === kg * 2)) return { error: `${exercise}: 무게는 0.5kg 단위로 300kg까지 적어 주세요. (맨몸이면 비워 두기)` };
  if (reps != null && !(Number.isInteger(reps) && reps >= 1 && reps <= 999)) return { error: `${exercise}: 횟수는 1~999 사이로 적어 주세요.` };
  if (!(Number.isInteger(sets) && sets >= 1 && sets <= 50)) return { error: `${exercise}: 세트는 1~50 사이로 적어 주세요.` };
  return { item: { exercise, kg, reps, sets, memo: String(x.memo ?? '').trim().slice(0, 40) } };
}

// 회원 한 명의 컨디셔닝 화면 데이터
function viewOf(memberId) {
  const list = db.conditioning.filter((c) => c.memberId === memberId);
  // 최고 기록: 날짜 순으로 훑으며 종목별 최고 무게를 넘은 기록에 pr 표시 (같은 날 같은 무게 여러 번이면 처음 것만)
  const asc = list.slice().sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at);
  const best = new Map(), flag = new Map();
  for (const e of asc) {
    if (!e.kg) continue;
    const b = best.get(e.exercise);
    if (!b || e.kg > b.kg) { flag.set(e.id, b ? 'pr' : 'first'); best.set(e.exercise, { exercise: e.exercise, kg: e.kg, day: e.day }); }
  }
  const entries = list.slice().sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at).map((e) => ({ ...e, mark: flag.get(e.id) || null }));
  const t = today(), mon = mondayOf(t);
  const week = entries.filter((e) => e.day >= mon && e.day <= t);
  return {
    entries,
    prs: [...best.values()].sort((a, b) => b.day.localeCompare(a.day)),
    week: { days: new Set(week.map((e) => e.day)).size, sets: week.reduce((s, e) => s + e.sets, 0), volume: Math.round(week.reduce((s, e) => s + volumeOf(e), 0)) },
    total: { days: new Set(entries.map((e) => e.day)).size, count: entries.length },
  };
}

module.exports = { EXERCISES, isDay, cleanItem, viewOf };
