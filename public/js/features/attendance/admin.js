// 출석 체크 (코치 회원 관리 탭 안의 출석 버튼)
import { toast } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { STAT_LABEL } from '../fighter/components.js';

export const attendButton = (m) => `<button class="btn sm ${m.attended ? '' : 'primary'}" data-attend="${m.id}" ${m.attended ? 'disabled' : ''}>${m.attended ? '출석✓' : '출석'}</button>`;

// onChange: 출석 처리 후 다시 그리기
export function bindAttend(onChange) {
  document.querySelectorAll('[data-attend]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); act(async () => {
    const r = await api('POST', `/api/coach/members/${b.dataset.attend}/attend`);
    const up = Object.entries(r.gains || {}).filter(([, v]) => v > 0).map(([k, v]) => `${STAT_LABEL[k][1]} +${v}`);
    toast(`${r.name} 출석 체크!${up.length ? ' ' + up.join(' · ') : ' 능력치가 조금씩 쌓이고 있어요'}`); onChange();
  }); }));
}
