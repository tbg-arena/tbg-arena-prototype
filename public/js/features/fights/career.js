// 회원 커리어 탭: 내 훈련(출석 · 커리큘럼 · 배운 기술) · 전적 · 피니시 칭호 · 경기 기록
import { state } from '../../core/state.js';
import { esc, svg } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { memberTab } from '../../core/tabs.js';
import { fightRow } from './components.js';
import { trainingCard } from './training.js';

memberTab({
  id: 'career', order: 40, label: '커리어',
  icon: svg('<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8"/>'),
  dot: ({ me }) => me.unseenFights.length, // 아직 안 본 경기 수
  load: async () => {
    // 커리큘럼(주차 이름)은 잘 안 바뀌어서 한 번만 받아 둔다
    const [fights, att, weeks] = await Promise.all([
      api('GET', '/api/fights'),
      api('GET', '/api/me/attendance').catch(() => ({ days: [] })),
      state.meta.weeks?.length ? state.meta.weeks : api('GET', '/api/curriculum').catch(() => []),
    ]);
    state.meta.weeks = weeks;
    return { fights, days: att.days || [], weeks };
  },
  view: ({ me, fights, days, weeks }) => careerView(me, fights, days, weeks),
});

function careerView(me, fights, days = [], weeks = []) {
  const m = me.member;
  const fin = Object.entries(m.finishes).sort((a, b) => b[1] - a[1]);
  const goal = state.meta.finishTitleAt;
  const played = m.wins + m.losses + m.draws;
  const rate = played ? Math.round((m.wins / played) * 100) + '%' : '–';
  // 최근 5경기 흐름: 승 = 파란 면, 패 = 빨간 선, 무 = 회색 선 (아직 중계를 안 본 경기는 결과를 숨김)
  const form = fights.filter((f) => !f.hidden && f.result).slice(0, 5).map((f) => {
    const w = f.result.winnerId;
    const k = !w ? ['D', 'd'] : w === m.id ? ['W', 'w'] : ['L', 'l'];
    return `<i class="form ${k[1]} px">${k[0]}</i>`;
  }).join('');
  return `
    ${trainingCard(me, days, weeks)}
    <div class="section-title">경기</div>
    <div class="card career-sum">
      <div class="stats4">
        <div class="stat"><b>${m.wins}</b><span>승</span></div>
        <div class="stat"><b>${m.losses}</b><span>패</span></div>
        <div class="stat"><b style="color:var(--red-text)">${m.kos}</b><span>KO/TKO</span></div>
        <div class="stat"><b>${rate}</b><span>승률</span></div>
      </div>
      <div class="row form-row"><span class="muted small grow">최근 경기</span>${form || '<span class="muted small">아직 없음</span>'}</div>
      <div class="muted small">무승부 ${m.draws} · 팬 ${m.fans}</div>
    </div>
    <div class="section-title">피니시 칭호 <span class="muted">같은 기술 ${goal}번</span></div>
    ${fin.length ? `<div class="card">${fin.map(([k, c]) => `
      <div class="row" style="margin:6px 0"><span class="grow"><b>${esc(k)}</b>${c >= goal ? ` <span class="badge solid">${esc(k)} 마스터</span>` : ''}</span><span class="muted small">${Math.min(c, goal)}/${goal}</span></div>
      ${c < goal ? `<div class="mbar"><i style="width:${(c / goal) * 100}%"></i></div>` : ''}`).join('')}</div>`
      : '<div class="card empty">아직 피니시가 없어요. KO나 TKO로 이겨보세요!</div>'}
    <div class="section-title">경기 기록</div>
    ${fights.length ? fights.map((f) => fightRow(f, m.id)).join('') : '<div class="card empty">아직 경기 기록이 없어요. 콜아웃으로 첫 경기를 잡으세요!</div>'}`;
}
