// 코치 '컨디셔닝' 탭: 같이 운동한 회원을 고르고, 한 줄에 종목(+무게 선택) × 양(횟수 · 시간 · 거리) × 세트 를 적어 저장
// - 회원 여러 명 선택 가능 (오늘 출석한 회원이 맨 앞) → 같은 운동을 한 번에
// - 한 명만 고르면 그 회원 기록이 아래에 보이고 ✕ 로 지울 수 있음 · '지난번 그대로' 사용 가능
import { esc, svg, toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { coachTab, renderCoach } from '../../core/tabs.js';
import { historyList, dayLabel } from './components.js';
import { PRESETS, parsePreset } from './presets.js';

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const UNITS = [['rep', '회'], ['sec', '초'], ['m', 'm']];             // 횟수 · 시간 · 거리
const HINT = { rep: '횟수', sec: '시간 1:30', m: '거리' };
const secText = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const blank = () => ({ exercise: '', kg: '', amount: '', unit: 'rep', sets: '3' });

// 다시 그려도 유지되는 입력 상태
const draft = { day: null, members: [], rows: [blank()] };

coachTab({
  id: 'conditioning', order: 17, label: '컨디셔닝',
  icon: svg('<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>'),
  poll: false, // 입력하는 중에 다시 그려지지 않게
  load: async () => {
    const members = await api('GET', '/api/coach/conditioning');
    draft.members = draft.members.filter((id) => members.some((m) => m.id === id));
    const one = draft.members.length === 1 ? draft.members[0] : null;
    const cd = one ? await api('GET', `/api/coach/members/${one}/conditioning`) : null;
    return { members, cd };
  },
  view: ({ members, cd }) => coachView(members, cd),
  bind: ({ members, cd }) => bindCoach(members, cd),
});

const redraw = () => renderCoach('conditioning');

function coachView(members, cd) {
  const today = kstToday();
  if (!draft.day || draft.day > today) draft.day = today;
  const picked = new Set(draft.members);
  const here = members.filter((m) => m.attended);
  const extra = members.filter((m) => !m.attended && picked.has(m.id));
  const others = members.filter((m) => !m.attended && !picked.has(m.id));
  const n = draft.members.length;
  const filled = draft.rows.filter((r) => r.exercise.trim()).length;
  const rowNames = new Set(draft.rows.map((r) => r.exercise.trim()));
  const onPresets = new Set(PRESETS.map(([name]) => name).filter((name) => rowNames.has(name)));
  return `
    <div class="section-title">누가 했나요 <span class="muted">${n ? `${n}명` : '여러 명 골라도 돼요'}</span></div>
    <div class="cd-pick">
      ${[...here, ...extra].map((m) => `<button class="${picked.has(m.id) ? 'on' : ''}" data-cdpick="${m.id}" aria-pressed="${picked.has(m.id)}">${esc(m.name)}</button>`).join('')}
    </div>
    ${others.length ? `<select id="cd-member" aria-label="다른 회원 추가" style="margin-top:8px"><option value="">＋ 다른 회원 추가</option>
      ${others.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>` : ''}

    <div class="section-title">운동 <input type="date" id="cd-day" value="${draft.day}" max="${today}" aria-label="운동한 날" /></div>
    <details class="cd-presets" ${draft.presetOpen ? 'open' : ''}>
      <summary><b>프리셋</b><span class="muted small">${onPresets.size ? `${onPresets.size}개 넣음` : '눌러서 넣고 빼기'}</span></summary>
      <div class="cd-pre-grid">
        ${PRESETS.map(([name, text], i) => `<button data-cdpre="${i}" class="${onPresets.has(name) ? 'on' : ''}" aria-pressed="${onPresets.has(name)}"><b>${esc(name)}</b><span>${esc(text)}</span></button>`).join('')}
      </div>
    </details>
    <div class="cd-lines">
      ${draft.rows.map((r, i) => `
      <div class="cd-line" data-i="${i}">
        <div class="cd-l1">
          <input data-f="exercise" value="${esc(r.exercise)}" placeholder="종목" aria-label="종목" />
          <label class="cd-kg"><input data-f="kg" value="${esc(r.kg)}" inputmode="decimal" placeholder="무게" aria-label="무게 kg (선택)" /><span>kg</span></label>
        </div>
        <div class="cd-l2">
          <input data-f="amount" value="${esc(r.amount)}" inputmode="${r.unit === 'sec' ? 'text' : 'numeric'}" placeholder="${HINT[r.unit]}" aria-label="${HINT[r.unit]}" />
          <div class="cd-units">${UNITS.map(([k, lb]) => `<button data-cdu="${i}|${k}" class="${r.unit === k ? 'on' : ''}" aria-pressed="${r.unit === k}">${lb}</button>`).join('')}</div>
          <span class="cd-x">×</span>
          <input data-f="sets" value="${esc(r.sets)}" inputmode="numeric" aria-label="세트" />
          <span class="cd-sets">세트</span>
          <button class="btn sm ghost" data-cdrm="${i}" aria-label="이 줄 지우기" ${draft.rows.length < 2 ? 'disabled' : ''}>✕</button>
        </div>
      </div>`).join('')}
    </div>
    <div class="row" style="margin-top:8px;gap:8px">
      <button class="btn sm grow" id="cd-add">＋ 종목 추가</button>
      ${cd?.entries.length ? `<button class="btn sm grow" id="cd-last">${dayLabel(cd.entries[0].day)} 그대로</button>` : ''}
    </div>

    <div class="cd-save">
      <button class="btn primary block" id="cd-save" ${n && filled ? '' : 'disabled'}>${!n ? '회원을 골라 주세요' : !filled ? '종목을 적어 주세요' : `${n}명 · ${filled}종목 저장`}</button>
    </div>

    ${n === 1 && cd ? `<div class="section-title">${esc(members.find((m) => m.id === draft.members[0])?.name || '')} 님 기록 <span class="muted">${cd.total.days}일 · ${cd.total.count}종목</span></div>
      ${historyList(cd.entries, { coach: true, empty: '아직 기록이 없어요.' })}` : ''}`;
}

function bindCoach(members, cd) {
  const $ = (id) => document.getElementById(id);
  const on = (sel, fn) => document.querySelectorAll(sel).forEach((el) => (el.onclick = () => fn(el)));
  // 회원
  on('[data-cdpick]', (b) => {
    const id = b.dataset.cdpick;
    draft.members = draft.members.includes(id) ? draft.members.filter((x) => x !== id) : [...draft.members, id];
    redraw();
  });
  if ($('cd-member')) $('cd-member').onchange = (e) => { if (e.target.value) { draft.members.push(e.target.value); redraw(); } };
  $('cd-day').onchange = (e) => { draft.day = e.target.value || kstToday(); };
  // 운동 줄
  document.querySelectorAll('.cd-line input').forEach((inp) => (inp.oninput = () => {
    draft.rows[+inp.closest('.cd-line').dataset.i][inp.dataset.f] = inp.value;
    // 저장 버튼 글자만 바로 갱신 (다시 그리면 입력 중인 칸 포커스가 빠지므로)
    const n = draft.members.length, filled = draft.rows.filter((r) => r.exercise.trim()).length, btn = $('cd-save');
    btn.disabled = !(n && filled);
    btn.textContent = !n ? '회원을 골라 주세요' : !filled ? '종목을 적어 주세요' : `${n}명 · ${filled}종목 저장`;
  }));
  on('[data-cdu]', (b) => { const [i, u] = b.dataset.cdu.split('|'); draft.rows[+i].unit = u; redraw(); });
  on('[data-cdrm]', (b) => { draft.rows.splice(+b.dataset.cdrm, 1); redraw(); });
  $('cd-add').onclick = () => {
    if (draft.rows.length >= 20) return toast('한 번에 20종목까지 넣을 수 있어요.', true);
    draft.rows.push(blank()); redraw();
    document.querySelector(`.cd-line[data-i="${draft.rows.length - 1}"] input[data-f="exercise"]`)?.focus();
  };
  // 프리셋 토글: 누르면 줄 추가 (마지막 빈 줄이 있으면 거기에), 다시 누르면 그 줄을 뺌
  document.querySelector('.cd-presets').ontoggle = (e) => { draft.presetOpen = e.target.open; };
  on('[data-cdpre]', (b) => {
    const [name, text] = PRESETS[+b.dataset.cdpre];
    const at = draft.rows.findIndex((r) => r.exercise.trim() === name);
    if (at >= 0) {
      draft.rows.splice(at, 1);
      if (!draft.rows.length) draft.rows.push(blank());
    } else {
      const p = parsePreset(text), last = draft.rows.length - 1;
      const row = { ...blank(), exercise: name, amount: p.amount, unit: p.unit, sets: p.sets ?? blank().sets };
      if (!draft.rows[last].exercise.trim()) draft.rows[last] = row;
      else if (draft.rows.length >= 20) return toast('한 번에 20종목까지 넣을 수 있어요.', true);
      else draft.rows.push(row);
    }
    redraw();
  });
  // 지난번 그대로 (한 명만 골랐을 때)
  if ($('cd-last')) $('cd-last').onclick = () => {
    const last = cd.entries[0].day;
    draft.rows = cd.entries.filter((e) => e.day === last).reverse().map((e) => ({
      exercise: e.exercise, kg: e.kg == null ? '' : String(e.kg), unit: ['rep', 'sec', 'm'].includes(e.unit) ? e.unit : 'rep',
      amount: e.amount == null ? '' : e.unit === 'sec' ? secText(e.amount) : String(e.amount), sets: String(e.sets),
    }));
    redraw();
  };
  // 저장: 한 명이면 그 회원 API, 여러 명이면 한 번에
  $('cd-save').onclick = () => act(async () => {
    const items = draft.rows.filter((r) => r.exercise.trim()).map((r) => ({ exercise: r.exercise, kg: r.kg, unit: r.unit, amount: r.amount, sets: r.sets }));
    const ids = draft.members;
    if (ids.length === 1) await api('POST', `/api/coach/members/${ids[0]}/conditioning`, { day: draft.day, items });
    else await api('POST', '/api/coach/conditioning', { memberIds: ids, day: draft.day, items });
    const names = ids.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean);
    toast(`${names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명` : names.join(', ')}에게 ${items.length}종목을 넣었어요.`);
    // 여러 명이면 같은 운동을 다음 조에 바로 넣을 수 있게 종목은 남기고 회원만 비움 / 한 명이면 종목을 비우고 기록을 보여 줌
    if (ids.length > 1) draft.members = [];
    else draft.rows = [blank()];
    redraw();
  });
}
