// 선수 카드 · 능력치 막대 (홈, 선수 분석, 코치 회원 관리에서 같이 쓴다)
import { esc, sprite, record } from '../../core/ui.js';

export const STAT_LABEL = { power: ['PWR', '파워'], speed: ['SPD', '스피드'], stamina: ['STA', '체력'], iq: ['IQ', 'IQ'], chin: ['DEF', '맷집'] };

// 막대 기준: 100 고정이면 초반(10 안팎)엔 막대가 거의 비어 보여서, 가장 높은 능력치보다 한 단계 위(10 단위, 최소 20)로 잡는다
export function statBars(stats) {
  const top = Math.max(...Object.keys(STAT_LABEL).map((k) => stats[k] || 0));
  const cap = Math.min(100, Math.max(20, Math.ceil((top + 1) / 10) * 10));
  return `<div class="stat-grid">${Object.entries(STAT_LABEL).map(([k, [ic, lb]]) => `
    <div class="statrow"><span class="sl"><i>${ic}</i>${lb}</span><div class="sbar"><i style="width:${Math.min(100, (stats[k] / cap) * 100)}%"></i></div><b>${stats[k]}</b></div>`).join('')}</div>`;
}

export function fighterCard(m, opts = {}) {
  return `
    <div class="card profile">
      <div class="p-head">
        <div class="sprite-box"><img src="${sprite(m, { pose: 'idle', scale: 2 })}" alt="" /></div>
        <div class="grow" style="min-width:0">
          ${m.streak >= 2 ? `<div class="small" style="margin-bottom:8px"><span class="badge red">${m.streak} WIN STREAK</span></div>` : ''}
          <div class="name ellipsis">${esc(m.name)}</div>
          <div class="small">${record(m)} <span class="muted">· KO/TKO ${m.kos}</span></div>
        </div>
        <div class="cp"><span>POWER</span><b>${m.power}</b></div>
      </div>
      <div class="p-body">
      ${m.titles?.length || m.laps ? `<div class="titles">${m.laps ? `<span class="badge red">31주 완주${m.laps > 1 ? ` ×${m.laps}` : ''}</span>` : ''}${(m.titles || []).map((t) => `<span class="badge solid">${esc(t)} 마스터</span>`).join('')}</div>` : ''}
      ${statBars(m.stats)}
      <div class="row small muted" style="margin-top:12px"><span class="grow">랭킹 포인트 <b class="px" style="color:var(--text)">${m.points}</b></span><span>팬 <b class="px" style="color:var(--text)">${m.fans}</b></span></div>
      </div>
    </div>`;
}
