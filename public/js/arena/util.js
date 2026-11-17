// 도트 그래픽 공용 함수
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const bump = (t) => Math.sin(Math.PI * clamp01(t));
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
