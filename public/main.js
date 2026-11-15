// TBG ARENA - 프론트엔드 (vanilla JS SPA)
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');

const STAT_LABEL = { power: ['PWR', '파워'], speed: ['SPD', '스피드'], stamina: ['STA', '체력'], iq: ['IQ', 'IQ'], chin: ['DEF', '맷집'] };
const STATUS = {
  pending_coach: ['코치 승인 대기', 'badge'],
  pending_opponent: ['상대 수락 대기', 'badge blue'],
  rejected: ['코치 반려', 'badge'],
  declined: ['상대 거절', 'badge'],
  cancelled: ['취소됨', 'badge'],
  done: ['경기 완료', 'badge green'],
};
const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const ICONS = {
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  callout: svg('<path d="M3 10v4h3l7 4V6L6 10H3z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
  rank: svg('<path d="M4 20V12M10 20V6M16 20v-9M22 20H2"/>'),
  career: svg('<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8"/>'),
  check: svg('<path d="M4 12l5 5L20 6"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>'),
  fight: svg('<path d="M7 4h7a4 4 0 014 4v4a4 4 0 01-4 4H9l-2 4V4z"/><path d="M7 9h6"/>'),
};
const sprite = (id, opts) => (window.PixelFighter ? window.PixelFighter.url(id, opts) : '');
const avatar = (id, cls = '', side) => `<div class="avatar ${cls}"><img src="${sprite(id, { side })}" alt="" /></div>`;
const POS_LABEL = { clinch: '클린치', ground: '그라운드' }; // 예전(MMA) 경기 다시보기용

const state = {
  token: localStorage.getItem('tbg_token'),
  role: localStorage.getItem('tbg_role'),
  tab: null, me: null, meta: null,
  pollTimer: null, playTimer: null,
};

// ───────── 유틸 ─────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = (v) => {
  const d = String(v).replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};
const ago = (t) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};
const clock = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const cat = (k) => state.meta.categories[k] || { label: k, icon: '❔' };
const masteryBar = (m) => `<div class="mbar"><i style="width:${m}%"></i></div>`;
const record = (m) => `${m.wins}승 ${m.losses}패${m.draws ? ` ${m.draws}무` : ''}`;
const methodText = (r) => (r.method === '판정' ? `${r.detail} 판정` : `${r.method} · ${r.round}R ${clock(r.time)}`);

let toastTimer;
function toast(msg, err) {
  $toast.textContent = msg;
  $toast.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.add('hidden'), 2600);
}
function vibrate(p) { try { navigator.vibrate?.(p); } catch {} }

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logout(true); throw new Error(data.error || '다시 로그인해주세요.'); }
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}
async function act(fn) { try { return await fn(); } catch (e) { toast(e.message, true); } }

function openModal(html, onMount) {
  $modal.innerHTML = `<div class="sheet">${html}</div>`;
  $modal.classList.remove('hidden');
  $modal.onclick = (e) => { if (e.target === $modal) closeModal(); };
  onMount?.($modal.querySelector('.sheet'));
}
function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }
const modalOpen = () => !$modal.classList.contains('hidden');

function stopTimers() {
  clearInterval(state.pollTimer); clearTimeout(state.playTimer);
  state.pollTimer = state.playTimer = null;
  state.arena?.destroy(); state.arena = null;
}
function poll(fn, ms) { clearInterval(state.pollTimer); state.pollTimer = setInterval(fn, ms); }

function logout(silent) {
  if (!silent && state.token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token } });
  localStorage.removeItem('tbg_token'); localStorage.removeItem('tbg_role');
  state.token = state.role = state.me = null;
  stopTimers(); closeModal(); history.replaceState(null, '', '/');
  renderLogin();
}

// ───────── 로그인 ─────────
function renderLogin(coach) {
  stopTimers();
  $app.innerHTML = `
    <div class="login">
      <div class="hero">
        <img class="hero-logo" src="/logo.png" alt="TBG BOXING &amp; MMA" />
        <div class="arena-word">ARENA</div>
        <div class="stage"><canvas id="demo"></canvas></div>
        <div class="tag">${coach ? '코치 전용<br/><em>관리자</em> 입장' : '체육관에서 배운 기술로<br/><em>성장하고, 겨뤄라.</em>'}</div>
      </div>
      ${coach
        ? `<input id="pin" class="phone-input" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off" />`
        : `<input id="phone" class="phone-input" type="tel" inputmode="numeric" placeholder="010-0000-0000" autocomplete="tel" maxlength="13" />`}
      <button id="go" class="btn primary block">${coach ? '코치 입장' : '입장하기'}</button>
      <button id="switch" class="link center">${coach ? '← 회원 입장으로' : '코치이신가요?'}</button>
      ${coach ? '' : '<div class="muted small center">TBG 등록 회원은 전화번호만으로 바로 입장할 수 있어요.</div>'}
      <div class="foot">TBG BOXING &amp; MMA · SINSA</div>
    </div>`;
  if (window.Arena) state.arena = new window.Arena(document.getElementById('demo'), { id: 'demo-a' }, { id: 'demo-b7' }, { demo: true });
  const input = document.getElementById(coach ? 'pin' : 'phone');
  if (!coach) input.addEventListener('input', () => { input.value = fmtPhone(input.value); });
  const submit = () => act(async () => {
    const data = coach
      ? await api('POST', '/api/coach/login', { pin: input.value })
      : await api('POST', '/api/login', { phone: input.value });
    state.token = data.token; state.role = data.role;
    localStorage.setItem('tbg_token', data.token); localStorage.setItem('tbg_role', data.role);
    vibrate(30); location.hash = ''; route();
  });
  document.getElementById('go').onclick = submit;
  input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  document.getElementById('switch').onclick = () => renderLogin(!coach);
}

// ───────── 라우팅 ─────────
async function route() {
  if (!state.meta) state.meta = await api('GET', '/api/meta').catch(() => null);
  if (!state.token) return renderLogin();
  stopTimers(); closeModal();
  state.seq = (state.seq || 0) + 1;
  document.body.classList.remove('fight-mode');
  const [, view, id] = location.hash.split('/');
  if (view === 'fight' && id) return renderFight(id);
  if (view === 'fighter' && id) return renderFighter(id);
  if (state.role === 'coach') return renderCoach(view || 'approve');
  return renderMember(view || 'home');
}
window.addEventListener('hashchange', route);
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

function shell(tabs, active, inner, opts = {}) {
  return `
    <div class="topbar">
      <div class="logo"><img src="/logo.png" alt="TBG" /><span class="arena-tag">${opts.coach ? 'COACH' : 'ARENA'}</span></div>
      <button class="link" id="logout">로그아웃</button>
    </div>
    <div class="page">${inner}</div>
    <nav class="tabbar"><div class="inner">
      ${tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === active ? 'on' : ''}">${ICONS[t.icon] || ''}${t.label}${t.dot ? `<span class="dot">${t.dot}</span>` : ''}</button>`).join('')}
    </div></nav>`;
}
function bindShell() {
  document.getElementById('logout').onclick = () => logout();
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => go(`#/${b.dataset.tab}`)));
}

