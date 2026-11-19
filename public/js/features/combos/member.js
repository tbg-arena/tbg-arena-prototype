// 회원 '내 콤비' 화면 (#/combos, 홈의 '내 콤비' 카드로 들어옴)
// 배운 기술로만 된 콤비가 열리고, 열린 콤비는 탭 한 번으로 필살기 장착 (직접 만들기는 홈의 필살기 카드 그대로)
import { state } from '../../core/state.js';
import { $app, esc, toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { go, addPage } from '../../core/router.js';

addPage('combos', renderCombos, { needsId: false });

let tab = 'open'; // 열림 / 잠김

async function renderCombos() {
  state.tab = 'combos';
  const seq = state.seq;
  let list;
  try { list = await api('GET', '/api/me/combos'); } catch (e) { toast(e.message, true); return go('#/home'); }
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  const open = list.filter((c) => c.open), locked = list.filter((c) => !c.open);
  const eq = list.find((c) => c.equipped);
  const shown = tab === 'open' ? open : locked;
  $app.innerHTML = `
    <div class="topbar"><button class="link" id="back">← 돌아가기</button><div class="muted small">내 콤비</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      <div class="section-title">장착 중인 필살기</div>
      ${eq ? `<div class="card cmb-eq"><div class="row"><div class="grow cmb-parts">${parts(eq)}</div><div class="cmb-hits"><b class="px">${eq.hits}</b><span>HIT</span></div></div>
        <div class="muted small" style="margin-top:10px">경기 막판에 한 번 터져요. 방어 동작 다음 펀치는 더 세게 들어가요.</div></div>`
        : '<div class="card empty">아직 콤비로 장착한 필살기가 없어요.<br/>아래 열린 콤비에서 골라 보세요.</div>'}
      <div class="section-title">콤비 <span class="muted">· 배운 기술로만 된 콤비가 열려요</span></div>
      <div class="seg two" style="margin-bottom:10px">
        <button data-tab="open" class="${tab === 'open' ? 'on' : ''}">열림 ${open.length}</button>
        <button data-tab="locked" class="${tab === 'locked' ? 'on' : ''}">잠김 ${locked.length}</button>
      </div>
      ${shown.length ? `<div class="card cmb-list">${shown.map(row).join('')}</div>` : `<div class="card empty">${tab === 'open' ? '아직 열린 콤비가 없어요.<br/>수업에서 기술을 배우면 그 기술로 된 콤비가 열려요.' : '모든 콤비가 열렸어요!'}</div>`}
      <div class="muted small" style="margin:12px 2px">흰 칸 = 펀치, 점선 = 디펜스, 점 테두리 = 스텝. 펀치 없이 디펜스·스텝만 있는 콤비도 필살기가 돼요 (화려한 움직임으로 흐름을 가져와요).</div>
    </div>`;
  document.getElementById('back').onclick = () => (history.length > 1 ? history.back() : go('#/home'));
  document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderCombos(); }));
  document.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = () => act(async () => {
    await api('POST', `/api/me/combos/${b.dataset.equip}/equip`);
    toast('필살기로 장착했어요!'); renderCombos();
  })));
}

const parts = (c) => c.parts.map((p) => `<span class="cmb-p ${p.kind}">${esc(p.label)}</span>`).join('');

// 한 줄 = 콤비 하나 (내 기술 목록처럼). 오른쪽: 장착 버튼 / 장착 중 표시. 잠긴 콤비는 뭘 배우면 열리는지
function row(c) {
  const side = !c.open ? '' : c.equipped ? '<span class="badge solid">장착 중</span>'
    : `<button class="btn sm" data-equip="${c.id}" aria-label="이 콤비를 필살기로 장착">장착</button>`;
  return `<div class="cmb-row ${c.open ? '' : 'locked'}">
    <div class="grow"><div class="cmb-parts">${parts(c)}</div>
      ${c.open ? `<div class="muted small">${c.hits}타</div>` : `<div class="muted small">${c.missing.map(esc).join(' · ')} 배우면 열려요</div>`}</div>
    ${side}
  </div>`;
}
