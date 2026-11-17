// 경기 기록 한 줄 · 시간/결과 표기 (커리어 탭, 코치 경기 탭, 중계 화면)
import { esc, ago } from '../../core/ui.js';

export const clock = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
export const methodText = (r) => (r.method === '판정' ? `${r.detail} 판정` : `${r.method} · ${r.round}R ${clock(r.time)}`);

// myId 가 있으면 그 회원 기준 (vs 상대 · WIN/LOSE), 없으면 코치용 (A vs B · 승자)
export function fightRow(f, myId) {
  const r = f.result;
  let badge;
  if (myId) {
    const opp = f.a === myId ? f.bName : f.aName;
    if (f.hidden) return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
      <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">vs ${esc(opp)}</div><div class="muted small">결과는 중계를 보면 공개 · ${ago(f.createdAt)}</div></div>
      <span class="badge red">경기 중</span></div>`;
    badge = !r.winnerId ? '<span class="badge">DRAW</span>' : r.winnerId === myId ? '<span class="badge solid">WIN</span>' : '<span class="badge red">LOSE</span>';
    const d = f.delta?.[myId];
    return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
      <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">vs ${esc(opp)}</div><div class="muted small">${methodText(r)} · ${ago(f.createdAt)}</div></div>
      <div class="center">${badge}${d != null ? `<div class="small ${d >= 0 ? 'delta-up' : 'delta-down'}">${d >= 0 ? '+' : ''}${d}</div>` : ''}</div></div>`;
  }
  if (f.hidden) return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
    <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">${esc(f.aName)} vs ${esc(f.bName)}</div><div class="muted small">결과는 중계를 보면 공개 · ${ago(f.createdAt)}</div></div>
    <span class="badge red">경기 중</span></div>`;
  const w = r.winnerId ? (r.winnerId === f.a ? f.aName : f.bName) : null;
  return `<div class="list-item" data-go="#/fight/${f.id}" style="cursor:pointer">
    <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">${esc(f.aName)} vs ${esc(f.bName)}</div><div class="muted small">${methodText(r)} · ${ago(f.createdAt)}</div></div>
    <span class="badge ${w ? 'green' : ''}">${w ? esc(w) + ' 승' : '무승부'}</span></div>`;
}
