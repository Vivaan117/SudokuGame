// ── PUZZLES ──────────────────────────────────────────────────────────────────
const PUZZLES = {
  easy: [
    [5,3,0,0,7,0,0,0,0],
    [6,0,0,1,9,5,0,0,0],
    [0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],
    [4,0,0,8,0,3,0,0,1],
    [7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],
    [0,0,0,4,1,9,0,0,5],
    [0,0,0,0,8,0,0,7,9]
  ],
  medium: [
    [0,2,0,6,0,8,0,0,0],
    [5,8,0,0,0,9,7,0,0],
    [0,0,0,0,4,0,0,0,0],
    [3,7,0,0,0,0,5,0,0],
    [6,0,0,0,0,0,0,0,4],
    [0,0,8,0,0,0,0,1,3],
    [0,0,0,0,2,0,0,0,0],
    [0,0,9,8,0,0,0,3,6],
    [0,0,0,3,0,6,0,9,0]
  ],
  hard: [
    [8,0,0,0,0,0,0,0,0],
    [0,0,3,6,0,0,0,0,0],
    [0,7,0,0,9,0,2,0,0],
    [0,5,0,0,0,7,0,0,0],
    [0,0,0,0,4,5,7,0,0],
    [0,0,0,1,0,0,0,3,0],
    [0,0,1,0,0,0,0,6,8],
    [0,0,8,5,0,0,0,1,0],
    [0,9,0,0,0,0,4,0,0]
  ],
  blank: Array(9).fill(null).map(() => Array(9).fill(0))
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let selectedCell  = null;
let notesMode     = false;
let errorCount    = 0;
let history       = [];
let timerInterval = null;
let timerStart    = null;
let gameStarted   = false;
let difficulty    = 'easy';
let notes         = Array(81).fill(null).map(() => new Set());
let givenCells    = new Set();
let toastTimeout;

const gridEl = document.getElementById('grid');

// ── GRID BUILD ────────────────────────────────────────────────────────────────
function buildGrid() {
  gridEl.innerHTML = '';
  for (let i = 0; i < 81; i++) {
    const row  = Math.floor(i / 9);
    const col  = i % 9;
    const cell = document.createElement('div');

    cell.className    = 'cell';
    cell.dataset.row  = row;
    cell.dataset.col  = col;
    cell.dataset.idx  = i;

    const inp       = document.createElement('input');
    inp.type        = 'text';
    inp.inputMode   = 'numeric';
    inp.maxLength   = 1;
    inp.readOnly    = true;

    cell.appendChild(inp);
    cell.addEventListener('click', () => selectCell(i));
    gridEl.appendChild(cell);
  }
}

// ── CELL SELECTION & HIGHLIGHTS ───────────────────────────────────────────────
function selectCell(idx) {
  if (!gameStarted) startTimer();
  selectedCell = idx;
  updateHighlights();
}

function updateHighlights() {
  const cells  = gridEl.querySelectorAll('.cell');
  const row    = Math.floor(selectedCell / 9);
  const col    = selectedCell % 9;
  const boxR   = Math.floor(row / 3) * 3;
  const boxC   = Math.floor(col / 3) * 3;
  const selVal = cells[selectedCell]?.querySelector('input')?.value;

  cells.forEach((c, i) => {
    c.classList.remove('selected', 'highlighted-row', 'highlighted-box', 'same-number');
    const r = Math.floor(i / 9), cc = i % 9;

    if (i === selectedCell) {
      c.classList.add('selected');
    } else if (r === row || cc === col) {
      c.classList.add('highlighted-row');
    } else if (r >= boxR && r < boxR + 3 && cc >= boxC && cc < boxC + 3) {
      c.classList.add('highlighted-box');
    }

    if (selVal && selVal !== '' && c.querySelector('input').value === selVal) {
      c.classList.add('same-number');
    }
  });
}

// ── NUMPAD ────────────────────────────────────────────────────────────────────
function buildNumpad() {
  const pad = document.getElementById('numpad');
  pad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn       = document.createElement('button');
    btn.className   = 'num-btn';
    btn.textContent = n;
    btn.dataset.num = n;
    btn.onclick     = () => enterNumber(n.toString());
    pad.appendChild(btn);
  }
}

function updateNumpadExhaustion() {
  // Count placed digits
  const counts = {};
  for (let n = 1; n <= 9; n++) counts[n] = 0;
  gridEl.querySelectorAll('.cell input').forEach(inp => {
    if (inp.value) counts[parseInt(inp.value)]++;
  });

  // Grey out buttons for completed digits
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.classList.toggle('exhausted', counts[parseInt(btn.dataset.num)] >= 9);
  });

  // Update remaining count
  const total  = gridEl.querySelectorAll('.cell input').length;
  const filled = [...gridEl.querySelectorAll('.cell input')].filter(i => i.value).length;
  document.getElementById('left-val').textContent = total - filled;
}

