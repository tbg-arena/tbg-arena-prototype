// 출석: 오늘 출석 여부 (다른 기능에서도 가져다 쓰는 함수)
const { save } = require('../core/db');
const { today } = require('../core/util');

// 날짜가 바뀌면 오늘 출석 여부 리셋 (조회 시점에 지연 처리)
// 조회만 하는 요청이 DB 전체를 다시 쓰지 않도록, 실제로 바뀔 때만 저장
// (Vercel은 여러 인스턴스가 동시에 저장하면 마지막 저장이 이겨서, 4초 폴링이 방금 치른 경기를 덮어쓸 수 있음)
function refresh(m) {
  if (m.attended && m.attendDay !== today()) { m.attended = false; save(); }
  return m;
}

// 출석 체크 뒤 다른 기능이 할 일을 등록하는 연결 지점 (예: shop → 출석 코인). fn(m)
const attendHooks = [];
const onAttend = (fn) => { attendHooks.push(fn); };
const runAttendHooks = (m) => { for (const fn of attendHooks) fn(m); };

// 출석 체크 전에 다른 기능이 막을 수 있는 연결 지점 (예: passes → 수강권 없음 · 이번 주 횟수 다 씀)
// fn(m) → 막으면 { error: '안내 문구', code: '이유' }, 괜찮으면 null
const attendChecks = [];
const checkAttend = (fn) => { attendChecks.push(fn); };
const runAttendChecks = (m) => { for (const fn of attendChecks) { const r = fn(m); if (r) return r; } return null; };

// 코치가 출석 기록 달력에서 지난 날짜를 추가하거나, 출석(지난 날짜 · 오늘)을 지울 때의 연결 지점
//   checkAttendRecord(fn)     fn(m, date) → 막으면 { error, code }, 괜찮으면 null  (예: passes → 그 날짜에 쓸 수강권 없음)
//   onAttendRecordAdd(fn)     fn(m, date)  지난 날짜 출석 추가 = 그날 출석 (예: passes → 그 날짜 수강권 차감, shop → 출석 코인)
//   onAttendRecordRemove(fn)  fn(m, date)  출석 삭제 = 없던 일로 (예: passes → 수강권 복구, shop → 출석 코인 회수)
const recordChecks = [], recordAdds = [], recordRemoves = [];
const checkAttendRecord = (fn) => { recordChecks.push(fn); };
const onAttendRecordAdd = (fn) => { recordAdds.push(fn); };
const onAttendRecordRemove = (fn) => { recordRemoves.push(fn); };
const runRecordChecks = (m, date) => { for (const fn of recordChecks) { const r = fn(m, date); if (r) return r; } return null; };
const runRecordAdds = (m, date) => { for (const fn of recordAdds) fn(m, date); };
const runRecordRemoves = (m, date) => { for (const fn of recordRemoves) fn(m, date); };

module.exports = {
  refresh, onAttend, runAttendHooks, checkAttend, runAttendChecks,
  checkAttendRecord, onAttendRecordAdd, onAttendRecordRemove, runRecordChecks, runRecordAdds, runRecordRemoves,
};
