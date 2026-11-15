// 테스트용 샘플 데이터 — 서버가 켜진 상태에서 실행: npm run seed
// 회원 8명 + 배운 기술 + 출석 + 경기 몇 판 + 대기 중 콜아웃
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const PIN = process.env.COACH_PIN || '1234';

async function api(method, url, body, token) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data.error || ''}`);
  return data;
}

// [이름, 전화번호, 벨트, 전략, 기술[이름, 분류, 숙련, 메모]]
const MEMBERS = [
  ['김도윤', '010-0000-0001', '블루', { stance: '오소독스', guard: '하이가드', style: '인파이팅', focus: ['헤드', '바디'] }, [
    ['잽', 'jab', 55, '기본기 수업'], ['원투', 'jab', 50], ['레프트 훅', 'hook', 38], ['어퍼컷', 'uppercut', 30], ['리버샷', 'body', 28], ['위빙', 'defense', 30],
  ]],
  ['이서준', '010-0000-0002', '퍼플', { stance: '사우스포', guard: '숄더롤', style: '카운터', focus: ['헤드'] }, [
    ['잽', 'jab', 45], ['카운터 훅', 'hook', 42, '카운터 클래스'], ['슬립', 'defense', 44], ['패리', 'defense', 36], ['스트레이트', 'jab', 40],
  ]],
  ['박지호', '010-0000-0003', '퍼플', { stance: '오소독스', guard: '밸런스', style: '인파이팅', focus: ['바디'] }, [
    ['바디 훅', 'body', 48], ['리버샷', 'body', 42], ['숏 어퍼컷', 'uppercut', 40], ['레프트 훅', 'hook', 36], ['더킹', 'defense', 30], ['잽', 'jab', 20],
  ]],
  ['최하은', '010-0000-0004', '블루', { stance: '오소독스', guard: '하이가드', style: '아웃복싱', focus: ['헤드'] }, [
    ['잽', 'jab', 50], ['원투', 'jab', 46], ['더블 잽', 'jab', 40], ['백스텝', 'defense', 38], ['레프트 훅', 'hook', 26],
  ]],
  ['정우진', '010-0000-0005', '브라운', { stance: '오소독스', guard: '밸런스', style: '인파이팅', focus: ['헤드', '바디'] }, [
    ['원투', 'jab', 42], ['레프트 훅', 'hook', 50], ['라이트 어퍼컷', 'uppercut', 44], ['바디 훅', 'body', 40], ['블로킹', 'defense', 40], ['위빙', 'defense', 34],
  ]],
  ['한소율', '010-0000-0006', '화이트', { stance: '오소독스', guard: '하이가드', style: '인파이팅', focus: ['헤드'] }, [
    ['잽', 'jab', 22, '입문 2주차'], ['원투', 'jab', 18],
  ]],
  ['윤태민', '010-0000-0007', '그린', { stance: '사우스포', guard: '숄더롤', style: '카운터', focus: ['헤드', '바디'] }, [
    ['잽', 'jab', 34], ['스트레이트', 'jab', 36], ['카운터 훅', 'hook', 30], ['슬립', 'defense', 32], ['바디 잽', 'body', 24],
  ]],
  ['오세린', '010-0000-0008', '옐로우', { stance: '오소독스', guard: '밸런스', style: '아웃복싱', focus: ['헤드'] }, [
    ['잽', 'jab', 30], ['원투', 'jab', 28], ['훅', 'hook', 20], ['블로킹', 'defense', 22],
  ]],
];

// 미리 치러 둘 경기 [도전자, 상대]
const FIGHTS = [[0, 1], [2, 3], [4, 0], [1, 2], [3, 6], [4, 2], [7, 5], [0, 3]];

(async () => {
  const coach = (await api('POST', '/api/coach/login', { pin: PIN })).token;
  const existing = await api('GET', '/api/coach/members', null, coach);
  const byPhone = Object.fromEntries(existing.map((m) => [m.phone, m]));

  const ids = [], tokens = [];
  for (const [name, phone, belt, strategy, skills] of MEMBERS) {
    const digits = phone.replace(/\D/g, '');
    let m = byPhone[digits];
    if (m) console.log(`· ${name} 이미 있음 — 건너뜀`);
    else {
      m = await api('POST', '/api/coach/members', { name, phone, belt }, coach);
      for (const [sn, category, mastery, desc] of skills) {
        await api('POST', `/api/coach/members/${m.id}/skills`, { name: sn, category, mastery, desc }, coach);
      }
      console.log(`✓ ${name} (${phone}) 기술 ${skills.length}개`);
    }
    ids.push(m.id);
    const t = (await api('POST', '/api/login', { phone })).token;
    tokens.push(t);
    await api('PUT', '/api/me/strategy', strategy, t);
  }
  const fights = await api('GET', '/api/fights', null, coach);
  if (fights.some((f) => ids.includes(f.a) && ids.includes(f.b))) return console.log('\n이미 샘플 경기가 있어 경기/콜아웃 생성은 건너뜁니다.');

  // 출석 (한소율은 출석 안 함 — 출석 체크 테스트용)
  for (let i = 0; i < ids.length; i++) {
    if (i !== 5) await api('POST', `/api/coach/members/${ids[i]}/attend`, null, coach);
  }

  // 경기: 콜아웃 → 코치 승인 → 상대 수락
  for (const [a, b] of FIGHTS) {
    const c = await api('POST', '/api/callouts', { opponentId: ids[b], message: '한판 붙자' }, tokens[a]);
    await api('POST', `/api/coach/callouts/${c.id}`, { approve: true }, coach);
    const done = await api('POST', `/api/callouts/${c.id}/respond`, { accept: true }, tokens[b]);
    const f = await api('GET', `/api/fights/${done.fightId}`, null, coach);
    const w = f.result.winnerId ? (f.result.winnerId === f.a ? f.aName : f.bName) : '무승부';
    console.log(`🥊 ${f.aName} vs ${f.bName} → ${w} (${f.result.method}${f.result.skill ? ' · ' + f.result.skill : ''})`);
  }

  // 대기 중 콜아웃 (흐름 테스트용)
  await api('POST', '/api/callouts', { opponentId: ids[4], message: '지난번 빚 갚으러 간다' }, tokens[3]); // 코치 승인 대기
  const p = await api('POST', '/api/callouts', { opponentId: ids[0], message: '금요일 스파링 어때요?' }, tokens[6]);
  await api('POST', `/api/coach/callouts/${p.id}`, { approve: true }, coach); // 김도윤 수락 대기

  console.log(`
완료!  코치 PIN: ${PIN}
회원 로그인 전화번호: 010-0000-0001 ~ 010-0000-0008
 - 010-0000-0001 김도윤 : 받은 콜아웃(수락 대기) 있음
 - 코치 화면 : 승인 대기 콜아웃 1건 (최하은 → 정우진)
 - 010-0000-0006 한소율 : 오늘 미출석 (출석 체크 테스트)`);
})().catch((e) => { console.error('실패:', e.message, '\n서버가 켜져 있는지 확인하세요 (npm start).'); process.exit(1); });
