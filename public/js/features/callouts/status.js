// 콜아웃 상태 배지
export const STATUS = {
  pending_coach: ['코치 승인 대기', 'badge'],
  pending_opponent: ['상대 수락 대기', 'badge blue'], // 예전 데이터 표시용 (상대 수락 단계는 없어짐)
  rejected: ['코치 반려', 'badge'],
  declined: ['상대 거절', 'badge'],
  cancelled: ['취소됨', 'badge'],
  done: ['경기 완료', 'badge green'],
  live: ['경기 중', 'badge red'], // 경기는 치러졌지만 아직 중계를 안 봄
};

export const statusBadge = (c) => { const [t, cls] = STATUS[c.live ? 'live' : c.status]; return `<span class="${cls}">${t}</span>`; };
