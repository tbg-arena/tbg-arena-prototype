// 출석 관련 예전 데이터 정리 (core/migrations.js 참고)
const { addMigration } = require('../core/migrations');

// 출석 날짜 기록(attendLog) 도입 전 회원: 남아 있는 날짜로 채운다
// (수강권 사용 날짜 + 마지막 출석일. 그 전 출석은 날짜가 저장돼 있지 않아 복원 불가)
addMigration((db) => {
  let changed = false;
  for (const m of db.members) {
    if (Array.isArray(m.attendLog)) continue;
    const days = new Set((db.passes || []).filter((p) => p.memberId === m.id).flatMap((p) => p.uses || []));
    if (m.attendDay) days.add(m.attendDay);
    m.attendLog = [...days].sort();
    changed = true;
  }
  return changed;
});

// 오늘 오른 능력치(attendToday) → 날짜별 오른 능력치(attendGains)
addMigration((db) => {
  let changed = false;
  for (const m of db.members) {
    if (!m.attendToday) continue;
    m.attendGains = { ...(m.attendGains || {}), [m.attendToday.day]: m.attendToday.delta };
    delete m.attendToday;
    changed = true;
  }
  return changed;
});

// 누적 출석 수는 출석 날짜 수보다 적을 수 없음 (예전 코드에서 달력으로 지난 날짜를 찍으면 누적이 안 올랐음)
addMigration((db) => {
  let changed = false;
  for (const m of db.members) {
    const n = new Set(m.attendLog || []).size;
    if ((m.attendCount || 0) < n) { m.attendCount = n; changed = true; }
  }
  return changed;
});
