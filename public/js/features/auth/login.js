// 로그인 화면: 회원(전화번호) / 코치(PIN) + 데모 스파링 애니메이션
import { state } from '../../core/state.js';
import { $app, fmtPhone, vibrate, stopTimers } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, setLoginPage } from '../../core/router.js';
import { Arena } from '../../arena/arena.js';

setLoginPage(renderLogin);

// 로그인 화면 데모 대진: 상점 옷(state.meta.wardrobe — lib/shop/items.js, 신 등급 전용 제외)을 부위마다 무작위로 입힌 선수 둘
// 라운드가 바뀔 때마다 새로 뽑는다 (성별도 무작위, 부위별로 그 성별이 입을 수 있는 것 중 기본템 포함 하나)
const SLOTS = ['gloves', 'shirt', 'trunks', 'shoes', 'hair'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let demoN = 0;
function randomFighter() {
  const gender = Math.random() < 0.5 ? 'F' : 'M', look = { arts: {} };
  for (const slot of SLOTS) {
    const it = pick((state.meta?.wardrobe || []).filter((w) => w.slot === slot && (!w.gender || w.gender === gender)));
    if (!it) continue;
    Object.assign(look, it.look);
    if (it.art) look.arts[slot] = it.art;
  }
  return { id: `demo-${++demoN}`, gender, look }; // id 마다 숨 쉬는 박자가 달라짐 (sprite.js lookOf phase)
}
const demoCast = () => [randomFighter(), randomFighter()];

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
        ? `<input id="pin" class="phone-input" type="password" aria-label="코치 PIN" inputmode="numeric" placeholder="PIN" autocomplete="off" />`
        : `<input id="phone" class="phone-input" type="tel" aria-label="전화번호" inputmode="numeric" placeholder="010-0000-0000" autocomplete="tel" maxlength="13" />`}
      <button id="go" class="btn primary block">${coach ? '코치 입장' : '입장하기'}</button>
      <button id="switch" class="link center">${coach ? '← 회원 입장으로' : '코치이신가요?'}</button>
      ${coach ? '' : '<div class="muted small center">TBG 등록 회원은 전화번호만으로 바로 입장할 수 있어요.</div>'}
      <div class="foot">TBG BOXING &amp; MMA · SINSA</div>
    </div>`;
  const [L, R] = demoCast();
  state.arena = new Arena(document.getElementById('demo'), L, R, { demo: true, cast: demoCast });
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
