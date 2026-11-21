// 컨디셔닝 기록 목록 (회원 탭 · 코치 탭이 같이 쓴다)
import { esc } from '../../core/ui.js';

const WD = '일월화수목금토';
export const dayLabel = (d) => { const t = new Date(d + 'T00:00:00Z'); return `${t.getUTCMonth() + 1}.${t.getUTCDate()} ${WD[t.getUTCDay()]}`; };
export const kgText = (kg) => (kg ? `${String(kg).replace(/\.0$/, '')}kg` : '맨몸');
// "12kg × 10회 × 3세트" (횟수 없으면 빼고, 맨몸이면 '맨몸')
export const setText = (e) => [kgText(e.kg), e.reps ? `${e.reps}회` : null, `${e.sets}세트`].filter(Boolean).join(' × ');

// entries: 최신순 기록. opts.coach: 줄마다 삭제 버튼 / opts.filter: 이 종목만
export function historyList(entries, opts = {}) {
  const list = opts.filter ? entries.filter((e) => e.exercise === opts.filter) : entries;
  if (!list.length) return `<div class="card empty">${opts.empty || '아직 기록이 없어요.'}</div>`;
  const days = [];
  for (const e of list) {
    if (!days.length || days[days.length - 1].day !== e.day) days.push({ day: e.day, items: [] });
    days[days.length - 1].items.push(e);
  }
  return days.map((d) => `
    <div class="cd-day">
      <div class="cd-day-head"><b class="px">${dayLabel(d.day)}</b><span class="muted small">${d.items.length}종목 · ${d.items.reduce((s, e) => s + e.sets, 0)}세트</span></div>
      ${d.items.map((e) => `
      <div class="cd-row">
        <div class="grow" style="min-width:0">
          <div class="cd-name">${esc(e.exercise)}${e.mark === 'pr' ? ' <span class="badge gold">최고 기록</span>' : e.mark === 'first' ? ' <span class="badge line">첫 기록</span>' : ''}</div>
          ${e.memo ? `<div class="muted small ellipsis">${esc(e.memo)}</div>` : ''}
        </div>
        <div class="cd-set px">${setText(e)}</div>
        ${opts.coach ? `<button class="btn sm ghost" data-cddel="${e.id}" aria-label="${esc(e.exercise)} 기록 삭제">✕</button>` : ''}
      </div>`).join('')}
    </div>`).join('');
}
