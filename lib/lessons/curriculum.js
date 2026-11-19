// 주차별 수업 (루트의 '주차 별 기술 습득 .csv' 31주). 주차를 넣으면 skill 이 회원 기술로 들어간다.
// skill: [기술 이름, 분류, 세부 기술] — 분류·세부 기술은 fights/engine.js 의 CATEGORIES · MOVES
// null = 경기 기술이 없는 주차 (스텝 · 이해 · 스파링) → 받은 기록만 남는다
const WEEKS = [
  ['잽·스트레이트', ['원투', 'jab', 'onetwo']],
  ['워킹스텝', null],
  ['점프 스텝', null],
  ['훅', ['훅', 'hook', 'hook']],
  ['어퍼컷', ['어퍼컷', 'uppercut', 'uppercut']],
  ['디펜스 가드', ['가드', 'defense', 'block']],
  ['슬립', ['슬립', 'defense', 'slip']],
  ['스웨이', ['스웨이', 'defense', 'back']], // 게임에 스웨이 동작이 없어 뒤로 빠지는 백스텝으로
  ['숄더롤', ['숄더롤', 'defense', 'roll']],
  ['위빙', ['위빙', 'defense', 'weave']],
  ['블락', ['블로킹', 'defense', 'block']],
  ['바디샷', ['바디 훅', 'body', 'bodyhook']],
  ['버티컬 훅', ['버티컬 훅', 'hook', 'shorthook']],
  ['L 스텝', null],
  ['피벗 스텝', null],
  ['사이드 스텝', null],
  ['바디 잽', ['바디 잽', 'body', 'bodystraight']],
  ['바디 스트레이트', ['바디 스트레이트', 'body', 'bodystraight']],
  ['오버 핸드 훅', ['오버핸드', 'hook', 'overhand']],
  ['체크 훅', ['체크 훅', 'hook', 'hook']],
  ['패링', ['패링', 'defense', 'parry']],
  ['더킹', ['더킹', 'defense', 'duck']],
  ['딥 (디펜스)', ['딥', 'defense', 'duck']],
  ['범퍼 (디펜스)', ['범퍼', 'defense', 'block']],
  ['클린치의 이해', null],
  ['스파링 (링 컷팅)', null],
  ['인파이팅의 이해', null],
  ['아웃복싱의 이해', null],
  ['가드·스탠스 선택', null],
  ['더블 펀치', ['더블 펀치', 'jab', 'double']],
  ['핀·블라인드', ['핀·블라인드', 'jab', 'jab']],
].map(([title, skill], i) => ({ week: i + 1, title, skill }));

module.exports = { WEEKS };
