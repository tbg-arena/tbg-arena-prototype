// 코치: 카카오 지도에서 체육관 위치 고르기 (검색 → 핀 → 끌어서 맞추기 → 저장)
// 회원 출석은 그대로 휴대폰 위치로 확인 (attendance/member.js). 지도는 이 창에서만 불러옴
import { esc, toast, openModal, closeModal } from '../../core/ui.js';
import { api, act } from '../../core/api.js';
import { locate, meters } from './geo.js';

const SEOUL = { lat: 37.5666, lng: 126.9784 }; // 체육관 위치가 없을 때 처음 보여 줄 곳 (서울시청)
const KEEP_NAME = 30; // 검색으로 고른 장소에서 이만큼(m) 안으로 핀을 옮기면 장소 이름 유지

// 카카오 지도 SDK 는 처음 열 때 한 번만 불러옴 (services: 장소 검색 · 좌표 → 주소)
let sdk = null;
function loadKakao(key) {
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  sdk ||= new Promise((resolve, reject) => {
    const fail = () => reject(new Error('지도를 불러오지 못했어요. 카카오 개발자 사이트에 지금 주소(도메인)가 등록돼 있는지 확인해 주세요.'));
    const timer = setTimeout(fail, 10000);
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    s.onerror = () => { clearTimeout(timer); fail(); };
    s.onload = () => {
      if (!window.kakao?.maps?.load) { clearTimeout(timer); return fail(); }
      window.kakao.maps.load(() => { clearTimeout(timer); resolve(window.kakao); });
    };
    document.head.append(s);
  }).catch((e) => { sdk = null; document.querySelector('script[src*="dapi.kakao.com"]')?.remove(); throw e; });
  return sdk;
}

