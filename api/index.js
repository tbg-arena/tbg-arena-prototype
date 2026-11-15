// Vercel 서버리스 진입점: /api/* 요청을 server.js 의 핸들러로 넘긴다
let handle = null;
let loadError = null;
try { ({ handle } = require('../server')); }
catch (e) { loadError = e; console.error('server.js 로드 실패', e); }

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: `서버 로드 실패: ${String(loadError && loadError.message || loadError)}`, node: process.version }));
  }
  // vercel.json rewrite 로 들어온 경우 원래 경로 복원 (/api?__p=/login → /api/login)
  const url = new URL(req.url, 'http://x');
  const p = url.searchParams.get('__p');
  if (p !== null) {
    url.searchParams.delete('__p');
    req.url = '/api' + p + (url.search || '');
  }
  return Promise.resolve(handle(req, res)).catch((e) => {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json; charset=utf-8'); }
    res.end(JSON.stringify({ error: `처리 실패: ${e.message}` }));
  });
};