// ───────── 공용 컴포넌트 ─────────
function statBars(stats) {
  return `<div class="stat-grid">${Object.entries(STAT_LABEL).map(([k, [ic, lb]]) => `
    <div class="statrow"><span class="sl"><i>${ic}</i>${lb}</span><div class="sbar"><i style="width:${Math.min(100, stats[k])}%"></i></div><b>${stats[k]}</b></div>`).join('')}</div>`;
}

function skillGroups(skills, opts = {}) {
  const groups = {};
  for (const s of skills) (groups[s.category] = groups[s.category] || []).push(s);
  const keys = Object.keys(state.meta.categories).filter((k) => groups[k]);
  if (!keys.length) return `<div class="card empty">${opts.empty || '아직 배운 기술이 없어요.<br/>코치에게 배운 기술 등록을 요청하세요!'}</div>`;
  return keys.map((k) => {
    const list = groups[k].sort((a, b) => b.mastery - a.mastery);
    const avg = Math.round(list.reduce((s, x) => s + x.mastery, 0) / list.length);
    return `<details class="card group" ${opts.open ? 'open' : ''}>
      <summary class="row"><div class="type-dot">${cat(k).icon}</div><div class="grow"><b>${cat(k).label}</b> <span class="muted small">${list.length}개</span></div>
        <div class="avg">${avg}</div><span class="muted chev">▸</span></summary>
      <div class="skills">${list.map((s) => `
        <div class="skillrow"><div class="grow"><div class="sname">${esc(s.name)}</div>${masteryBar(s.mastery)}${s.desc ? `<div class="muted small">${esc(s.desc)}</div>` : ''}</div>
          <div class="mval">${s.mastery}</div>
          ${opts.coach ? `<div class="row" style="gap:4px"><button class="btn sm" data-mdown="${s.id}">−5</button><button class="btn sm navy" data-mup="${s.id}">+5</button><button class="btn sm ghost" data-delskill="${s.id}">✕</button></div>` : ''}
        </div>`).join('')}</div>
    </details>`;
  }).join('');
}

function fighterCard(m, opts = {}) {
  return `
    <div class="card profile">
      <div class="p-head">
        <div class="sprite-box"><img src="${sprite(m.id, { pose: 'idle', scale: 2 })}" alt="" /></div>
        <div class="grow" style="min-width:0">
          ${m.streak >= 2 ? `<div class="small"><span class="badge red">${m.streak} WIN STREAK</span></div>` : ''}
          <div class="name ellipsis">${esc(m.name)}</div>
          <div class="small">${record(m)} <span class="muted">· KO/TKO ${m.kos}</span></div>
        </div>
        <div class="cp"><span>POWER</span><b>${m.power}</b></div>
      </div>
      <div class="p-body">
      ${m.titles?.length ? `<div class="titles">${m.titles.map((t) => `<span class="badge solid">${esc(t)} 마스터</span>`).join('')}</div>` : ''}
      ${statBars(m.stats)}
      <div class="row small muted" style="margin-top:12px"><span class="grow">랭킹 포인트 <b class="px" style="color:var(--text)">${m.points}</b></span><span>팬 <b class="px" style="color:var(--text)">${m.fans}</b></span></div>
      </div>
    </div>`;
}