// 두 좌표 사이 거리 (m)
function distance(a, b) {
  const R = 6371e3, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// gym: 지금 저장된 위치 | null, radius: 출석 반경(m), mapKey: 카카오 JavaScript 키
// fallback(이유): 지도를 못 불러오면 '지금 위치로 저장' 창으로
export function openGymMap({ gym, radius, mapKey }, onChange, fallback) {
  openModal(`<h3>체육관 위치</h3>
    <form class="gym-search" id="gymFind"><input id="gymQ" type="search" placeholder="체육관 이름이나 주소" enterkeyhint="search" autocomplete="off" aria-label="체육관 검색">
      <button class="btn" id="gymGo">검색</button></form>
    <div class="gym-results" id="gymResults"></div>
    <div class="gym-map loading" id="gymMap"><span class="muted small">지도 불러오는 중…</span></div>
    <div class="gym-pick-row"><div class="grow gym-pick" id="gymPick"></div><button class="btn sm" id="mine">내 위치</button></div>
    <div class="att-msg" id="gymMsg" role="alert"></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="x">닫기</button>
      <button class="btn primary grow" id="save" disabled>이 위치로 저장</button></div>`, (el) => {
    el.querySelector('#x').onclick = closeModal;
    loadKakao(mapKey).then((kakao) => { if (el.isConnected) mountMap(el, kakao.maps, { gym, radius }, onChange); },
      (e) => { if (el.isConnected) fallback(e.message); });
  });
}

function mountMap(el, maps, { gym, radius }, onChange) {
  const $ = (s) => el.querySelector(s);
  const box = $('#gymMap'), msg = $('#gymMsg'), results = $('#gymResults'), save = $('#save');
  box.classList.remove('loading'); box.innerHTML = '';
  const start = gym || SEOUL;
  const map = new maps.Map(box, { center: new maps.LatLng(start.lat, start.lng), level: gym ? 2 : 7 });
  map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
  const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#ff1744';
  const marker = new maps.Marker({ draggable: true });
  const circle = new maps.Circle({ radius, strokeWeight: 2, strokeColor: red, strokeOpacity: 0.9, fillColor: red, fillOpacity: 0.18 });
  const places = new maps.services.Places(), geocoder = new maps.services.Geocoder();
  const OK = maps.services.Status.OK;
  let pick = null;   // 저장할 위치 { lat, lng, name, address }
  let picked = null; // 검색에서 고른 장소 (핀을 조금 옮겨도 이름 유지)

  const show = () => {
    $('#gymPick').innerHTML = pick
      ? `<b>${esc(pick.name || '고른 위치')}</b><span class="muted small">${pick.address ? esc(pick.address) + ' · ' : ''}출석 반경 ${radius}m</span>
         <span class="muted small">핀을 끌거나 지도를 눌러 체육관 자리에 맞춰 주세요</span>`
      : '<span class="muted small">체육관을 검색하거나 지도를 눌러 위치를 찍어 주세요</span>';
  };

  // info 가 없으면 핀을 직접 옮긴 것: 고른 장소 근처면 이름 유지, 주소는 좌표로 다시 찾음
  function place(lat, lng, info) {
    const ll = new maps.LatLng(lat, lng);
    marker.setPosition(ll); marker.setMap(map);
    circle.setPosition(ll); circle.setMap(map);
    pick = { lat, lng, name: info?.name || '', address: info?.address || '' };
    if (!info) {
      if (picked && distance(picked, pick) <= KEEP_NAME) pick.name = picked.name;
      const mine = pick;
      geocoder.coord2Address(lng, lat, (r, st) => {
        if (st !== OK || pick !== mine) return;
        mine.address = r[0]?.road_address?.address_name || r[0]?.address?.address_name || '';
        show();
      });
    }
    save.disabled = false; show();
  }
  const focus = (lat, lng) => { map.setLevel(2); map.setCenter(new maps.LatLng(lat, lng)); };

  if (gym) { place(gym.lat, gym.lng, gym); if (gym.name) picked = { ...gym }; } else show();
  // 시트가 올라오는 중에 지도를 만들어서 크기를 다시 맞춤
  setTimeout(() => { map.relayout(); map.setCenter(new maps.LatLng(pick?.lat ?? start.lat, pick?.lng ?? start.lng)); }, 260);

  maps.event.addListener(map, 'click', (e) => { msg.textContent = ''; place(e.latLng.getLat(), e.latLng.getLng()); });
  maps.event.addListener(marker, 'dragend', () => { const p = marker.getPosition(); place(p.getLat(), p.getLng()); });

  // 검색: 장소 이름으로 먼저, 없으면 주소로
  const list = (items) => {
    results.innerHTML = items.map((p, i) => `<button type="button" data-i="${i}"><b>${esc(p.name)}</b><span class="muted small">${esc([p.category, p.address].filter(Boolean).join(' · '))}</span></button>`).join('');
    results.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => {
      const p = items[+b.dataset.i];
      picked = p; place(p.lat, p.lng, p); focus(p.lat, p.lng);
      results.innerHTML = '';
    }));
  };
  $('#gymFind').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#gymQ').value.trim();
    msg.textContent = ''; results.innerHTML = '';
    if (!q) return;
    const none = () => { msg.textContent = '찾는 곳이 없어요. 다른 이름이나 주소로 검색해 보세요.'; };
    places.keywordSearch(q, (r, st) => {
      if (st === OK && r.length) {
        return list(r.slice(0, 6).map((p) => ({ lat: +p.y, lng: +p.x, name: p.place_name, address: p.road_address_name || p.address_name, category: p.category_name.split(' > ').pop() })));
      }
      geocoder.addressSearch(q, (a, st2) => {
        if (st2 !== OK || !a.length) return none();
        list(a.slice(0, 6).map((p) => ({ lat: +p.y, lng: +p.x, name: '', address: p.road_address?.address_name || p.address_name })));
      });
    });
  };

  // 내 위치: 저장하지 않고 핀만 옮김 (PC는 오차가 커서 지도에서 확인하고 맞추기)
  const mine = $('#mine');
  mine.onclick = () => act(async () => {
    mine.disabled = true; msg.textContent = '';
    try {
      const pos = await locate();
      place(pos.lat, pos.lng); focus(pos.lat, pos.lng);
      if (pos.accuracy > radius) msg.textContent = `내 위치 오차가 ±${meters(pos.accuracy)}로 커요. 지도에서 체육관 자리에 핀을 맞춰 주세요.`;
    } catch (e) { msg.textContent = e.message; }
    finally { if (mine.isConnected) mine.disabled = false; }
  });

  save.onclick = () => act(async () => {
    if (!pick) return;
    save.disabled = true;
    try {
      const { gym: g } = await api('PUT', '/api/coach/gym', pick);
      closeModal(); toast(`체육관 위치를 저장했어요 (출석 반경 ${g.radius}m)`); onChange?.();
    } catch (e) { msg.textContent = e.message; }
    finally { if (save.isConnected) save.disabled = false; }
  });
}
