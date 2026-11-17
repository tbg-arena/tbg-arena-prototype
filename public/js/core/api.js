// 서버 API 호출
import { state } from './state.js';
import { toast } from './ui.js';

// 로그인이 풀렸을 때(401) 할 일 — core/router.js 가 등록한다 (로그아웃 → 로그인 화면)
let onAuthLost = () => {};
export const setAuthLost = (fn) => { onAuthLost = fn; };

export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // 서버가 새로 배포됐으면 새 코드로 다시 불러오기 (중계 보는 중엔 나간 뒤에)
  const ver = res.headers.get('x-app-version');
  if (ver) {
    if (!state.ver) state.ver = ver;
    else if (ver !== state.ver && !document.body.classList.contains('fight-mode')) { location.reload(); return new Promise(() => {}); }
  }
  if (res.status === 401 && state.token) { onAuthLost(); throw new Error(data.error || '다시 로그인해주세요.'); }
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}
// 버튼 동작용: 실패하면 토스트로 알려준다
export async function act(fn) { try { return await fn(); } catch (e) { toast(e.message, true); } }
