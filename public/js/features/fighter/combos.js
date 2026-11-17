// 회원 콤보 루틴: 내 기술을 순서대로 엮어 저장 (경기 중 공격 차례에 가끔 사용)
import { state } from '../../core/state.js';
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route } from '../../core/router.js';

// 콤보 루틴: 저장된 기술 id 목록을 기술 객체로 (지워진 기술은 빠짐)
export function comboList(me) {
  return (me.member.combos || []).map((c) => toSkills(me, c)).filter((c) => c.length >= 2);
}
// 필살기 콤보 (없으면 null)
export function finisherOf(me) {
  const c = toSkills(me, me.member.finisher || []);
  return c.length >= 2 ? c : null;
}
const toSkills = (me, ids) => { const byId = new Map(me.skills.map((s) => [s.id, s])); return ids.map((id) => byId.get(id)).filter(Boolean); };

export function comboModal(me) {
  const M = state.meta.comboMax || { combos: 5, min: 2, max: 5 };
  const C = state.meta.categories;
  const picks = me.skills.filter((s) => C[s.category]); // 공격 + 방어 기술
  const isAtk = (id) => C[picks.find((s) => s.id === id)?.category]?.group === 'attack';
  const list = comboList(me).map((c) => c.map((s) => s.id));
  let draft = [];
  let finisher = finisherOf(me)?.map((s) => s.id) || null;
  // 분류 탭: 기술 있는 첫 분류부터. 탭 안에서는 숙련 높은 순
  let tab = Object.keys(C).find((k) => picks.some((s) => s.category === k));
  const nameOf = (id) => esc(picks.find((s) => s.id === id)?.name || '');
  openModal(`
    <h3>내 콤보 루틴</h3>
    <div class="muted small" style="margin-bottom:10px">경기 중 공격 차례에 가끔(30%) 콤보를 써요. 앞 펀치가 맞을수록 다음 펀치가 잘 들어가지만, 중간에 빗나가면 끊기고 카운터를 맞기 쉬워요. 🛡️ 방어 기술을 넣으면 피하면서 다음 펀치가 더 세게 들어가요.</div>
    <div class="section-title" style="margin-top:0">필살기 콤보 <span class="muted" style="text-transform:none;font-weight:600">· 1개 · 막판에 한 번, 센 상대일수록 더 세게</span></div>
    <div id="c-fin" style="margin-bottom:10px"></div>
    <div class="section-title" style="margin-top:0">일반 콤보 <span class="muted" style="text-transform:none;font-weight:600">· 최대 ${M.combos}개</span></div>
    <div class="stack">
      <div id="c-list"></div>
      <div><label class="field">새 콤보 — 기술을 순서대로 누르세요 (${M.min}개 이상, 공격 1개 이상)</label>
        <div class="card" id="c-draft" style="min-height:22px;margin:0 0 8px"></div>
        <div class="seg five" id="c-cat" style="margin-bottom:6px">${Object.entries(C).map(([k, v]) => `<button data-c="${k}" ${picks.some((s) => s.category === k) ? '' : 'disabled'}>${v.icon}<br/>${esc(v.label)}</button>`).join('')}</div>
        <div class="seg" style="grid-template-columns:repeat(3,1fr);grid-auto-rows:38px;height:126px;overflow-y:auto;align-content:start" id="c-pick"></div>
        <div class="row" style="margin-top:8px"><button class="btn sm grow" id="c-undo">한 칸 지우기</button><button class="btn sm navy grow" id="c-add">콤보 추가</button><button class="btn sm red grow" id="c-fin-set">필살기로 지정</button></div>
      </div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
    const draw = () => {
      el.querySelector('#c-list').innerHTML = list.length
        ? list.map((c, i) => `<div class="list-item small"><div class="grow">${c.map(nameOf).join(' → ')}</div><button class="btn sm ghost" data-del="${i}" aria-label="콤보 삭제">✕</button></div>`).join('')
        : '<div class="card empty">아직 콤보가 없어요.</div>';
      el.querySelector('#c-fin').innerHTML = finisher
        ? `<div class="list-item small"><span class="badge red">FINISHER</span><div class="grow">${finisher.map(nameOf).join(' → ')}</div><button class="btn sm ghost" id="c-fin-del" aria-label="필살기 삭제">✕</button></div>`
        : '<div class="card empty">아래에서 콤보를 만들고 "필살기로 지정"을 누르세요.</div>';
      const fd = el.querySelector('#c-fin-del'); if (fd) fd.onclick = () => { finisher = null; draw(); };
      el.querySelector('#c-draft').innerHTML = draft.length ? draft.map(nameOf).join(' → ') : '<span class="muted small">기술을 눌러 순서를 정하세요</span>';
      const ready = draft.length >= M.min && draft.some(isAtk);
      el.querySelector('#c-add').disabled = !ready || list.length >= M.combos;
      el.querySelector('#c-fin-set').disabled = !ready;
      el.querySelectorAll('#c-cat button').forEach((b) => b.classList.toggle('on', b.dataset.c === tab));
      const pick = el.querySelector('#c-pick');
      if (pick) {
        pick.innerHTML = picks.filter((s) => s.category === tab).sort((a, b) => b.mastery - a.mastery)
          .map((s) => `<button data-id="${s.id}" ${draft.length >= M.max ? 'disabled' : ''}>${esc(s.name)} <span class="px" style="opacity:.6">${s.mastery}</span></button>`).join('');
        pick.querySelectorAll('button').forEach((b) => (b.onclick = () => { draft.push(b.dataset.id); draw(); }));
      }
      el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { list.splice(+b.dataset.del, 1); draw(); }));
    };
    el.querySelectorAll('#c-cat button').forEach((b) => (b.onclick = () => { tab = b.dataset.c; draw(); }));
    el.querySelector('#c-undo').onclick = () => { draft.pop(); draw(); };
    el.querySelector('#c-add').onclick = () => { list.push(draft); draft = []; draw(); };
    el.querySelector('#c-fin-set').onclick = () => { finisher = draft; draft = []; draw(); }; // 필살기는 1개라 덮어씀
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('PUT', '/api/me/combos', { combos: list, finisher }); closeModal(); toast('콤보를 저장했어요.'); route();
    });
    if (!picks.some((s) => isAtk(s.id))) { el.querySelector('#c-cat').remove(); el.querySelector('#c-pick').outerHTML = '<div class="card empty">공격 기술이 없어요. 코치에게 기술 등록을 받으세요.</div>'; }
    draw();
  });
}
