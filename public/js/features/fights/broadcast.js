// 경기 중계 화면 (#/fight/<id>): 도트 애니메이션 + 체력바 + 해설 피드 + 결과
import { state } from '../../core/state.js';
import { $app, esc, avatar, toast, vibrate } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { addPage, go } from '../../core/router.js';
import { Arena } from '../../arena/arena.js';
import { SFX } from '../../arena/sfx.js';
import { clock } from './components.js';
import { shareStory } from './story.js';

const POS_LABEL = { clinch: '클린치', ground: '그라운드' }; // 예전(MMA) 경기 다시보기용

addPage('fight', renderFight);

async function renderFight(id) {
  state.tab = 'fight';
  const seq = state.seq;
  document.body.classList.add('fight-mode');
  let f;
  try { f = await api('GET', `/api/fights/${id}`); } catch (e) { toast(e.message, true); return go('#/'); }
  if (!state.me && state.role === 'member') state.me = await api('GET', '/api/me').catch(() => null);
  if (seq !== state.seq) return; // 그 사이 다른 화면으로 이동함
  const myId = state.me?.member?.id;
  const [L, R] = f.b === myId ? [{ id: f.b, name: f.bName, power: f.powerB, gender: f.bGender }, { id: f.a, name: f.aName, power: f.powerA, gender: f.aGender }]
    : [{ id: f.a, name: f.aName, power: f.powerA, gender: f.aGender }, { id: f.b, name: f.bName, power: f.powerB, gender: f.bGender }];
  let i = 0, speed = 1;
  const nameOf = (id) => (id === f.a ? f.aName : f.bName);

  $app.innerHTML = `<div class="dark">
    <div class="topbar"><button class="link" id="back">← 나가기</button><div class="logo"><img src="/logo.png" alt="TBG" /><span class="arena-tag">LIVE</span></div><button class="sound-btn" id="snd"></button></div>
    <div class="arena">
      <div class="fighters">
        ${[L, R].map((p, k) => `
          <div class="fighter-wrap ${k ? 'right' : 'left'}">
            <div class="fighter ${k ? 'right' : 'left'}">
              ${avatar(p, '', k ? 'R' : 'L')}
              <div class="meta"><div class="fname ellipsis">${esc(p.name)}${p.id === myId ? ' <span class="muted small">(나)</span>' : ''}</div>
              <div class="pw">PWR ${p.power}</div></div>
            </div>
            <div class="hp"><i id="hp-${p.id}" style="width:100%"></i></div>
          </div>`).join('<div class="vs">VS</div>')}
      </div>
      <div class="scoreboard"><span id="rnd">1R</span><b id="clk">${clock(f.roundSec || 300)}</b><span id="pos" class="badge" style="display:none"></span></div>
      <div class="ring"><canvas id="ring"></canvas>${f.taunt ? `<div class="taunt" id="taunt"><span>도전장</span><b>${esc(nameOf(f.taunt.by))}</b><p>“${esc(f.taunt.text)}”</p></div>` : ''}</div>
      <div class="feed" id="feed"></div>
      <div id="result"></div>
      <div class="row" id="ctrl"><button class="btn grow" id="spd">▶ 1x</button><button class="btn primary grow" id="skip">결과 바로 보기 ⏭</button></div>
    </div></div>`;
  const arena = state.arena = new Arena(document.getElementById('ring'), L, R);
  let prevHp = null;

  const leave = () => (history.length > 1 ? history.back() : go('#/'));
  document.getElementById('back').onclick = leave;
  const $snd = document.getElementById('snd');
  const sndLabel = () => { const on = SFX.enabled; $snd.classList.toggle('on', !!on); $snd.innerHTML = on ? '♪ ON' : '♪ OFF'; };
  sndLabel();
  $snd.onclick = () => { SFX.toggle(); sndLabel(); vibrate(15); };
  document.getElementById('spd').onclick = (e) => { speed = speed === 1 ? 3 : speed === 3 ? 8 : 1; e.target.textContent = `▶ ${speed}x`; if (arena) arena.speed = speed; };
  document.getElementById('skip').onclick = () => { clearTimeout(state.playTimer); document.getElementById('taunt')?.remove(); while (i < f.events.length) show(f.events[i++], true); if (arena) arena.silent = true; arena?.snap(f.events[f.events.length - 1], f.result); end(); };

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
        ${isPlayer ? '<button class="btn block" style="margin-top:14px" id="story">📸 결과 이미지 저장</button>' : ''}
        <button class="btn primary block" style="margin-top:${isPlayer ? 8 : 14}px" id="back2">돌아가기</button>
      </div>`;
    document.getElementById('back2').onclick = leave;
    if (isPlayer) document.getElementById('story').onclick = (e) => {
      e.target.disabled = true;
      const cards = r.cards ? ` · 채점 ${r.cards.map((c) => (f.a === L.id ? c : [c[1], c[0]]).join('-')).join(', ')}` : '';
      shareStory({
        ring: document.getElementById('ring'), L, R, winnerId: r.winnerId, title: text, lose: !win && !!r.winnerId,
        method: `${r.method}${r.skill ? ` · ${r.skill}` : ''}${r.detail ? ` (${r.detail})` : ''}`,
        meta: `${r.round}R ${clock(r.time)}${cards}`, delta: d,
        date: new Date(f.createdAt || Date.now()).toLocaleDateString('ko-KR'),
      }).catch((err) => toast(err.message, true)).finally(() => { e.target.disabled = false; });
    };
  }
  function step() {
    if (state.tab !== 'fight') return;
    if (i >= f.events.length) return end();
    const e = f.events[i++];
    show(e);
    const base = ({ finish: 1800, big: 1400, down: 1600, sub: 1500, round: 1300 }[e.type] || 900) + (e.act?.finisher ? 1600 : 0); // 필살기는 연타·마무리 연출 시간만큼 더
    state.playTimer = setTimeout(step, base / speed);
  }
  if (f.taunt) {
    // 도전장 한마디: 피드 맨 아래(가장 오래된 줄)에 남기고, 링 위에 잠깐 띄운 뒤 경기 시작
    $feed.insertAdjacentHTML('afterbegin', `<div class="ev taunt-line ${f.taunt.by === L.id ? 'l' : 'r'}"><span class="t">도전장</span>${esc(nameOf(f.taunt.by))}: “${esc(f.taunt.text)}”</div>`);
    state.playTimer = setTimeout(() => { document.getElementById('taunt')?.remove(); step(); }, 2800);
  } else step();
}
