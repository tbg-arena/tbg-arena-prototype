// 선수 분석 화면 (#/fighter/<id>) = 스카우팅 리포트
//   표지(사진 · 판정 도장 · 맞대결) → TALE OF THE TAPE(나 vs 상대 능력치) → 코너 메모(공략 포인트) → 주무기 · 전략 · 전체 기술 → 콜아웃
//   회원이 볼 때만 나와 비교한다. 코치가 보면 상대 정보만 (비교 · 판정 · 콜아웃 없음)
import { state } from '../../core/state.js';
import { $app, esc, toast, record } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { addPage, go, bindGo } from '../../core/router.js';
import { figureURL } from '../../arena/figure.js';
import { STAT_LABEL, statBars } from './components.js';
import { skillGroups, cat, masteryBar } from '../skills/components.js';
import { bindCalloutActions } from '../callouts/member.js';

addPage('fighter', renderFighter);

async function renderFighter(id) {
  state.tab = 'fighter';
  const member = state.role === 'member';
  // 본인은 상대 분석을 볼 수 없다 (주소를 직접 쳐도) — 내 정보는 홈에서
  if (member) {
    if (!state.me) state.me = await api('GET', '/api/me').catch(() => null);
    if (state.me?.member?.id === id) { toast('나는 상대 분석을 볼 수 없어요.', true); return history.length > 1 ? history.back() : go('#/'); }
  }
  let d, fights = [];
  try { [d, fights] = await Promise.all([api('GET', `/api/members/${id}`), member ? api('GET', '/api/fights').catch(() => []) : []]); }
  catch (e) { toast(e.message, true); return history.back(); }
  const o = d.member, me = member ? state.me?.member : null;
  $app.innerHTML = `
    <div class="topbar"><span style="width:60px"></span><div class="muted small">상대 분석</div><span style="width:60px"></span></div>
    <div class="page no-tabs scout">
      ${cover(o, me, d.skills, headToHead(fights, o.id, me?.id))}
      ${me ? tape(me, o) : `<div class="section-title">능력치</div><div class="card">${statBars(o.stats)}</div>`}
      <div class="section-title">코너 메모 <span class="muted">이렇게 상대하세요</span></div>
      ${memo(o, me, d.skills)}
      <div class="section-title">주무기</div>
      ${weapons(d.skills)}
      <div class="section-title">기본 전략</div>
      ${plan(o.strategy)}
      <div class="section-title">배운 기술 전체 <span class="muted">${d.skills.length}개</span></div>
      ${skillGroups(d.skills, { empty: '배운 기술이 없습니다.' })}
    </div>
    <div class="backbar scout-bar"><button class="btn" id="back">←</button>
      ${me ? `<button class="btn primary grow" data-callout="${o.id}" data-name="${esc(o.name)}" ${d.skills.length ? '' : 'disabled'}>${d.skills.length ? `${esc(o.name)}에게 콜아웃` : '기술이 없어 콜아웃 불가'}</button>` : '<span class="grow"></span>'}</div>`;
  document.getElementById('back').onclick = () => history.back();
  bindGo();
  if (me) bindCalloutActions();
}

// ── 표지: 사진 + 이름 · 전적 + 판정 도장(전투력 차) + 맞대결 전적
// 판정: 상대 전투력 / 내 전투력 — 1.15배 넘으면 강적, 0.9배 미만이면 해볼 만함, 그 사이 호각
function verdict(o, me) {
  if (!me) return null;
  const r = o.power / Math.max(1, me.power), diff = o.power - me.power;
  const [label, cls] = r > 1.15 ? ['강적', 'danger'] : r < 0.9 ? ['해볼 만함', 'edge'] : ['호각', 'even'];
  return { label, cls, diff };
}
// 내 경기 중 이 상대와의 경기 (중계 안 본 경기는 결과를 모르니 뺌)
function headToHead(fights, oid, myId) {
  if (!myId) return null;
  const vs = fights.filter((f) => !f.hidden && f.result && (f.a === oid || f.b === oid));
  const w = vs.filter((f) => f.result.winnerId === myId).length, l = vs.filter((f) => f.result.winnerId === oid).length;
  return { n: vs.length, w, l, dr: vs.length - w - l, last: vs[0] };
}
function cover(o, me, skills, h2h) {
  const v = verdict(o, me);
  const badges = [o.streak >= 2 ? `<span class="badge red">${o.streak}연승 중</span>` : '', o.laps ? `<span class="badge red">31주 완주${o.laps > 1 ? ` ×${o.laps}` : ''}</span>` : '',
    ...(o.titles || []).map((t) => `<span class="badge solid">${esc(t)} 마스터</span>`)].join('');
  return `<div class="card scout-cover">
      <div class="scout-file px">SCOUTING REPORT</div>
      <div class="scout-top">
        <div class="fig-box"><img src="${figureURL(o, 2)}" alt="" /></div>
        <div class="scout-side">
          <div class="name ellipsis">${esc(o.name)}</div>
          <div class="small">${record(o)} <span class="muted">· KO/TKO ${o.kos}</span></div>
          ${v ? `<div class="stamp-wrap"><div class="stamp ${v.cls}">${v.label}</div></div>` : '<span class="grow"></span>'}
          <dl class="scout-meta"><dt>랭킹 포인트</dt><dd class="px">${o.points}</dd><dt>팬</dt><dd class="px">${o.fans}</dd><dt>기술</dt><dd class="px">${skills.length}</dd></dl>
        </div>
      </div>
      <div class="scout-board ${v ? '' : 'one'}">
        <div><span class="px">POWER</span><b class="px">${o.power}</b></div>
        ${v ? `<div class="${v.diff > 0 ? 'up' : v.diff < 0 ? 'down' : ''}"><span class="px">나와 차이</span><b class="px">${v.diff > 0 ? '+' : ''}${v.diff}</b></div>` : ''}
      </div>
      ${badges ? `<div class="titles" style="margin:12px 0 0">${badges}</div>` : ''}
      ${h2h ? `<div class="scout-h2h"><span class="px">맞대결</span>${h2h.n
        ? `<b>${h2h.w}승 ${h2h.l}패${h2h.dr ? ` ${h2h.dr}무` : ''}</b><span class="muted small grow">${h2h.w > h2h.l ? '내가 앞서요' : h2h.w < h2h.l ? '갚아야 할 빚이 있어요' : '팽팽해요'}</span>
          <button class="btn sm" data-go="#/fight/${h2h.last.id}">지난 경기</button>`
        : '<b>첫 대결</b><span class="muted small grow">아직 붙어 본 적 없어요</span>'}</div>` : ''}
    </div>`;
}

