// 회원 '출석' 화면 (#/attend, 홈의 출석 카드 · 커리어 훈련 카드로 들어옴)
// 체육관 안에서 '출석하기' → 이 기기 위치를 확인해 체육관 반경 안이면 출석 + 출석 기록 달력
import { state } from '../../core/state.js';
import { $app, svg, toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { go, addPage } from '../../core/router.js';
import { STAT_LABEL } from '../fighter/components.js';
import { attendCalendar, bindAttendCalendar, weekCount } from './calendar.js';
import { locate } from './geo.js';

addPage('attend', renderAttend, { needsId: false });

const PIN = svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>');

// 출석으로 오른 능력치 안내 (예: ' 파워 +1 · 체력 +1')
const gainText = (gains) => {
  const up = Object.entries(gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_LABEL[k]?.[1] || k} +${v}`);
  return up.length ? ' ' + up.join(' · ') : ' 능력치가 조금씩 쌓이고 있어요';
};

async function renderAttend() {
  state.tab = 'attend';
  const seq = state.seq;
  let a;
  try { a = await api('GET', '/api/me/attendance'); } catch (e) { toast(e.message, true); return go('#/home'); }
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  $app.innerHTML = `
    <div class="topbar"><span style="width:60px"></span><div class="muted small">출석</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      ${checkCard(a)}
      <div class="section-title">출석 기록</div>
      <div class="card att-cal">${attendCalendar(a.days, a.today)}</div>
    </div>
    <div class="backbar"><button class="btn block" id="back">← 돌아가기</button></div>`;
  document.getElementById('back').onclick = () => (history.length > 1 ? history.back() : go('#/home'));
  bindAttendCalendar($app, a.days, a.today);
  bindCheckIn();
  window.scrollTo(0, 0);
}

function checkCard(a) {
  const sub = `누적 <b>${a.attendCount}</b>회 · 이번 주 <b>${weekCount(a.days, a.today)}</b>회`;
  if (a.attended) return `
    <div class="card att-now done">
      <div class="att-stamp">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>')}</div>
      <div><b class="att-title">오늘 출석 완료</b><div class="muted small">${sub}</div></div>
    </div>`;
  return `
    <div class="card att-now">
      <div><b class="att-title">체육관에 도착했나요?</b>
        <div class="muted small">${a.radius ? '체육관 안에서 누르면 위치를 확인해 출석돼요' : '아직 체육관 위치가 등록되지 않았어요. 코치에게 알려 주세요.'}</div></div>
      <button class="btn primary block att-btn" id="checkIn" ${a.radius ? '' : 'disabled'}>${PIN}<span>출석하기</span></button>
      <div class="att-msg" id="attMsg" role="alert"></div>
      <div class="muted small">${sub} · 출석하면 능력치가 조금씩 올라요</div>
    </div>`;
}

function bindCheckIn() {
  const btn = document.getElementById('checkIn');
  if (!btn) return;
  const msg = document.getElementById('attMsg');
  btn.onclick = () => act(async () => {
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `${PIN}<span>위치 확인 중…</span>`; msg.textContent = '';
    try {
      const pos = await locate();
      const r = await api('POST', '/api/me/attend', pos);
      toast(`출석 체크!${gainText(r.gains)}`);
      await renderAttend();
    } catch (e) {
      msg.textContent = e.message; // 체육관에서 멀어요 · 위치 권한 등은 토스트 대신 화면에 남겨 둠
    } finally {
      if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
    }
  });
}
