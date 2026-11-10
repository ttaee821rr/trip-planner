// =============================================================
// budget.js — 기능 3: 예산 & 지출 기록 (남은 예산 자동 계산)
// course.js에 있는 trip(여행 데이터), dayLabel(), el() 을 같이 써요.
// =============================================================

// ---------- 설정값 ----------
const CATEGORIES = [
  { id: 'transport', name: '교통', icon: '🚆' },
  { id: 'stay', name: '숙박', icon: '🏨' },
  { id: 'food', name: '식비', icon: '🍜' },
  { id: 'tour', name: '관광·입장료', icon: '🎫' },
  { id: 'shopping', name: '쇼핑', icon: '🛍️' },
  { id: 'etc', name: '기타', icon: '📦' },
];
const BEFORE_TRIP = 'before'; // '여행 전'(예약, 준비물 등)에 쓴 돈을 뜻하는 값

// ---------- 데이터 ----------
// 저장 모양: { total: 500000, expenses: [ {id, amount, title, category, dayId} ] }
let budget = loadData('budget');
if (!budget || !Array.isArray(budget.expenses)) {
  budget = { total: 0, expenses: [] };
}

function saveBudget() {
  saveData('budget', budget);
}

// ---------- 화면 요소 ----------
const totalInput = el('budget-total');
const totalAmount = el('total-amount');
const spentAmount = el('spent-amount');
const leftAmount = el('left-amount');
const progressBar = el('progress-bar');
const budgetStatus = el('budget-status');
const expenseForm = el('expense-form');
const expAmount = el('exp-amount');
const expDay = el('exp-day');
const expTitle = el('exp-title');
const expCategory = el('exp-category');
const categoryCard = el('category-card');
const categoryList = el('category-list');
const expenseList = el('expense-list');
const expenseEmpty = el('expense-empty');

// ---------- 도우미 함수 ----------
// 12000 → "12,000원"
const won = (n) => n.toLocaleString('ko-KR') + '원';

function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// 금액 합치기 (reduce = 배열 안의 값들을 하나로 모으는 함수)
function sumOf(list) {
  return list.reduce((sum, e) => sum + e.amount, 0);
}

function addOption(select, value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  select.append(option);
}

// ---------- 화면 그리기 ----------
// '언제' 선택칸: 여행 전 / 1일차 / 2일차 ... (코스 화면의 일차와 연결)
function renderDaySelect() {
  const prev = expDay.value;
  expDay.innerHTML = '';
  addOption(expDay, BEFORE_TRIP, '여행 전 (예약·준비)');
  trip.days.forEach((day, i) => addOption(expDay, day.id, dayLabel(i)));

  // 전에 고른 값이 아직 있으면 그대로, 없으면 1일차
  const ids = [BEFORE_TRIP, ...trip.days.map((d) => d.id)];
  expDay.value = ids.includes(prev) ? prev : trip.days[0].id;
}

// 총 예산 / 쓴 돈 / 남은 돈 + 막대
function renderSummary() {
  const total = budget.total || 0;
  const spent = sumOf(budget.expenses);
  const left = total - spent;
  const percent = total ? Math.round((spent / total) * 100) : 0;

  totalAmount.textContent = total ? won(total) : '-';
  spentAmount.textContent = won(spent);
  leftAmount.textContent = total ? won(left) : '-';
  leftAmount.classList.toggle('over', total > 0 && left < 0);

  progressBar.style.width = Math.min(percent, 100) + '%';
  progressBar.className = percent > 100 ? 'over' : percent >= 80 ? 'warn' : '';

  if (!total) budgetStatus.textContent = '총 예산을 입력하면 남은 돈이 자동으로 계산돼요.';
  else if (left < 0) budgetStatus.textContent = `⚠️ 예산을 ${won(-left)} 초과했어요!`;
  else budgetStatus.textContent = `예산의 ${percent}%를 썼어요.`;
}

