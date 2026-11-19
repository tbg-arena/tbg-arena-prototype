// 코치 '배운 것' 탭: 오늘 출석한 회원을 각자 다음 주차로 묶어 보여주고, 한 번에 넣는다
// 다르게 가르친 회원만 이름을 눌러 주차를 옮기거나 빼면 된다. 출석 안 찍은 회원은 검색으로 추가.
import { state } from '../../core/state.js';
import { esc, svg, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { coachTab, renderCoach } from '../../core/tabs.js';

// 넣기 전 코치가 손댄 것 (다시 그려도 유지). 날짜가 바뀌면 새로 시작
const draft = { day: null, week: {}, off: {}, extra: new Set() };
function resetIfNewDay() {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (draft.day !== d) Object.assign(draft, { day: d, week: {}, off: {}, extra: new Set() });
}

const W = () => state.meta.weeks || [];
const weekTitle = (w) => W()[w - 1]?.title || '';
const weekOf = (m) => m.today || draft.week[m.id] || m.next;
const poolOf = (list) => list.filter((m) => m.attended || m.today || draft.extra.has(m.id));
const pendingOf = (list) => poolOf(list).filter((m) => !m.today && !draft.off[m.id]);

coachTab({
  id: 'lessons', order: 15, label: '배운 것',
  icon: svg('<path d="M4 5h11a3 3 0 013 3v11H7a3 3 0 01-3-3V5z"/><path d="M8 9h6M8 13h4"/>'),
  poll: false, // 코치가 고르는 중에 다시 그려지지 않게
  load: async () => { resetIfNewDay(); return { lessons: await api('GET', '/api/coach/lessons') }; },
  view: ({ lessons }) => lessonsView(lessons),
  bind: ({ lessons }) => bindLessons(lessons),
});

async function redraw() {
  const y = window.scrollY;
  await renderCoach('lessons');
  window.scrollTo(0, y);
}

function lessonsView(list) {
  const pool = poolOf(list);
  const groups = {};
  for (const m of pool) (groups[weekOf(m)] = groups[weekOf(m)] || []).push(m);
  const weeks = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const pending = pendingOf(list), done = pool.filter((m) => m.today);
  const cta = pending.length
    ? `<button class="btn primary block" id="lgive">${pending.length}명 한 번에 넣기</button>`
    : done.length ? `<button class="btn block" id="lundo">오늘 넣은 ${done.length}명 되돌리기</button>`
    : `<button class="btn block" disabled>넣을 회원이 없어요</button>`;
  return `
    <label class="lsearch">${svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}
      <input id="lq" type="search" placeholder="이름 검색 — 출석 안 찍은 회원 추가" aria-label="회원 검색" autocomplete="off" /></label>
    <div id="lres"></div>
    <div class="section-title">오늘 ${pool.length}명 <span class="muted">· ${weeks.length}개 주차 · 이름을 누르면 주차 바꾸기</span></div>
    ${weeks.length ? weeks.map((w) => `
      <div class="card lgroup">
        <div class="row"><span class="lweek">${w}주</span><b class="grow">${esc(weekTitle(w))}</b>
          <span class="muted small">${W()[w - 1]?.skill ? `기술 · ${esc(W()[w - 1].skill)}` : '기술 없음'}</span></div>
        <div class="lchips">${groups[w].map((m) => {
          const cls = m.today ? 'done' : draft.off[m.id] ? 'off' : weekOf(m) !== m.next ? 'moved' : '';
          return `<button class="lchip ${cls}" data-chip="${m.id}">${m.today ? '✓ ' : ''}${esc(m.name)}${m.laps ? ' ★' : ''}</button>`;
        }).join('')}</div>
      </div>`).join('') : '<div class="card empty">오늘 출석한 회원이 없어요.<br/>출석 체크를 하거나 위에서 이름을 검색해 추가하세요.</div>'}
    <div class="lcta">${cta}<div class="muted small center">출석한 회원은 다음 주차로 미리 채워져요 · ★ 31주 완주 (다음은 1주부터 복습)</div></div>`;
}

function bindLessons(list) {
  const byId = (id) => list.find((m) => m.id === id);
  const q = document.getElementById('lq'), res = document.getElementById('lres');
  // 검색 결과만 다시 그려서 입력 중 포커스가 안 날아가게
  q.oninput = () => {
    const s = q.value.trim();
    const pool = new Set(poolOf(list).map((m) => m.id));
    const hits = s ? list.filter((m) => !pool.has(m.id) && m.name.includes(s)).slice(0, 8) : [];
    res.innerHTML = hits.length ? `<div class="card lres">${hits.map((m) => `<button class="row" data-add="${m.id}"><b class="grow">${esc(m.name)}</b><span class="muted small">${m.last ? `지난번 ${m.last}주` : '첫 수업'} · 다음 ${m.next}주</span><span>＋</span></button>`).join('')}</div>`
      : s ? '<div class="muted small" style="padding:8px 2px">이미 목록에 있거나 없는 이름이에요.</div>' : '';
    res.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => { draft.extra.add(b.dataset.add); redraw(); }));
  };
  document.querySelectorAll('[data-chip]').forEach((b) => (b.onclick = () => chipSheet(byId(b.dataset.chip))));

  const give = document.getElementById('lgive');
  if (give) give.onclick = () => act(async () => {
    const items = pendingOf(list).map((m) => ({ memberId: m.id, week: weekOf(m) }));
    const r = await api('POST', '/api/coach/lessons', { items });
    toast(`${r.given}명에게 넣었어요.${r.skipped ? ` (${r.skipped}명은 오늘 이미 받음)` : ''}`);
    redraw();
  });
  const undo = document.getElementById('lundo');
  if (undo) undo.onclick = () => act(async () => {
    const ids = poolOf(list).filter((m) => m.today).map((m) => m.id);
    if (!confirm(`오늘 넣은 ${ids.length}명을 되돌릴까요? 새로 생긴 기술은 지워지고 올린 숙련은 내려가요.`)) return;
    const r = await api('POST', '/api/coach/lessons/undo', { memberIds: ids });
    toast(`${r.undone}명 되돌렸어요.`); redraw();
  });
}

