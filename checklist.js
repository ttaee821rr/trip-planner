// =============================================================
// checklist.js — 기능 4: 여행 전 체크리스트 (진행률 표시)
// course.js에 있는 el(), makeButton() 을 같이 써요.
// =============================================================

// ---------- 설정값 ----------
const CHECK_GROUPS = [
  { id: 'docs', name: '예약·서류', icon: '📄' },
  { id: 'pack', name: '짐 싸기', icon: '🧳' },
  { id: 'todo', name: '할 일', icon: '📝' },
];

// '기본 목록 불러오기' 버튼을 누르면 들어가는 항목들 [분류, 내용]
const TEMPLATES = {
  domestic: [
    ['docs', '신분증'],
    ['docs', '숙소 예약 확인'],
    ['docs', '교통편 예약 (KTX·버스·렌터카)'],
    ['pack', '휴대폰 충전기'],
    ['pack', '보조배터리'],
    ['pack', '상비약'],
    ['pack', '세면도구'],
    ['pack', '갈아입을 옷'],
    ['todo', '날씨 확인'],
    ['todo', '코스·예산 정리 (이 앱에서!)'],
  ],
  overseas: [
    ['docs', '여권 (유효기간 확인)'],
    ['docs', '항공권 e-티켓'],
    ['docs', '숙소 예약 확인'],
    ['docs', '여행자 보험'],
    ['docs', '비자·입국 서류 확인'],
    ['pack', '휴대폰 충전기'],
    ['pack', '보조배터리 (기내에 들고 타기)'],
    ['pack', '멀티 어댑터'],
    ['pack', '상비약'],
    ['todo', '환전·해외 결제 카드'],
    ['todo', '유심·eSIM·로밍'],
    ['todo', '날씨 확인'],
  ],
};

// ---------- 데이터 ----------
// 저장 모양: { items: [ {id, text, group, done} ] }
let checklist = loadData('checklist');
if (!checklist || !Array.isArray(checklist.items)) {
  checklist = { items: [] };
}

function saveChecklist() {
  saveData('checklist', checklist);
}

// ---------- 화면 요소 ----------
const checkForm = el('check-form');
const checkText = el('check-text');
const checkGroup = el('check-group');
const checkMessage = el('check-message');
const checkProgressText = el('check-progress-text');
const checkProgressBar = el('check-progress-bar');
const checkList = el('check-list');
const checkEmpty = el('check-empty');

function groupOf(id) {
  return CHECK_GROUPS.find((g) => g.id === id) || CHECK_GROUPS[CHECK_GROUPS.length - 1];
}

// ---------- 화면 그리기 ----------
// 진행률: "7 / 12 완료 (58%)" + 막대
function renderCheckProgress() {
  const total = checklist.items.length;
  const done = checklist.items.filter((item) => item.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  if (!total) checkProgressText.textContent = '아직 항목이 없어요.';
  else if (done === total) checkProgressText.textContent = `🎉 ${total}개 모두 준비 완료!`;
  else checkProgressText.textContent = `${done} / ${total} 완료 (${percent}%)`;

  checkProgressBar.style.width = percent + '%';
  checkProgressBar.classList.toggle('done', total > 0 && done === total);
}

// 목록: 분류별로 묶어서 보여주기
function renderCheckItems() {
  checkList.innerHTML = '';

  for (const group of CHECK_GROUPS) {
    const items = checklist.items.filter((item) => groupOf(item.group).id === group.id);
    if (items.length === 0) continue;

    const head = document.createElement('li');
    head.className = 'group-head';
    const title = document.createElement('span');
    title.textContent = `${group.icon} ${group.name}`;
    const count = document.createElement('span');
    count.textContent = `${items.filter((i) => i.done).length} / ${items.length}`;
    head.append(title, count);
    checkList.append(head);

    items.forEach((item) => checkList.append(makeCheckItem(item)));
  }

  checkEmpty.hidden = checklist.items.length > 0;
}

function makeCheckItem(item) {
  const li = document.createElement('li');
  li.className = 'check-item' + (item.done ? ' done' : '');

  // label로 감싸면 글자를 눌러도 체크돼요
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = item.done;
  box.addEventListener('change', () => toggleCheckItem(item.id));
  const text = document.createElement('span');
  text.textContent = item.text;
  label.append(box, text);

  li.append(label, makeButton('삭제', () => deleteCheckItem(item.id), 'danger'));
  return li;
}

// 체크리스트 화면 전체 다시 그리기
function renderChecklist() {
  renderCheckProgress();
  renderCheckItems();
}

// ---------- 동작 ----------
function toggleCheckItem(id) {
  const item = checklist.items.find((i) => i.id === id);
  if (!item) return;
  item.done = !item.done;
  saveChecklist();
  renderChecklist();
}

function deleteCheckItem(id) {
  const item = checklist.items.find((i) => i.id === id);
  if (!item) return;
  if (!confirm(`'${item.text}'을(를) 목록에서 지울까요?`)) return;
  checklist.items = checklist.items.filter((i) => i.id !== id);
  saveChecklist();
  renderChecklist();
}

// 기본 목록 넣기 (이미 같은 내용이 있으면 건너뛰어서 두 번 눌러도 겹치지 않아요)
function addTemplate(kind) {
  const existing = new Set(checklist.items.map((i) => i.text)); // Set = 중복 없는 목록
  let added = 0;
  for (const [group, text] of TEMPLATES[kind]) {
    if (existing.has(text)) continue;
    checklist.items.push({ id: makeId(), text, group, done: false });
    added++;
  }
  saveChecklist();
  renderChecklist();
  checkMessage.textContent = added ? `${added}개 항목을 추가했어요.` : '이미 다 들어 있어요.';
}

// 체크 모두 해제 (다음 여행 때 목록을 다시 쓰기 좋게)
function uncheckAll() {
  if (!checklist.items.some((i) => i.done)) return;
  if (!confirm('체크를 모두 해제할까요? 항목은 그대로 남아요.')) return;
  checklist.items.forEach((i) => { i.done = false; });
  saveChecklist();
  renderChecklist();
}

// ---------- 이벤트 연결 ----------
checkForm.addEventListener('submit', (e) => {
  e.preventDefault(); // 페이지 새로고침 막기
  const text = checkText.value.trim();
  if (!text) return;
  checklist.items.push({ id: makeId(), text, group: checkGroup.value, done: false });
  saveChecklist();
  checkText.value = ''; // 분류는 그대로 둬서 연달아 입력하기 편하게
  checkMessage.textContent = '';
  renderChecklist();
  checkText.focus();
});

el('template-domestic').addEventListener('click', () => addTemplate('domestic'));
el('template-overseas').addEventListener('click', () => addTemplate('overseas'));
el('uncheck-all-btn').addEventListener('click', uncheckAll);

// ---------- 시작 ----------
for (const g of CHECK_GROUPS) {
  const option = document.createElement('option');
  option.value = g.id;
  option.textContent = `${g.icon} ${g.name}`;
  checkGroup.append(option);
}
renderChecklist();