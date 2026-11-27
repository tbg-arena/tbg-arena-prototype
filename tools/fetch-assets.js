// 배포 빌드 때 유료 · 체험판 에셋을 비공개 저장소에서 받아 public/ 에 넣는다 (vercel.json buildCommand → npm run build)
// 이 저장소는 공개라서 재배포 금지 라이선스 에셋(Sayleok 히트맨 시트)은 올리지 않는다. 배포 결과물에만 들어간다.
//   ASSET_REPO  = 에셋 저장소 (예: SH38038038/tbg-asset)
//   ASSET_TOKEN = 그 저장소 읽기 전용 GitHub 토큰 (fine-grained, Contents: Read-only)
//   ASSET_REF   = 브랜치 (없으면 main)
// 토큰이 없거나(로컬 · PR 미리보기) 받기에 실패하면 경고만 남기고 넘어간다 — 앱은 시트가 없으면 옛 도트 캐릭터로 그린다.
const fs = require('fs');
const path = require('path');

// [에셋 저장소 안 경로, 이 앱 안 경로]
const FILES = [['hitman/sheet.png', 'public/img/hitman/sheet.png']];

async function main() {
  const { ASSET_REPO: repo, ASSET_TOKEN: token, ASSET_REF: ref = 'main' } = process.env;
  if (!repo || !token) return console.log('[assets] ASSET_REPO · ASSET_TOKEN 없음 → 에셋 받기 건너뜀 (경기 캐릭터는 옛 도트 캐릭터)');
  for (const [src, dest] of FILES) {
    const url = `https://api.github.com/repos/${repo}/contents/${src}?ref=${encodeURIComponent(ref)}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw', 'User-Agent': 'tbg-arena-build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const out = path.join(__dirname, '..', dest);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf);
      console.log(`[assets] ${src} → ${dest} (${buf.length} bytes)`);
    } catch (e) {
      console.warn(`[assets] ${src} 받기 실패 (${e.message}) → 건너뜀`);
    }
  }
}

main();