// 분류별 합계 (많이 쓴 순서)
function renderCategories() {
  const spent = sumOf(budget.expenses);
  const rows = CATEGORIES
    .map((c) => ({ ...c, sum: sumOf(budget.expenses.filter((e) => e.category === c.id)) }))
    .filter((c) => c.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  categoryCard.hidden = rows.length === 0;
  categoryList.innerHTML = '';

  for (const c of rows) {
    const row = document.createElement('div');
    row.className = 'cat-row';

    const name = document.createElement('span');
    name.textContent = `${c.icon} ${c.name}`;

    const bar = document.createElement('div');
    bar.className = 'cat-bar';
    const fill = document.createElement('span');
    fill.style.width = Math.round((c.sum / spent) * 100) + '%';
    bar.append(fill);

    const amount = document.createElement('strong');
    amount.textContent = won(c.sum);

    row.append(name, bar, amount);
    categoryList.append(row);
  }
}

// 지출 내역 (여행 전 → 1일차 → 2일차 … 순서로 묶어서, 묶음마다 합계)
function renderExpenses() {
  expenseList.innerHTML = '';

  const groups = [
    { id: BEFORE_TRIP, label: '여행 전' },
    ...trip.days.map((day, i) => ({ id: day.id, label: dayLabel(i) })),
  ];
  const knownIds = groups.map((g) => g.id);
  // 코스 화면에서 일차를 지우면 그 일차의 지출은 여기로 모여요
  groups.push({ id: null, label: '일차 없음 (삭제된 일차)' });

  for (const group of groups) {
    const items = budget.expenses.filter((e) =>
      group.id === null ? !knownIds.includes(e.dayId) : e.dayId === group.id
    );
    if (items.length === 0) continue;

    const head = document.createElement('li');
    head.className = 'group-head';
    const title = document.createElement('span');
    title.textContent = group.label;
    const subtotal = document.createElement('span');
    subtotal.textContent = won(sumOf(items));
    head.append(title, subtotal);
    expenseList.append(head);

    items.forEach((e) => expenseList.append(makeExpenseItem(e)));
  }

  expenseEmpty.hidden = budget.expenses.length > 0;
}

function makeExpenseItem(expense) {
  const category = categoryOf(expense.category);

  const li = document.createElement('li');
  li.className = 'expense';

  const icon = document.createElement('span');
  icon.className = 'expense-icon';
  icon.textContent = category.icon;

  const body = document.createElement('div');
  body.className = 'expense-body';
  const title = document.createElement('div');
  title.className = 'expense-title';
  title.textContent = expense.title;
  const cat = document.createElement('div');
  cat.className = 'expense-cat';
  cat.textContent = category.name;
  body.append(title, cat);

  const amount = document.createElement('span');
  amount.className = 'expense-amount';
  amount.textContent = won(expense.amount);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn small danger';
  del.textContent = '삭제';
  del.addEventListener('click', () => deleteExpense(expense.id));

  li.append(icon, body, amount, del);
  return li;
}

// 예산 화면 전체 다시 그리기 (app.js가 예산 메뉴를 열 때도 불러요)
function renderBudget() {
  renderDaySelect();
  renderSummary();
  renderCategories();
  renderExpenses();
}

// ---------- 동작 ----------
function deleteExpense(id) {
  const expense = budget.expenses.find((e) => e.id === id);
  if (!expense) return;
  if (!confirm(`'${expense.title}' ${won(expense.amount)}을(를) 지울까요?`)) return;

  budget.expenses = budget.expenses.filter((e) => e.id !== id);
  saveBudget();
  renderBudget();
}

// 총 예산 입력 → 바로 저장하고 다시 계산
totalInput.addEventListener('input', () => {
  budget.total = Math.max(0, Math.round(Number(totalInput.value) || 0));
  saveBudget();
  renderSummary();
});

// 지출 추가
expenseForm.addEventListener('submit', (e) => {
  e.preventDefault(); // 페이지 새로고침 막기
  const amount = Math.round(Number(expAmount.value));
  if (!amount || amount <= 0) return;

  const category = expCategory.value;
  budget.expenses.push({
    id: makeId(),
    amount,
    title: expTitle.value.trim() || categoryOf(category).name, // 내용을 비우면 분류 이름으로
    category,
    dayId: expDay.value,
  });
  saveBudget();

  // 금액·내용만 비우고, '언제'와 '분류'는 그대로 둬서 연달아 입력하기 편하게
  expAmount.value = '';
  expTitle.value = '';
  renderBudget();
  expAmount.focus();
});

// ---------- 시작 ----------
CATEGORIES.forEach((c) => addOption(expCategory, c.id, `${c.icon} ${c.name}`));
totalInput.value = budget.total || '';
renderBudget();