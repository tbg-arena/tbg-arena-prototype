// 출석 직후 시트: 오늘 배운 주차 + 오늘 한 운동을 그 자리에서 기록 (코치 회원·기술 탭의 출석 버튼)
// '나중에'를 누르면 출석만 된 상태 — 주차는 '배운 것' 탭에서 넣을 수 있다
import { state } from '../../core/state.js';
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';

// r: 출석 응답 (privateMember + lessonLast/lessonNext), gainLine: 출석으로 오른 능력치 안내
export function openTodaySheet(r, gainLine, onChange) {
  const W = state.meta.weeks || [], T = state.meta.trainings || [];
  if (!W.length) return onChange?.();
  let week = r.lessonToday || r.lessonNext || 1, none = false;
  const picked = new Set();
  const last = r.lessonLast ? `지난번 ${r.lessonLast}주 ${esc(W[r.lessonLast - 1]?.title || '')}` : '첫 수업';
  const done = () => { closeModal(); onChange?.(); };

  openModal(`
    <div class="row" style="gap:8px"><span class="lweek">출석 ✓</span><h3 style="margin:0">${esc(r.name)}</h3></div>
    <div class="muted small" style="margin:4px 0 16px">${esc(gainLine.trim())} · ${last}</div>
    <label class="field">오늘 배운 것</label>
    <div class="row lstep"><button class="btn" id="p" aria-label="이전 주차">‹</button>
      <div class="grow lpick" id="box"><span class="lweek" id="lw"></span><b id="lt"></b></div>
      <button class="btn" id="n" aria-label="다음 주차">›</button></div>
    <div class="row" style="margin:8px 0 16px"><span class="grow small" id="sk"></span><button class="btn sm lnone" id="none">진도 안 나감</button></div>
    <label class="field">오늘 한 운동 · 여러 개 선택</label>
    <div class="seg ltrain">${T.map((t) => `<button data-t="${t.id}"><b>${esc(t.label)}</b><span>${statText(t.stats)}</span></button>`).join('')}</div>
    <div class="row" style="margin-top:16px"><button class="btn" id="later">나중에</button><button class="btn primary grow" id="ok"></button></div>`, (el) => {
    const draw = () => {
      el.querySelector('#lw').textContent = `${week}주`;
      el.querySelector('#lt').textContent = W[week - 1]?.title || '';
      el.querySelector('#box').classList.toggle('off', none);
      el.querySelector('#none').classList.toggle('on', none);
      const skill = W[week - 1]?.skill;
      el.querySelector('#sk').textContent = none ? '오늘은 주차를 넣지 않아요 (운동만 기록)' : skill ? `기술 · ${skill}` : '경기 기술 없는 주차 (받은 기록만)';
      el.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', picked.has(b.dataset.t)));
      el.querySelector('#ok').textContent = `저장${none ? '' : ` · ${week}주`}${picked.size ? ` · 운동 ${picked.size}` : ''}`;
    };
    const move = (d) => { week = Math.max(1, Math.min(W.length, week + d)); none = false; draw(); };
    el.querySelector('#p').onclick = () => move(-1);
    el.querySelector('#n').onclick = () => move(1);
    el.querySelector('#none').onclick = () => { none = !none; draw(); };
    el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { picked.has(b.dataset.t) ? picked.delete(b.dataset.t) : picked.add(b.dataset.t); draw(); }));
    el.querySelector('#later').onclick = done;
    el.querySelector('#ok').onclick = () => act(async () => {
      if (none && !picked.size) return done(); // 기록할 게 없으면 그냥 닫기
      await api('POST', `/api/coach/members/${r.id}/today`, { week: none ? null : week, train: [...picked] });
      toast(`${r.name} 오늘 기록 저장!`); done();
    });
    draw();
  });
}

const STAT_KO = { power: '파워', speed: '스피드', stamina: '체력', iq: 'IQ', chin: '맷집' };
const statText = (stats) => Object.keys(stats).map((k) => STAT_KO[k] || k).join(' · ') + ' +';
