// 화면끼리 같이 쓰는 상태: 로그인 정보, 현재 탭, 서버 설정값(/api/meta), 타이머
export const state = {
  token: localStorage.getItem('tbg_token'),
  role: localStorage.getItem('tbg_role'),
  tab: null, me: null, meta: null,
  pollTimer: null, playTimer: null,
};
