// 회원 홈 탭: 내 선수 카드 · 출석·수강권 · 기본 전략 · 필살기 콤보 · 옷장·상점 가기 · 내 기술
import { state } from '../../core/state.js';
import { esc, svg, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route } from '../../core/router.js';
import { memberTab } from '../../core/tabs.js';
import { fighterCard } from './components.js';
import { skillGroups } from '../skills/components.js';
import { finisherOf, finisherModal } from './finisher.js';

memberTab({
  id: 'home', order: 10, label: '홈',
  icon: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  load: async () => ({ callouts: await api('GET', '/api/callouts') }),
  view: ({ me, callouts }) => homeView(me, callouts),
  bind: ({ me }) => {
    const strat = document.getElementById('editStrategy');
    if (strat) strat.onclick = () => strategyModal(me.member.strategy);
    const fin = document.getElementById('editFinisher');
    if (fin) fin.onclick = () => finisherModal(me);
    // 타일을 키보드로도 열 수 있게 (Enter · Space)
    document.querySelectorAll('.prep-tile[role=button]').forEach((t) => (t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } }));
  },
});

function homeView(me, callouts) {
  const m = me.member;
  const pending = (callouts || []).filter((c) => c.opponentId === m.id && c.status === 'pending_coach');
  const s = m.strategy;
  return `
    ${pending.map((c) => `<div class="banner blue" data-go="#/callout"><div class="grow" style="min-width:0"><b>${esc(c.challenger)}</b> 님의 도전장!${c.message ? `<div class="ellipsis">“${esc(c.message)}”</div>` : ''}<div class="small" style="opacity:.75">코치가 승인하면 바로 경기</div></div><span>→</span></div>`).join('')}
    ${fighterCard(m)}
    <div class="section-title">내 준비</div>
    <div class="prep">
      ${prepTile({ go: '#/passes', code: 'GYM', title: '출석 · 수강권', sub: `누적 ${m.attendCount}회 · 출석하면 능력치가 올라요`,
        chip: m.attended ? '<span class="badge solid">오늘 완료</span>' : '<span class="badge">미출석</span>' })}
      ${prepTile({ id: 'editFinisher', code: 'FIN', title: '필살기',
        sub: finisherOf(me) ? finisherOf(me).map((x) => esc(x.name)).join(' · ') : '배운 기술로 막판 한 방',
        chip: finisherOf(me) ? `<span class="badge solid">${finisherOf(me).length}타 장착</span>` : '<span class="badge gold">만들기</span>' })}
      ${prepTile({ go: '#/combos', code: 'CMB', title: '내 콤비', sub: m.comboOpen ? '탭 한 번으로 필살기 장착' : '기술을 배우면 열려요',
        chip: m.comboOpen ? `<span class="badge">열림 ${m.comboOpen}</span>` : '<span class="badge">잠김</span>' })}
      ${prepTile({ id: 'editStrategy', code: 'STR', title: '기본 전략', sub: `${esc(s.stance)} · ${esc(s.guard)} · ${esc(s.style)}`,
        chip: '<span class="badge">바꾸기</span>' })}
      ${prepTile({ go: '#/shop', code: 'GEAR', title: '옷장 · 상점', sub: '모은 코인으로 브랜드 장비', wide: true,
        chip: `<span class="badge gold">COIN ${m.coins ?? 0}</span>` })}
    </div>
    <div class="section-title">내 기술 <span class="muted">${me.skills.length}</span></div>
    ${skillGroups(me.skills)}
    <div class="muted small" style="margin:10px 2px">숫자는 숙련도예요. 숙련이 높을수록 경기에서 자주 나오고 잘 들어가요. 코치가 수업에서 본 실력대로 조정하고, 경기에서 성공하면 조금씩 올라요. 같은 기술로 ${state.meta.finishTitleAt}번 피니시하면 칭호가 붙어요.</div>`;
}

// 내 준비 타일: 약어 칸 + 상태 칩 (오른쪽 위) + 이름 + 한 줄 설명
function prepTile({ go, id, code, title, sub, chip, wide }) {
  const attr = go ? `data-go="${go}"` : `id="${id}" role="button" tabindex="0"`;
  return `<div class="prep-tile${wide ? ' wide' : ''}" ${attr}>
    <div class="row" style="justify-content:space-between"><span class="prep-code px">${code}</span>${chip}</div>
    <b>${title}</b><div class="muted small prep-sub">${sub}</div>
  </div>`;
}

function strategyModal(cur) {
  const S = state.meta.strategy;
  const sel = { ...cur, focus: [...(cur.focus || ['헤드', '바디'])] };
  const HELP = {
    stance: { 오소독스: '왼발 앞. 가장 흔한 자세', 사우스포: '오른발 앞. 오소독스 상대로 타격 정확도 ↑' },
    guard: { 하이가드: '얼굴 펀치 방어 ↑ / 바디에 약간 취약', 숄더롤: '잽·스트레이트 방어 ↑↑ · 카운터 ↑ / 훅에 약함', 밸런스: '모든 펀치 방어 조금 ↑' },
    style: { 인파이팅: '공격권 ↑ · 훅·어퍼컷·바디 비중 ↑', 카운터: '공격권 ↓ · 상대 펀치가 빗나가면 받아치기', 아웃복싱: '잽·스트레이트 비중 ↑ · 어퍼컷 비중 ↓' },
  };
  const seg = (k) => `<div class="seg" style="grid-template-columns:repeat(${S[k].length},1fr)">${S[k].map((v) => `<button data-k="${k}" data-v="${esc(v)}" class="${(k === 'focus' ? sel.focus.includes(v) : sel[k] === v) ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
  const help = (k) => (HELP[k] ? `<div class="muted small" id="h-${k}" style="margin-top:4px">${HELP[k][sel[k]]}</div>` : '');
  openModal(`
    <h3>내 기본 전략</h3>
    <div class="stack">
      <div><label class="field">스탠스</label>${seg('stance')}${help('stance')}</div>
      <div><label class="field">가드</label>${seg('guard')}${help('guard')}</div>
      <div><label class="field">스타일</label>${seg('style')}${help('style')}</div>
      <div><label class="field">공략 부위 (복수 선택) — 해당 펀치를 더 자주 시도</label>${seg('focus')}</div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
    el.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => {
      const { k, v } = b.dataset;
      if (k === 'focus') {
        if (sel.focus.includes(v)) { if (sel.focus.length > 1) sel.focus = sel.focus.filter((x) => x !== v); }
        else sel.focus.push(v);
        el.querySelectorAll(`[data-k="focus"]`).forEach((x) => x.classList.toggle('on', sel.focus.includes(x.dataset.v)));
      } else {
        sel[k] = v;
        el.querySelectorAll(`[data-k="${k}"]`).forEach((x) => x.classList.toggle('on', x.dataset.v === v));
        const h = el.querySelector(`#h-${k}`); if (h) h.textContent = HELP[k][v];
      }
    }));
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('PUT', '/api/me/strategy', sel); closeModal(); toast('전략을 저장했어요.'); route();
    });
  });
}
