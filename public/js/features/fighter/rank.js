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
      </div>`).join('')}
    ${myBar(me, members)}`;
}

// 내 순위: 목록 어디를 보고 있어도 탭바 위에 붙어 있고, 바로 콜아웃으로 이어진다
function myBar(me, members) {
  const i = members.findIndex((o) => o.id === me.member.id);
  if (i < 0 || members.length < 2) return '';
  const mine = members[i];
  const goal = i === 0
    ? `1위 지키는 중 · 2위와 ${mine.points - members[1].points}pt 차이`
    : `${i}위와 ${members[i - 1].points - mine.points}pt 차이 · 이기면 올라가요`;
  return `<div class="mybar">
    <div class="mybar-no px">${i + 1}</div>
    <div class="grow" style="min-width:0"><b>나 · ${mine.points}pt</b><div class="small ellipsis muted">${goal}</div></div>
    <button class="btn sm primary" data-go="#/callout">도전</button>
  </div>`;
}
