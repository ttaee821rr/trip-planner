// =============================================================
// course.js — 기능 1: 지도에 일차별 코스 그리기 + 시간 계획 + 메모
// =============================================================

// ---------- 설정값 ----------
const DAY_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#d6336c'];
const DEFAULT_CENTER = [37.5665, 126.978]; // 처음 지도 위치: 서울시청
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ALL_DAYS = -1; // '전체' 탭을 뜻하는 값

// ---------- 데이터 ----------
// 저장 모양: { title, startDate, days: [ { stops: [ {id, name, time, memo, lat, lng} ] } ] }
function newTrip() {
  return { title: '', startDate: '', days: [{ id: makeId(), stops: [] }] };
}

let trip = loadData('trip');
if (!trip || !Array.isArray(trip.days) || trip.days.length === 0) {
  trip = newTrip(); // 처음 쓰는 사람이면 빈 여행 하나 만들기
}

let selectedDay = 0;      // 지금 보고 있는 일차 (0 = 1일차, ALL_DAYS = 전체)
let editingId = null;     // 수정 중인 장소의 id (새로 추가하는 중이면 null)
let pendingLatLng = null; // 입력 칸에서 저장할 위치

function saveTrip() {
  saveData('trip', trip);
}

// ---------- 화면 요소 가져오기 ----------
const el = (id) => document.getElementById(id);
const titleInput = el('trip-title');
const startInput = el('trip-start');
const dayTabs = el('day-tabs');
const mapHint = el('map-hint');
const form = el('stop-form');
const formTitle = el('form-title');
const nameInput = el('stop-name');
const timeInput = el('stop-time');
const memoInput = el('stop-memo');
const listTitle = el('list-title');
const stopList = el('stop-list');
const emptyText = el('empty-text');
const deleteDayBtn = el('delete-day-btn');

// ---------- 지도 준비 (Leaflet + OpenStreetMap, API 키 필요 없음) ----------
const map = L.map('map').setView(DEFAULT_CENTER, 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap', // 지도 출처 표시 (필수)
}).addTo(map);

const routeLayer = L.layerGroup().addTo(map); // 코스(선 + 번호 핀)를 한꺼번에 담는 상자
let pendingMarker = null; // 입력 중일 때 "여기에 추가돼요"를 보여주는 점선 동그라미
let markerById = {};      // 장소 id → 지도 핀 (목록에서 '지도' 버튼 누를 때 사용)

// ---------- 작은 도우미 함수들 ----------
function colorOf(dayIndex) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

