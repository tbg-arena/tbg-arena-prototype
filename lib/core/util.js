// 여러 기능에서 같이 쓰는 작은 함수들
const crypto = require('crypto');

const uid = () => crypto.randomBytes(6).toString('hex');
const now = () => Date.now();
const digits = (s) => String(s || '').replace(/\D/g, '');
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

module.exports = { uid, now, digits, today, clamp };