// ── ENTER NUMBER ──────────────────────────────────────────────────────────────
function enterNumber(val) {
  if (selectedCell === null) return;

  const cells = gridEl.querySelectorAll('.cell');
  const cell  = cells[selectedCell];
  if (cell.classList.contains('given')) return;

  if (!gameStarted) startTimer();

  // Notes mode
  if (notesMode && val !== '') {
    toggleNote(selectedCell, val);
    return;
  }

  // Save undo snapshot
  const inp = cell.querySelector('input');
  history.push({
    idx:   selectedCell,
    old:   inp.value,
    notes: JSON.stringify([...notes[selectedCell]])
  });

  // Clear notes for this cell and set the value
  notes[selectedCell].clear();
  renderCell(selectedCell);

  inp.value = val;
  cell.classList.remove('error', 'solved-anim');

  if (val && !isValidPlacement(selectedCell, val)) {
    cell.classList.add('error');
    errorCount++;
    document.getElementById('errors-val').textContent = errorCount;
  } else if (val) {
    cell.classList.add('solved-anim');
    setTimeout(() => cell.classList.remove('solved-anim'), 300);
  }

  updateHighlights();
  updateNumpadExhaustion();
  checkWin();
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
function toggleNote(idx, val) {
  const n = parseInt(val);
  if (notes[idx].has(n)) notes[idx].delete(n);
  else notes[idx].add(n);
  renderCell(idx);
}

function renderCell(idx) {
  const cell = gridEl.querySelectorAll('.cell')[idx];
  const inp  = cell.querySelector('input');

  if (notes[idx].size > 0 && !inp.value) {
    let notesGrid = cell.querySelector('.notes-grid');
    if (!notesGrid) {
      notesGrid           = document.createElement('div');
      notesGrid.className = 'notes-grid';
      cell.appendChild(notesGrid);
      cell.classList.add('notes-mode');
    }
    notesGrid.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const d           = document.createElement('div');
      d.className       = 'note-digit';
      d.textContent     = notes[idx].has(n) ? n : '';
      notesGrid.appendChild(d);
    }
  } else {
    const notesGrid = cell.querySelector('.notes-grid');
    if (notesGrid) {
      notesGrid.remove();
      cell.classList.remove('notes-mode');
    }
  }
}

function toggleNotes() {
  notesMode = !notesMode;
  const btn = document.getElementById('notes-btn');
  btn.classList.toggle('notes-active', notesMode);
  showToast(notesMode ? 'Notes mode on' : 'Notes mode off');
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') { enterNumber(e.key); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { enterNumber(''); return; }
  if (selectedCell === null) return;

  const row = Math.floor(selectedCell / 9);
  const col = selectedCell % 9;
  let nr = row, nc = col;

  if (e.key === 'ArrowUp')    { nr = (row + 8) % 9; e.preventDefault(); }
  if (e.key === 'ArrowDown')  { nr = (row + 1) % 9; e.preventDefault(); }
  if (e.key === 'ArrowLeft')  { nc = (col + 8) % 9; e.preventDefault(); }
  if (e.key === 'ArrowRight') { nc = (col + 1) % 9; e.preventDefault(); }
  if (e.key === 'n' || e.key === 'N') toggleNotes();
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }

  selectCell(nr * 9 + nc);
});

