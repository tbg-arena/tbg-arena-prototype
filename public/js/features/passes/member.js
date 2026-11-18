// 회원 '내 수강권' 화면 (#/passes, 홈의 출석 카드로 들어옴): 지금 수강권 · 예정 · 지난 수강권
import { state } from '../../core/state.js';
import { $app, esc, toast } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { go, addPage } from '../../core/router.js';
import { STATUS_LABEL, dday, shortDate, weekDots } from './components.js';

addPage('passes', renderPasses, { needsId: false });

async function renderPasses() {
  state.tab = 'passes';
  const seq = state.seq;
  let d;
  try { d = await api('GET', '/api/passes'); } catch (e) { toast(e.message, true); return go('#/home'); }
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  $app.innerHTML = `
    <div class="topbar"><button class="link" id="back">← 돌아가기</button><div class="muted small">내 수강권</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      <div class="section-title">지금 수강권</div>
      ${d.current.length ? d.current.map(currentCard).join('') : '<div class="card empty">사용 중인 수강권이 없어요.<br/>코치에게 수강권 등록을 요청하세요.</div>'}
      ${d.scheduled.length ? `<div class="section-title">시작 예정</div>${d.scheduled.map(row).join('')}` : ''}
      <div class="section-title">지난 수강권</div>
      ${d.past.length ? d.past.map(row).join('') : '<div class="card empty">지난 수강권이 없어요.</div>'}
      <div class="muted small" style="margin:12px 2px">출석 체크를 받으면 1회씩 차감돼요. 이번 주(월~일) 횟수를 다 쓰면 다음 주 월요일까지 출석할 수 없고, 이번 주에 못 쓴 횟수는 다음 주로 넘어가지 않아요.</div>
    </div>`;
  document.getElementById('back').onclick = () => (history.length > 1 ? history.back() : go('#/home'));
  window.scrollTo(0, 0);
}

function currentCard(p) {
  return `
    <div class="card pass-card">
      <div class="row"><div class="grow"><div class="pass-name">${esc(p.name)}</div><div class="muted small">${shortDate(p.start)} ~ ${shortDate(p.end)}</div></div><span class="badge solid px">${dday(p.daysLeft)}</span></div>
      <div class="pass-stats">
        <div><span>이번 주 남은 횟수</span><b class="px">${p.weekLeft}<small>/${p.perWeek}</small></b>${weekDots(p)}</div>
        <div><span>전체 남은 횟수</span><b class="px">${p.left}<small>/${p.total}</small></b><div class="mbar"><i style="width:${(p.left / p.total) * 100}%"></i></div></div>
        <div><span>남은 기간</span><b class="px">${p.daysLeft ? `${p.daysLeft}<small>일</small>` : '오늘'}</b><small class="muted">${shortDate(p.end)}까지</small></div>
      </div>
      ${p.memo ? `<div class="muted small" style="margin-top:8px">${esc(p.memo)}</div>` : ''}
    </div>`;
}

function row(p) {
  const when = p.status === 'scheduled' ? `${shortDate(p.start)}부터` : `${p.used}/${p.total}회 사용`;
  return `<div class="list-item"><div class="grow" style="min-width:0"><div style="font-weight:800">${esc(p.name)}</div><div class="muted small">${shortDate(p.start)} ~ ${shortDate(p.end)} · ${when}</div></div><span class="badge">${STATUS_LABEL[p.status]}</span></div>`;
}
