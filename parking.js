// =============================================================
// parking.js — 기능 6: 주차 위치 저장 + 주차 시간 + 층 메모 + 예상 요금
// '내 차 어디?' 주차 앱에서 검증한 위치 코드(getLocation)를 가져왔어요.
// course.js의 el(), numberIcon()과
// budget.js의 won() 을 같이 써요.
// =============================================================

// ---------- 데이터 ----------
// 저장 모양: { spot: {lat, lng, accuracy, savedAt, memo} 또는 null,
//             rate: {baseMin, baseFee, unitMin, unitFee, dayMax} }
// (주차 앱은 'parking-spot'이라는 이름을 써서, 여기 'trip-planner:parking'과 안 겹쳐요)
let parking = loadData('parking');
if (!parking || typeof parking !== 'object') parking = { spot: null, rate: {} };
if (!parking.rate) parking.rate = {};

function saveParking() {
  saveData('parking', parking);
}

// ---------- 화면 요소 ----------
const parkEmpty = el('park-empty');
const parkInfo = el('park-info');
const parkSaveBtn = el('park-save-btn');
const parkUpdateBtn = el('park-update-btn');
const parkClearBtn = el('park-clear-btn');
const parkStatus = el('park-status');
const parkStart = el('park-start');
const parkElapsed = el('park-elapsed');
const parkFee = el('park-fee');
const parkAccuracy = el('park-accuracy');
const parkMemo = el('park-memo');
const rateForm = el('rate-form');
const ratePreview = el('rate-preview');

// 요금 입력칸 id ↔ 저장 이름
const RATE_FIELDS = {
  'rate-base-min': 'baseMin', // 기본 시간(분)
  'rate-base-fee': 'baseFee', // 기본 요금(원)
  'rate-unit-min': 'unitMin', // 추가 단위(분)
  'rate-unit-fee': 'unitFee', // 추가 요금(원)
  'rate-day-max': 'dayMax',   // 하루 최대 요금(원)
};

// ---------- 현재 위치 (주차 앱에서 가져온 코드) ----------
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 위치 기능을 지원하지 않아요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, // 오차(미터)
        savedAt: Date.now(),
      }),
      (err) => reject(new Error(locationErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function locationErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return '위치 권한이 거부됐어요. 브라우저 설정에서 이 사이트의 위치 권한을 허용해 주세요.';
    case err.POSITION_UNAVAILABLE:
      return '위치를 알 수 없어요. 와이파이·위치 서비스를 켜고, 지하라면 입구 근처에서 다시 시도해 주세요.';
    case err.TIMEOUT:
      return '위치를 찾는 데 너무 오래 걸려요. 다시 시도해 주세요.';
    default:
      return '알 수 없는 오류가 났어요. 다시 시도해 주세요.';
  }
}

// ---------- 시간 계산 ----------
// 1700000000000 → "11/24 14:05"
function formatClock(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0'); // padStart = 한 자리면 앞에 0 붙이기
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

// 135 → "2시간 15분"
function formatDuration(minutes) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) return `${days}일 ${hours}시간 ${mins}분`;
  if (hours) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

function elapsedMinutes() {
  return Math.max(0, Math.floor((Date.now() - parking.spot.savedAt) / 60000));
}

// ---------- 요금 계산 ----------
function rateReady() {
  const r = parking.rate;
  return Number.isFinite(r.baseMin) && Number.isFinite(r.baseFee);
}

// 하루(24시간) 안의 요금: 기본 요금 + 넘은 시간을 단위로 올림해서 추가 요금
function feeWithinDay(minutes, r) {
  if (minutes <= 0) return 0;
  let fee = r.baseFee;
  if (minutes > r.baseMin && r.unitMin > 0 && Number.isFinite(r.unitFee)) {
    fee += Math.ceil((minutes - r.baseMin) / r.unitMin) * r.unitFee; // Math.ceil = 올림
  }
  return r.dayMax > 0 ? Math.min(fee, r.dayMax) : fee;
}

// 전체 예상 요금 (24시간이 넘으면 하루 최대 요금을 날마다 더해요). 설정이 없으면 null
function calcFee(minutes) {
  if (!rateReady()) return null;
  const r = parking.rate;
  if (r.dayMax > 0 && minutes > 1440) {
    const days = Math.floor(minutes / 1440);
    return days * r.dayMax + feeWithinDay(minutes - days * 1440, r);
  }
  return feeWithinDay(minutes, r);
}

// "최초 30분 1,000원, 이후 10분마다 500원 → 2시간 주차하면 5,500원"
function ratePreviewText() {
  if (!rateReady()) return '기본 시간과 기본 요금을 넣으면 예상 요금을 계산해요.';
  const r = parking.rate;
  let text = `최초 ${r.baseMin}분 ${won(r.baseFee)}`;
  if (r.unitMin > 0 && Number.isFinite(r.unitFee)) text += `, 이후 ${r.unitMin}분마다 ${won(r.unitFee)}`;
  if (r.dayMax > 0) text += `, 하루 최대 ${won(r.dayMax)}`;
  return `${text} → 2시간 주차하면 ${won(calcFee(120))}`;
}

// ---------- 지도 (주차 화면 전용, 코스 지도와 따로) ----------
let parkMap = null;
let parkMarker = null;
let parkCircle = null;

