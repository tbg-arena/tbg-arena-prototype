// 코치 회원 관리 탭: 회원 등록·수정·삭제 + (출석 버튼, 수강권, 기술 관리는 각 기능 파일에서)
import { esc, svg, avatar, fmtPhone, record, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { coachTab, renderCoach } from '../../core/tabs.js';
import { STAT_LABEL } from '../fighter/components.js';
import { skillGroups } from '../skills/components.js';
import { addSkillButton, bindSkillAdmin } from '../skills/admin.js';
import { attendButton, bindAttend } from '../attendance/admin.js';
import { passBadge, passBlock, bindPassAdmin } from '../passes/coach.js';

coachTab({
  id: 'members', order: 20, label: '회원·기술',
  icon: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>'),
  poll: false, // 펼쳐 둔 회원·입력 중인 폼이 4초마다 닫히지 않도록
  load: async () => ({ members: await api('GET', '/api/coach/members') }),
  view: ({ members }) => membersView(members),
  bind: ({ members }) => {
    bindMemberActions(members);
    bindAttend(refreshMembers, members);
    bindPassAdmin(members, refreshMembers);
    bindSkillAdmin(members, refreshMembers);
  },
});

function membersView(members) {
  return `
        <button class="btn primary block" id="addMember">＋ 회원 등록</button>
        <div class="section-title">회원 (${members.length}) · 오늘 출석 ${members.filter((m) => m.attended).length}명</div>
        ${members.length ? members.map((m) => `
          <details class="card member" data-mid="${m.id}">
            <summary class="row">${avatar(m)}
              <div class="grow" style="min-width:0"><div style="font-weight:800" class="ellipsis">${esc(m.name)}</div>
                <div class="muted small">${fmtPhone(m.phone)} · 전투력 ${m.power} · 기술 ${m.skills.length}</div>${passBadge(m)}</div>
              ${attendButton(m)}</summary>
            <div style="margin-top:12px">
              ${passBlock(m)}
              ${statSliders(m)}
              <div class="muted small" style="margin:8px 0">${record(m)} · 누적 출석 ${m.attendCount}</div>
              <div class="row" style="margin:12px 0 8px">
                ${addSkillButton(m)}
                <button class="btn" data-edit="${m.id}">수정</button>
                <button class="btn ghost" data-delmember="${m.id}" data-name="${esc(m.name)}">삭제</button>
              </div>
              ${skillGroups(m.skills, { coach: true, open: true, empty: '등록된 기술이 없습니다. 수업에서 배운 기술을 등록해 주세요.' })}
            </div>
          </details>`).join('') : '<div class="card empty">등록된 회원이 없습니다.</div>'}`;
}

function memberForm(m = {}) {
  return `
    <div class="stack">
      <div><label class="field">이름</label><input id="f-name" maxlength="20" value="${esc(m.name || '')}" placeholder="홍길동" /></div>
      <div><label class="field">전화번호 (로그인용)</label><input id="f-phone" type="tel" inputmode="numeric" maxlength="13" value="${m.phone ? fmtPhone(m.phone) : ''}" placeholder="010-0000-0000" /></div>
      <div><label class="field">성별 (캐릭터)</label><div class="seg two" id="f-gender">${[['M', '남자'], ['F', '여자']].map(([g, t]) => `<button type="button" data-g="${g}" class="${(m.gender || 'M') === g ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    </div>`;
}

// 코치용 능력치 막대: 끌어서 조절, 손 떼면 저장
function statSliders(m) {
  return `<div class="stat-grid">${Object.entries(STAT_LABEL).map(([k, [ic, lb]]) => `
    <label class="statrow"><span class="sl"><i>${ic}</i>${lb}</span><input type="range" min="0" max="100" value="${m.stats[k]}" data-stat="${k}" data-sid="${m.id}" aria-label="${lb}" /><b>${m.stats[k]}</b></label>`).join('')}</div>`;
}

// 펼쳐진 회원 유지하며 다시 그리기
async function refreshMembers() {
  const open = [...document.querySelectorAll('details.member[open]')].map((d) => d.dataset.mid);
  const y = window.scrollY;
  await renderCoach('members');
  open.forEach((id) => document.querySelector(`[data-mid="${id}"]`)?.setAttribute('open', ''));
  window.scrollTo(0, y);
}

function bindMemberActions(members) {
  const byId = (id) => members?.find((m) => m.id === id);
  const phoneFmt = (el) => {
    const p = el.querySelector('#f-phone'); p.oninput = () => (p.value = fmtPhone(p.value));
    el.querySelectorAll('#f-gender button').forEach((b) => (b.onclick = () => el.querySelectorAll('#f-gender button').forEach((x) => x.classList.toggle('on', x === b))));
  };
  const genderVal = (el) => el.querySelector('#f-gender button.on')?.dataset.g || 'M';

  const addBtn = document.getElementById('addMember');
  if (addBtn) addBtn.onclick = () => openModal(`<h3>회원 등록</h3>${memberForm()}
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">등록</button></div>`, (el) => {
    phoneFmt(el);
    el.querySelector('#x').onclick = closeModal;
    el.querySelector('#ok').onclick = () => act(async () => {
      await api('POST', '/api/coach/members', { name: el.querySelector('#f-name').value, phone: el.querySelector('#f-phone').value, gender: genderVal(el) });
      closeModal(); toast('회원이 등록되었습니다.'); refreshMembers();
    });
  });
  document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const m = byId(b.dataset.edit);
    openModal(`<h3>회원 수정</h3>${memberForm(m)}
      <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button><button class="btn primary grow" id="ok">저장</button></div>`, (el) => {
      phoneFmt(el);
      el.querySelector('#x').onclick = closeModal;
      el.querySelector('#ok').onclick = () => act(async () => {
        await api('PUT', `/api/coach/members/${m.id}`, { name: el.querySelector('#f-name').value, phone: el.querySelector('#f-phone').value, gender: genderVal(el) });
        closeModal(); toast('저장되었습니다.'); refreshMembers();
      });
    });
  }));
  document.querySelectorAll('[data-stat]').forEach((r) => {
    r.oninput = () => (r.nextElementSibling.textContent = r.value);
    r.onchange = () => act(async () => {
      await api('PUT', `/api/coach/members/${r.dataset.sid}`, { stats: { [r.dataset.stat]: r.value } });
      refreshMembers(); // 전투력 표시 갱신
    });
  });
  document.querySelectorAll('[data-delmember]').forEach((b) => (b.onclick = () => act(async () => {
    if (!confirm(`${b.dataset.name} 회원을 삭제할까요? 기술과 기록도 함께 사라집니다.`)) return;
    await api('DELETE', `/api/coach/members/${b.dataset.delmember}`); toast('삭제되었습니다.'); refreshMembers();
  })));
}
