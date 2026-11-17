// 기술 관리 (코치): 배운 기술 등록 · 숙련 ±5 · 삭제 — 코치 회원 관리 탭 안에서 쓴다
import { state } from '../../core/state.js';
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';

export const addSkillButton = (m) => `<button class="btn navy grow" data-addskill="${m.id}" data-name="${esc(m.name)}">＋ 배운 기술 등록</button>`;

// members: 코치 회원 목록 (기술 포함), onChange: 바뀐 뒤 다시 그리기
export function bindSkillAdmin(members, onChange) {
  const allSkills = () => (members || []).flatMap((m) => m.skills);

  document.querySelectorAll('[data-addskill]').forEach((b) => (b.onclick = () => {
    const C = state.meta.categories, MV = state.meta.moves || {};
    let category = 'jab', move = MV.jab?.[0]?.[0];
    openModal(`<h3>${esc(b.dataset.name)} · 배운 기술 등록</h3>
      <div class="stack">
        <div><label class="field">분류</label><div class="seg five" id="s-cat">${Object.entries(C).map(([k, v]) => `<button data-c="${k}" class="${k === category ? 'on' : ''}">${v.icon}<br/>${v.label}</button>`).join('')}</div></div>
        <div><label class="field">세부 기술</label><div class="seg four moves" id="s-move"></div></div>
        <div><label class="field">기술 이름</label><input id="s-name" maxlength="24" placeholder="예: 원투, 레프트 훅, 리버샷, 슬립" /></div>
        <div><label class="field">시작 숙련도 <b id="s-mv" class="px">10</b> / 100</label><input id="s-m" type="range" min="1" max="100" value="10" /></div>
        <div><label class="field">메모 (선택)</label><input id="s-desc" maxlength="60" placeholder="예: 3월 2주차 수업" /></div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn navy grow" id="ok">등록</button></div>`, (el) => {
      const nameIn = el.querySelector('#s-name');
      const labelOf = (id) => (MV[category] || []).find(([k]) => k === id)?.[1] || '';
      // 세부 기술을 고르면 이름을 채운다 (코치가 직접 고친 이름은 덮어쓰지 않음)
      const pickMove = (id) => {
        const auto = !nameIn.value || nameIn.value === nameIn.dataset.auto;
        move = id;
        el.querySelectorAll('#s-move button').forEach((x) => x.classList.toggle('on', x.dataset.m === id));
        if (auto) nameIn.value = nameIn.dataset.auto = labelOf(id);
      };
      const drawMoves = () => {
        el.querySelector('#s-move').innerHTML = (MV[category] || []).map(([k, label]) => `<button data-m="${k}">${esc(label)}</button>`).join('');
        el.querySelectorAll('#s-move button').forEach((x) => (x.onclick = () => pickMove(x.dataset.m)));
        pickMove(MV[category]?.[0]?.[0]);
      };
      drawMoves();
      el.querySelectorAll('#s-cat button').forEach((t) => (t.onclick = () => {
        category = t.dataset.c; el.querySelectorAll('#s-cat button').forEach((x) => x.classList.toggle('on', x === t));
        drawMoves();
      }));
      const mv = el.querySelector('#s-m');
      mv.oninput = () => (el.querySelector('#s-mv').textContent = mv.value);
      el.querySelector('#x').onclick = closeModal;
      el.querySelector('#ok').onclick = () => act(async () => {
        await api('POST', `/api/coach/members/${b.dataset.addskill}/skills`, { name: el.querySelector('#s-name').value, category, move, mastery: mv.value, desc: el.querySelector('#s-desc').value });
        closeModal(); toast('기술이 등록되었습니다.'); onChange();
      });
    });
  }));
  const adjust = (id, d) => act(async () => {
    const s = allSkills().find((x) => x.id === id);
    await api('PUT', `/api/coach/skills/${id}`, { mastery: s.mastery + d }); onChange();
  });
  document.querySelectorAll('[data-mup]').forEach((b) => (b.onclick = () => adjust(b.dataset.mup, 5)));
  document.querySelectorAll('[data-mdown]').forEach((b) => (b.onclick = () => adjust(b.dataset.mdown, -5)));
  document.querySelectorAll('[data-delskill]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm('이 기술을 삭제할까요?')) return;
    await api('DELETE', `/api/coach/skills/${b.dataset.delskill}`); onChange();
  })));
}
