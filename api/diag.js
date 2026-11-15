// 임시 진단용: 함수 실행 환경과 server.js 로드 오류 확인 (원인 확인 후 삭제)
module.exports = async (req, res) => {
  const out = {
    node: process.version,
    vercel: !!process.env.VERCEL,
    env: Object.keys(process.env).filter((k) => /KV_|UPSTASH|REDIS|COACH_PIN/.test(k)).sort(),
    url: req.url,
  };
  try { require('../server'); out.serverLoad = 'ok'; }
  catch (e) { out.serverLoad = String(e && e.stack || e).slice(0, 1500); }
  try {
    const store = require('../store');
    out.store = store.kind;
    if (store.kind === 'redis') { await store.load(); out.storeLoad = 'ok'; }
  } catch (e) { out.storeLoad = String(e && e.message || e).slice(0, 500); }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out, null, 2));
};
