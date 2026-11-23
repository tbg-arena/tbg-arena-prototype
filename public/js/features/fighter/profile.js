// 선수 분석 화면 (#/fighter/<id>): 상대 능력치 · 전략 · 배운 기술
import { state } from '../../core/state.js';
import { $app, esc, toast } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { addPage } from '../../core/router.js';
import { fighterCard } from './components.js';
import { skillGroups } from '../skills/components.js';

addPage('fighter', renderFighter);

async function renderFighter(id) {
  state.tab = 'fighter';
  let d;
  try { d = await api('GET', `/api/members/${id}`); } catch (e) { toast(e.message, true); return history.back(); }
  const m = d.member;
  const s = m.strategy;
  $app.innerHTML = `
    <div class="topbar"><span style="width:60px"></span><div class="muted small">상대 분석</div><span style="width:60px"></span></div>
    <div class="page no-tabs">
      ${fighterCard(m)}
      <div class="section-title">기본 전략</div>
      <div class="card small">${esc(s.stance)} · ${esc(s.guard)} · ${esc(s.style)} · ${(s.focus || []).map(esc).join('·')} 공략</div>
      <div class="section-title">배운 기술 (${d.skills.length})</div>
      ${skillGroups(d.skills, { empty: '배운 기술이 없습니다.' })}
      <button class="btn block" id="back" style="margin-top:16px">← 돌아가기</button>
    </div>`;
  document.getElementById('back').onclick = () => history.back();
}