// ───────── 회원 화면 ─────────
async function renderMember(tab) {
  state.tab = tab;
  const need = {
    members: ['callout', 'rank'].includes(tab),
    callouts: ['callout', 'home'].includes(tab),
    fights: ['career'].includes(tab),
  };
  const load = async () => {
    const [me, members, callouts, fights] = await Promise.all([
      api('GET', '/api/me'),
      need.members ? api('GET', '/api/members') : null,
      need.callouts ? api('GET', '/api/callouts') : null,
      need.fights ? api('GET', '/api/fights') : null,
    ]);
    return { me, members, callouts, fights };
  };
  let data;
  try { data = await load(); } catch (e) { return toast(e.message, true); }
  if (state.tab !== tab) return;
  draw(data);

  let lastSig = sig(data);
  poll(async () => {
    if (modalOpen() || state.tab !== tab) return;
    try {
      const d = await load();
      if (state.tab !== tab) return;
      if (d.me.unseenFights.length > data.me.unseenFights.length) { vibrate([80, 60, 80]); toast('경기 결과가 나왔습니다!'); }
      const s = sig(d);
      if (s !== lastSig) { lastSig = s; data = d; draw(d); }
    } catch {}
  }, 4000);

  function sig(d) { return JSON.stringify([d.me, d.callouts, d.members, d.fights]); }

  function draw({ me, members, callouts, fights }) {
    state.me = me;
    const tabs = [
      { id: 'home', icon: 'home', label: '홈' },
      { id: 'callout', icon: 'callout', label: '콜아웃', dot: me.pendingForMe || '' },
      { id: 'rank', icon: 'rank', label: '랭킹' },
      { id: 'career', icon: 'career', label: '커리어' },
    ];
    let inner = me.unseenFights.length
      ? `<div class="banner" data-go="#/fight/${me.unseenFights[0]}">경기 결과 도착! 중계 보기 <span style="margin-left:auto">→</span></div>` : '';
    if (tab === 'home') inner += homeView(me, callouts);
    if (tab === 'callout') inner += calloutView(me, members, callouts);
    if (tab === 'rank') inner += rankView(me, members);
    if (tab === 'career') inner += careerView(me, fights);
    $app.innerHTML = shell(tabs, tab, inner);
    bindShell();
    bindMemberActions(me);
  }
}

function homeView(me, callouts) {
  const m = me.member;
  const pending = (callouts || []).filter((c) => c.opponentId === m.id && c.status === 'pending_opponent');
  const s = m.strategy;
  return `
    ${fighterCard(m)}
    ${pending.length ? `<div class="banner blue" data-go="#/callout">받은 콜아웃 ${pending.length}건 — 수락하면 바로 경기! <span style="margin-left:auto">→</span></div>` : ''}
    <div class="section-title">내 준비</div>
    <div class="card row"><div class="type-dot px" style="filter:none;font-size:12px;font-weight:700">GYM</div><div class="grow"><b>${m.attended ? '오늘 출석 완료 ✓' : '오늘 아직 미출석'}</b><div class="muted small">체육관에 나와 코치 출석 체크를 받으면 능력치가 올라요 · 누적 ${m.attendCount}회</div></div></div>
    <div class="card row" id="editStrategy" style="cursor:pointer"><div class="type-dot px" style="filter:none;font-size:12px;font-weight:700">STR</div><div class="grow"><b>내 기본 전략</b><div class="muted small">${esc(s.stance)} · ${esc(s.guard)} · ${esc(s.style)} · ${(s.focus || []).map(esc).join('·')} 공략</div></div><span class="link" style="padding:0">바꾸기 →</span></div>
    <div class="section-title">내 기술 (${me.skills.length}) <span class="muted" style="text-transform:none;font-weight:600">· 배운 기술만 경기에 나와요</span></div>
    ${skillGroups(me.skills)}
    <div class="muted small" style="margin:10px 2px">숫자는 숙련도예요. 숙련이 높을수록 경기에서 자주 나오고 잘 들어가요. 코치가 수업에서 본 실력대로 조정하고, 경기에서 성공하면 조금씩 올라요. 같은 기술로 ${state.meta.finishTitleAt}번 피니시하면 칭호가 붙어요.</div>`;
}

function calloutView(me, members, callouts) {
  const myId = me.member.id;
  const open = (c) => ['pending_opponent', 'pending_coach'].includes(c.status);
  const incoming = callouts.filter((c) => c.opponentId === myId && open(c));
  const outgoing = callouts.filter((c) => c.challengerId === myId && open(c));
  const past = callouts.filter((c) => !open(c)).slice(0, 10);
  const others = members.filter((x) => x.id !== myId);
  const st = (c) => `<span class="${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`;
  return `
    <div class="steps"><span>① 콜아웃</span>›<span>② 코치 승인</span>›<span>③ 상대 수락</span>›<span>FIGHT</span></div>
    <div class="section-title">받은 콜아웃</div>
    ${incoming.length ? incoming.map((c) => `
      <div class="card">
        <div class="row"><div class="grow"><b>${esc(c.challenger)}</b> <span class="muted">님의 도전!</span></div>${st(c)}</div>
        ${c.message ? `<div style="margin-top:6px">“${esc(c.message)}”</div>` : ''}
        ${c.status === 'pending_opponent'
          ? `<div class="row" style="margin-top:12px"><button class="btn primary grow" data-accept="${c.id}">수락 — 바로 경기</button><button class="btn" data-go="#/fighter/${c.challengerId}">분석</button><button class="btn" data-decline="${c.id}">거절</button></div>`
          : '<div class="muted small" style="margin-top:6px">코치 승인 후 수락할 수 있어요.</div>'}
      </div>`).join('') : '<div class="card empty">받은 콜아웃이 없어요.</div>'}

    <div class="section-title">보낸 콜아웃</div>
    ${outgoing.length ? outgoing.map((c) => `
      <div class="card"><div class="row"><div class="grow">→ <b>${esc(c.opponent)}</b></div>${st(c)}</div>
        ${c.message ? `<div class="muted small" style="margin-top:4px">“${esc(c.message)}”</div>` : ''}
        <div class="row" style="margin-top:8px"><span class="muted small grow">${ago(c.createdAt)}</span><button class="btn sm ghost" data-cancel="${c.id}">취소</button></div>
      </div>`).join('') : '<div class="card empty">보낸 콜아웃이 없어요.</div>'}

    <div class="section-title">상대 지목하기</div>
    ${others.length ? others.map((o) => `
      <div class="list-item">
        <div data-go="#/fighter/${o.id}" style="cursor:pointer">${avatar(o.id)}</div>
        <div class="grow" style="min-width:0;cursor:pointer" data-go="#/fighter/${o.id}"><div class="ellipsis" style="font-weight:800">${esc(o.name)}</div>
          <div class="muted small">전투력 <b class="px" style="color:#fff">${o.power}</b> · ${record(o)} · 기술 ${o.skillCount}</div></div>
        <button class="btn sm primary" data-callout="${o.id}" data-name="${esc(o.name)}" ${o.skillCount ? '' : 'disabled'}>콜아웃</button>
      </div>`).join('') : '<div class="card empty">다른 회원이 아직 없어요.</div>'}

    ${past.length ? `<div class="section-title">지난 콜아웃</div>${past.map((c) => `
      <div class="list-item small"><div class="grow ellipsis">${esc(c.challenger)} → ${esc(c.opponent)}${c.coachNote ? ` <span class="muted">(${esc(c.coachNote)})</span>` : ''}</div>${st(c)}
      ${c.fightId ? `<button class="btn sm" data-go="#/fight/${c.fightId}">중계</button>` : ''}</div>`).join('')}` : ''}`;
}