// 이름을 눌렀을 때: 주차 옮기기 · 오늘은 빼기 / 이미 넣었으면 그 회원만 되돌리기
function chipSheet(m) {
  const last = (m.last ? `지난번 ${m.last}주 ${esc(weekTitle(m.last))}` : '첫 수업') + (m.laps ? ` · ★ 31주 완주 ${m.laps}회` : '');
  if (m.today) return openModal(`<h3>${esc(m.name)}</h3>
    <div class="muted small" style="margin-bottom:12px">오늘 ${m.today}주 ${esc(weekTitle(m.today))} 넣음</div>
    <div class="row"><button class="btn grow" id="x">닫기</button><button class="btn grow" id="u">이 회원만 되돌리기</button></div>`, (el) => {
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#u').onclick = () => act(async () => {
      await api('POST', '/api/coach/lessons/undo', { memberIds: [m.id] });
      closeModal(); toast('되돌렸어요.'); redraw();
    });
  });
  let w = weekOf(m);
  openModal(`<h3>${esc(m.name)}</h3>
    <div class="muted small" style="margin-bottom:12px">${last}</div>
    <div class="row lstep"><button class="btn" id="p" aria-label="이전 주차">‹</button>
      <div class="grow lpick"><span class="lweek" id="lw"></span><b id="lt"></b></div>
      <button class="btn" id="n" aria-label="다음 주차">›</button></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="off">${draft.off[m.id] ? '다시 넣기' : '오늘은 안 넣기'}</button><button class="btn primary grow" id="ok">확인</button></div>`, (el) => {
    const draw = () => { el.querySelector('#lw').textContent = `${w}주`; el.querySelector('#lt').textContent = weekTitle(w); };
    const move = (d) => { w = Math.max(1, Math.min(W().length, w + d)); draw(); };
    el.querySelector('#p').onclick = () => move(-1);
    el.querySelector('#n').onclick = () => move(1);
    el.querySelector('#off').onclick = () => { draft.off[m.id] = !draft.off[m.id]; closeModal(); redraw(); };
    el.querySelector('#ok').onclick = () => {
      if (w === m.next) delete draft.week[m.id]; else draft.week[m.id] = w;
      delete draft.off[m.id]; closeModal(); redraw();
    };
    draw();
  });
}
