// 코치 콤비 관리 ('배운 것' 탭의 '콤비'): 추가 · 수정 · 삭제
// 콤비 글자를 저장하면 서버가 동작으로 나눠 보여준다. 회원에게 열리는지는 배운 기술로 자동 계산
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';

const parts = (c) => c.parts.map((p) => `<span class="cmb-p ${p.kind}">${esc(p.label)}</span>`).join('');

export function comboAdminView(list) {
  list = list || [];
  return `
    <div class="row cmb-add"><input id="c-new" maxlength="80" placeholder="예: 원투 슬립 투 훅 투" aria-label="새 콤비" /><button class="btn primary" id="c-add">추가</button></div>
    <div class="muted small" style="margin:8px 2px 12px">띄어쓰기로 동작을 나눠 적어요. 펀치: 잽·원·투·원투·핀·훅·체크 훅·오버핸드·어퍼·바디·바디 훅 / 디펜스: 가드·블락·슬립·스웨이·숄더롤·위빙·더킹·패링·백스텝 / 스텝: 워킹 스텝·점프·사이드·피벗·L 스텝. 반복은 <b>어퍼X3</b>, 메모는 <b>(대각선)</b>. 모르는 동작이 있으면 저장 전에 알려 줘요.</div>
    <div class="section-title">콤비 ${list.length}개 <span class="muted">· 모두 필살기로 쓸 수 있어요</span></div>
    ${list.length ? `<div class="card cmb-list">${list.map((c, i) => `
      <div class="cmb-row">
        <span class="cmb-no px">${i + 1}</span>
        <div class="grow"><div class="cmb-parts">${parts(c)}</div>
</div>
        <button class="btn sm" data-cedit="${c.id}">수정</button><button class="btn sm ghost" data-cdel="${c.id}" aria-label="삭제">✕</button>
      </div>`).join('')}</div>` : '<div class="card empty">콤비가 없어요. 위에서 추가해 주세요.</div>'}`;
}

export function bindComboAdmin(list, onChange) {
  const input = document.getElementById('c-new');
  const add = () => act(async () => {
    await api('POST', '/api/coach/combos', { text: input.value });
    toast('콤비를 추가했어요.'); onChange();
  });
  document.getElementById('c-add').onclick = add;
  input.onkeydown = (e) => { if (e.key === 'Enter') add(); };
  document.querySelectorAll('[data-cedit]').forEach((b) => (b.onclick = () => {
    const c = list.find((x) => x.id === b.dataset.cedit);
    openModal(`<h3>콤비 수정</h3>
      <input id="c-text" maxlength="80" value="${esc(c.text)}" />
      <div class="muted small" style="margin-top:8px">이미 이 콤비를 필살기로 장착한 회원은 그대로예요 (기술로 저장돼 있어서).</div>
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
      el.querySelector('#x').onclick = closeModal;
      el.querySelector('#ok').onclick = () => act(async () => {
        await api('PUT', `/api/coach/combos/${c.id}`, { text: el.querySelector('#c-text').value });
        closeModal(); toast('저장했어요.'); onChange();
      });
    });
  }));
  document.querySelectorAll('[data-cdel]').forEach((b) => (b.onclick = () => act(async () => {
    const c = list.find((x) => x.id === b.dataset.cdel);
    if (!confirm(`'${c.text}' 콤비를 지울까요?\n이미 장착한 회원의 필살기는 그대로예요.`)) return;
    await api('DELETE', `/api/coach/combos/${c.id}`); toast('지웠어요.'); onChange();
  })));
}
