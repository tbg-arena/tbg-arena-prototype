// 로그인 화면: 회원(전화번호) / 코치(PIN) + 데모 스파링 애니메이션
import { state } from '../../core/state.js';
import { $app, fmtPhone, vibrate, stopTimers } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { route, setLoginPage } from '../../core/router.js';
import { Arena } from '../../arena/arena.js';

setLoginPage(renderLogin);

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
  state.arena = new Arena(document.getElementById('demo'), { id: 'demo-a', gender: 'M' }, { id: 'demo-b7', gender: 'F' }, { demo: true });
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
