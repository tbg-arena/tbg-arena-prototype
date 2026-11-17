// 코치 경기 탭: 전체 경기 기록
import { svg } from '../../core/ui.js';
import { api } from '../../core/api.js';
import { coachTab } from '../../core/tabs.js';
import { fightRow } from './components.js';

coachTab({
  id: 'fights', order: 30, label: '경기',
  icon: svg('<path d="M7 4h7a4 4 0 014 4v4a4 4 0 01-4 4H9l-2 4V4z"/><path d="M7 9h6"/>'),
  load: async () => ({ fights: await api('GET', '/api/fights') }),
  view: ({ fights }) => `<div class="section-title">경기 기록</div>${fights.length ? fights.map((f) => fightRow(f)).join('') : '<div class="card empty">경기 기록이 없습니다.</div>'}`,
});
