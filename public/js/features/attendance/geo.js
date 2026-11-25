// 이 기기의 지금 위치 (회원 출석 · 코치 체육관 위치 저장에서 같이 씀)
// 브라우저 위치는 https 주소(또는 localhost)에서만 동작한다
const GEO_ERR = {
  1: '위치 권한을 허용해야 해요. 브라우저 설정에서 이 사이트의 위치 권한을 켜 주세요.',
  2: '위치를 찾지 못했어요. 와이파이 · GPS를 켜고 다시 시도해 주세요.',
  3: '위치 확인이 오래 걸려요. 잠시 뒤 다시 시도해 주세요.',
};

// → { lat, lng, accuracy(m) }. 실패하면 안내 문구를 담은 Error
export function locate() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error('https 주소에서만 위치를 확인할 수 있어요.'));
    if (!navigator.geolocation) return reject(new Error('이 브라우저에서는 위치를 확인할 수 없어요.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(GEO_ERR[e.code] || '위치를 확인하지 못했어요.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export const meters = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`);
