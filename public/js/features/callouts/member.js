// 회원 콜아웃 탭: 받은/보낸 콜아웃 · 상대 지목 · 지난 콜아웃
import { esc, svg, ago, avatar, record, toast, vibrate, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, go } from '../../core/router.js';
import { memberTab } from '../../core/tabs.js';
import { statusBadge as st } from './status.js';

memberTab({
  id: 'callout', order: 20, label: '콜아웃',
  icon: svg('<path d="M3 10v4h3l7 4V6L6 10H3z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
  dot: ({ me }) => me.pendingForMe,
  load: async () => {
    const [members, callouts] = await Promise.all([api('GET', '/api/members'), api('GET', '/api/callouts')]);
    return { members, callouts };
  },
  view: ({ me, members, callouts }) => calloutView(me, members, callouts),
  bind: bindCalloutActions,
});

function calloutView(me, members, callouts) {
  const myId = me.member.id;
  const open = (c) => ['pending_opponent', 'pending_coach'].includes(c.status);
  const incoming = callouts.filter((c) => c.opponentId === myId && open(c));
  const outgoing = callouts.filter((c) => c.challengerId === myId && open(c));
  const past = callouts.filter((c) => !open(c)).slice(0, 10);
  const others = members.filter((x) => x.id !== myId);
  return `
    <div class="steps"><span>① 콜아웃</span>›<span>② 코치 승인</span>›<span>FIGHT</span></div>
    <div class="section-title">받은 콜아웃</div>
    ${incoming.length ? incoming.map((c) => `
      <div class="card">
        <div class="row"><div class="grow"><b>${esc(c.challenger)}</b> <span class="muted">님의 도전!</span></div>${st(c)}</div>
        ${c.message ? `<div style="margin-top:6px">“${esc(c.message)}”</div>` : ''}
        ${c.status === 'pending_opponent'
          ? `<div class="row" style="margin-top:12px"><button class="btn primary grow" data-accept="${c.id}">수락 — 바로 경기</button><button class="btn" data-go="#/fighter/${c.challengerId}">분석</button><button class="btn" data-decline="${c.id}">거절</button></div>`
          : '<div class="muted small" style="margin-top:6px">코치가 승인하면 바로 경기가 치러져요.</div>'}
      </div>`).join('') : '<div class="card empty">받은 콜아웃이 없어요.</div>'}

    <div class="section-title">보낸 콜아웃</div>
    ${outgoing.length ? outgoing.map((c) => `
      <div class="card"><div class="row"><div class="grow">→ <b>${esc(c.opponent)}</b></div>${st(c)}</div>
        ${c.message ? `<div class="muted small" style="margin-top:4px">“${esc(c.message)}”</div>` : ''}
        <div class="row" style="margin-top:8px"><span class="muted small grow">${ago(c.createdAt)}</span><button class="btn sm ghost" data-cancel="${c.id}">취소</button></div>
      </div>`).join('') : '<div class="card empty">보낸 콜아웃이 없어요.</div>'}

    <div class="section-title">상대 지목하기</div>
    ${others.length ? others.map((o) => `
      <div class="list-item">
        <div data-go="#/fighter/${o.id}" style="cursor:pointer">${avatar(o)}</div>
        <div class="grow" style="min-width:0;cursor:pointer" data-go="#/fighter/${o.id}"><div class="ellipsis" style="font-weight:800">${esc(o.name)}</div>
          <div class="muted small">전투력 <b class="px" style="color:#fff">${o.power}</b> · ${record(o)} · 기술 ${o.skillCount}</div></div>
        <button class="btn sm primary" data-callout="${o.id}" data-name="${esc(o.name)}" ${o.skillCount ? '' : 'disabled'}>콜아웃</button>
      </div>`).join('') : '<div class="card empty">다른 회원이 아직 없어요.</div>'}

    ${past.length ? `<div class="section-title">지난 콜아웃</div>${past.map((c) => `
      <div class="list-item small"><div class="grow ellipsis">${esc(c.challenger)} → ${esc(c.opponent)}${c.coachNote ? ` <span class="muted">(${esc(c.coachNote)})</span>` : ''}</div>${st(c)}
      ${c.fightId ? `<button class="btn sm" data-go="#/fight/${c.fightId}">중계</button>` : ''}</div>`).join('')}` : ''}`;
}

function bindCalloutActions() {
  document.querySelectorAll('[data-callout]').forEach((b) => (b.onclick = () => {
    openModal(`
      <h3>${esc(b.dataset.name)} 님에게 콜아웃</h3>
      <div class="muted small" style="margin-bottom:10px">코치가 승인하는 순간 바로 경기가 치러집니다. 그 전에 전략을 챙기세요!</div>
      <input id="msg" maxlength="80" placeholder="한마디 (선택) 예: 금요일 스파링 빚 갚으러 간다" />
      <div class="row" style="margin-top:12px"><button class="btn grow" id="cancel">닫기</button><button class="btn primary grow" id="send">도전장 보내기</button></div>`,
    (el) => {
      el.querySelector('#cancel').onclick = closeModal;
      el.querySelector('#send').onclick = () => act(async () => {
        await api('POST', '/api/callouts', { opponentId: b.dataset.callout, message: el.querySelector('#msg').value });
        closeModal(); toast('도전장을 보냈습니다! 코치 승인을 기다려주세요.'); vibrate(40); route();
      });
    });
  }));
  document.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = () => act(async () => {
    b.disabled = true;
    const c = await api('POST', `/api/callouts/${b.dataset.accept}/respond`, { accept: true });
    vibrate([80, 60, 80]); go(`#/fight/${c.fightId}`);
  })));
  document.querySelectorAll('[data-decline]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm('콜아웃을 거절할까요?')) return;
    await api('POST', `/api/callouts/${b.dataset.decline}/respond`, { accept: false }); route();
  })));
  document.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => act(async () => {
    await api('POST', `/api/callouts/${b.dataset.cancel}/cancel`); route();
  })));
}