function rankView(me, members) {
  return `<div class="section-title">TBG 랭킹</div>
    ${members.map((o, i) => `
      <div class="list-item ${o.id === me.member.id ? 'me' : ''}" data-go="#/fighter/${o.id}" style="cursor:pointer">
        <div class="rank r${i + 1}">${i + 1}</div>
        ${avatar(o.id)}
        <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:800">${esc(o.name)} ${o.titles.length ? '<span class="badge solid">TITLE</span>' : ''}</div>
          <div class="muted small">${record(o)} · 전투력 ${o.power}</div></div>
        <div class="center"><b class="pts">${o.points}</b><div class="muted px" style="font-size:9px">PTS</div></div>
      </div>`).join('')}`;
}

function careerView(me, fights) {
  const m = me.member;
  const fin = Object.entries(m.finishes).sort((a, b) => b[1] - a[1]);
  const goal = state.meta.finishTitleAt;
  return `
    <div class="card">
      <div class="stats3">
        <div class="stat"><b>${m.wins}</b><span>승</span></div>
        <div class="stat"><b>${m.losses}</b><span>패</span></div>
        <div class="stat"><b>${m.draws}</b><span>무</span></div>
        <div class="stat"><b>${m.kos}</b><span>KO/TKO</span></div>
        <div class="stat"><b>${m.fans}</b><span>팬</span></div>
        <div class="stat"><b>${m.attendCount}</b><span>출석</span></div>
      </div>
    </div>
    <div class="section-title">피니시 칭호 <span class="muted" style="text-transform:none;font-weight:600">· 같은 기술로 ${goal}번 끝내면 칭호</span></div>
    ${fin.length ? `<div class="card">${fin.map(([k, c]) => `
      <div class="row" style="margin:6px 0"><span class="grow"><b>${esc(k)}</b>${c >= goal ? ` <span class="badge solid">${esc(k)} 마스터</span>` : ''}</span><span class="muted small">${Math.min(c, goal)}/${goal}</span></div>
      ${c < goal ? `<div class="mbar"><i style="width:${(c / goal) * 100}%"></i></div>` : ''}`).join('')}</div>`
      : '<div class="card empty">아직 피니시가 없어요. KO나 TKO로 이겨보세요!</div>'}
    <div class="section-title">경기 기록</div>
    ${fights.length ? fights.map((f) => fightRow(f, m.id)).join('') : '<div class="card empty">아직 경기 기록이 없어요. 콜아웃으로 첫 경기를 잡으세요!</div>'}`;
}

function fightRow(f, myId) {
  const r = f.result;
  let badge;
  if (myId) {
    const opp = f.a === myId ? f.bName : f.aName;
    badge = !r.winnerId ? '<span class="badge">DRAW</span>' : r.winnerId === myId ? '<span class="badge solid">WIN</span>' : '<span class="badge red">LOSE</span>';
    const d = f.delta?.[myId];
    return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
      <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">vs ${esc(opp)}</div><div class="muted small">${methodText(r)} · ${ago(f.createdAt)}</div></div>
      <div class="center">${badge}${d != null ? `<div class="small ${d >= 0 ? 'delta-up' : 'delta-down'}">${d >= 0 ? '+' : ''}${d}</div>` : ''}</div></div>`;
  }
  const w = r.winnerId ? (r.winnerId === f.a ? f.aName : f.bName) : null;
  return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
    <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">${esc(f.aName)} vs ${esc(f.bName)}</div><div class="muted small">${methodText(r)} · ${ago(f.createdAt)}</div></div>
    <span class="badge ${w ? 'green' : ''}">${w ? esc(w) + ' 승' : '무승부'}</span></div>`;
}

function bindGo() {
  document.querySelectorAll('[data-go]').forEach((el) => (el.onclick = (e) => { e.stopPropagation(); go(el.dataset.go); }));
}

function bindMemberActions(me) {
  bindGo();
  const strat = document.getElementById('editStrategy');
  if (strat) strat.onclick = () => strategyModal(me.member.strategy);

  document.querySelectorAll('[data-callout]').forEach((b) => (b.onclick = () => {
    openModal(`
      <h3>${esc(b.dataset.name)} 님에게 콜아웃</h3>
      <div class="muted small" style="margin-bottom:10px">코치 승인 → 상대 수락 순간 경기가 치러집니다. 그 전에 전략을 챙기세요!</div>
      <input id="msg" maxlength="80" placeholder="한마디 (선택) 예: 금요일 스파링 빚 갚으러 간다" />
      <div class="row" style="margin-top:12px"><button class="btn grow" id="cancel">닫기</button><button class="btn primary grow" id="send">도전장 보내기</button></div>`,
    (el) => {
      el.querySelector('#cancel').onclick = closeModal;
      el.querySelector('#send').onclick = () => act(async () => {
        await api('POST', '/api/callouts', { opponentId: b.dataset.callout, message: el.querySelector('#msg').value });
        closeModal(); toast('도전장을 보냈습니다! 코치 승인을 기다려주세요.'); vibrate(40); route();
      });
    });
  }));
  document.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = () => act(async () => {
    b.disabled = true;
    const c = await api('POST', `/api/callouts/${b.dataset.accept}/respond`, { accept: true });
    vibrate([80, 60, 80]); go(`#/fight/${c.fightId}`);
  })));
  document.querySelectorAll('[data-decline]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm('콜아웃을 거절할까요?')) return;
    await api('POST', `/api/callouts/${b.dataset.decline}/respond`, { accept: false }); route();
  })));
  document.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => act(async () => {
    await api('POST', `/api/callouts/${b.dataset.cancel}/cancel`); route();
  })));
}

