// 코치 '배운 것' 탭
// - 오늘 넣기: 오늘 출석한 회원을 각자 다음 주차로 묶어 보여주고, 한 번에 넣는다
//   다르게 가르친 회원만 이름을 눌러 주차를 옮기거나 빼면 된다. 출석 안 찍은 회원은 검색으로 추가.
// - 커리큘럼: 주차별 수업 내용 · 지도 포인트 · 배우는 기술 · 오르는 능력치 (추가 · 수정 · 순서 이동 · 삭제)
// - 콤비: 콤비 추가 · 수정 · 삭제 (combos/coach.js)
import { state } from '../../core/state.js';
import { esc, svg, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { coachTab, renderCoach } from '../../core/tabs.js';
import { statsText } from './sheet.js';
import { comboAdminView, bindComboAdmin } from '../combos/coach.js';

let mode = 'today'; // today | curriculum

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
  load: async () => {
    resetIfNewDay();
    // 커리큘럼은 코치가 고칠 수 있어서 탭을 열 때마다 새로 받는다 (출석 시트 · 이름 표시에도 씀)
    const [lessons, weeks, combos] = await Promise.all([
      api('GET', '/api/coach/lessons'), api('GET', '/api/curriculum'), mode === 'combos' ? api('GET', '/api/coach/combos') : null,
    ]);
    state.meta.weeks = weeks;
    return { lessons, combos };
  },
  view: ({ lessons, combos }) => `<div class="seg" style="margin-bottom:14px">
      ${[['today', '오늘 넣기'], ['curriculum', '커리큘럼'], ['combos', '콤비']].map(([k, t]) => `<button data-mode="${k}" class="${mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${mode === 'today' ? lessonsView(lessons) : mode === 'curriculum' ? curriculumView(lessons) : comboAdminView(combos)}`,
  bind: ({ lessons, combos }) => {
    document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; renderCoach('lessons'); }));
    if (mode === 'today') bindLessons(lessons);
    else if (mode === 'curriculum') bindCurriculum();
    else bindComboAdmin(combos, redraw);
  },
});

let openWeek = null; // 펼쳐 둔 주차 (고친 뒤 다시 그려도 펼친 채로)

// 커리큘럼: 주차마다 접었다 펴는 카드 (내 기술 목록과 같은 모양). 오른쪽 숫자 = 이 주차가 다음 차례인 회원 수
function curriculumView(list) {
  const C = state.meta.categories || {};
  const waiting = {};
  for (const m of list) waiting[m.next] = (waiting[m.next] || 0) + 1;
  return `<button class="btn primary block" data-wadd>＋ 주차 추가</button>
    <div class="muted small" style="margin:12px 2px">주차를 넣으면(= 그 주차를 배움) 아래 기술이 생기고 능력치가 올라요. 이미 있는 기술은 숙련 +5. 넣은 걸 되돌리면 같이 내려가요.</div>
    ${W().length ? '' : '<div class="card empty">주차가 없어요. 주차를 추가해 주세요.</div>'}
    ${W().map((w) => `
    <details class="card group lcur" data-wid="${w.id}" ${w.id === openWeek ? 'open' : ''}>
      <summary class="row"><span class="lweek">${w.week}주</span>
        <div class="grow" style="min-width:0"><b>${esc(w.title)}</b><div class="muted small ellipsis">${w.skill ? `${esc(C[w.skillCat]?.label || '')} · ${esc(w.skill)}` : '경기 기술 없음 · 능력치만'}</div></div>
        ${waiting[w.week] ? `<span class="badge" title="이 주차가 다음 차례인 회원">${waiting[w.week]}명</span>` : ''}<span class="muted chev">▸</span></summary>
      <div class="lcur-body">
        <p>${esc(w.content)}</p>
        <div class="lcur-k">지도 포인트</div>
        <ul>${w.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <div class="lcur-k">배우는 것</div>
        <div class="row small"><span class="grow">${w.skill ? `기술 <b>${esc(w.skill)}</b> <span class="muted">(${esc(C[w.skillCat]?.label || '')}) · 처음이면 숙련 10, 있으면 +5</span>` : '<span class="muted">경기에 쓰는 기술은 없어요</span>'}</span></div>
        <div class="row small" style="margin-top:4px"><span class="grow">능력치 <b>${statsText(w.stats)}</b></span></div>
        <div class="row" style="margin-top:12px"><button class="btn sm grow" data-wedit="${w.id}">수정</button><button class="btn sm ghost" data-wdel="${w.id}" data-title="${esc(w.title)}">삭제</button></div>
      </div>
    </details>`).join('')}`;
}

function bindCurriculum() {
  document.querySelectorAll('details.lcur').forEach((d) => (d.ontoggle = () => { if (d.open) openWeek = d.dataset.wid; else if (openWeek === d.dataset.wid) openWeek = null; }));
  document.querySelector('[data-wadd]').onclick = () => weekEditor(null);
  document.querySelectorAll('[data-wedit]').forEach((b) => (b.onclick = () => weekEditor(W().find((w) => w.id === b.dataset.wedit))));
  document.querySelectorAll('[data-wdel]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm(`'${b.dataset.title}' 주차를 지울까요?\n뒤 주차들이 한 칸씩 당겨져요. 이미 받은 회원의 기술 · 능력치는 그대로예요.`)) return;
    await api('DELETE', `/api/coach/curriculum/${b.dataset.wdel}`); toast('주차를 지웠어요.'); redraw();
  })));
}

