// =============================================================
// storage.js — 저장 / 불러오기 담당 (앞으로 만들 모든 기능이 같이 씀)
// localStorage = 브라우저 안에 있는 작은 저장 공간. 새로고침해도 남아 있음.
// =============================================================

// GitHub Pages는 같은 아이디의 모든 앱이 저장 공간을 같이 써요.
// 그래서 이름 앞에 앱 이름을 붙여서 주차 앱 등 다른 앱과 섞이지 않게 해요.
const APP_PREFIX = 'trip-planner:';

// 저장된 값 꺼내기 (없거나 깨져 있으면 null)
function loadData(name) {
  try {
    const raw = localStorage.getItem(APP_PREFIX + name);
    return raw ? JSON.parse(raw) : null; // JSON.parse = 글자 → 자바스크립트 객체로 변환
  } catch (e) {
    return null;
  }
}

// 값 저장하기
function saveData(name, value) {
  try {
    localStorage.setItem(APP_PREFIX + name, JSON.stringify(value)); // JSON.stringify = 객체 → 글자로 변환
    return true;
  } catch (e) {
    alert('저장하지 못했어요. 저장 공간이 부족하거나 브라우저가 막고 있을 수 있어요.');
    return false;
  }
}

// 값 지우기
function removeData(name) {
  localStorage.removeItem(APP_PREFIX + name);
}

// 겹치지 않는 고유 번호(id) 만들기 — 장소 하나하나를 구분하는 이름표
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}