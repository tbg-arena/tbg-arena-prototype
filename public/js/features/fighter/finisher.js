// 필살기 콤보 (회원당 1개): 내 기술을 순서대로 엮어 저장. 경기 막판에 한 번, 첫 펀치가 맞으면 끝까지 들어간다
import { state } from '../../core/state.js';
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route } from '../../core/router.js';

// 저장된 필살기를 기술 목록으로 (지워진 기술은 빠짐, 2개 미만이면 null)
export function finisherOf(me) {
  const byId = new Map(me.skills.map((s) => [s.id, s]));
  const c = (me.member.finisher || []).map((id) => byId.get(id)).filter(Boolean);
  return c.length >= 2 ? c : null;
}

export function finisherModal(me) {
  const L = state.meta.finLen || { min: 2, max: 20 };
  const C = state.meta.categories;
  const picks = me.skills.filter((s) => C[s.category]); // 공격 + 방어 기술
  const isAtk = (id) => C[picks.find((s) => s.id === id)?.category]?.group === 'attack';
  let draft = finisherOf(me)?.map((s) => s.id) || [];
  // 분류 탭: 기술 있는 첫 분류부터. 탭 안에서는 숙련 높은 순
  let tab = Object.keys(C).find((k) => picks.some((s) => s.category === k));
  const nameOf = (id) => esc(picks.find((s) => s.id === id)?.name || '');
  openModal(`
    <h3>필살기 콤보</h3>
    <div class="muted small" style="margin-bottom:10px">경기 막판(3라운드 후반이나 상대가 지쳤을 때) 한 번 터져요. 첫 펀치가 맞으면 끝까지 들어가고, 나보다 센 상대일수록 더 세게 들어가요. 🛡️ 방어 기술을 넣으면 피하면서 다음 펀치가 더 세져요.</div>
    <div class="stack">
      <div><label class="field">기술을 순서대로 누르세요 (${L.min}개 이상, 공격 1개 이상)</label>
        <div class="card" id="c-draft" style="min-height:22px;margin:0 0 16px"></div>
        <div class="seg five" id="c-cat" style="margin-bottom:14px;gap:8px">${Object.entries(C).map(([k, v]) => `<button data-c="${k}" ${picks.some((s) => s.category === k) ? '' : 'disabled'}>${v.icon}<br/>${esc(v.label)}</button>`).join('')}</div>
        <div class="seg" style="grid-template-columns:repeat(3,1fr);grid-auto-rows:38px;gap:10px;height:134px;overflow-y:auto;align-content:start" id="c-pick"></div>
        <div class="row" style="margin-top:16px;gap:10px"><button class="btn sm grow" id="c-undo">한 칸 지우기</button><button class="btn sm grow" id="c-clear">전부 지우기</button></div>
      </div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
    const draw = () => {
      el.querySelector('#c-draft').innerHTML = draft.length ? draft.map(nameOf).join(' → ') : '<span class="muted small">비워 두고 저장하면 필살기가 해제돼요</span>';
      // 저장: 비어 있으면 해제, 아니면 조건을 채워야 함
      el.querySelector('#ok').disabled = draft.length > 0 && (draft.length < L.min || !draft.some(isAtk));
      el.querySelectorAll('#c-cat button').forEach((b) => b.classList.toggle('on', b.dataset.c === tab));
      const pick = el.querySelector('#c-pick');
      if (pick) {
        pick.innerHTML = picks.filter((s) => s.category === tab).sort((a, b) => b.mastery - a.mastery)
          .map((s) => `<button data-id="${s.id}" ${draft.length >= L.max ? 'disabled' : ''}>${esc(s.name)} <span class="px" style="opacity:.6">${s.mastery}</span></button>`).join('');
        pick.querySelectorAll('button').forEach((b) => (b.onclick = () => { draft.push(b.dataset.id); draw(); }));
      }
    };
    el.querySelectorAll('#c-cat button').forEach((b) => (b.onclick = () => { tab = b.dataset.c; draw(); }));
    el.querySelector('#c-undo').onclick = () => { draft.pop(); draw(); };
    el.querySelector('#c-clear').onclick = () => { draft = []; draw(); };
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('PUT', '/api/me/finisher', { finisher: draft.length ? draft : null });
      closeModal(); toast(draft.length ? '필살기를 저장했어요.' : '필살기를 해제했어요.'); route();
    });
    if (!picks.some((s) => isAtk(s.id))) { el.querySelector('#c-cat').remove(); el.querySelector('#c-pick').outerHTML = '<div class="card empty">공격 기술이 없어요. 코치에게 기술 등록을 받으세요.</div>'; }
    draw();
  });
}
