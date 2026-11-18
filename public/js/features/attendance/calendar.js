// 출석 달력: 회원 '내 수강권'의 접었다 펴는 달력 + 코치 출석 기록 창에서 쓰는 한 달 달력
// days: 출석한 날짜 ['YYYY-MM-DD', …]

export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export const ym = (s) => s.slice(0, 7); // 'YYYY-MM'
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const countIn = (days, month) => days.filter((d) => ym(d) === month).length;

// 한 달 칸 (월요일 시작). opts.editable: 오늘까지 날짜에 data-date (코치가 눌러서 지난 기록 추가·삭제, 오늘 출석 체크·취소), opts.today: 기준 오늘
export function monthGrid(days, month, opts = {}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const blank = (first.getUTCDay() + 6) % 7; // 월요일 시작
  const set = new Set(days), today = opts.today || todayKST();
  const cells = [];
  for (let i = 0; i < blank; i++) cells.push('<i class="blank"></i>');
  for (let d = 1; d <= lastDay; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const clickable = opts.editable && date <= today;
    const edit = clickable ? ` data-date="${date}"` : '';
    const cls = [set.has(date) && 'on', date === today && 'today', opts.editable && (clickable ? 'edit' : 'locked')].filter(Boolean).join(' ');
    cells.push(`<i class="${cls}"${edit}>${d}</i>`);
  }
  return `<div class="cal-week">${['월', '화', '수', '목', '금', '토', '일'].map((w) => `<b>${w}</b>`).join('')}</div><div class="cal-days">${cells.join('')}</div>`;
}

function calBody(days, month) {
  const now = ym(todayKST());
  return `
    <div class="cal-head"><button class="btn sm ghost" data-calmove="-1">◀</button><b class="px">${month.replace('-', '.')}</b><button class="btn sm ghost" data-calmove="1" ${month >= now ? 'disabled' : ''}>▶</button></div>
    ${monthGrid(days, month)}
    <div class="muted small center" style="margin-top:8px">${month === now ? '이번 달' : `${Number(month.slice(5))}월`} 출석 <b style="color:var(--text)">${countIn(days, month)}</b>회</div>`;
}

// 접힌 칸 (처음엔 이번 달)
export function attendCalendar(days) {
  const month = ym(todayKST());
  return `<details class="card att-cal" id="attCal">
      <summary class="row"><div class="grow"><b>출석 기록</b> <span class="muted small">· 이번 달 ${countIn(days, month)}회</span></div><span class="muted chev">▸</span></summary>
      <div class="cal" data-month="${month}">${calBody(days, month)}</div>
    </details>`;
}

// ◀ ▶ 로 달 바꾸기
export function bindAttendCalendar(days) {
  const box = document.querySelector('#attCal .cal');
  if (!box) return;
  const bind = () => box.querySelectorAll('[data-calmove]').forEach((b) => (b.onclick = () => {
    const month = shiftMonth(box.dataset.month, Number(b.dataset.calmove));
    box.dataset.month = month;
    box.innerHTML = calBody(days, month);
    bind();
  }));
  bind();
}
