// HTTP 유틸: JSON 응답, 요청 본문 읽기, 정적 파일
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// 배포 버전: 앱이 이 값이 바뀐 걸 보면 새 코드로 다시 불러온다 (열어 둔 옛 화면 + 새 서버 조합 방지)
// (Vercel에서 배포 ID를 못 읽으면 끔: 인스턴스마다 값이 달라 계속 새로고침되는 것 방지)
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || (process.env.VERCEL ? '' : String(Date.now()));
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(APP_VERSION ? { 'X-App-Version': APP_VERSION } : {}) });
  res.end(JSON.stringify(data));
}
const fail = (res, status, msg) => send(res, status, { error: msg });

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })() : req.body || {});
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) return fail(res, 404, 'not found');
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(idx);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

module.exports = { send, fail, readBody, serveStatic };