// 주차 추가 · 수정 창. w = null 이면 추가 (위치 기본: 맨 뒤)
function weekEditor(w) {
  const C = state.meta.categories, MV = state.meta.moves || {};
  const STATS = [['power', '파워'], ['speed', '스피드'], ['stamina', '체력'], ['iq', 'IQ'], ['chin', '맷집']];
  const total = W().length;
  let cat = w?.skillCat || null, move = w?.skillMove || null;
  openModal(`<h3>${w ? `${w.week}주 수정` : '주차 추가'}</h3>
    <div class="stack">
      <div class="row"><div class="grow"><label class="field">주차 이름</label><input id="e-title" maxlength="30" value="${esc(w?.title || '')}" placeholder="예: 슬립" /></div>
        <div style="width:96px"><label class="field">위치 (1~${w ? total : total + 1})</label><input id="e-at" type="number" inputmode="numeric" min="1" max="${w ? total : total + 1}" value="${w ? w.week : total + 1}" /></div></div>
      <div><label class="field">수업 내용</label><input id="e-content" maxlength="100" value="${esc(w?.content || '')}" placeholder="예: 잽·스트레이트에 대한 좌우 슬립" /></div>
      <div><label class="field">지도 포인트 (한 줄에 하나, 6개까지)</label><textarea id="e-points" rows="3" placeholder="최소한의 머리 이동&#10;몸통 회전">${esc((w?.points || []).join('\n'))}</textarea></div>
      <div><label class="field">배우는 기술</label>
        <div class="seg" id="e-cat" style="grid-template-columns:repeat(3,1fr)"><button data-c="" class="${cat ? '' : 'on'}">기술 없음</button>${Object.entries(C).map(([k, v]) => `<button data-c="${k}" class="${k === cat ? 'on' : ''}">${esc(v.label)}</button>`).join('')}</div>
        <div class="seg four" id="e-move" style="margin-top:6px"></div>
        <input id="e-skill" maxlength="24" style="margin-top:6px" value="${esc(w?.skill || '')}" placeholder="기술 이름 (예: 슬립)" /></div>
      <div><label class="field">오르는 능력치 (0.5 단위, 주차당 합계 2 정도 권장)</label>
        <div class="lstats">${STATS.map(([k, t]) => `<label><span>${t}</span><input type="number" step="0.5" min="0" max="5" data-stat="${k}" value="${w?.stats?.[k] || ''}" placeholder="0" /></label>`).join('')}</div></div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">${w ? '저장' : '추가'}</button></div>`, (el) => {
    const skillIn = el.querySelector('#e-skill');
    const labelOf = (id) => (MV[cat] || []).find(([k]) => k === id)?.[1] || '';
    const draw = () => {
      el.querySelectorAll('#e-cat button').forEach((b) => b.classList.toggle('on', b.dataset.c === (cat || '')));
      el.querySelector('#e-move').innerHTML = cat ? (MV[cat] || []).map(([k, t]) => `<button data-m="${k}" class="${k === move ? 'on' : ''}">${esc(t)}</button>`).join('') : '';
      el.querySelector('#e-move').classList.toggle('hidden', !cat);
      skillIn.classList.toggle('hidden', !cat);
      el.querySelectorAll('#e-move button').forEach((b) => (b.onclick = () => {
        // 세부 기술을 고르면 이름을 채운다 (코치가 직접 고친 이름은 덮어쓰지 않음)
        if (!skillIn.value || skillIn.value === labelOf(move)) skillIn.value = labelOf(b.dataset.m);
        move = b.dataset.m; draw();
      }));
    };
    el.querySelectorAll('#e-cat button').forEach((b) => (b.onclick = () => {
      cat = b.dataset.c || null; move = cat ? MV[cat]?.[0]?.[0] : null;
      if (cat && !skillIn.value) skillIn.value = labelOf(move);
      draw();
    }));
    draw();
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      const body = {
        title: el.querySelector('#e-title').value, content: el.querySelector('#e-content').value,
        points: el.querySelector('#e-points').value.split('\n'),
        skill: cat ? { name: skillIn.value, category: cat, move } : null,
        stats: Object.fromEntries([...el.querySelectorAll('[data-stat]')].map((i) => [i.dataset.stat, i.value])),
        at: Number(el.querySelector('#e-at').value) || undefined,
      };
      const saved = w ? await api('PUT', `/api/coach/curriculum/${w.id}`, body) : await api('POST', '/api/coach/curriculum', body);
      openWeek = w ? w.id : saved[Math.min(body.at || saved.length, saved.length) - 1]?.id;
      closeModal(); toast(w ? '저장했어요.' : '주차를 추가했어요.'); redraw();
    });
  });
}

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
