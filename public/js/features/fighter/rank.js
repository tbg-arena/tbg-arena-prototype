// 회원 랭킹 탭
import { esc, svg, avatar, record } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { memberTab } from '../../core/tabs.js';

memberTab({
  id: 'rank', order: 30, label: '랭킹',
  icon: svg('<path d="M4 20V12M10 20V6M16 20v-9M22 20H2"/>'),
  load: async () => ({ members: await api('GET', '/api/members') }),
  view: ({ me, members }) => rankView(me, members),
});

function rankView(me, members) {
  return `<div class="section-title">TBG 랭킹</div>
    ${members.map((o, i) => `
      <div class="list-item ${o.id === me.member.id ? 'me' : ''}" data-go="#/fighter/${o.id}" style="cursor:pointer">
        <div class="rank r${i + 1}">${i + 1}</div>
        ${avatar(o)}
        <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:800">${esc(o.name)} ${o.titles.length ? '<span class="badge solid">TITLE</span>' : ''}</div>
          <div class="muted small">${record(o)} · 전투력 ${o.power}</div></div>
        <div class="center"><b class="pts">${o.points}</b><div class="muted px" style="font-size:9px">PTS</div></div>
      </div>`).join('')}`;
}
