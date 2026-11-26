// 코치 출석 관리 (회원·기술 탭 안): 체육관 위치 설정 (지도: gym-map.js) · 회원 출석 상태 · 출석 기록 달력 (보기만)
// 출석은 회원이 체육관에서 직접 한다 (attendance/member.js). 코치는 출석을 넣거나 지우지 않음
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { openTodaySheet } from '../lessons/sheet.js';
import { attendCalendar, bindAttendCalendar, weekCount } from './calendar.js';
import { locate, meters } from './geo.js';
import { openGymMap } from './gym-map.js';

// ── 체육관 위치: 회원은 여기서 반경 안이어야 출석할 수 있다
// gym: { lat, lng, name, address, radius, setAt } | null
export function gymCard(gym) {
  const where = gym ? [gym.name, gym.address].filter(Boolean).join(' · ') : '';
  const link = gym && `https://map.kakao.com/link/map/${encodeURIComponent(gym.name || '체육관')},${gym.lat},${gym.lng}`;
  return `<div class="card gym-card ${gym ? '' : 'unset'}">
      <div class="grow" style="min-width:0"><b>체육관 위치</b>
        ${where ? `<div class="small gym-where">${esc(where)}</div>` : ''}
        <div class="muted small">${gym ? `출석 반경 ${gym.radius}m · <a href="${link}" target="_blank" rel="noopener">지도에서 보기</a>` : '아직 없어요 — 정해야 회원이 출석할 수 있어요'}</div></div>
      <button class="btn sm ${gym ? '' : 'primary'}" id="setGym">${gym ? '바꾸기' : '설정'}</button>
    </div>`;
}

// info: { gym, radius(출석 반경 m, 서버에서 고정), mapKey(카카오 지도 키 | null) }
// 지도 키가 있으면 지도에서 고르고, 없거나 지도를 못 불러오면 체육관 안에서 '지금 위치로 저장'
export function bindGym(info, onChange) {
  const b = document.getElementById('setGym');
  if (!b) return;
  const here = (note) => openHereModal(info.radius, onChange, note);
  b.onclick = () => (info.mapKey ? openGymMap(info, onChange, here) : here());
}

// note: 지도를 못 불러온 이유 (있으면 맨 위에 보여 줌)
function openHereModal(radius, onChange, note) {
  openModal(`<h3>체육관 위치</h3>
    ${note ? `<div class="att-msg" style="margin-bottom:10px">${esc(note)}</div>` : ''}
    <div class="muted small">체육관 안에서 저장해 주세요. 지금 이 기기의 위치가 체육관 위치가 되고, 회원은 그 근처에서만 출석할 수 있어요.</div>
    <div class="att-msg" id="gymMsg" role="alert"></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button>
      <button class="btn primary grow" id="here">지금 위치로 저장</button></div>`, (el) => {
    const msg = el.querySelector('#gymMsg');
    el.querySelector('#x').onclick = closeModal;
    const here = el.querySelector('#here');
    here.onclick = () => act(async () => {
      here.disabled = true; here.textContent = '위치 확인 중…'; msg.textContent = '';
      try {
        const pos = await locate();
        // 출석 반경이 좁아서, 저장하는 위치가 부정확하면 체육관 안에서도 출석이 안 될 수 있음
        if (pos.accuracy > radius && !confirm(`위치 오차가 ±${meters(pos.accuracy)}로 커요. 이대로 저장하면 회원이 체육관 안에서도 출석이 안 될 수 있어요.\n그래도 저장할까요? (와이파이를 켜고 다시 하면 더 정확해져요)`)) return;
        const { gym } = await api('PUT', '/api/coach/gym', pos);
        closeModal(); toast(`체육관 위치를 저장했어요 (오차 ±${meters(pos.accuracy)}, 출석 반경 ${gym.radius}m)`); onChange?.();
      } catch (e) { msg.textContent = e.message; }
      finally { if (here.isConnected) { here.disabled = false; here.textContent = '지금 위치로 저장'; } }
    });
  });
}

// ── 회원 줄 오른쪽: 오늘 출석했으면 '오늘 기록'(배운 주차 · 운동 시트), 아니면 미출석 표시
export const attendBadge = (m) => (m.attended
  ? `<button class="btn sm primary" data-todaysheet="${m.id}">✓ 오늘 기록</button>`
  : '<span class="badge">미출석</span>');

// onChange: 저장 뒤 다시 그리기, members: 코치 회원 목록
export function bindTodaySheet(members, onChange) {
  document.querySelectorAll('[data-todaysheet]').forEach((b) => (b.onclick = (e) => {
    e.preventDefault(); // 회원 카드가 펼쳐지지 않게
    const m = members.find((x) => x.id === b.dataset.todaysheet);
    if (m) act(() => openTodaySheet(m, '오늘 출석', onChange));
  }));
}

// ── 출석 기록 달력 (보기만)
export const attendLogButton = (m) => `<button class="btn sm" data-attendlog="${m.id}">출석 기록</button>`;

async function openAttendLog(m) {
  const { days, today, attendCount } = await api('GET', `/api/coach/members/${m.id}/attendance`);
  openModal(`<h3>${esc(m.name)} · 출석 기록</h3>
    <div class="att-week">누적 <b class="px">${attendCount}</b>회 · 이번 주 <b class="px">${weekCount(days, today)}</b>회</div>
    ${attendCalendar(days, today)}
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button></div>`, (el) => {
    bindAttendCalendar(el, days, today);
    el.querySelector('#x').onclick = closeModal;
  });
}

export function bindAttendLog(members) {
  document.querySelectorAll('[data-attendlog]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(() => openAttendLog(members.find((x) => x.id === b.dataset.attendlog))); }));
}