// ── TALE OF THE TAPE: 가운데 항목 이름, 왼쪽 = 나(흰색) · 오른쪽 = 상대(빨강). 막대는 가운데에서 바깥으로, 앞선 쪽 숫자에 ◀ ▶
const STAT_TOP = 100;
function tape(me, o) {
  const rows = Object.entries(STAT_LABEL).map(([k, [code, label]]) => {
    const a = Math.floor(me.stats[k]), b = o.stats[k], w = (n) => Math.min(100, (n / STAT_TOP) * 100);
    return `<div class="tape-row">
        <b class="tv ${a > b ? 'win' : ''}">${a > b ? '◀ ' : ''}${a}</b>
        <div class="tbar me"><i style="width:${w(a)}%"></i></div>
        <div class="tk"><i class="px">${code}</i>${label}</div>
        <div class="tbar op"><i style="width:${w(b)}%"></i></div>
        <b class="tv ${b > a ? 'win' : ''}">${b}${b > a ? ' ▶' : ''}</b>
      </div>`;
  }).join('');
  const lead = Object.keys(STAT_LABEL).filter((k) => Math.floor(me.stats[k]) > o.stats[k]).length, lag = Object.keys(STAT_LABEL).filter((k) => o.stats[k] > Math.floor(me.stats[k])).length;
  return `<div class="section-title">TALE OF THE TAPE</div>
    <div class="card tape">
      <div class="tape-head"><span>나</span><span class="px">VS</span><span class="ellipsis">${esc(o.name)}</span></div>
      ${rows}
      <div class="tape-sum small">능력치 5개 중 <b>${lead}개 앞서고</b> · <b class="op">${lag}개 밀려요</b></div>
    </div>`;
}

