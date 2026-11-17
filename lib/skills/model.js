// 기술: 회원이 배운 기술 목록 (다른 기능에서도 가져다 쓰는 함수)
// 기술 분류(CATEGORIES)·세부 기술(MOVES) 정의는 경기 엔진(fights/engine.js)에 있다.
const { db } = require('../core/db');

const skillsOf = (id) => db.skills.filter((s) => s.memberId === id);

module.exports = { skillsOf };