function strategyModal(cur) {
  const S = state.meta.strategy;
  const sel = { ...cur, focus: [...(cur.focus || ['헤드', '바디'])] };
  const HELP = {
    stance: { 오소독스: '왼발 앞. 가장 흔한 자세', 사우스포: '오른발 앞. 오소독스 상대로 타격 정확도 ↑' },
    guard: { 하이가드: '얼굴 펀치 방어 ↑ / 바디에 약간 취약', 숄더롤: '잽·스트레이트 방어 ↑↑ · 카운터 ↑ / 훅에 약함', 밸런스: '모든 펀치 방어 조금 ↑' },
    style: { 인파이팅: '공격권 ↑ · 훅·어퍼컷·바디 비중 ↑', 카운터: '공격권 ↓ · 상대 펀치가 빗나가면 받아치기', 아웃복싱: '잽·스트레이트 비중 ↑ · 어퍼컷 비중 ↓' },
  };
  const seg = (k) => `<div class="seg" style="grid-template-columns:repeat(${S[k].length},1fr)">${S[k].map((v) => `<button data-k="${k}" data-v="${esc(v)}" class="${(k === 'focus' ? sel.focus.includes(v) : sel[k] === v) ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
  const help = (k) => (HELP[k] ? `<div class="muted small" id="h-${k}" style="margin-top:4px">${HELP[k][sel[k]]}</div>` : '');
  openModal(`
    <h3>내 기본 전략</h3>
    <div class="stack">
      <div><label class="field">스탠스</label>${seg('stance')}${help('stance')}</div>
      <div><label class="field">가드</label>${seg('guard')}${help('guard')}</div>
      <div><label class="field">스타일</label>${seg('style')}${help('style')}</div>
      <div><label class="field">공략 부위 (복수 선택) — 해당 펀치를 더 자주 시도</label>${seg('focus')}</div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
    el.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => {
      const { k, v } = b.dataset;
      if (k === 'focus') {
        if (sel.focus.includes(v)) { if (sel.focus.length > 1) sel.focus = sel.focus.filter((x) => x !== v); }
        else sel.focus.push(v);
        el.querySelectorAll(`[data-k="focus"]`).forEach((x) => x.classList.toggle('on', sel.focus.includes(x.dataset.v)));
      } else {
        sel[k] = v;
        el.querySelectorAll(`[data-k="${k}"]`).forEach((x) => x.classList.toggle('on', x.dataset.v === v));
        const h = el.querySelector(`#h-${k}`); if (h) h.textContent = HELP[k][v];
      }
    }));
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('PUT', '/api/me/strategy', sel); closeModal(); toast('전략을 저장했어요.'); route();
    });
  });
}

// ───────── 선수 분석 ─────────
async function renderFighter(id) {
  state.tab = 'fighter';
  let d;
  try { d = await api('GET', `/api/members/${id}`); } catch (e) { toast(e.message, true); return history.back(); }
  const m = d.member;
  const s = m.strategy;
  $app.innerHTML = `
    <div class="topbar"><button class="link" id="back">← 돌아가기</button><div class="muted small">상대 분석</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      ${fighterCard(m)}
      <div class="section-title">기본 전략</div>
      <div class="card small">${esc(s.stance)} · ${esc(s.guard)} · ${esc(s.style)} · ${(s.focus || []).map(esc).join('·')} 공략</div>
      <div class="section-title">배운 기술 (${d.skills.length})</div>
      ${skillGroups(d.skills, { empty: '배운 기술이 없습니다.' })}
    </div>`;
  document.getElementById('back').onclick = () => history.back();
}

