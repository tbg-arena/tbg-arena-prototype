// 인스타 스토리 공유: 링 마지막 장면 + 경기 결과를 1080×1920 PNG로 만들어 공유 창(없으면 다운로드)으로 넘긴다
const W = 1080, H = 1920;
const PIXEL = 'Galmuri11, monospace';

import { figureURL } from '../../arena/figure.js';
import { gearArtURL } from '../../arena/gear-art.js';
import { lookOf } from '../../arena/sprite.js';

const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

// d = { ring: canvas, L: {id, name, power, gender, look}, R, winnerId, title, lose, method, meta, delta, date }
// 저장하는 사람(경기 화면에서 늘 왼쪽 L)은 산 옷을 입은 캐릭터를 크게 + 입은 상품 그림 칸 — 상점에서 산 디테일이 보이게
const SLOTS = [['gloves', 'GLOVES'], ['shirt', 'TOP'], ['trunks', 'TRUNKS'], ['shoes', 'SHOES']];
export async function storyCanvas(d) {
  const arts = lookOf(d.L).gear.arts || {};
  const worn = SLOTS.filter(([k]) => arts[k]);
  const [logo, fig, ...tiles] = await Promise.all([loadImg('/logo.png'), loadImg(figureURL(d.L)), ...worn.map(([k]) => loadImg(gearArtURL(arts[k], 8))),
    document.fonts?.load(`700 40px Galmuri11`).catch(() => {})]);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#212121'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // 로고
  const lh = logo ? 300 * logo.height / logo.width : 160;
  if (logo) g.drawImage(logo, (W - 300) / 2, 70, 300, lh);
  g.fillStyle = '#ff1744'; g.font = `700 40px ${PIXEL}`; g.fillText('ARENA', W / 2, 70 + lh + 40);

  // 가운데: 왼쪽 = 내 캐릭터 크게 / 오른쪽 = 링 마지막 장면(작게) + 입은 상품 칸 2×2
  const top = 70 + lh + 90;
  if (fig) {
    const fh = 760, fw = fh * fig.width / fig.height, fx = 300 - fw / 2;
    g.fillStyle = '#181526'; g.fillRect(60, top, 480, fh + 40);   // 히트맨 밤 배경 + 하늘빛 매트
    g.fillStyle = '#b9d3d6'; g.fillRect(60, top + fh - 30, 480, 70);
    g.fillStyle = '#87a0ae'; g.fillRect(60, top + fh - 30, 480, 8);
    g.imageSmoothingEnabled = false; g.drawImage(fig, fx, top + 10, fw, fh);
  }
  const rx = 580, rw = 440, rh = rw * 100 / 160;
  g.imageSmoothingEnabled = false;
  g.drawImage(d.ring, rx, top, rw, rh);
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(rx - 3, top - 3, rw + 6, rh + 6);
  const ts = 200, tg = 40;
  worn.forEach(([, label], i) => {
    const tx = rx + (i % 2) * (ts + tg), ty = top + rh + 50 + Math.floor(i / 2) * (ts + 70);
    g.fillStyle = '#2c2c2c'; g.fillRect(tx, ty, ts, ts);
    if (tiles[i]) g.drawImage(tiles[i], tx + 4, ty + 4, ts - 8, ts - 8);
    g.fillStyle = '#888'; g.font = `700 28px ${PIXEL}`; g.fillText(label, tx + ts / 2, ty + ts + 30);
  });

  // 선수: 판정승은 링 장면만으론 승자가 안 보여서 이름 줄에 WINNER 표시, 패자는 흐리게
  const ny = top + 800 + 150;
  g.fillStyle = '#888'; g.font = `700 40px ${PIXEL}`;
  g.fillText('VS', W / 2, ny);
  for (const [p, x, color] of [[d.L, W / 2 - 280, '#75a7ff'], [d.R, W / 2 + 280, '#ff5c77']]) {
    const lost = d.winnerId && p.id !== d.winnerId;
    if (p.id === d.winnerId) {
      g.fillStyle = '#ffea00'; g.fillRect(x - 110, ny - 112, 220, 50);
      g.fillStyle = '#111'; g.font = `700 34px ${PIXEL}`; g.fillText('WINNER', x, ny - 86);
    }
    g.fillStyle = lost ? '#555' : color; g.font = `700 52px ${PIXEL}`; g.fillText(fit(g, p.name, 380), x, ny);
    g.fillStyle = lost ? '#444' : '#888'; g.font = `700 34px ${PIXEL}`; g.fillText(`PWR ${p.power}`, x, ny + 60);
  }

  // 결과
  const ty = ny + 180;
  g.font = `700 120px ${PIXEL}`;
  if (!d.lose) { g.fillStyle = '#2979ff'; g.fillText(d.title, W / 2 + 8, ty + 8); }
  g.fillStyle = d.lose ? '#888' : '#fff'; g.fillText(d.title, W / 2, ty);
  g.fillStyle = '#fff'; g.font = `700 52px ${PIXEL}`; g.fillText(fit(g, d.method, 960), W / 2, ty + 120);
  g.fillStyle = '#aaa'; g.font = `700 38px ${PIXEL}`; g.fillText(fit(g, d.meta, 960), W / 2, ty + 185);
  if (d.delta != null) {
    g.fillStyle = d.delta >= 0 ? '#00e676' : '#ff1744'; g.font = `700 56px ${PIXEL}`;
    g.fillText(`RANK PTS ${d.delta >= 0 ? '+' : ''}${d.delta}`, W / 2, ty + 265);
  }

  // 하단
  g.fillStyle = '#666'; g.font = `700 32px ${PIXEL}`;
  g.fillText(`${d.date} · TBG BOXING & MMA · SINSA`, W / 2, H - 60);
  return c;
}

// 너무 긴 이름은 말줄임
function fit(g, s, max) {
  if (g.measureText(s).width <= max) return s;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

export async function shareStory(d) {
  const c = await storyCanvas(d);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  const file = new File([blob], `tbg-arena-${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { return await navigator.share({ files: [file] }); }
    catch (e) { if (e.name === 'AbortError') return; } // 사용자가 닫음 / 그 외 실패는 다운로드로
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
