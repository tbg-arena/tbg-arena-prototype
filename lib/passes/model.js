// 수강권: 주 N회 + 기간(시작일~종료일) + 전체 횟수. 출석하면 1회 차감 (다른 기능에서도 가져다 쓰는 함수)
// - 출석은 '사용 중' 수강권이 있고, 이번 주(월~일) 횟수가 남아 있어야 가능
// - 이번 주에 못 쓴 횟수는 다음 주로 넘어가지 않음
const { db } = require('../core/db');
const { today } = require('../core/util');
const { addPrivateFields } = require('../fighter/model');
const { checkAttend, onAttend, checkAttendRecord, onAttendRecordAdd, onAttendRecordRemove } = require('../attendance/model');

// 자주 쓰는 수강권 (코치 등록 화면의 버튼). 전체 횟수 기본값 = 주 횟수 × 4주 × 개월
const PRESETS = [3, 5].flatMap((perWeek) => [1, 3, 6].map((months) => ({ perWeek, months, total: perWeek * 4 * months })));
const passName = (p) => `주${p.perWeek}회 ${p.months}개월`;

// ── 날짜 ('YYYY-MM-DD', KST 기준 문자열)
const toDate = (s) => new Date(s + 'T00:00:00Z');
const fmt = (d) => d.toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(toDate(s)) && fmt(toDate(s)) === s;
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
// n개월 뒤 같은 날. 그 달에 같은 날이 없으면 말일 (1/31 + 1개월 → 2/28), clamped = 말일로 당겼는지
function addMonths(s, n) {
  const d = toDate(s), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return { date: fmt(d), clamped: day > last };
}
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400e3);
const weekStart = (s) => addDays(s, -((toDate(s).getUTCDay() + 6) % 7)); // 그 주 월요일
// 마지막 날: 11/18 시작 1개월 → 12/17 까지, 1/31 시작 1개월 → 2/28 까지 (다음 달에 같은 날이 없으면 그 달 말일)
function endOf(start, months) {
  const { date, clamped } = addMonths(start, months);
  return clamped ? date : addDays(date, -1);
}

const passesOf = (memberId) => (db.passes || []).filter((p) => p.memberId === memberId);

// 화면에 보낼 수강권 정보
// status: active(사용 중) · scheduled(예정) · expired(기간 만료) · usedUp(횟수 소진)
function passInfo(p, day = today()) {
  const used = p.uses.length;
  const ws = weekStart(day);
  const weekUsed = p.uses.filter((d) => d >= ws && d <= day).length;
  const status = day < p.start ? 'scheduled' : day > p.end ? 'expired' : used >= p.total ? 'usedUp' : 'active';
  return {
    id: p.id, name: passName(p), perWeek: p.perWeek, months: p.months, total: p.total, used, left: Math.max(0, p.total - used),
    weekUsed, weekLeft: Math.max(0, p.perWeek - weekUsed), start: p.start, end: p.end, daysLeft: daysBetween(day, p.end),
    status, memo: p.memo || '', createdAt: p.createdAt,
  };
}

// 사용 중인 수강권 (종료일 빠른 순)
const activePasses = (m) => passesOf(m.id).map((p) => [p, passInfo(p)]).filter(([, i]) => i.status === 'active')
  .sort(([a], [b]) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
// 이번 출석에서 1회 뺄 수강권: 사용 중이면서 이번 주 횟수가 남은 것 중 종료일이 가장 빠른 것
const passForAttend = (m) => activePasses(m).find(([, i]) => i.weekLeft > 0)?.[0] || null;
// 화면 요약용 지금 수강권: 다음 출석에 차감될 것 (이번 주를 다 썼으면 사용 중인 첫 수강권)
function currentPass(m) {
  const a = activePasses(m);
  const pick = a.find(([, i]) => i.weekLeft > 0) || a[0];
  return pick ? pick[1] : null;
}
const nextScheduled = (m) => passesOf(m.id).map((p) => passInfo(p)).filter((i) => i.status === 'scheduled').sort((a, b) => (a.start < b.start ? -1 : 1))[0] || null;

// 수강권 목록을 사용 중 · 예정 · 지난 수강권으로 나눔
function groupPasses(memberId) {
  const all = passesOf(memberId).map((p) => passInfo(p));
  const by = (s) => all.filter((i) => s.includes(i.status));
  return {
    current: by(['active']).sort((a, b) => (a.end < b.end ? -1 : 1)),
    scheduled: by(['scheduled']).sort((a, b) => (a.start < b.start ? -1 : 1)),
    past: by(['expired', 'usedUp']).sort((a, b) => (a.end > b.end ? -1 : 1)),
  };
}

// ── 다른 기능에 연결
// 출석 전: 사용 중인 수강권이 없거나 이번 주 횟수를 다 썼으면 막는다
checkAttend((m) => {
  const active = activePasses(m);
  if (!active.length) {
    const next = nextScheduled(m);
    if (next) return { error: `${m.name} 회원의 수강권은 ${next.start}부터 쓸 수 있어요.`, code: 'NO_PASS' };
    return { error: `${m.name} 회원은 사용 중인 수강권이 없어요. 수강권을 먼저 등록해 주세요.`, code: 'NO_PASS' };
  }
  if (!passForAttend(m)) return { error: `${m.name} 회원은 이번 주 출석(주${active[0][1].perWeek}회)을 다 썼어요.`, code: 'WEEK_FULL' };
  return null;
});
// 출석하면 1회 차감 (언제 썼는지 날짜로 기록)
onAttend((m) => { passForAttend(m).uses.push(today()); });
// 지난 날짜 출석 기록 (코치가 달력에서): 그 날짜가 기간 안이고, 횟수가 남고, 그 주 횟수가 남은 수강권에서 차감
const weekUsedOn = (p, date) => { const ws = weekStart(date), we = addDays(ws, 6); return p.uses.filter((d) => d >= ws && d <= we).length; };
const covering = (m, date) => passesOf(m.id).filter((p) => p.start <= date && date <= p.end);
const passForDate = (m, date) => covering(m, date).filter((p) => p.uses.length < p.total && weekUsedOn(p, date) < p.perWeek)
  .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0))[0] || null;