// ───────── 경기 중계 ─────────
async function renderFight(id) {
  state.tab = 'fight';
  const seq = state.seq;
  document.body.classList.add('fight-mode');
  let f;
  try { f = await api('GET', `/api/fights/${id}`); } catch (e) { toast(e.message, true); return go('#/'); }
  if (!state.me && state.role === 'member') state.me = await api('GET', '/api/me').catch(() => null);
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  const myId = state.me?.member?.id;
  const [L, R] = f.b === myId ? [{ id: f.b, name: f.bName, power: f.powerB }, { id: f.a, name: f.aName, power: f.powerA }]
    : [{ id: f.a, name: f.aName, power: f.powerA }, { id: f.b, name: f.bName, power: f.powerB }];
  let i = 0, speed = 1;

  $app.innerHTML = `<div class="dark">
    <div class="topbar"><button class="link" id="back">← 나가기</button><div class="logo"><img src="/logo.png" alt="TBG" /><span class="arena-tag">LIVE</span></div><button class="sound-btn" id="snd"></button></div>
    <div class="arena">
      <div class="fighters">
        ${[L, R].map((p, k) => `
          <div class="fighter-wrap ${k ? 'right' : 'left'}">
            <div class="fighter ${k ? 'right' : 'left'}">
              ${avatar(p.id, '', k ? 'R' : 'L')}
              <div class="meta"><div class="fname ellipsis">${esc(p.name)}${p.id === myId ? ' <span class="muted small">(나)</span>' : ''}</div>
              <div class="pw">PWR ${p.power}</div></div>
            </div>
            <div class="hp"><i id="hp-${p.id}" style="width:100%"></i></div>
          </div>`).join('<div class="vs">VS</div>')}
      </div>
      <div class="scoreboard"><span id="rnd">1R</span><b id="clk">${clock(f.roundSec || 300)}</b><span id="pos" class="badge" style="display:none"></span></div>
      <div class="ring"><canvas id="ring"></canvas></div>
      <div class="feed" id="feed"></div>
      <div id="result"></div>
      <div class="row" id="ctrl"><button class="btn grow" id="spd">▶ 1x</button><button class="btn primary grow" id="skip">결과 바로 보기 ⏭</button></div>
    </div></div>`;
  const arena = state.arena = window.Arena ? new window.Arena(document.getElementById('ring'), L, R) : null;
  let prevHp = null;

  const leave = () => (history.length > 1 ? history.back() : go('#/'));
  document.getElementById('back').onclick = leave;
  const $snd = document.getElementById('snd');
  const sndLabel = () => { const on = window.SFX?.enabled; $snd.classList.toggle('on', !!on); $snd.innerHTML = on ? '♪ ON' : '♪ OFF'; };
  sndLabel();
  $snd.onclick = () => { window.SFX?.toggle(); sndLabel(); vibrate(15); };
  document.getElementById('spd').onclick = (e) => { speed = speed === 1 ? 3 : speed === 3 ? 8 : 1; e.target.textContent = `▶ ${speed}x`; if (arena) arena.speed = speed; };
  document.getElementById('skip').onclick = () => { clearTimeout(state.playTimer); while (i < f.events.length) show(f.events[i++], true); if (arena) arena.silent = true; arena?.snap(f.events[f.events.length - 1], f.result); end(); };

  const $feed = document.getElementById('feed');
  function show(e, silent) {
    if (!silent) arena?.play(e, prevHp, f.result);
    prevHp = e.hp;
    for (const p of [L, R]) {
      const el = document.getElementById(`hp-${p.id}`);
      const v = Math.max(0, e.hp[p.id]) / f.maxHp * 100;
      el.style.width = v + '%';
      el.parentElement.classList.toggle('low', v <= 30);
    }
    document.getElementById('rnd').textContent = `${e.r}R`;
    document.getElementById('clk').textContent = clock(Math.max(0, (f.roundSec || 300) - e.t));
    const posEl = document.getElementById('pos');
    posEl.textContent = POS_LABEL[e.pos] || '';
    posEl.style.display = POS_LABEL[e.pos] ? '' : 'none';
    posEl.className = 'badge ' + (e.pos === 'ground' ? 'solid' : e.pos === 'clinch' ? 'red' : '');
    const side = e.by ? (e.by === L.id ? 'l' : 'r') : 'c';
    $feed.insertAdjacentHTML('afterbegin', `<div class="ev ${e.type} ${side}"><span class="t">${e.type === 'round' ? '' : `${e.r}R ${clock(Math.max(0, (f.roundSec || 300) - e.t))}`}</span>${esc(e.text)}</div>`);
    if (!silent && ['big', 'down', 'finish', 'sub'].includes(e.type)) {
      vibrate(e.type === 'finish' ? [120, 60, 200] : 50);
      $app.querySelector('.fighters').classList.remove('flash'); void $app.offsetWidth; $app.querySelector('.fighters').classList.add('flash');
    }
  }
  function end() {
    document.getElementById('ctrl').remove();
    const r = f.result;
    const isPlayer = myId === f.a || myId === f.b;
    const win = r.winnerId === myId;
    const wname = r.winnerId ? (r.winnerId === f.a ? f.aName : f.bName) : null;
    const text = !r.winnerId ? 'DRAW' : isPlayer ? (win ? 'YOU WIN' : 'YOU LOSE') : `${esc(wname)} WIN`;
    const d = isPlayer ? f.delta?.[myId] : null;
    document.getElementById('result').innerHTML = `
      <div class="card result">
        <div class="big ${isPlayer && !win && r.winnerId ? 'lose' : 'win'}">${text}</div>
        <div style="margin-top:6px;font-weight:800">${esc(r.method)}${r.skill ? ` · ${esc(r.skill)}` : ''}${r.detail ? ` (${esc(r.detail)})` : ''}</div>
        <div class="muted small">${r.round}R ${clock(r.time)}${r.cards ? ` · 채점 ${r.cards.map((c) => (f.a === L.id ? c : [c[1], c[0]]).join('-')).join(', ')}` : ''}</div>
        ${d != null ? `<div class="${d >= 0 ? 'delta-up' : 'delta-down'}" style="margin-top:8px;font-weight:800">RANK PTS ${d >= 0 ? '+' : ''}${d}</div>` : ''}
        <button class="btn primary block" style="margin-top:14px" id="back2">돌아가기</button>
      </div>`;
    document.getElementById('back2').onclick = leave;
  }
  function step() {
    if (state.tab !== 'fight') return;
    if (i >= f.events.length) return end();
    const e = f.events[i++];
    show(e);
    const base = { finish: 1800, big: 1400, down: 1600, sub: 1500, round: 1300 }[e.type] || 900;
    state.playTimer = setTimeout(step, base / speed);
  }
  step();
}

