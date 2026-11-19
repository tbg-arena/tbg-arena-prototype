// 출석 체크 (코치 회원 관리 탭 안의 출석 버튼) + 지난 출석 기록 정리 (달력)
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { STAT_LABEL } from '../fighter/components.js';
import { openPassRegister } from '../passes/coach.js';
import { openTodaySheet } from '../lessons/sheet.js';
import { monthGrid, shiftMonth, ym, countIn } from './calendar.js';

export const attendButton = (m) => `<button class="btn sm ${m.attended ? '' : 'primary'}" data-attend="${m.id}" ${m.attended ? 'disabled' : ''}>${m.attended ? '출석✓' : '출석'}</button>`;

// 출석으로 오른 능력치 안내 (예: ' 파워 +1 · 체력 +1')
const gainText = (gains) => {
  const up = Object.entries(gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_LABEL[k]?.[1] || k} +${v}`);
  return up.length ? ' ' + up.join(' · ') : ' 능력치가 조금씩 쌓이고 있어요';
};

// 오늘 출석 체크 (출석 버튼 · 출석 기록 달력의 오늘 칸에서 같이 씀). 성공하면 응답, 막히면 null
// 출석은 수강권이 있어야 가능: 수강권이 없으면 등록 창으로, 이번 주 횟수를 다 썼으면 안내만
// m: 코치 회원 목록의 회원 (수강권 등록 창을 열 때 씀, 없을 수 있음)
async function attendToday(id, m, onChange) {
  let r;
  try { r = await api('POST', `/api/coach/members/${id}/attend`); }
  catch (err) {
    if (err.data?.code === 'NO_PASS' && m) {
      if (confirm(`${err.message}

지금 수강권을 등록할까요?`)) openPassRegister(m, onChange);
      return null;
    }
    throw err; // 이번 주 횟수 다 씀 등은 토스트로 안내
  }
  toast(`${r.name} 출석 체크!${gainText(r.gains)}`); onChange?.();
  return r;
}

// onChange: 출석 처리 후 다시 그리기, members: 코치 회원 목록
// 출석 버튼은 출석 뒤 바로 '오늘 배운 것 · 운동' 시트를 연다 (다시 그리기는 시트를 닫을 때)
export function bindAttend(onChange, members = []) {
  document.querySelectorAll('[data-attend]').forEach((b) => (b.onclick = (e) => {
    e.preventDefault();
    act(async () => {
      const r = await attendToday(b.dataset.attend, members.find((x) => x.id === b.dataset.attend), onChange);
      if (r) await openTodaySheet(r, gainText(r.gains), onChange);
    });
  }));
}

// ── 출석 기록 달력 (전날 출석 · 기능 도입 전 출석 맞추기 · 오늘 출석 체크/취소)
// 지난 날짜 누르기 = 그날 출석 체크 (누적 · 능력치 · 코인 · 수강권 차감)
// 오늘 칸 = 출석 버튼과 같음. 출석한 날 다시 누르기 = 그 출석 삭제 (누적 · 코인 · 그날 오른 능력치 · 수강권 모두 되돌림)
export const attendLogButton = (m) => `<button class="btn sm" data-attendlog="${m.id}">출석 기록</button>`; // 수강권 칸 안에 들어감

async function openAttendLog(m, onChange) {
  let { days, today } = await api('GET', `/api/coach/members/${m.id}/attendance`);
  let month = ym(today);
  openModal(`<h3>${esc(m.name)} · 출석 기록</h3>
    <div class="cal" id="logCal"></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button></div>`, (el) => {
    const box = el.querySelector('#logCal');
    // 이번 주(월~일) 출석 횟수 — 수강권이 있으면 주 N회와 함께
    const weekStart = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
    const weekEnd = (() => { const d = new Date(weekStart + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })();
    const perWeek = m.pass?.perWeek;
    const draw = () => {
      const week = days.filter((d) => d >= weekStart && d <= weekEnd).length;
      box.innerHTML = `<div class="att-week">이번 주 출석 <b class="px">${week}</b>${perWeek ? ` / 주${perWeek}회` : '회'} <span class="muted small">(${weekStart.slice(5).replace('-', '.')} ~ ${weekEnd.slice(5).replace('-', '.')})</span></div>
        <div class="cal-head"><button class="btn sm ghost" data-calmove="-1">◀</button><b class="px">${month.replace('-', '.')}</b><button class="btn sm ghost" data-calmove="1" ${month >= ym(today) ? 'disabled' : ''}>▶</button></div>
        ${monthGrid(days, month, { editable: true, today })}
        <div class="muted small center" style="margin-top:8px">${Number(month.slice(5))}월 출석 <b style="color:var(--text)">${countIn(days, month)}</b>회</div>`;
      box.querySelectorAll('[data-calmove]').forEach((b) => (b.onclick = () => { month = shiftMonth(month, Number(b.dataset.calmove)); draw(); }));
      box.querySelectorAll('[data-date]').forEach((c) => (c.onclick = () => act(async () => {
        const date = c.dataset.date, had = days.includes(date), isToday = date === today;
        if (isToday && !had) { // 오늘 출석 체크 = 출석 버튼과 똑같음 (능력치 · 코인 · 수강권 차감, 수강권 없으면 등록 안내)
          if (!confirm('오늘 출석 체크할까요? 출석 버튼과 같아요 (능력치 상승 · 출석 코인 · 수강권 1회 차감).')) return;
          if (!(await attendToday(m.id, m, onChange))) return; // 수강권 없음 → 등록 창으로 넘어감
          ({ days } = await api('GET', `/api/coach/members/${m.id}/attendance`));
          return draw();
        }
        if (had && !confirm(`${isToday ? '오늘' : date} 출석을 지울까요? 누적 출석 · 출석 코인 · 수강권 1회 · 그날 오른 능력치가 되돌아가요.`)) return;
        const r = had ? await api('DELETE', `/api/coach/members/${m.id}/attendance/${date}`) : await api('POST', `/api/coach/members/${m.id}/attendance`, { date });
        ({ days } = r);
        toast(had ? (isToday ? '오늘 출석을 취소했어요.' : `${date} 출석을 지웠어요.`) : `${date} 출석 체크!${gainText(r.gains)}`);
        draw(); onChange?.();
      })));
    };
    draw();
    el.querySelector('#x').onclick = closeModal;
  });
}

// members: 코치 회원 목록, onChange: 바뀐 뒤 다시 그리기
export function bindAttendLog(members, onChange) {
  document.querySelectorAll('[data-attendlog]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(() => openAttendLog(members.find((x) => x.id === b.dataset.attendlog), onChange)); }));
}
