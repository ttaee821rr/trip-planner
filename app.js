// =============================================================
// app.js — 화면 아래 메뉴(코스 / 예산) 바꾸기 + 전체 초기화
// 맨 마지막에 불러와야 해요 (course.js, budget.js의 함수를 쓰기 때문)
// =============================================================

const PAGES = ['course', 'budget']; // 3단계부터 여기에 하나씩 추가돼요

function showPage(name) {
  if (!PAGES.includes(name)) name = 'course';

  PAGES.forEach((page) => {
    const isActive = page === name;
    document.getElementById(`page-${page}`).hidden = !isActive;
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  if (name === 'course') map.invalidateSize(); // 숨겨졌다가 다시 나온 지도는 크기를 다시 계산해야 제대로 보여요
  if (name === 'budget') renderBudget();       // 코스 화면에서 바뀐 일차(추가·삭제·날짜)를 반영

  saveData('page', name); // 마지막으로 본 화면 기억하기
  window.scrollTo(0, 0);
}

// 메뉴 버튼 누르면 화면 바꾸기 (data-page="budget" → showPage('budget'))
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// 전체 초기화: 코스 + 예산을 모두 지우고 새로고침
document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('여행 코스와 예산 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
  removeData('trip');
  removeData('budget');
  removeData('page');
  location.reload(); // 새로고침하면 빈 상태로 다시 시작
});

// ---------- 시작: 마지막으로 보던 화면 열기 ----------
showPage(loadData('page') || 'course');