// ── VALIDATION ────────────────────────────────────────────────────────────────
function isValidPlacement(idx, val) {
  const board = getBoard();
  const row   = Math.floor(idx / 9);
  const col   = idx % 9;
  const num   = parseInt(val);

  for (let c = 0; c < 9; c++) if (c !== col && board[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (r !== row && board[r][col] === num) return false;

  const sr = Math.floor(row / 3) * 3;
  const sc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if ((sr + r !== row || sc + c !== col) && board[sr + r][sc + c] === num) return false;

  return true;
}

function validateBoard() {
  const cells = gridEl.querySelectorAll('.cell');
  let hasError = false;

  cells.forEach((cell, i) => {
    const inp = cell.querySelector('input');
    cell.classList.remove('error');
    if (inp.value && !cell.classList.contains('given')) {
      if (!isValidPlacement(i, inp.value)) {
        cell.classList.add('error');
        hasError = true;
      }
    }
  });

  if (hasError) showToast('Some cells have conflicts', 'error-toast');
  else          showToast('Looking good! No conflicts found ✓', 'success');
}

// ── UNDO ──────────────────────────────────────────────────────────────────────
function undo() {
  if (!history.length) return;
  const last  = history.pop();
  const cells = gridEl.querySelectorAll('.cell');
  const cell  = cells[last.idx];
  const inp   = cell.querySelector('input');

  inp.value          = last.old;
  notes[last.idx]    = new Set(JSON.parse(last.notes));
  renderCell(last.idx);
  cell.classList.remove('error', 'solved-anim');
  updateHighlights();
  updateNumpadExhaustion();
}

// ── SOLVER ────────────────────────────────────────────────────────────────────
function getBoard() {
  const inputs = gridEl.querySelectorAll('.cell input');
  const board  = [];
  for (let i = 0; i < 9; i++) {
    const row = [];
    for (let j = 0; j < 9; j++) {
      const val = inputs[i * 9 + j].value;
      row.push(val ? parseInt(val) : 0);
    }
    board.push(row);
  }
  return board;
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const sr = Math.floor(row / 3) * 3;
  const sc = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (board[sr + i][sc + j] === num) return false;
  return true;
}

function solve(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solve(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

async function solveSudoku() {
  const board = getBoard();
  if (!solve(board)) {
    showToast('No solution exists for this puzzle', 'error-toast');
    return;
  }

  gridEl.classList.add('solving');
  const inputs = gridEl.querySelectorAll('.cell input');
  const cells  = gridEl.querySelectorAll('.cell');

  // Collect empty cells to animate
  const toFill = [];
  for (let i = 0; i < 81; i++) {
    if (!inputs[i].value) {
      toFill.push({ i, val: board[Math.floor(i / 9)][i % 9] });
    }
  }

  // Reveal one cell at a time
  for (const { i, val } of toFill) {
    await new Promise(r => setTimeout(r, 18));
    inputs[i].value = val;
    cells[i].classList.remove('error');
    cells[i].classList.add('solved-anim');
    setTimeout(() => cells[i].classList.remove('solved-anim'), 300);
  }

  gridEl.classList.remove('solving');
  updateNumpadExhaustion();
  setTimeout(checkWin, 100);
}

// ── GAME MANAGEMENT ───────────────────────────────────────────────────────────
function loadPuzzle(puz) {
  const cells = gridEl.querySelectorAll('.cell');
  givenCells.clear();
  notes      = Array(81).fill(null).map(() => new Set());
  history    = [];
  errorCount = 0;
  document.getElementById('errors-val').textContent = 0;

  for (let i = 0; i < 81; i++) {
    const r    = Math.floor(i / 9);
    const c    = i % 9;
    const cell = cells[i];
    const inp  = cell.querySelector('input');
    const v    = puz[r][c];
    const ng   = cell.querySelector('.notes-grid');

    if (ng) ng.remove();
    cell.classList.remove('given','error','solved-anim','notes-mode','selected','highlighted-row','highlighted-box','same-number');
    inp.value = v || '';

    if (v) {
      cell.classList.add('given');
      givenCells.add(i);
    }
  }
  updateNumpadExhaustion();
}

function setDifficulty(d) {
  difficulty = d;
  document.querySelectorAll('.diff-tab').forEach(t => {
    t.classList.toggle('active',
      t.textContent.toLowerCase() === d ||
      (d === 'blank' && t.textContent === 'Blank')
    );
  });
  newGame();
}

function newGame() {
  stopTimer();
  resetTimer();
  gameStarted  = false;
  selectedCell = null;
  loadPuzzle(PUZZLES[difficulty]);
  document.getElementById('win-overlay').classList.remove('show');
}

function clearGrid() {
  const cells = gridEl.querySelectorAll('.cell');
  notes   = Array(81).fill(null).map(() => new Set());
  history = [];

  cells.forEach(cell => {
    if (!cell.classList.contains('given')) {
      const inp = cell.querySelector('input');
      const ng  = cell.querySelector('.notes-grid');
      inp.value = '';
      cell.classList.remove('error', 'solved-anim', 'notes-mode');
      if (ng) ng.remove();
    }
  });
  updateNumpadExhaustion();
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  if (gameStarted) return;
  gameStarted   = true;
  timerStart    = Date.now();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  timerStart = null;
  document.getElementById('timer-val').textContent = '00:00';
}

function updateTimerDisplay() {
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  document.getElementById('timer-val').textContent = `${m}:${s}`;
}

function getTimerString() {
  return document.getElementById('timer-val').textContent;
}

// ── WIN CHECK ─────────────────────────────────────────────────────────────────
function checkWin() {
  const inputs    = gridEl.querySelectorAll('.cell input');
  const allFilled = [...inputs].every(i => i.value);
  if (!allFilled) return;

  const board = getBoard();
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (!isValid(board, r, c, board[r][c])) return;

  stopTimer();
  document.getElementById('win-time').textContent   = getTimerString();
  document.getElementById('win-errors').textContent = errorCount;
  setTimeout(() => document.getElementById('win-overlay').classList.add('show'), 500);
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, cls = '') {
  const t    = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'show ' + cls;
  clearTimeout(toastTimeout);
  toastTimeout  = setTimeout(() => { t.className = ''; }, 2500);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
buildGrid();
buildNumpad();
loadPuzzle(PUZZLES.easy);
