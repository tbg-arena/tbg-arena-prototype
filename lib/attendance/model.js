// 출석: 오늘 출석 여부 · 체육관 위치 (다른 기능에서도 가져다 쓰는 함수)
const { db, save } = require('../core/db');
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

// ── 체육관 위치 (코치가 카카오 지도에서 고르거나 체육관에서 '지금 위치로 저장' → db.gym = { lat, lng, name, address, setAt })
// 회원은 이 위치에서 RADIUS(m) 안이어야 출석할 수 있다. 위치 오차만큼 봐주지 않음
// (휴대폰 위치는 실내에서 10~30m 흔들려서, 이보다 좁히면 체육관 안에서도 자주 막힘. 자주 막히면 이 값을 키우기)
const RADIUS = 20;
const gym = () => (db.gym ? { lat: db.gym.lat, lng: db.gym.lng, name: db.gym.name || '', address: db.gym.address || '', setAt: db.gym.setAt, radius: RADIUS } : null);

// 카카오 지도 키 (JavaScript 키). 코치 화면에서 지도로 체육관을 고를 때만 씀. 없으면 '지금 위치로 저장'만
// 브라우저에 그대로 보이는 키라 비밀은 아니지만, 저장소가 공개라 코드에 넣지 않고 환경변수로 받음
// (카카오 개발자 사이트에 등록한 도메인에서만 지도가 뜬다)
const mapKey = () => process.env.KAKAO_JS_KEY || null;

// 두 좌표 사이 거리 (m, 하버사인)
function distanceM(a, b) {
  const R = 6371e3, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 브라우저가 보낸 위치 { lat, lng, accuracy } → 숫자로 정리, 이상하면 null
function readPos(body) {
  const lat = Number(body?.lat), lng = Number(body?.lng), acc = Number(body?.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, accuracy: Number.isFinite(acc) && acc >= 0 ? acc : 0 };
}

module.exports = { refresh, onAttend, runAttendHooks, RADIUS, gym, mapKey, distanceM, readPos };
