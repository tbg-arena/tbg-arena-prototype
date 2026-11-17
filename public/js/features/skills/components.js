// 기술 목록 (분류별로 접었다 펴는 카드). 홈, 선수 분석, 코치 회원 관리에서 같이 쓴다.
import { state } from '../../core/state.js';
import { esc } from '../../core/ui.js';

export const cat = (k) => state.meta.categories[k] || { label: k, icon: '❔' };
export const masteryBar = (m) => `<div class="mbar"><i style="width:${m}%"></i></div>`;

// opts.coach: 숙련 −5/+5·삭제 버튼 표시 (버튼 동작은 skills/admin.js)
export function skillGroups(skills, opts = {}) {
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