function showParkingOnMap(spot) {
  if (!parkMap) {
    parkMap = L.map('park-map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap', // 출처 표시 필수
    }).addTo(parkMap);
    parkMarker = L.marker([spot.lat, spot.lng], { icon: numberIcon('P', '#1c7ed6') }).addTo(parkMap);
    // 파란 동그라미 = 위치 오차 범위 (이 안 어딘가에 차가 있어요)
    parkCircle = L.circle([spot.lat, spot.lng], {
      radius: spot.accuracy || 0, color: '#1c7ed6', weight: 1, fillOpacity: 0.1,
    }).addTo(parkMap);
  }
  parkMarker.setLatLng([spot.lat, spot.lng]);
  parkCircle.setLatLng([spot.lat, spot.lng]).setRadius(spot.accuracy || 0);
  parkMap.invalidateSize(); // 숨겨졌다가 나타난 지도는 크기 재계산 필요
  parkMap.setView([spot.lat, spot.lng], 17);
}

// ---------- 화면 그리기 ----------
// 지난 시간·예상 요금만 다시 계산 (30초마다 자동으로 불러요)
function renderParkingTime() {
  if (!parking.spot) return;
  const minutes = elapsedMinutes();
  const fee = calcFee(minutes);
  parkElapsed.textContent = formatDuration(minutes);
  parkFee.textContent = fee === null ? '요금 설정 필요' : won(fee);
}

// 주차 화면 전체 다시 그리기 (app.js가 주차 메뉴를 열 때도 불러요)
function renderParking() {
  const spot = parking.spot;
  parkEmpty.hidden = !!spot; // !! = 값이 있으면 true, 없으면 false
  parkInfo.hidden = !spot;
  ratePreview.textContent = ratePreviewText();
  if (!spot) return;

  parkStart.textContent = formatClock(spot.savedAt);
  parkAccuracy.textContent = `위치 오차 약 ${Math.round(spot.accuracy)}m`
    + (spot.accuracy > 100 ? ' — 오차가 커요. 밖이나 입구 근처에서 위치를 다시 잡아 보세요.' : '');
  if (document.activeElement !== parkMemo) parkMemo.value = spot.memo || ''; // 입력 중엔 건드리지 않기

  renderParkingTime();
  // 주차 화면이 보일 때만 지도 그리기 (숨겨진 상태로 만들면 지도 크기가 0이 돼요)
  if (!el('page-parking').hidden) showParkingOnMap(spot);
}

// ---------- 동작 ----------
// 위치 저장 (처음 저장 / 위치 다시 잡기 둘 다 이 함수)
async function saveParkingSpot() {
  const isUpdate = !!parking.spot;
  parkSaveBtn.disabled = true;
  parkUpdateBtn.disabled = true;
  parkStatus.textContent = '위치를 찾는 중... (몇 초 걸릴 수 있어요)';
  try {
    const pos = await getLocation(); // await = 위치를 찾을 때까지 기다리기
    parking.spot = {
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      savedAt: isUpdate ? parking.spot.savedAt : pos.savedAt, // 다시 잡을 땐 주차 시간 유지
      memo: isUpdate ? parking.spot.memo : '',
    };
    saveParking();
    parkStatus.textContent = isUpdate
      ? '✅ 위치를 다시 잡았어요. (주차 시간은 그대로예요)'
      : '✅ 주차 위치를 저장했어요! 층·구역도 적어 두세요.';
    renderParking();
  } catch (e) {
    parkStatus.textContent = e.message;
  } finally {
    parkSaveBtn.disabled = false; // finally = 성공하든 실패하든 마지막에 실행
    parkUpdateBtn.disabled = false;
  }
}

// 출차 완료: 주차 위치만 지우고 요금 설정은 남겨요
function clearParking() {
  if (!parking.spot) return;
  const minutes = elapsedMinutes();
  const fee = calcFee(minutes);
  const msg = `출차할까요? 주차 시간 ${formatDuration(minutes)}`
    + (fee === null ? '' : `, 예상 요금 ${won(fee)}`)
    + '\n저장된 주차 위치는 지워져요.';
  if (!confirm(msg)) return;
  parking.spot = null;
  saveParking();
  parkStatus.textContent = '출차 완료! 요금 설정은 다음 주차를 위해 남겨 뒀어요.';
  renderParking();
}

// ---------- 이벤트 연결 ----------
parkSaveBtn.addEventListener('click', saveParkingSpot);
parkUpdateBtn.addEventListener('click', saveParkingSpot);
parkClearBtn.addEventListener('click', clearParking);

parkMemo.addEventListener('input', () => {
  if (!parking.spot) return;
  parking.spot.memo = parkMemo.value;
  saveParking();
});

// 요금 칸에 입력하면 바로 저장하고 다시 계산
for (const [inputId, key] of Object.entries(RATE_FIELDS)) {
  const input = el(inputId);
  input.value = Number.isFinite(parking.rate[key]) ? parking.rate[key] : '';
  input.addEventListener('input', () => {
    const value = input.value === '' ? null : Math.max(0, Math.round(Number(input.value)));
    parking.rate[key] = Number.isFinite(value) ? value : null;
    saveParking();
    ratePreview.textContent = ratePreviewText();
    renderParkingTime();
  });
}
rateForm.addEventListener('submit', (e) => e.preventDefault()); // Enter 눌러도 새로고침 안 되게

// 30초마다 지난 시간·요금 갱신 + 폰에서 앱으로 돌아왔을 때 바로 갱신
setInterval(renderParkingTime, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderParkingTime();
});

// ---------- 시작 ----------
renderParking();