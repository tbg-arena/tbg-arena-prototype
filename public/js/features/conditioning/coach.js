// 코치 '컨디셔닝' 탭: 회원을 고르고 그날 한 체력운동(종목 · 덤벨 무게 · 횟수 · 세트)을 넣는다
// - 오늘 출석한 회원이 맨 앞에 나온다
// - '지난번 그대로'로 직전 운동을 불러와 무게만 고쳐 넣을 수 있다
// - 아래에 그 회원의 기록이 보이고, 잘못 넣은 줄은 ✕ 로 지운다
import { state } from '../../core/state.js';
import { esc, svg, toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { coachTab, renderCoach } from '../../core/tabs.js';
import { historyList, dayLabel } from './components.js';

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const blank = () => ({ exercise: '', kg: '', reps: '', sets: '3', memo: '' });

// 다시 그려도 유지되는 입력 상태
const draft = { memberId: null, day: null, rows: [blank()] };

coachTab({
  id: 'conditioning', order: 17, label: '컨디셔닝',
  icon: svg('<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>'),
  poll: false, // 입력하는 중에 다시 그려지지 않게
  load: async () => {
    const members = await api('GET', '/api/coach/conditioning');
    if (draft.memberId && !members.some((m) => m.id === draft.memberId)) draft.memberId = null;
    const cd = draft.memberId ? await api('GET', `/api/coach/members/${draft.memberId}/conditioning`) : null;
    return { members, cd };
  },
  view: ({ members, cd }) => coachView(members, cd),
  bind: ({ members, cd }) => bindCoach(members, cd),
});

function coachView(members, cd) {
  const today = kstToday();
  if (!draft.day || draft.day > today) draft.day = today;
  const here = members.filter((m) => m.attended);
  const sel = members.find((m) => m.id === draft.memberId);
  const EX = state.meta.conditioningExercises || [];
  return `
    <div class="section-title">회원 고르기 <span class="muted">${here.length ? `오늘 출석 ${here.length}명` : '오늘 출석한 회원이 아직 없어요'}</span></div>
    ${here.length ? `<div class="cd-pick">${here.map((m) => `<button class="${m.id === draft.memberId ? 'on' : ''}" data-cdpick="${m.id}">${esc(m.name)}</button>`).join('')}</div>` : ''}
    <select id="cd-member" aria-label="회원 고르기" style="margin-top:8px">
      <option value="">${here.length ? '다른 회원 찾기' : '회원을 골라 주세요'}</option>
      ${members.map((m) => `<option value="${m.id}" ${m.id === draft.memberId ? 'selected' : ''}>${esc(m.name)}${m.attended ? ' · 오늘 출석' : ''}${m.lastDay ? ` · 마지막 ${dayLabel(m.lastDay)}` : ''}</option>`).join('')}
    </select>

    ${sel ? `
    <div class="card cd-form" style="margin-top:14px">
      <div class="row"><b class="grow" style="font-size:17px">${esc(sel.name)} <span class="muted small">운동 넣기</span></b>
        <input type="date" id="cd-day" value="${draft.day}" max="${today}" aria-label="운동한 날" style="width:auto;padding:8px 10px;font-size:14px" /></div>
      <div class="cd-cols muted"><span>종목</span><span>kg</span><span>횟수</span><span>세트</span><span></span></div>
      ${draft.rows.map((r, i) => `
      <div class="cd-line" data-i="${i}">
        <input list="cd-ex" data-f="exercise" value="${esc(r.exercise)}" placeholder="예: 덤벨 컬" aria-label="종목" />
        <input data-f="kg" value="${esc(r.kg)}" inputmode="decimal" placeholder="맨몸" aria-label="덤벨 무게 kg" />
        <input data-f="reps" value="${esc(r.reps)}" inputmode="numeric" placeholder="–" aria-label="횟수" />
        <input data-f="sets" value="${esc(r.sets)}" inputmode="numeric" aria-label="세트" />
        <button class="btn sm ghost" data-cdrm="${i}" aria-label="이 줄 지우기" ${draft.rows.length < 2 ? 'disabled' : ''}>✕</button>
        <input class="cd-memo" data-f="memo" value="${esc(r.memo)}" placeholder="메모 (선택) · 예: 마지막 세트 힘듦, 플랭크 60초" aria-label="메모" />
      </div>`).join('')}
      <datalist id="cd-ex">${EX.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="row" style="margin-top:10px;gap:8px">
        <button class="btn sm grow" id="cd-add">＋ 종목 추가</button>
        <button class="btn sm grow" id="cd-last" ${cd?.entries.length ? '' : 'disabled'}>지난번 그대로</button>
      </div>
      <button class="btn primary block" id="cd-save" style="margin-top:12px">${esc(sel.name)} 님 운동 저장</button>
      <div class="muted small" style="margin-top:8px">무게는 덤벨 한 개 기준 · 맨몸 운동은 kg 비워 두기 · 시간 운동은 횟수 비우고 메모에 시간</div>
    </div>

    <div class="section-title">${esc(sel.name)} 님 기록 <span class="muted">${cd ? `${cd.total.days}일 · ${cd.total.count}종목` : ''}</span></div>
    ${cd ? historyList(cd.entries, { coach: true, empty: '아직 기록이 없어요. 위에서 첫 운동을 넣어 주세요.' }) : ''}` : `
    <div class="card empty" style="margin-top:14px">운동을 넣을 회원을 골라 주세요.</div>`}`;
}

function bindCoach(members, cd) {
  const pick = (id) => {
    if (id === draft.memberId) return;
    Object.assign(draft, { memberId: id || null, rows: [blank()] });
    renderCoach('conditioning');
  };
  document.querySelectorAll('[data-cdpick]').forEach((b) => (b.onclick = () => pick(b.dataset.cdpick)));
  const selEl = document.getElementById('cd-member');
  if (selEl) selEl.onchange = () => pick(selEl.value);
  if (!draft.memberId) return;

  // 입력할 때마다 draft 에 저장 (다시 그려도 유지)
  document.querySelectorAll('.cd-line input').forEach((inp) => (inp.oninput = () => {
    draft.rows[+inp.closest('.cd-line').dataset.i][inp.dataset.f] = inp.value;
  }));
  const dayEl = document.getElementById('cd-day');
  dayEl.onchange = () => { draft.day = dayEl.value || kstToday(); };
  document.querySelectorAll('[data-cdrm]').forEach((b) => (b.onclick = () => { draft.rows.splice(+b.dataset.cdrm, 1); renderCoach('conditioning'); }));
  document.getElementById('cd-add').onclick = () => {
    if (draft.rows.length >= 20) return toast('한 번에 20개까지 넣을 수 있어요.', true);
    draft.rows.push(blank()); renderCoach('conditioning');
  };
  // 지난번 그대로: 가장 최근 날의 종목을 그대로 불러온다 (무게만 고치면 됨)
  document.getElementById('cd-last').onclick = () => {
    const last = cd.entries[0]?.day;
    const items = cd.entries.filter((e) => e.day === last).reverse();
    draft.rows = items.map((e) => ({ exercise: e.exercise, kg: e.kg ?? '', reps: e.reps ?? '', sets: String(e.sets), memo: '' }));
    toast(`${dayLabel(last)} 운동 ${items.length}개를 불러왔어요. 고칠 것만 고쳐서 저장하세요.`);
    renderCoach('conditioning');
  };
  document.getElementById('cd-save').onclick = () => act(async () => {
    const items = draft.rows.filter((r) => String(r.exercise).trim() || r.kg || r.reps);
    if (!items.length) return toast('종목을 하나 이상 적어 주세요.', true);
    await api('POST', `/api/coach/members/${draft.memberId}/conditioning`, { day: draft.day, items });
    const name = members.find((m) => m.id === draft.memberId)?.name || '';
    draft.rows = [blank()];
    toast(`${name} 님 운동 ${items.length}개를 넣었어요.`);
    renderCoach('conditioning');
  });
  document.querySelectorAll('[data-cddel]').forEach((b) => (b.onclick = () => act(async () => {
    await api('DELETE', `/api/coach/conditioning/${b.dataset.cddel}`);
    toast('기록을 지웠어요.');
    renderCoach('conditioning');
  })));
}