// ───────── 코치 화면 ─────────
async function renderCoach(tab) {
  state.tab = tab;
  const tabs = (pending) => [
    { id: 'approve', icon: 'check', label: '승인', dot: pending || '' },
    { id: 'members', icon: 'users', label: '회원·기술' },
    { id: 'fights', icon: 'fight', label: '경기' },
  ];
  const load = async () => {
    const [callouts, members, fights] = await Promise.all([
      api('GET', '/api/callouts'),
      tab === 'members' ? api('GET', '/api/coach/members') : null,
      tab === 'fights' ? api('GET', '/api/fights') : null,
    ]);
    return { callouts, members, fights };
  };
  let data;
  try { data = await load(); } catch (e) { return toast(e.message, true); }
  if (state.tab !== tab) return;
  draw(data);
  if (tab !== 'members') {
    let lastSig = JSON.stringify(data);
    poll(async () => {
      if (modalOpen() || state.tab !== tab) return;
      try {
        const d = await load();
        if (state.tab !== tab) return;
        const s = JSON.stringify(d);
        if (s !== lastSig) { lastSig = s; draw(d); }
      } catch {}
    }, 4000);
  }

  function draw({ callouts, members, fights }) {
    const pending = callouts.filter((c) => c.status === 'pending_coach');
    let inner = '';
    if (tab === 'approve') {
      inner = `<div class="section-title">승인 대기 콜아웃 (${pending.length})</div>
        ${pending.length ? pending.map((c) => `
          <div class="card">
            <div style="font-size:17px;font-weight:900">${esc(c.challenger)} <span class="badge red px">VS</span> ${esc(c.opponent)}</div>
            ${c.message ? `<div class="muted" style="margin-top:4px">“${esc(c.message)}”</div>` : ''}
            <div class="muted small" style="margin-top:4px">${ago(c.createdAt)}</div>
            <div class="row" style="margin-top:12px"><button class="btn green grow" data-approve="${c.id}">승인</button><button class="btn grow" data-reject="${c.id}">반려</button></div>
          </div>`).join('') : '<div class="card empty">승인 대기 중인 콜아웃이 없습니다.</div>'}
        <div class="section-title">최근 처리 내역</div>
        ${callouts.filter((c) => c.status !== 'pending_coach').slice(0, 15).map((c) => `
          <div class="list-item small"><div class="grow ellipsis">${esc(c.challenger)} → ${esc(c.opponent)}</div><span class="${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>
          ${c.fightId ? `<button class="btn sm" data-go="#/fight/${c.fightId}">중계</button>` : ''}</div>`).join('') || '<div class="card empty">내역 없음</div>'}`;
    }
    if (tab === 'members') {
      inner = `
        <button class="btn primary block" id="addMember">＋ 회원 등록</button>
        <div class="section-title">회원 (${members.length}) · 오늘 출석 ${members.filter((m) => m.attended).length}명</div>
        ${members.length ? members.map((m) => `
          <details class="card member" data-mid="${m.id}">
            <summary class="row">${avatar(m.id)}
              <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">${esc(m.name)}</div>
                <div class="muted small">${fmtPhone(m.phone)} · 전투력 ${m.power} · 기술 ${m.skills.length}</div></div>
              <button class="btn sm ${m.attended ? '' : 'primary'}" data-attend="${m.id}" ${m.attended ? 'disabled' : ''}>${m.attended ? '출석✓' : '출석'}</button></summary>
            <div style="margin-top:12px">
              ${statBars(m.stats)}
              <div class="muted small" style="margin:8px 0">${record(m)} · 누적 출석 ${m.attendCount}</div>
              <div class="row" style="margin:12px 0 8px">
                <button class="btn navy grow" data-addskill="${m.id}" data-name="${esc(m.name)}">＋ 배운 기술 등록</button>
                <button class="btn" data-edit="${m.id}">수정</button>
                <button class="btn ghost" data-delmember="${m.id}" data-name="${esc(m.name)}">삭제</button>
              </div>
              ${skillGroups(m.skills, { coach: true, open: true, empty: '등록된 기술이 없습니다. 수업에서 배운 기술을 등록해 주세요.' })}
            </div>
          </details>`).join('') : '<div class="card empty">등록된 회원이 없습니다.</div>'}`;
    }
    if (tab === 'fights') {
      inner = `<div class="section-title">경기 기록</div>${fights.length ? fights.map((f) => fightRow(f)).join('') : '<div class="card empty">경기 기록이 없습니다.</div>'}`;
    }
    $app.innerHTML = shell(tabs(pending.length), tab, inner, { coach: true });
    bindShell();
    bindCoachActions(members);
  }
}

function memberForm(m = {}) {
  return `
    <div class="stack">
      <div><label class="field">이름</label><input id="f-name" maxlength="20" value="${esc(m.name || '')}" placeholder="홍길동" /></div>
      <div><label class="field">전화번호 (로그인용)</label><input id="f-phone" type="tel" inputmode="numeric" maxlength="13" value="${m.phone ? fmtPhone(m.phone) : ''}" placeholder="010-0000-0000" /></div>
    </div>`;
}

