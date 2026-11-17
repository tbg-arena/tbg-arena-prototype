// 코치 승인 탭: 승인 대기 콜아웃 (승인하면 바로 경기) · 최근 처리 내역
import { esc, svg, ago, toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route } from '../../core/router.js';
import { coachTab } from '../../core/tabs.js';
import { statusBadge } from './status.js';

const pendingOf = (callouts) => callouts.filter((c) => c.status === 'pending_coach');

coachTab({
  id: 'approve', order: 10, label: '승인',
  icon: svg('<path d="M4 12l5 5L20 6"/>'),
  dot: ({ callouts }) => pendingOf(callouts).length,
  view: ({ callouts }) => approveView(callouts),
  bind: bindApproveActions,
});

function approveView(callouts) {
  const pending = pendingOf(callouts);
  return `<div class="section-title">승인 대기 콜아웃 (${pending.length})</div>
        ${pending.length ? pending.map((c) => `
          <div class="card">
            <div style="font-size:17px;font-weight:900">${esc(c.challenger)} <span class="badge red px">VS</span> ${esc(c.opponent)}</div>
            ${c.message ? `<div class="muted" style="margin-top:4px">“${esc(c.message)}”</div>` : ''}
            <div class="muted small" style="margin-top:4px">${ago(c.createdAt)}</div>
            <div class="row" style="margin-top:12px"><button class="btn green grow" data-approve="${c.id}">승인</button><button class="btn grow" data-reject="${c.id}">반려</button></div>
          </div>`).join('') : '<div class="card empty">승인 대기 중인 콜아웃이 없습니다.</div>'}
        <div class="section-title">최근 처리 내역</div>
        ${callouts.filter((c) => c.status !== 'pending_coach').slice(0, 15).map((c) => `
          <div class="list-item small"><div class="grow ellipsis">${esc(c.challenger)} → ${esc(c.opponent)}</div>${statusBadge(c)}
          ${c.fightId ? `<button class="btn sm" data-go="#/fight/${c.fightId}">중계</button>` : ''}</div>`).join('') || '<div class="card empty">내역 없음</div>'}`;
}

function bindApproveActions() {
  document.querySelectorAll('[data-approve]').forEach((b) => (b.onclick = () => act(async () => {
    await api('POST', `/api/coach/callouts/${b.dataset.approve}`, { approve: true }); toast('승인했습니다. 경기가 치러졌습니다.'); route();
  })));
  document.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => act(async () => {
    const note = prompt('반려 사유 (선택)');
    if (note === null) return;
    await api('POST', `/api/coach/callouts/${b.dataset.reject}`, { approve: false, note }); route();
  })));
}
