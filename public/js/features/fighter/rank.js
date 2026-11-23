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

// 0경기 회원은 '배치 전': 서버가 경기 뛴 회원 뒤로 정렬해 보내므로 순위 번호 없이 맨 아래에 모아 보여준다
const played = (o) => o.wins + o.losses + o.draws > 0;

function rankView(me, members) {
  const ranked = members.filter(played).length;
  const item = (o, i) => `
      <div class="list-item ${o.id === me.member.id ? 'me' : ''}" data-go="#/fighter/${o.id}" style="cursor:pointer">
        ${i < ranked ? `<div class="rank r${i + 1}">${i + 1}</div>` : '<div class="rank">–</div>'}
        ${avatar(o)}
        <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:800">${esc(o.name)} ${o.titles.length ? '<span class="badge solid">TITLE</span>' : ''}</div>
          <div class="muted small">${i < ranked ? `${record(o)} · ` : ''}전투력 ${o.power}</div></div>
        ${i < ranked ? `<div class="center"><b class="pts">${o.points}</b><div class="muted px" style="font-size:9px">PTS</div></div>` : '<span class="badge">배치 전</span>'}
      </div>`;
  return `<div class="section-title">TBG 랭킹</div>
    ${ranked ? members.slice(0, ranked).map(item).join('') : '<div class="card empty">아직 경기를 치른 회원이 없어요.</div>'}
    ${ranked < members.length ? `<div class="section-title">배치 전 <span class="muted">${members.length - ranked}명 · 첫 경기를 치르면 순위가 매겨져요</span></div>
    ${members.slice(ranked).map((o, j) => item(o, ranked + j)).join('')}` : ''}
    ${myBar(me, members, ranked)}`;
}

// 내 순위: 목록 어디를 보고 있어도 탭바 위에 붙어 있고, 바로 콜아웃으로 이어진다
function myBar(me, members, ranked) {
  const i = members.findIndex((o) => o.id === me.member.id);
  if (i < 0 || members.length < 2) return '';
  const mine = members[i];
  const goal = i >= ranked ? '첫 경기를 치르면 순위에 올라요'
    : i === 0 ? (ranked > 1 ? `1위 지키는 중 · 2위와 ${mine.points - members[1].points}pt 차이` : '1위 · 아직 혼자 순위에 있어요')
    : `${i}위와 ${members[i - 1].points - mine.points}pt 차이 · 이기면 올라가요`;
  return `<div class="mybar">
    <div class="mybar-no px">${i < ranked ? i + 1 : '–'}</div>
    <div class="grow" style="min-width:0"><b>나 · ${i < ranked ? `${mine.points}pt` : '배치 전'}</b><div class="small ellipsis muted">${goal}</div></div>
    <button class="btn sm primary" data-go="#/callout">도전</button>
  </div>`;
}
