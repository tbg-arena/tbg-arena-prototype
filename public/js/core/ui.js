// 화면 공용 도구: 포맷 · 아이콘 · 아바타 · 토스트 · 모달 · 타이머
import { state } from './state.js';
import { spriteURL } from '../arena/sprite.js';

export const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');

// ── 포맷
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtPhone = (v) => {
  const d = String(v).replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};
export const ago = (t) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};
export const record = (m) => `${m.wins}승 ${m.losses}패${m.draws ? ` ${m.draws}무` : ''}`;

// ── 아이콘 · 캐릭터 이미지
export const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`; // 탭 아이콘 (24×24 선 아이콘)
export const sprite = (p, opts) => spriteURL(p, opts);
export const avatar = (p, cls = '', side) => `<div class="avatar ${cls}"><img src="${sprite(p, { side })}" alt="" /></div>`;

// ── 알림
let toastTimer;
export function toast(msg, err) {
  $toast.textContent = msg;
  $toast.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.add('hidden'), 2600);
}
export function vibrate(p) { try { navigator.vibrate?.(p); } catch {} }

// ── 모달 (아래에서 올라오는 시트)
export function openModal(html, onMount) {
  $modal.innerHTML = `<div class="sheet">${html}</div>`;
  $modal.classList.remove('hidden');
  $modal.onclick = (e) => { if (e.target === $modal) closeModal(); };
  onMount?.($modal.querySelector('.sheet'));
}
export function closeModal() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }
export const modalOpen = () => !$modal.classList.contains('hidden');

// ── 타이머: 화면을 옮길 때 stopTimers() 로 정리된다 (core/router.js)
export function stopTimers() {
  clearInterval(state.pollTimer); clearTimeout(state.playTimer);
  state.pollTimer = state.playTimer = null;
  state.arena?.destroy(); state.arena = null;
}
export function poll(fn, ms) { clearInterval(state.pollTimer); state.pollFn = fn; state.pollTimer = setInterval(fn, ms); }
// 폰 화면이 꺼졌다 켜지거나 다른 앱에 갔다 오면 다음 주기를 기다리지 않고 바로 확인
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.pollTimer) state.pollFn?.(); });