checkAttendRecord((m, date) => {
  if (passForDate(m, date)) return null;
  const cov = covering(m, date);
  if (!cov.length) return { error: `${date}에 쓸 수 있는 수강권이 없어요. 그 날짜가 기간에 들어가도록 수강권을 먼저 등록해 주세요 (시작일을 그 전으로).`, code: 'NO_PASS' };
  if (cov.every((p) => p.uses.length >= p.total)) return { error: `${date}이 들어가는 수강권의 횟수를 다 썼어요.`, code: 'USED_UP' };
  const ws = weekStart(date);
  return { error: `그 주(${ws} ~ ${addDays(ws, 6)})는 이미 주${cov[0].perWeek}회를 다 썼어요.`, code: 'WEEK_FULL' };
});
onAttendRecordAdd((m, date) => { passForDate(m, date).uses.push(date); });
const restoreUse = (m, date) => {
  const p = passesOf(m.id).find((x) => x.uses.includes(date));
  if (p) p.uses.splice(p.uses.indexOf(date), 1);
};
onAttendRecordRemove(restoreUse); // 출석 삭제 (지난 날짜 · 오늘)

// 출석 기록은 있는데 수강권에서 차감 안 된 날 → 그 날짜 수강권에서 차감 (오래된 날부터, 주 횟수 · 전체 횟수 규칙 그대로)
// 예: 수강권 기능 전 마지막 출석일, 출석 뒤에 시작일을 과거로 등록한 수강권. 수강권 등록 때 · 데이터 정리(migrate) 때 실행
function chargeLogged(m) {
  const charged = new Set(passesOf(m.id).flatMap((p) => p.uses));
  let changed = false;
  for (const date of [...new Set(m.attendLog || [])].sort()) {
    if (charged.has(date)) continue;
    const p = passForDate(m, date);
    if (p) { p.uses.push(date); changed = true; }
  }
  return changed;
}

// 본인·코치 화면용 요약
addPrivateFields((m) => ({ pass: currentPass(m), nextPass: nextScheduled(m) }));

// 누적 출석 수만 있고 날짜가 없는 예전 출석(출석 날짜 기록 · 수강권 기능 전)에 날짜를 임의로 채워 누적 = 달력 = 수강권 사용 으로 맞춤
// 기존 운영 데이터용 (나중에 초기화 예정) — 날짜는 실제 출석일이 아님. 능력치 · 코인은 그때 이미 받았으니 그대로
// 1) 수강권 기간 안에서 오래된 날부터 (주 횟수 · 전체 횟수 안에서, 수강권에도 차감)
// 2) 모자라면 가장 이른 날짜 전으로 하루씩 (수강권 없이 기록만)
// 이번 주는 비워 둠 (채운 날 때문에 오늘 출석이 '이번 주 다 씀' 으로 막히지 않게)
function fillUnknownDays(m) {
  const logged = new Set(m.attendLog || []);
  let need = (m.attendCount || 0) - logged.size;
  if (need <= 0) return false;
  const thisWeek = weekStart(today());
  const passes = passesOf(m.id).sort((a, b) => (a.start < b.start ? -1 : 1));
  for (const p of passes) {
    for (let d = p.start; d <= p.end && d < thisWeek && need > 0; d = addDays(d, 1)) {
      if (logged.has(d) || p.uses.length >= p.total || weekUsedOn(p, d) >= p.perWeek) continue;
      p.uses.push(d); logged.add(d); need--;
    }
  }
  let d = [...logged, ...passes.map((p) => p.start), thisWeek].sort()[0];
  while (need > 0) { d = addDays(d, -1); if (!logged.has(d)) { logged.add(d); need--; } }
  m.attendLog = [...logged].sort();
  return true;
}

module.exports = { PRESETS, passName, isDate, endOf, passesOf, passInfo, groupPasses, currentPass, chargeLogged, fillUnknownDays };
