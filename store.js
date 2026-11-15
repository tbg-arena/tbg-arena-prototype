// 저장소: Redis(Upstash REST)가 설정돼 있으면 Redis, 아니면 로컬 파일(data/db.json)
// - Vercel 마켓플레이스 Upstash: KV_REST_API_URL / KV_REST_API_TOKEN
// - Upstash 직접 연결:          UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// 경기 중계(events)는 용량이 커서 Redis에서는 경기별 키로 따로 저장한다.
const fs = require('fs');
const path = require('path');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.REDIS_PREFIX || 'tbg';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const empty = () => ({ members: [], skills: [], callouts: [], fights: [], sessions: {} });

async function redis(cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Redis ${cmd[0]} 실패: ${data.error || res.status}`);
  return data.result;
}

const redisStore = {
  kind: 'redis',
  async load() {
    const raw = await redis(['GET', `${PREFIX}:db`]);
    return { ...empty(), ...(raw ? JSON.parse(raw) : {}) };
  },
  async save(db) {
    // 새 경기의 중계 데이터는 경기별 키로 분리
    for (const f of db.fights) {
      if (!f.events) continue;
      await redis(['SET', `${PREFIX}:fight:${f.id}`, JSON.stringify(f.events)]);
      delete f.events;
    }
    await redis(['SET', `${PREFIX}:db`, JSON.stringify(db)]);
  },
  async events(f) {
    if (f.events) return f.events;
    const raw = await redis(['GET', `${PREFIX}:fight:${f.id}`]);
    return raw ? JSON.parse(raw) : [];
  },
};

const fileStore = {
  kind: 'file',
  async load() {
    if (!fs.existsSync(DB_FILE)) return empty();
    try { return { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
    catch (e) { console.error('DB 로드 실패, 새로 시작합니다:', e.message); return empty(); }
  },
  async save(db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  },
  async events(f) { return f.events || []; },
};

// Vercel에서는 파일에 저장할 수 없으므로 Redis가 없으면 원인을 알려준다
const missingStore = {
  kind: 'none',
  async load() { throw new Error('Vercel에 Upstash Redis가 연결되지 않았어요. (KV_REST_API_URL / KV_REST_API_TOKEN 환경변수 없음) 연결 후 Redeploy 해주세요.'); },
  async save() { throw new Error('저장소 없음'); },
  async events() { return []; },
};

module.exports = REDIS_URL && REDIS_TOKEN ? redisStore : process.env.VERCEL ? missingStore : fileStore;
