// Vercel 서버리스 진입점: /api/* 요청을 server.js 의 핸들러로 넘긴다
const { handle } = require('../server');

module.exports = (req, res) => {
  // vercel.json rewrite 로 들어온 경우 원래 경로 복원 (/api?__p=/login → /api/login)
  const url = new URL(req.url, 'http://x');
  const p = url.searchParams.get('__p');
  if (p !== null) {
    url.searchParams.delete('__p');
    req.url = '/api' + p + (url.search || '');
  }
  return handle(req, res);
};
