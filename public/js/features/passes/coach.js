// 수강권 관리 (코치): 회원 카드 안의 수강권 칸 · 등록 창 · 내역 창 — 코치 회원 관리 탭에서 쓴다
import { state } from '../../core/state.js';
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { STATUS_LABEL, dday, shortDate, passLine, todayKST, endOf } from './components.js';

// 회원 목록 줄에 붙는 표시: 확인이 필요하면 빨갛게 (수강권 없음 · 이번 주 끝 · 2회 이하 · 7일 이하)
export function passBadge(m) {
  const p = m.pass;
  if (!p) return `<span class="pbadge warn">${m.nextPass ? `수강권 ${shortDate(m.nextPass.start)} 시작` : '수강권 없음'}</span>`;
  const warn = p.weekLeft === 0 || p.left <= 2 || p.daysLeft <= 7;
  return `<span class="pbadge ${warn ? 'warn' : ''}">주${p.perWeek}회 · 이번 주 ${p.weekLeft}/${p.perWeek} · ${p.left}회 · ${dday(p.daysLeft)}</span>`;
}

// 회원 카드를 펼쳤을 때 수강권 칸
export function passBlock(m) {
  const now = m.pass ? passLine(m.pass) : m.nextPass ? `${esc(m.nextPass.name)} · ${shortDate(m.nextPass.start)} 시작 예정` : '<span class="warn-text">사용 중인 수강권 없음</span>';
  return `<div class="pass-admin row">
      <div class="grow" style="min-width:0"><div class="small muted">수강권</div><div class="small">${now}</div></div>
      <button class="btn sm primary" data-addpass="${m.id}">＋ 등록</button><button class="btn sm" data-passes="${m.id}">내역</button>
    </div>`;
}

// 수강권 등록 창 (onDone: 등록 뒤 다시 그리기)
export function openPassRegister(m, onDone) {
  const presets = state.meta.passPresets || [];
  const weeks = [...new Set(presets.map((p) => p.perWeek))], monthsList = [...new Set(presets.map((p) => p.months))];
  let perWeek = weeks[0], months = monthsList[0], totalEdited = false, startEdited = false;
  const seg = (id, list, cur, label) => `<div class="seg" id="${id}" style="grid-template-columns:repeat(${list.length},1fr)">${list.map((v) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}">${label(v)}</button>`).join('')}</div>`;
  openModal(`<h3>${esc(m.name)} · 수강권 등록</h3>
    <div class="stack">
      <div><label class="field">주 횟수</label>${seg('p-week', weeks, perWeek, (v) => `주${v}회`)}</div>
      <div><label class="field">기간</label>${seg('p-months', monthsList, months, (v) => `${v}개월`)}</div>
      <div><label class="field">전체 횟수 <span class="muted">· 기본 = 주 횟수 × 4주 × 개월</span></label><input id="p-total" type="number" inputmode="numeric" min="1" max="999" /></div>
      <div><label class="field">시작일</label><input id="p-start" type="date" value="${todayKST()}" /></div>
      <div class="card small" id="p-sum"></div>
      <div><label class="field">메모 (선택)</label><input id="p-memo" maxlength="60" placeholder="예: 11월 결제, 할인 적용" /></div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">등록</button></div>`, (el) => {
    const $total = el.querySelector('#p-total'), $start = el.querySelector('#p-start'), $sum = el.querySelector('#p-sum');
    const update = () => {
      if (!totalEdited) $total.value = perWeek * 4 * months;
      const start = $start.value || todayKST();
      $sum.innerHTML = `<b>주${perWeek}회 ${months}개월</b> · ${shortDate(start)} ~ ${shortDate(endOf(start, months))} · 전체 ${esc($total.value)}회`;
    };
    const pick = (id, set) => el.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => {
      el.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b));
      set(Number(b.dataset.v)); update();
    }));
    pick('p-week', (v) => { perWeek = v; });
    pick('p-months', (v) => { months = v; });
    $total.oninput = () => { totalEdited = true; update(); };
    $start.onchange = () => { startEdited = true; update(); }; // 안 바꾸면 시작일은 서버 기준 오늘 (폰 시계가 틀려도 안전)
    update();
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('POST', `/api/coach/members/${m.id}/passes`, { perWeek, months, total: $total.value, start: startEdited ? $start.value : undefined, memo: el.querySelector('#p-memo').value });
      closeModal(); toast(`${m.name} 수강권 등록 · 주${perWeek}회 ${months}개월`); onDone?.();
    });
  });
}

// 수강권 내역 창: 사용 중 · 예정 · 지난 수강권, 잘못 넣은 수강권 삭제
async function openPassHistory(m, onChange) {
  const d = await api('GET', `/api/coach/members/${m.id}/passes`);
  const all = [...d.current, ...d.scheduled, ...d.past];
  openModal(`<h3>${esc(m.name)} · 수강권 내역</h3>
    ${all.length ? all.map((p) => `
      <div class="list-item">
        <div class="grow" style="min-width:0"><div style="font-weight:800">${esc(p.name)} <span class="badge">${STATUS_LABEL[p.status]}</span></div>
          <div class="muted small">${shortDate(p.start)} ~ ${shortDate(p.end)} · ${p.used}/${p.total}회 사용${p.memo ? ` · ${esc(p.memo)}` : ''}</div></div>
        <button class="btn sm ghost" data-delpass="${p.id}">삭제</button>
      </div>`).join('') : '<div class="card empty">등록된 수강권이 없어요.</div>'}
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="add">＋ 수강권 등록</button></div>`, (el) => {
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#add').onclick = () => openPassRegister(m, onChange);
    el.querySelectorAll('[data-delpass]').forEach((b) => (b.onclick = () => act(async () => {
      if (!confirm('이 수강권을 삭제할까요? 잘못 등록한 경우에만 지워 주세요.')) return;
      await api('DELETE', `/api/coach/passes/${b.dataset.delpass}`);
      toast('수강권을 삭제했어요.'); onChange?.(); openPassHistory(m, onChange);
    })));
  });
}

// members: 코치 회원 목록, onChange: 바뀐 뒤 다시 그리기
export function bindPassAdmin(members, onChange) {
  const byId = (id) => members?.find((m) => m.id === id);
  document.querySelectorAll('[data-addpass]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); openPassRegister(byId(b.dataset.addpass), onChange); }));
  document.querySelectorAll('[data-passes]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(() => openPassHistory(byId(b.dataset.passes), onChange)); }));
}
