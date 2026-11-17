// 화면 이동: 주소(#/...)에 맞는 화면을 그린다. 화면은 각 기능이 등록한다.
//   addPage('fight', renderFight)       → #/fight/<id> 같은 단독 화면
//   setLoginPage(renderLogin)           → 로그인 전 화면
//   setRoleHome('member', renderMember) → 그 밖의 주소는 역할별 탭 화면 (core/tabs.js)
import { state } from './state.js';
import { stopTimers, closeModal } from './ui.js';
import { api, setAuthLost } from './api.js';

const pages = new Map();
const homes = new Map();
let loginPage = () => {};

export const addPage = (name, render) => { pages.set(name, render); };
export const setLoginPage = (render) => { loginPage = render; };
export const setRoleHome = (role, render) => { homes.set(role, render); };

export async function route() {
  if (!state.meta) state.meta = await api('GET', '/api/meta').catch(() => null);
  if (!state.token) return loginPage();
  stopTimers(); closeModal();
  state.seq = (state.seq || 0) + 1;
  document.body.classList.remove('fight-mode');
  const [, view, id] = location.hash.split('/');
  if (id && pages.has(view)) return pages.get(view)(id);
  return homes.get(state.role === 'coach' ? 'coach' : 'member')(view);
}
window.addEventListener('hashchange', route);
export const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

// data-go="#/..." 가 붙은 요소를 누르면 그 화면으로 이동
export function bindGo() {
  document.querySelectorAll('[data-go]').forEach((el) => (el.onclick = (e) => { e.stopPropagation(); go(el.dataset.go); }));
}

export function logout(silent) {
  if (!silent && state.token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + state.token } });
  localStorage.removeItem('tbg_token'); localStorage.removeItem('tbg_role');
  state.token = state.role = state.me = null;
  stopTimers(); closeModal(); history.replaceState(null, '', '/');
  loginPage();
}
setAuthLost(() => logout(true));