// 펼쳐진 회원 유지하며 다시 그리기
async function refreshMembers() {
  const open = [...document.querySelectorAll('details.member[open]')].map((d) => d.dataset.mid);
  const y = window.scrollY;
  await renderCoach('members');
  open.forEach((id) => document.querySelector(`[data-mid="${id}"]`)?.setAttribute('open', ''));
  window.scrollTo(0, y);
}

function bindCoachActions(members) {
  bindGo();
  const byId = (id) => members?.find((m) => m.id === id);
  const allSkills = () => (members || []).flatMap((m) => m.skills);
  const phoneFmt = (el) => { const p = el.querySelector('#f-phone'); p.oninput = () => (p.value = fmtPhone(p.value)); };

  const addBtn = document.getElementById('addMember');
  if (addBtn) addBtn.onclick = () => openModal(`<h3>회원 등록</h3>${memberForm()}
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">등록</button></div>`, (el) => {
    phoneFmt(el);
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('POST', '/api/coach/members', { name: el.querySelector('#f-name').value, phone: el.querySelector('#f-phone').value });
      closeModal(); toast('회원이 등록되었습니다.'); refreshMembers();
    });
  });
  document.querySelectorAll('[data-attend]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(async () => {
    const r = await api('POST', `/api/coach/members/${b.dataset.attend}/attend`);
    const up = Object.entries(r.gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_LABEL[k][1]} +${v}`);
    toast(`${r.name} 출석 체크!${up.length ? ' ' + up.join(' · ') : ' 능력치가 조금씩 쌓이고 있어요'}`); refreshMembers();
  }); }));
  document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const m = byId(b.dataset.edit);
    openModal(`<h3>회원 수정</h3>${memberForm(m)}
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
      phoneFmt(el);
      el.querySelector('#x').onclick = closeModal;
      el.querySelector('#ok').onclick = () => act(async () => {
        await api('PUT', `/api/coach/members/${m.id}`, { name: el.querySelector('#f-name').value, phone: el.querySelector('#f-phone').value });
        closeModal(); toast('저장되었습니다.'); refreshMembers();
      });
    });
  }));
  document.querySelectorAll('[data-delmember]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm(`${b.dataset.name} 회원을 삭제할까요? 기술과 기록도 함께 사라집니다.`)) return;
    await api('DELETE', `/api/coach/members/${b.dataset.delmember}`); toast('삭제되었습니다.'); refreshMembers();
  })));
  document.querySelectorAll('[data-addskill]').forEach((b) => (b.onclick = () => {
    const C = state.meta.categories;
    let category = 'jab';
    openModal(`<h3>${esc(b.dataset.name)} · 배운 기술 등록</h3>
      <div class="stack">
        <div><label class="field">분류</label><div class="seg five" id="s-cat">${Object.entries(C).map(([k, v]) => `<button data-c="${k}" class="${k === category ? 'on' : ''}">${v.icon}<br/>${v.label}</button>`).join('')}</div></div>
        <div><label class="field">기술 이름</label><input id="s-name" maxlength="24" placeholder="예: 원투, 레프트 훅, 리버샷, 슬립" /></div>
        <div><label class="field">시작 숙련도 <b id="s-mv" class="px">10</b> / 100</label><input id="s-m" type="range" min="1" max="100" value="10" /></div>
        <div><label class="field">메모 (선택)</label><input id="s-desc" maxlength="60" placeholder="예: 3월 2주차 수업" /></div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn navy grow" id="ok">등록</button></div>`, (el) => {
      el.querySelectorAll('#s-cat button').forEach((t) => (t.onclick = () => {
        category = t.dataset.c; el.querySelectorAll('#s-cat button').forEach((x) => x.classList.toggle('on', x === t));
      }));
      const mv = el.querySelector('#s-m');
      mv.oninput = () => (el.querySelector('#s-mv').textContent = mv.value);
      el.querySelector('#x').onclick = closeModal;
      el.querySelector('#ok').onclick = () => act(async () => {
        await api('POST', `/api/coach/members/${b.dataset.addskill}/skills`, { name: el.querySelector('#s-name').value, category, mastery: mv.value, desc: el.querySelector('#s-desc').value });
        closeModal(); toast('기술이 등록되었습니다.'); refreshMembers();
      });
    });
  }));
  const adjust = (id, d) => act(async () => {
    const s = allSkills().find((x) => x.id === id);
    await api('PUT', `/api/coach/skills/${id}`, { mastery: s.mastery + d }); refreshMembers();
  });
  document.querySelectorAll('[data-mup]').forEach((b) => (b.onclick = () => adjust(b.dataset.mup, 5)));
  document.querySelectorAll('[data-mdown]').forEach((b) => (b.onclick = () => adjust(b.dataset.mdown, -5)));
  document.querySelectorAll('[data-delskill]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm('이 기술을 삭제할까요?')) return;
    await api('DELETE', `/api/coach/skills/${b.dataset.delskill}`); refreshMembers();
  })));
  document.querySelectorAll('[data-approve]').forEach((b) => (b.onclick = () => act(async () => {
    await api('POST', `/api/coach/callouts/${b.dataset.approve}`, { approve: true }); toast('승인했습니다. 상대의 수락을 기다립니다.'); route();
  })));
  document.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => act(async () => {
    const note = prompt('반려 사유 (선택)');
    if (note === null) return;
    await api('POST', `/api/coach/callouts/${b.dataset.reject}`, { approve: false, note }); route();
  })));
}

route();
