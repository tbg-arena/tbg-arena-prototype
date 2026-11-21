// 회원 '컨디셔닝' 탭: 코치와 함께 한 체력운동 기록 · 종목별 최고 기록 · 이번 주 운동량
// 기록은 코치가 넣는다 (coach.js). 회원은 보기만.
import { esc, svg } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { memberTab, renderMember } from '../../core/tabs.js';
import { historyList, kgText } from './components.js';

let filter = null; // 최고 기록 칩을 누르면 그 종목 기록만

memberTab({
  id: 'conditioning', order: 25, label: '컨디셔닝', // 콜아웃(20)과 랭킹(30) 사이 = 탭 가운데
  icon: svg('<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>'),
  load: async () => ({ cd: await api('GET', '/api/conditioning') }),
  view: ({ cd }) => conditioningView(cd),
  bind: () => {
    document.querySelectorAll('[data-cdpr]').forEach((b) => (b.onclick = () => {
      filter = filter === b.dataset.cdpr ? null : b.dataset.cdpr;
      renderMember('conditioning');
    }));
  },
});

function conditioningView(cd) {
  if (filter && !cd.entries.some((e) => e.exercise === filter)) filter = null;
  const w = cd.week;
  const head = w.days ? '월요일부터 집계' : cd.total.days ? '이번 주는 아직' : '코치와 한 체력운동이 여기 쌓여요';
  return `
    <div class="card cd-sum">
      <div class="tr-top">
        <div><h2>이번 주 컨디셔닝</h2><div class="muted small">${head}</div></div>
      </div>
      <div class="stats3">
        <div class="stat"><b>${w.days}</b><span>운동한 날</span></div>
        <div class="stat"><b>${w.sets}</b><span>총 세트</span></div>
        <div class="stat"><b>${w.volume.toLocaleString()}</b><span>들어 올린 kg</span></div>
      </div>
      <div class="muted small cd-foot">지금까지 ${cd.total.days}일 · ${cd.total.count}종목</div>
    </div>

    ${cd.prs.length ? `
    <div class="section-title">최고 기록</div>
    <div class="cd-prs">${cd.prs.map((p) => `
      <button class="cd-pr ${filter === p.exercise ? 'on' : ''}" data-cdpr="${esc(p.exercise)}" aria-pressed="${filter === p.exercise}">
        <span class="small">${esc(p.exercise)}</span><b class="px">${kgText(p.kg)}</b>
      </button>`).join('')}</div>` : ''}

    <div class="section-title">운동 기록 ${filter ? `<span class="muted">· ${esc(filter)}만</span> <button class="link" data-cdpr="${esc(filter)}" style="padding:4px">전체 보기</button>` : ''}</div>
    ${historyList(cd.entries, { filter, empty: '아직 기록이 없어요.<br/>체력운동을 하면 코치가 무게 · 횟수 · 세트를 넣어 줘요.' })}`;
}
