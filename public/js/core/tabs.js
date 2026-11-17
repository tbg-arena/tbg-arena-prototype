// 탭 화면 틀 (회원 / 코치): 상단바 + 탭바, 데이터 불러오기, 4초마다 새로고침
// 각 기능이 자기 탭을 등록한다. 탭을 추가해도 이 파일은 고칠 필요 없다.
//
//   memberTab({
//     id: 'shop', order: 50, label: '상점', icon: svg('<path d="..."/>'),
//     load: async () => ({ items: await api('GET', '/api/shop') }), // 이 탭에 필요한 데이터 (선택)
//     view: (data) => html,   // data = 회원: { me, ...load 결과 } / 코치: { callouts, ...load 결과 }
//     bind: (data) => {},     // 그린 뒤 버튼 연결 (선택)
//     dot: (data) => 3,       // 탭 아이콘 위 빨간 숫자 (선택)
//     poll: false,            // 4초 자동 새로고침 끄기 (선택, 입력 폼이 많은 탭)
//   });
//
// order 가 가장 작은 탭이 첫 화면이다.
import { state } from './state.js';
import { $app, esc, toast, vibrate, modalOpen, poll } from './ui.js';
import { api } from './api.js';
import { go, bindGo, logout, setRoleHome } from './router.js';

const TABS = { member: [], coach: [] };
const tabsOf = (role) => TABS[role].slice().sort((a, b) => a.order - b.order);
export const memberTab = (def) => { TABS.member.push(def); };
export const coachTab = (def) => { TABS.coach.push(def); };

function shell(tabs, active, inner, opts = {}) {
  return `
    <div class="topbar">
      <div class="logo"><img src="/logo.png" alt="TBG" /><span class="arena-tag">${opts.coach ? 'COACH' : 'ARENA'}</span></div>
      <button class="link" id="logout">로그아웃</button>
    </div>
    <div class="page">${inner}</div>
    <nav class="tabbar"><div class="inner">
      ${tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === active ? 'on' : ''}">${t.icon || ''}${t.label}${t.dot ? `<span class="dot">${t.dot}</span>` : ''}</button>`).join('')}
    </div></nav>`;
}
function bindShell() {
  document.getElementById('logout').onclick = () => logout();
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => go(`#/${b.dataset.tab}`)));
}
const tabButtons = (role, data) => tabsOf(role).map((t) => ({ id: t.id, icon: t.icon, label: t.label, dot: t.dot?.(data) }));

// ───────── 회원 ─────────
export async function renderMember(tab) {
  tab = tab || tabsOf('member')[0]?.id;
  state.tab = tab;
  const def = TABS.member.find((t) => t.id === tab);
  const load = async () => {
    const [me, extra] = await Promise.all([api('GET', '/api/me'), def?.load ? def.load() : null]);
    return { me, ...extra };
  };
  let data;
  try { data = await load(); } catch (e) { return toast(e.message, true); }
  if (state.tab !== tab) return;
  draw(data);

  let lastSig = JSON.stringify(data);
  poll(async () => {
    if (modalOpen() || state.tab !== tab) return;
    try {
      const d = await load();
      if (state.tab !== tab) return;
      if (d.me.unseenFights.length > data.me.unseenFights.length) { vibrate([80, 60, 80]); toast(`${d.me.unseenFights[0].name}님과의 경기가 치러졌어요!`); }
      const s = JSON.stringify(d);
      if (s !== lastSig) { lastSig = s; data = d; draw(d); }
    } catch {}
  }, 4000);

  function draw(d) {
    const { me } = d;
    state.me = me;
    // 아직 안 본 경기가 있으면 모든 탭 위에 중계 보기 배너
    let inner = me.unseenFights.length
      ? `<div class="banner" data-go="#/fight/${me.unseenFights[0].id}">${esc(me.unseenFights[0].name)}님과 경기 성사! 중계 보기 <span style="margin-left:auto">→</span></div>` : '';
    if (def) inner += def.view(d);
    $app.innerHTML = shell(tabButtons('member', d), tab, inner);
    bindShell();
    bindGo();
    def?.bind?.(d);
  }
}

// ───────── 코치 ─────────
export async function renderCoach(tab) {
  tab = tab || tabsOf('coach')[0]?.id;
  state.tab = tab;
  const def = TABS.coach.find((t) => t.id === tab);
  const load = async () => {
    // 콜아웃은 승인 탭 숫자 표시에 쓰여서 모든 코치 탭에서 불러온다
    const [callouts, extra] = await Promise.all([api('GET', '/api/callouts'), def?.load ? def.load() : null]);
    return { callouts, ...extra };
  };
  let data;
  try { data = await load(); } catch (e) { return toast(e.message, true); }
  if (state.tab !== tab) return;
  draw(data);
  if (def?.poll !== false) {
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

  function draw(d) {
    const inner = def ? def.view(d) : '';
    $app.innerHTML = shell(tabButtons('coach', d), tab, inner, { coach: true });
    bindShell();
    bindGo();
    def?.bind?.(d);
  }
}

setRoleHome('member', renderMember);
setRoleHome('coach', renderCoach);
