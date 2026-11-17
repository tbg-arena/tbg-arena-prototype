// 회원 커리어 탭: 전적 · 피니시 칭호 · 경기 기록
import { state } from '../../core/state.js';
import { esc, svg } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { memberTab } from '../../core/tabs.js';
import { fightRow } from './components.js';

memberTab({
  id: 'career', order: 40, label: '커리어',
  icon: svg('<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8"/>'),
  load: async () => ({ fights: await api('GET', '/api/fights') }),
  view: ({ me, fights }) => careerView(me, fights),
});

function careerView(me, fights) {
  const m = me.member;
  const fin = Object.entries(m.finishes).sort((a, b) => b[1] - a[1]);
  const goal = state.meta.finishTitleAt;
  return `
    <div class="card">
      <div class="stats3">
        <div class="stat"><b>${m.wins}</b><span>승</span></div>
        <div class="stat"><b>${m.losses}</b><span>패</span></div>
        <div class="stat"><b>${m.draws}</b><span>무</span></div>
        <div class="stat"><b>${m.kos}</b><span>KO/TKO</span></div>
        <div class="stat"><b>${m.fans}</b><span>팬</span></div>
        <div class="stat"><b>${m.attendCount}</b><span>출석</span></div>
      </div>
    </div>
    <div class="section-title">피니시 칭호 <span class="muted" style="text-transform:none;font-weight:600">· 같은 기술로 ${goal}번 끝내면 칭호</span></div>
    ${fin.length ? `<div class="card">${fin.map(([k, c]) => `
      <div class="row" style="margin:6px 0"><span class="grow"><b>${esc(k)}</b>${c >= goal ? ` <span class="badge solid">${esc(k)} 마스터</span>` : ''}</span><span class="muted small">${Math.min(c, goal)}/${goal}</span></div>
      ${c < goal ? `<div class="mbar"><i style="width:${(c / goal) * 100}%"></i></div>` : ''}`).join('')}</div>`
      : '<div class="card empty">아직 피니시가 없어요. KO나 TKO로 이겨보세요!</div>'}
    <div class="section-title">경기 기록</div>
    ${fights.length ? fights.map((f) => fightRow(f, m.id)).join('') : '<div class="card empty">아직 경기 기록이 없어요. 콜아웃으로 첫 경기를 잡으세요!</div>'}`;
}
