// 회원 '내 수강권' 화면 (#/passes, 홈의 출석 카드로 들어옴): 지금 수강권 · 출석 기록 달력 · 예정 · 지난 수강권
import { state } from '../../core/state.js';
import { $app, esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { go, addPage } from '../../core/router.js';
import { STATUS_LABEL, dday, shortDate, weekDots, addDays, todayKST } from './components.js';
import { attendCalendar, bindAttendCalendar } from '../attendance/calendar.js';

addPage('passes', renderPasses, { needsId: false });

async function renderPasses() {
  state.tab = 'passes';
  const seq = state.seq;
  let d, att;
  try { [d, att] = await Promise.all([api('GET', '/api/passes'), api('GET', '/api/me/attendance')]); } catch (e) { toast(e.message, true); return go('#/home'); }
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  $app.innerHTML = `
    <div class="topbar"><span style="width:60px"></span><div class="muted small">내 수강권</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      <div class="section-title">지금 수강권</div>
      ${d.current.length ? d.current.map(currentCard).join('') : '<div class="card empty">사용 중인 수강권이 없어요.<br/>코치에게 수강권 등록을 요청하세요.</div>'}
      ${attendCalendar(att.days)}
      ${d.scheduled.length ? `<div class="section-title">시작 예정</div>${d.scheduled.map(row).join('')}` : ''}
      <div class="section-title">지난 수강권</div>
      ${d.past.length ? d.past.map(row).join('') : '<div class="card empty">지난 수강권이 없어요.</div>'}
      <div class="muted small" style="margin:12px 2px">출석 체크를 받으면 1회씩 차감돼요. 이번 주(월~일) 횟수를 다 쓰면 다음 주 월요일까지 출석할 수 없고, 이번 주에 못 쓴 횟수는 다음 주로 넘어가지 않아요.</div>
    </div>
    <div class="backbar"><button class="btn block" id="back">← 돌아가기</button></div>`;
  document.getElementById('back').onclick = () => (history.length > 1 ? history.back() : go('#/home'));
  bindAttendCalendar(att.days);
  document.querySelectorAll('[data-holdpass]').forEach((b) => (b.onclick = () => openHoldModal(b.dataset.holdpass, d, renderPasses)));
  document.querySelectorAll('[data-cancelhold]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm('이 홀딩을 취소할까요?')) return;
    await api('DELETE', `/api/passes/${b.dataset.passid}/hold/${b.dataset.cancelhold}`);
    toast('홀딩을 취소했어요.'); renderPasses();
  })));
  window.scrollTo(0, 0);
}

function currentCard(p) {
  const today = todayKST();
  const activeHold = p.holds.find((h) => h.start <= today && h.end >= today);
  const futureHolds = p.holds.filter((h) => h.start > today);
  const holdSection = p.holdsMax > 0 ? `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      ${activeHold ? `<div class="row" style="margin-bottom:6px"><span class="badge warn">홀딩 중 · ${shortDate(activeHold.end)}까지</span></div>` : ''}
      ${futureHolds.map((h) => `
        <div class="row" style="margin-bottom:4px">
          <span class="muted small">예정 홀딩 ${shortDate(h.start)} ~ ${shortDate(h.end)}</span>
          <button class="btn sm ghost" data-cancelhold="${h.id}" data-passid="${p.id}" style="margin-left:auto;padding:2px 8px">취소</button>
        </div>`).join('')}
      <div class="row" style="align-items:center">
        <span class="muted small">홀딩 ${p.holdsLeft}/${p.holdsMax}회 남음</span>
        ${p.holdsLeft > 0 && !activeHold ? `<button class="btn sm" data-holdpass="${p.id}" style="margin-left:auto">홀딩 신청</button>` : ''}
      </div>
    </div>` : '';
  return `
    <div class="card pass-card">
      <div class="row"><div class="grow"><div class="pass-name">${esc(p.name)}</div><div class="muted small">${shortDate(p.start)} ~ ${shortDate(p.end)}</div></div><span class="badge solid px">${dday(p.daysLeft)}</span></div>
      <div class="pass-stats">
        <div><span>이번 주 남은 횟수</span><b class="px">${p.weekLeft}<small>/${p.perWeek}</small></b>${weekDots(p)}</div>
        <div><span>전체 남은 횟수</span><b class="px">${p.left}<small>/${p.total}</small></b><div class="mbar"><i style="width:${(p.left / p.total) * 100}%"></i></div></div>
        <div><span>남은 기간</span><b class="px">${p.daysLeft ? `${p.daysLeft}<small>일</small>` : '오늘'}</b><small class="muted">${shortDate(p.end)}까지</small></div>
      </div>
      ${holdSection}
      ${p.memo ? `<div class="muted small" style="margin-top:8px">${esc(p.memo)}</div>` : ''}
    </div>`;
}

function openHoldModal(passId, passes, onDone) {
  const p = passes.current.find((x) => x.id === passId);
  if (!p) return;
  const today = todayKST();
  openModal(`<h3>홀딩 신청</h3>
    <div class="stack">
      <div class="card small muted" style="margin-bottom:0">7일 동안 수강권이 일시 정지되고 종료일이 7일 연장돼요.</div>
      <div><label class="field">시작일</label><input id="h-start" type="date" value="${today}" min="${today}" /></div>
      <div class="card small" id="h-sum"></div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">신청</button></div>`, (el) => {
    const $start = el.querySelector('#h-start');
    const $sum = el.querySelector('#h-sum');
    const update = () => {
      const s = $start.value || today;
      $sum.innerHTML = `홀딩 기간: <b>${shortDate(s)} ~ ${shortDate(addDays(s, 6))}</b><br>새 종료일: <b>${shortDate(addDays(p.end, 7))}</b>`;
    };
    $start.onchange = update;
    update();
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('POST', `/api/passes/${passId}/hold`, { start: $start.value || today });
      closeModal(); toast('홀딩을 신청했어요. 종료일이 7일 연장됐어요.'); onDone?.();
    });
  });
}

function row(p) {
  const when = p.status === 'scheduled' ? `${shortDate(p.start)}부터` : `${p.used}/${p.total}회 사용`;
  return `<div class="list-item"><div class="grow" style="min-width:0"><div style="font-weight:800">${esc(p.name)}</div><div class="muted small">${shortDate(p.start)} ~ ${shortDate(p.end)} · ${when}</div></div><span class="badge">${STATUS_LABEL[p.status]}</span></div>`;
}
