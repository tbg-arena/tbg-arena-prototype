// 인스타 스토리 공유: 링 마지막 장면 + 경기 결과를 1080×1920 PNG로 만들어 공유 창(없으면 다운로드)으로 넘긴다
const W = 1080, H = 1920;
const PIXEL = 'Galmuri11, monospace';

const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

// d = { ring: canvas, L: {id, name, power}, R: {id, name, power}, winnerId, title, lose, method, meta, delta, date }
export async function storyCanvas(d) {
  const [logo] = await Promise.all([loadImg('/logo.png'), document.fonts?.load(`700 40px Galmuri11`).catch(() => {})]);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // 로고
  const lh = logo ? 380 * logo.height / logo.width : 200;
  if (logo) g.drawImage(logo, (W - 380) / 2, 110, 380, lh);
  g.fillStyle = '#ff4b45'; g.font = `700 44px ${PIXEL}`; g.fillText('ARENA', W / 2, 110 + lh + 50);

  // 링 장면 (도트 유지)
  const rw = 960, rh = rw * 100 / 160, rx = (W - rw) / 2, ry = 110 + lh + 120;
  g.imageSmoothingEnabled = false;
  g.drawImage(d.ring, rx, ry, rw, rh);
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(rx - 3, ry - 3, rw + 6, rh + 6);

  // 선수: 판정승은 링 장면만으론 승자가 안 보여서 이름 줄에 WINNER 표시, 패자는 흐리게
  const ny = ry + rh + 150;
  g.fillStyle = '#888'; g.font = `700 40px ${PIXEL}`;
  g.fillText('VS', W / 2, ny);
  for (const [p, x, color] of [[d.L, W / 2 - 280, '#fff'], [d.R, W / 2 + 280, '#ff4b45']]) {
    const lost = d.winnerId && p.id !== d.winnerId;
    if (p.id === d.winnerId) {
      g.fillStyle = '#e8302b'; g.fillRect(x - 110, ny - 112, 220, 50);
      g.fillStyle = '#fff'; g.font = `700 34px ${PIXEL}`; g.fillText('WINNER', x, ny - 86);
    }
    g.fillStyle = lost ? '#555' : color; g.font = `700 52px ${PIXEL}`; g.fillText(fit(g, p.name, 380), x, ny);
    g.fillStyle = lost ? '#444' : '#888'; g.font = `700 34px ${PIXEL}`; g.fillText(`PWR ${p.power}`, x, ny + 60);
  }

  // 결과
  const ty = ny + 210;
  g.font = `700 150px ${PIXEL}`;
  if (!d.lose) { g.fillStyle = '#e8302b'; g.fillText(d.title, W / 2 + 8, ty + 8); }
  g.fillStyle = d.lose ? '#888' : '#fff'; g.fillText(d.title, W / 2, ty);
  g.fillStyle = '#fff'; g.font = `700 56px ${PIXEL}`; g.fillText(fit(g, d.method, 960), W / 2, ty + 150);
  g.fillStyle = '#aaa'; g.font = `700 42px ${PIXEL}`; g.fillText(fit(g, d.meta, 960), W / 2, ty + 230);
  if (d.delta != null) {
    g.fillStyle = d.delta >= 0 ? '#4ade80' : '#ff4b45'; g.font = `700 64px ${PIXEL}`;
    g.fillText(`RANK PTS ${d.delta >= 0 ? '+' : ''}${d.delta}`, W / 2, ty + 340);
  }

  // 하단
  g.fillStyle = '#666'; g.font = `700 32px ${PIXEL}`;
  g.fillText(`${d.date} · TBG BOXING & MMA · SINSA`, W / 2, H - 90);
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
