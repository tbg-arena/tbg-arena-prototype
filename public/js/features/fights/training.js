import { esc } from '../../core/ui.js';

// 커리어 탭 맨 위 '내 훈련' 카드: 체육관에서 실제로 한 것(이번 주 출석 · 커리큘럼 · 최근 배운 기술)
// 커리큘럼 주차 수는 코치가 늘릴 수 있어서 칸 게이지 없이 숫자와 다음 수업만 보여 준다
const DAY = 864e5;
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 서버와 같은 KST 날짜
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const mondayOf = (d) => addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7));

export function trainingCard(me, days, weeks) {
  const m = me.member;
  const today = kstToday();
  const set = new Set(days);
  // 이번 주 (월~일) 출석 칸
  const mon = mondayOf(today);
  const week = [...Array(7)].map((_, i) => addDays(mon, i));
  const thisWeek = week.filter((d) => set.has(d)).length;
  // 연속 주: 이번 주(아직 안 나왔으면 지난주)부터 거꾸로, 한 번이라도 나온 주가 이어진 수
  const weekHas = (start) => [...Array(7)].some((_, i) => set.has(addDays(start, i)));
  let streak = 0;
  for (let w = thisWeek ? mon : addDays(mon, -7); weekHas(w); w = addDays(w, -7)) streak++;
  // 커리큘럼 진도
  const total = weeks.length;
  const done = Math.min(m.lessonLast || 0, total);
  const next = total ? weeks[Math.min(m.lessonNext || 1, total) - 1] : null;
  // 최근 배운 기술 (등록된 날 기준 최신 3개, 7일 안이면 NEW)
  const recent = me.skills.filter((x) => x.createdAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const ago = (t) => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`; };
  const state = m.attended ? '오늘 출석 완료' : '오늘은 아직';
  return `
    <div class="card training">
      <div class="tr-top">
        <div><h2>이번 주 훈련</h2><div class="muted small">${state} · 누적 ${m.attendCount}회</div></div>
        <div class="tr-big"><b>${thisWeek}</b><span>이번 주 출석</span></div>
      </div>

      <div class="tr-block" data-go="#/passes">
        <div class="row tr-head"><b>출석</b><span class="grow"></span>${streak >= 2 ? `<span class="badge solid">${streak}주 연속</span>` : ''}</div>
        <div class="tr-week">${week.map((d, i) => `<div class="${set.has(d) ? 'on' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}"><i></i><span>${'월화수목금토일'[i]}</span></div>`).join('')}</div>
      </div>

      ${total ? `<div class="tr-block">
        <div class="row tr-head"><b>커리큘럼</b><span class="grow"></span><span class="px tr-num">${done ? `${done}<small>주째</small>` : '<small>시작 전</small>'}</span>${m.laps ? `<span class="badge red">완주 ×${m.laps}</span>` : ''}</div>
        ${next ? `<div class="small"><span class="muted">다음 수업</span> <b>${next.week}주 · ${esc(next.title || '')}</b>${next.skill ? ` <span class="muted">— ${esc(next.skill)} 배워요</span>` : ''}</div>` : ''}
      </div>` : ''}

      <div class="tr-block">
        <div class="row tr-head"><b>최근 배운 기술</b><span class="grow"></span><span class="muted small">전체 ${me.skills.length}개</span></div>
        ${recent.length ? `<div class="tr-skills">${recent.map((x) => `<span class="tr-skill">${esc(x.name)} <small>${ago(x.createdAt)}</small>${Date.now() - x.createdAt < 7 * DAY ? ' <em class="px">NEW</em>' : ''}</span>`).join('')}</div>`
          : '<div class="muted small">수업에서 배운 기술을 코치가 넣어 주면 여기 쌓여요</div>'}
      </div>
    </div>`;
}