// "1일차 · 11/20(금)" 같은 이름 만들기
function dayLabel(dayIndex) {
  let label = `${dayIndex + 1}일차`;
  if (trip.startDate) {
    const d = new Date(trip.startDate + 'T00:00:00');
    d.setDate(d.getDate() + dayIndex);
    label += ` · ${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
  }
  return label;
}

// 시간 순서로 정렬 (시간을 안 적은 장소는 맨 뒤에, 넣은 순서대로)
function sortedStops(day) {
  return [...day.stops].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

// 지금 화면에 보여줄 일차 번호 목록
function visibleDays() {
  return selectedDay === ALL_DAYS ? trip.days.map((_, i) => i) : [selectedDay];
}

// 지도에 올릴 동그란 번호 핀
function numberIcon(n, color) {
  return L.divIcon({
    className: 'num-icon',
    html: `<span style="background:${color}">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// 카카오맵 길찾기 링크 (API 키 필요 없음, 이름에 쉼표가 있으면 안 돼서 공백으로 바꿈)
function kakaoRouteUrl(name, lat, lng) {
  const safeName = name.replace(/,/g, ' ');
  return `https://map.kakao.com/link/to/${encodeURIComponent(safeName)},${lat},${lng}`;
}

// id로 장소 찾기 → { day, stop }
function findStop(id) {
  for (const day of trip.days) {
    const stop = day.stops.find((s) => s.id === id);
    if (stop) return { day, stop };
  }
  return null;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6; // 좌표를 소수점 6자리로 (약 10cm 정밀도)

// 버튼 하나 만들기
function makeButton(text, onClick, extraClass = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn small ${extraClass}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeDot(color) {
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = color;
  return dot;
}

// ---------- 화면 그리기 ----------
// 주의: 사용자가 쓴 글은 innerHTML 대신 textContent로 넣어요.
// (innerHTML에 넣으면 이상한 코드가 실행될 수 있음 = XSS 공격)

function renderTabs() {
  dayTabs.innerHTML = '';
  dayTabs.append(makeTab('전체', ALL_DAYS));
  trip.days.forEach((day) => {
  if (!day.id) day.id = makeId();
});
saveTrip();

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tab add';
  addBtn.textContent = '+ 일차 추가';
  addBtn.addEventListener('click', addDay);
  dayTabs.append(addBtn);
}

function makeTab(text, dayIndex, color) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tab' + (dayIndex === selectedDay ? ' active' : '');
  if (color) btn.append(makeDot(color));
  btn.append(text);
  btn.addEventListener('click', () => selectDay(dayIndex));
  return btn;
}

function renderList() {
  stopList.innerHTML = '';
  let count = 0;

  for (const i of visibleDays()) {
    const stops = sortedStops(trip.days[i]);

    // '전체' 탭에서는 일차마다 제목을 붙여요
    if (selectedDay === ALL_DAYS) {
      const header = document.createElement('li');
      header.className = 'day-divider';
      header.append(makeDot(colorOf(i)), dayLabel(i));
      stopList.append(header);
      if (stops.length === 0) {
        const none = document.createElement('li');
        none.className = 'day-empty';
        none.textContent = '장소 없음';
        stopList.append(none);
      }
    }

    stops.forEach((stop, n) => {
      stopList.append(makeStopItem(stop, n + 1, colorOf(i)));
      count++;
    });
  }

  emptyText.hidden = count > 0 || selectedDay === ALL_DAYS;
}

function makeStopItem(stop, number, color) {
  const li = document.createElement('li');
  li.className = 'stop';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.background = color;
  badge.textContent = number;

  const body = document.createElement('div');
  body.className = 'stop-body';

  if (stop.time) {
    const time = document.createElement('div');
    time.className = 'stop-time';
    time.textContent = stop.time;
    body.append(time);
  }

  const name = document.createElement('div');
  name.className = 'stop-name';
  name.textContent = stop.name;
  body.append(name);

  if (stop.memo) {
    const memo = document.createElement('div');
    memo.className = 'stop-memo';
    memo.textContent = stop.memo;
    body.append(memo);
  }

  const route = document.createElement('a');
  route.className = 'btn small';
  route.textContent = '길찾기';
  route.href = kakaoRouteUrl(stop.name, stop.lat, stop.lng);
  route.target = '_blank';            // 새 탭에서 열기
  route.rel = 'noopener noreferrer';  // 새 탭이 이 페이지를 건드리지 못하게 (보안)

  const actions = document.createElement('div');
  actions.className = 'stop-actions';
  actions.append(
    makeButton('지도', () => focusStop(stop.id)),
    makeButton('수정', () => startEdit(stop.id)),
    makeButton('삭제', () => deleteStop(stop.id), 'danger'),
    route
  );
  body.append(actions);

  li.append(badge, body);
  return li;
}

// 지도에 코스(선 + 번호 핀) 그리기
function drawRoute() {
  routeLayer.clearLayers();
  markerById = {};

  for (const i of visibleDays()) {
    const color = colorOf(i);
    const stops = sortedStops(trip.days[i]);

    // 장소가 2개 이상이면 순서대로 선으로 잇기
    if (stops.length >= 2) {
      const points = stops.map((s) => [s.lat, s.lng]);
      L.polyline(points, { color, weight: 4, opacity: 0.8 }).addTo(routeLayer);
    }

    stops.forEach((stop, n) => {
      const marker = L.marker([stop.lat, stop.lng], { icon: numberIcon(n + 1, color) })
        .bindPopup(popupContent(stop, i))
        .addTo(routeLayer);
      markerById[stop.id] = marker;
    });
  }
}

// 핀을 눌렀을 때 뜨는 말풍선 내용
function popupContent(stop, dayIndex) {
  const box = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = stop.name;
  const sub = document.createElement('div');
  sub.textContent = dayLabel(dayIndex) + (stop.time ? ` · ${stop.time}` : '');
  box.append(title, sub);
  return box;
}

// 지금 보이는 코스가 한눈에 들어오게 지도 확대/이동
function fitToRoute() {
  const points = [];
  for (const i of visibleDays()) {
    for (const s of trip.days[i].stops) points.push([s.lat, s.lng]);
  }
  if (points.length === 1) map.setView(points[0], 15);
  else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
}

// 화면 전체 다시 그리기 (데이터가 바뀔 때마다 호출)
function render() {
  if (selectedDay !== ALL_DAYS && selectedDay >= trip.days.length) {
    selectedDay = trip.days.length - 1;
  }
  const isAll = selectedDay === ALL_DAYS;

  renderTabs();
  renderList();
  drawRoute();

  listTitle.textContent = isAll ? '전체 코스' : `${dayLabel(selectedDay)} 코스`;
  deleteDayBtn.hidden = isAll || trip.days.length <= 1;
  mapHint.textContent = isAll
    ? '일차 탭(1일차, 2일차…)을 고르면 지도를 눌러 장소를 추가할 수 있어요.'
    : `지도를 누르면 ${selectedDay + 1}일차에 장소가 추가돼요.`;
  document.title = trip.title ? `${trip.title} - 여행 플래너` : '여행 플래너';
}

// ---------- 입력 칸 열기/닫기 ----------
function openForm(latlng, stop) {
  editingId = stop ? stop.id : null;
  formTitle.textContent = stop ? '장소 수정' : `${dayLabel(selectedDay)}에 장소 추가`;
  nameInput.value = stop ? stop.name : '';
  timeInput.value = stop ? stop.time : '';
  memoInput.value = stop ? stop.memo : '';
  setPending(latlng);
  form.hidden = false;
  nameInput.focus();
}

function setPending(latlng) {
  pendingLatLng = { lat: round6(latlng.lat), lng: round6(latlng.lng) };
  if (pendingMarker) {
    pendingMarker.setLatLng(latlng);
  } else {
    pendingMarker = L.circleMarker(latlng, {
      radius: 12, color: '#111', weight: 2, dashArray: '4', fillOpacity: 0.15,
    }).addTo(map);
  }
}

function closeForm() {
  form.hidden = true;
  form.reset();
  editingId = null;
  pendingLatLng = null;
  if (pendingMarker) {
    pendingMarker.remove();
    pendingMarker = null;
  }
}

// ---------- 동작 (버튼 눌렀을 때) ----------
function selectDay(dayIndex) {
  closeForm();
  selectedDay = dayIndex;
  render();
  fitToRoute();
}

function addDay() {
  closeForm();
  trip.days.push({ id: makeId(), stops: [] });
  selectedDay = trip.days.length - 1;
  saveTrip();
  render();
}

function deleteDay() {
  if (selectedDay === ALL_DAYS || trip.days.length <= 1) return;
  const count = trip.days[selectedDay].stops.length;
  const msg = `${selectedDay + 1}일차를 삭제할까요?` + (count ? ` (장소 ${count}곳도 같이 지워져요)` : '');
  if (!confirm(msg)) return;

  closeForm();
  trip.days.splice(selectedDay, 1); // splice = 배열에서 해당 칸 잘라내기
  selectedDay = Math.max(0, selectedDay - 1);
  saveTrip();
  render();
  fitToRoute();
}

function startEdit(id) {
  const found = findStop(id);
  if (!found) return;
  selectedDay = trip.days.indexOf(found.day); // '전체' 탭에서 눌러도 그 일차로 이동
  render();
  openForm(L.latLng(found.stop.lat, found.stop.lng), found.stop);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteStop(id) {
  const found = findStop(id);
  if (!found) return;
  if (!confirm(`'${found.stop.name}'을(를) 코스에서 뺄까요?`)) return;

  found.day.stops = found.day.stops.filter((s) => s.id !== id);
  if (editingId === id) closeForm();
  saveTrip();
  render();
}

function focusStop(id) {
  const marker = markerById[id];
  if (!marker) return;
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
  marker.openPopup();
  el('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- 이벤트 연결 (언제 어떤 함수를 실행할지) ----------
map.on('click', (e) => {
  if (selectedDay === ALL_DAYS) {
    mapHint.textContent = '⚠️ 먼저 위에서 일차(1일차, 2일차…)를 골라 주세요.';
    return;
  }
  if (form.hidden) openForm(e.latlng, null); // 새 장소 입력 시작
  else setPending(e.latlng);                 // 입력 중이면 위치만 옮기기
});

form.addEventListener('submit', (e) => {
  e.preventDefault(); // 폼 제출 시 페이지가 새로고침되는 기본 동작 막기
  const name = nameInput.value.trim();
  if (!name || !pendingLatLng) return;

  const values = {
    name,
    time: timeInput.value,
    memo: memoInput.value.trim(),
    lat: pendingLatLng.lat,
    lng: pendingLatLng.lng,
  };

  if (editingId) {
    const found = findStop(editingId);
    if (found) Object.assign(found.stop, values); // 기존 장소 내용 덮어쓰기
  } else {
    trip.days[selectedDay].stops.push({ id: makeId(), ...values });
  }

  saveTrip();
  closeForm();
  render();
});

el('cancel-btn').addEventListener('click', closeForm);
deleteDayBtn.addEventListener('click', deleteDay);

titleInput.addEventListener('input', () => {
  trip.title = titleInput.value;
  saveTrip();
  document.title = trip.title ? `${trip.title} - 여행 플래너` : '여행 플래너';
});

startInput.addEventListener('change', () => {
  trip.startDate = startInput.value;
  saveTrip();
  render(); // 탭에 날짜 다시 표시
});

// ---------- 시작 ----------
titleInput.value = trip.title || '';
startInput.value = trip.startDate || '';
render();
fitToRoute();