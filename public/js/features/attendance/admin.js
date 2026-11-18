// 출석 체크 (코치 회원 관리 탭 안의 출석 버튼)
import { toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { STAT_LABEL } from '../fighter/components.js';
import { openPassRegister } from '../passes/coach.js';

export const attendButton = (m) => `<button class="btn sm ${m.attended ? '' : 'primary'}" data-attend="${m.id}" ${m.attended ? 'disabled' : ''}>${m.attended ? '출석✓' : '출석'}</button>`;

// onChange: 출석 처리 후 다시 그리기, members: 코치 회원 목록 (수강권 등록 창을 열 때 씀)
// 출석은 수강권이 있어야 가능: 수강권이 없으면 등록 창으로, 이번 주 횟수를 다 썼으면 안내만
export function bindAttend(onChange, members = []) {
  document.querySelectorAll('[data-attend]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(async () => {
    let r;
    try { r = await api('POST', `/api/coach/members/${b.dataset.attend}/attend`); }
    catch (err) {
      const m = members.find((x) => x.id === b.dataset.attend);
      if (err.data?.code === 'NO_PASS' && m) {
        if (confirm(`${err.message}

지금 수강권을 등록할까요?`)) openPassRegister(m, onChange);
        return;
      }
      throw err; // 이번 주 횟수 다 씀 등은 토스트로 안내
    }
    const up = Object.entries(r.gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_LABEL[k][1]} +${v}`);
    toast(`${r.name} 출석 체크!${up.length ? ' ' + up.join(' · ') : ' 능력치가 조금씩 쌓이고 있어요'}`); onChange();
  }); }));
}
