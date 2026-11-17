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

module.exports = { refresh, onAttend, runAttendHooks };
