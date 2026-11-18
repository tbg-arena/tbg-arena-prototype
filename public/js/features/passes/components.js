// 수강권 표시 (회원 홈 · 내 수강권 · 코치 회원 관리에서 같이 쓴다)
import { esc } from '../../core/ui.js';

export const STATUS_LABEL = { active: '사용 중', scheduled: '예정', expired: '기간 만료', usedUp: '횟수 소진' };
export const dday = (n) => (n === 0 ? 'D-DAY' : `D-${n}`);
export const shortDate = (s) => String(s).replace(/-/g, '.'); // 2026-11-18 → 2026.11.18

// 한 줄 요약: 주3회 3개월 · 이번 주 1/3회 · 전체 28회 남음 · D-41
export const passLine = (p) => `${esc(p.name)} · 이번 주 ${p.weekLeft}/${p.perWeek}회 · 전체 ${p.left}회 남음 · ${dday(p.daysLeft)}`;

// 이번 주 남은 횟수 칸 (흰 칸 = 남은 횟수)
export const weekDots = (p) => `<span class="wdots">${Array.from({ length: p.perWeek }, (_, i) => `<i class="${i < p.weekLeft ? 'on' : ''}"></i>`).join('')}</span>`;

// ── 날짜 (서버 lib/passes/model.js 와 같은 규칙 — 코치 등록 창 미리보기용)
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const toDate = (s) => new Date(s + 'T00:00:00Z');
const fmt = (d) => d.toISOString().slice(0, 10);
export function endOf(start, months) {
  const d = toDate(start), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  if (day > last) return fmt(d);        // 다음 달에 같은 날이 없으면 그 달 말일까지
  d.setUTCDate(d.getUTCDate() - 1);     // 11/18 시작 1개월 → 12/17 까지
  return fmt(d);
}
