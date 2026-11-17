// GET /api/meta: 화면에서 쓰는 설정값 (기술 분류, 전략 선택지 …)
// 각 기능의 routes.js 가 addMeta({ 이름: 값 }) 로 자기 값을 보탠다.
const { route } = require('./router');
const { send } = require('./http');

const meta = {};
const addMeta = (values) => { Object.assign(meta, values); };

route('GET', '/api/meta', null, async (req, res) => {
  send(res, 200, meta);
});

module.exports = { addMeta };
