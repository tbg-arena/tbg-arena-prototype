// 출석 달력: 회원 '출석' 화면 · 코치 출석 기록 창에서 쓰는 한 달 달력 (보기만, ◀ ▶ 로 달 이동)
// days: 출석한 날짜 ['YYYY-MM-DD', …]

export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export const ym = (s) => s.slice(0, 7); // 'YYYY-MM'
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const countIn = (days, month) => days.filter((d) => ym(d) === month).length;

// 이번 주(월~일) 출석 횟수
export function weekCount(days, today = todayKST()) {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const mon = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  const sun = d.toISOString().slice(0, 10);
  return days.filter((x) => x >= mon && x <= sun).length;
}

// 한 달 칸 (월요일 시작)
export function monthGrid(days, month, today = todayKST()) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const blank = (first.getUTCDay() + 6) % 7; // 월요일 시작
  const set = new Set(days);
  const cells = [];
  for (let i = 0; i < blank; i++) cells.push('<i class="blank"></i>');
  for (let d = 1; d <= lastDay; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const cls = [set.has(date) && 'on', date === today && 'today'].filter(Boolean).join(' ');
    cells.push(`<i class="${cls}">${d}</i>`);
  }
  return `<div class="cal-week">${['월', '화', '수', '목', '금', '토', '일'].map((w) => `<b>${w}</b>`).join('')}</div><div class="cal-days">${cells.join('')}</div>`;
}

function calBody(days, month, today) {
  const now = ym(today);
  return `
    <div class="cal-head"><button class="btn sm ghost" data-calmove="-1" aria-label="이전 달">◀</button><b class="px">${month.replace('-', '.')}</b><button class="btn sm ghost" data-calmove="1" aria-label="다음 달" ${month >= now ? 'disabled' : ''}>▶</button></div>
    ${monthGrid(days, month, today)}
    <div class="muted small center" style="margin-top:8px">${month === now ? '이번 달' : `${Number(month.slice(5))}월`} 출석 <b style="color:var(--text)">${countIn(days, month)}</b>회</div>`;
}

// 달력 칸 (처음엔 이번 달). bindAttendCalendar 로 ◀ ▶ 연결
export const attendCalendar = (days, today = todayKST()) => `<div class="cal" data-month="${ym(today)}">${calBody(days, ym(today), today)}</div>`;

// root: attendCalendar 를 넣은 요소 (화면 · 모달)
export function bindAttendCalendar(root, days, today = todayKST()) {
  const box = root.querySelector('.cal');
  if (!box) return;
  const bind = () => box.querySelectorAll('[data-calmove]').forEach((b) => (b.onclick = () => {
    box.dataset.month = shiftMonth(box.dataset.month, Number(b.dataset.calmove));
    box.innerHTML = calBody(days, box.dataset.month, today);
    bind();
  }));
  bind();
}
