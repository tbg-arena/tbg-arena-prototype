// 로그인 화면: 회원(전화번호) / 코치(PIN) + 데모 스파링 애니메이션
import { state } from '../../core/state.js';
import { $app, fmtPhone, vibrate, stopTimers } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, setLoginPage } from '../../core/router.js';
import { Arena } from '../../arena/arena.js';

setLoginPage(renderLogin);

// 로그인 화면 데모 대진: 상점 장비(lib/shop/items.js 의 look)를 입힌 선수들이 번갈아 나온다 [화이트 코너, 레드 코너]
const G = {
  everlast: { gloveArt: ['KKKKK', 'KGKKK', 'WWWWK', 'KKKKK', 'RRRRR'], palette: { K: '#151515', G: '#5c5c5c', W: '#ffffff', R: '#d2141f' } },
  twins: { gloveArt: ['BBBBY', 'BHBYY', 'BBYYY', 'BYYYY', 'KKKKK'], palette: { B: '#1f5fd6', H: '#8fb6ff', Y: '#ffd21f', K: '#111111' }, trail: '#ffd21f' },
  winning: { gloveArt: ['RRRRR', 'RHRRR', 'RRRRR', 'WRWRW', 'WWWWW'], palette: { R: '#d2141f', H: '#ff9a9a', W: '#ffffff' }, trail: '#ff4b45' },
};
const nbnlTee = { shirt: '#1a1a1a', shirtS: '#0c0c0c', shirtMark: '#ffffff' };
const nbnlTank = { ...nbnlTee, sleeveless: true };
const redTank = { shirt: '#c8102e', shirtS: '#8c0b20', shirtMark: '#ffffff', sleeveless: true };
const blackTank = { shirt: '#1b1b1b', shirtS: '#0d0d0d', sleeveless: true };
const elTrunks = { trunks: '#141414', trunksS: '#f2f2f2', trunksMark: '#d2141f' };
const elTrunksW = { trunks: '#ececec', trunksS: '#161616', trunksMark: '#d2141f' };
const DEMO_CAST = [
  [{ id: 'demo-a', gender: 'M', look: { ...G.winning, ...nbnlTee, ...elTrunks, hair: 'mohawk' } },
   { id: 'demo-b7', gender: 'F', look: { ...G.twins, ...redTank, ...elTrunksW, hair: 'ponytail' } }],
  [{ gender: 'F', look: { ...G.everlast, ...nbnlTank, ...elTrunks, hair: 'bun' } },
   { gender: 'M', look: { ...G.winning, ...blackTank, hair: 'bald' } }],
  [{ gender: 'M', look: { ...G.twins, ...redTank, ...elTrunksW, hair: 'buzz' } },
   { gender: 'F', look: { ...G.everlast, ...blackTank, ...elTrunks, hair: 'bob' } }],
];

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
  state.arena = new Arena(document.getElementById('demo'), DEMO_CAST[0][0], DEMO_CAST[0][1], { demo: true, cast: DEMO_CAST });
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