// ── 코너 메모: 상대 최고 · 최저 능력치 + 주무기 + 전략별 공략. 세컨드가 코너에서 불러 주는 말투로 짧게
const STRONG = {
  power: '펀치가 무거워요. 정면에서 맞받아치지 말고 각도를 틀어요',
  speed: '손이 빨라요. 어설픈 거리에 서 있으면 잽에 계속 맞아요',
  stamina: '체력이 좋아요. 후반까지 가면 불리하니 초반에 점수를 쌓아요',
  iq: '수 읽기가 좋아요. 같은 패턴을 반복하지 마세요',
  chin: '맷집이 좋아요. 한 방을 노리기보다 쌓아서 무너뜨려요',
};
const WEAK = {
  power: '펀치가 가벼워요. 압박하며 들어가도 크게 위험하지 않아요',
  speed: '손이 느려요. 잽으로 먼저 거리를 잡아요',
  stamina: '체력이 약해요. 라운드 후반까지 쉬지 않고 몰아붙여요',
  iq: '대응이 느려요. 페인트와 콤비네이션에 잘 걸려요',
  chin: '맷집이 약해요. 깨끗한 정타 한 방이면 흔들려요',
};
const PLAN_TIP = {
  stance: { 사우스포: '사우스포 — 앞발 바깥을 잡고 뒷손 스트레이트를 꽂아요', 오소독스: '오소독스 — 상대 뒷손(오른손) 쪽으로 돌며 각을 만들어요' },
  guard: { 하이가드: '하이가드 — 얼굴은 단단해요. 바디부터 무너뜨려요', 숄더롤: '숄더롤 — 앞어깨로 흘려요. 바디와 오버핸드가 잘 들어가요', 밸런스: '밸런스 가드 — 빈틈이 적어요. 페인트로 가드를 먼저 움직여요' },
  style: { 인파이팅: '인파이터 — 붙으면 위험해요. 잽과 발로 거리를 유지해요', 카운터: '카운터 — 먼저 크게 들어가면 역으로 맞아요. 페인트로 끌어내요', 아웃복싱: '아웃복서 — 거리를 빼요. 코너로 몰아 압박해요' },
};
const FOCUS_TIP = { 헤드: '헤드를 노려요 — 가드를 올리고 턱을 당겨요', 바디: '바디를 노려요 — 팔꿈치를 붙여 옆구리를 지켜요' };
function memo(o, me, skills) {
  const ks = Object.keys(STAT_LABEL), hi = ks.reduce((a, k) => (o.stats[k] > o.stats[a] ? k : a)), lo = ks.reduce((a, k) => (o.stats[k] < o.stats[a] ? k : a));
  const vsMe = (k) => (me ? (() => { const d = o.stats[k] - Math.floor(me.stats[k]); return d ? ` <span class="${d > 0 ? 'op' : ''}">(나보다 ${d > 0 ? '+' : ''}${d})</span>` : ' <span>(나와 같음)</span>'; })() : '');
  const top = [...skills].sort((a, b) => b.mastery - a.mastery)[0];
  const s = o.strategy || {};
  // 최고 · 최저 차이가 5 미만이면 강점 · 약점이라 부르기 어려움 → 고른 능력치 한 줄 (나와 비교한 결론)
  const flat = o.stats[hi] - o.stats[lo] < 5;
  const lead = me ? ks.filter((k) => Math.floor(me.stats[k]) > o.stats[k]).length : 0;
  const flatBody = !me ? '튀는 능력치 없이 고르게 비슷해요' : lead === ks.length ? '모든 능력치에서 내가 앞서요. 내 페이스로 밀어붙여요'
    : lead === 0 ? '모든 능력치에서 밀려요. 정면 승부보다 전략과 기술로 풀어요' : '고르게 비슷해서 빈틈이 적어요. 내가 앞서는 능력치로 승부해요';
  const notes = [
    flat ? ['능력치', '', `모두 ${o.stats[lo]}~${o.stats[hi]}`, flatBody] : ['강점', 'hi', `${STAT_LABEL[hi][1]} ${o.stats[hi]}${vsMe(hi)}`, STRONG[hi]],
    flat ? null : ['약점', 'lo', `${STAT_LABEL[lo][1]} ${o.stats[lo]}${vsMe(lo)}`, WEAK[lo]],
    top ? ['주무기', 'hi', `${esc(top.name)} · 숙련 ${top.mastery}`, `${cat(top.category).label} 쪽이 제일 날카로워요. 이 기술이 나올 때를 대비해요`] : null,
    ...['stance', 'guard', 'style'].map((k) => PLAN_TIP[k][s[k]]).filter(Boolean).map((t) => { const [h, b] = t.split(' — '); return ['전략', '', h, b]; }),
    ...(s.focus || []).map((f) => FOCUS_TIP[f]).filter(Boolean).map((t) => { const [h, b] = t.split(' — '); return ['공략', '', h, b]; }),
  ].filter(Boolean);
  return `<div class="card memo">${notes.map(([tag, cls, head, body]) => `
      <div class="memo-row"><span class="memo-tag ${cls} px">${tag}</span><div class="grow"><b>${head}</b><div class="muted small">${body}</div></div></div>`).join('')}</div>`;
}

// ── 주무기 TOP 3: 숙련 높은 순, 1위는 크게
function weapons(skills) {
  const top = [...skills].sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  if (!top.length) return '<div class="card empty">배운 기술이 없습니다.</div>';
  return `<div class="weapons">${top.map((s, i) => `
      <div class="weapon ${i ? '' : 'main'}"><div class="row"><span class="wrank px">${i + 1}</span><span class="type-dot">${cat(s.category).icon}</span>
        <div class="grow" style="min-width:0"><div class="ellipsis" style="font-weight:800">${esc(s.name)}</div><div class="muted small">${cat(s.category).label}</div></div><b class="px wv">${s.mastery}</b></div>
        ${masteryBar(s.mastery)}</div>`).join('')}</div>`;
}

// ── 기본 전략: 4칸 (스탠스 · 가드 · 스타일 · 공략)
function plan(s = {}) {
  const cell = (k, v) => `<div class="plan-cell"><span class="px">${k}</span><b>${esc(v || '—')}</b></div>`;
  return `<div class="plan">${cell('STANCE', s.stance)}${cell('GUARD', s.guard)}${cell('STYLE', s.style)}${cell('TARGET', (s.focus || []).join(' · '))}</div>`;
}
