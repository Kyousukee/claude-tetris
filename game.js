'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#81d4fa', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - steel gray
  '#263238', // Bomb - dark slate
];

const PASTEL_COLORS = [
  null,
  '#b2ebf2', // I
  '#fff9c4', // O
  '#e1bee7', // T
  '#c8e6c9', // S
  '#ffcdd2', // Z
  '#b3e5fc', // J
  '#ffe0b2', // L
  '#eceff1', // Nut
  '#78909c', // Bomb
];

const NEON_COLORS = [
  null,
  '#00e5ff',
  '#ffea00',
  '#e040fb',
  '#00e676',
  '#ff1744',
  '#40c4ff',
  '#ff9100',
  '#e0f7fa',
  '#ff3d00',
];

const SKINS = ['retro', 'neon', 'pastel', 'pixel'];
const SKIN_STORAGE_KEY = 'tetris-skin';

const BOMB_TYPE = 9;
const BOMB_INTERVAL = 5; // lines between bomb spawns
const BOMB_RADIUS = 1;   // 1 => 3x3 blast area
const BOMB_SCORE_PER_BLOCK = 50;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut - hollow center
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#d8dae0' };
const THEME_STORAGE_KEY = 'tetris-theme';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinButtons = document.querySelectorAll('.skin-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let skin = 'retro';
let bombPending = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function makeBomb() {
  return { type: BOMB_TYPE, shape: [[BOMB_TYPE]], x: Math.floor(COLS / 2), y: 0, isBomb: true };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (Math.floor(lines / BOMB_INTERVAL) > Math.floor(prevLines / BOMB_INTERVAL)) {
      bombPending = true;
    }
    updateHUD();
  }
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) values.push(board[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      board[r][c] = values.length ? values.pop() : 0;
    }
  }
}

function explodeBomb() {
  const cx = current.x;
  const cy = current.y;
  let destroyed = 0;
  for (let r = cy - BOMB_RADIUS; r <= cy + BOMB_RADIUS; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = cx - BOMB_RADIUS; c <= cx + BOMB_RADIUS; c++) {
      if (c < 0 || c >= COLS) continue;
      if (board[r][c]) destroyed++;
      board[r][c] = 0;
    }
  }
  score += destroyed * BOMB_SCORE_PER_BLOCK;
  applyGravity();
  clearLines();
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.isBomb) {
    explodeBomb();
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  if (bombPending) {
    next = makeBomb();
    bombPending = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockRetro(context, x, y, colorIndex, size) {
  context.fillStyle = COLORS[colorIndex];
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, colorIndex, size) {
  const color = NEON_COLORS[colorIndex] || COLORS[colorIndex];
  context.shadowBlur = size * 0.6;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(x * size + 2, y * size + 2, size - 4, 3);
}

function drawBlockPastel(context, x, y, colorIndex, size) {
  const color = PASTEL_COLORS[colorIndex] || COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  const r = Math.min(6, w / 3, h / 3);
  context.save();
  roundedRectPath(context, px, py, w, h, r);
  context.fillStyle = color;
  context.fill();
  context.clip();
  context.fillStyle = 'rgba(255,255,255,0.3)';
  context.fillRect(px, py, w, 4);
  context.restore();
}

function drawBlockPixel(context, x, y, colorIndex, size) {
  const color = COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  const cell = Math.max(3, Math.floor(size / 6));
  let row = 0;
  for (let ry = py; ry < py + h; ry += cell, row++) {
    let col = 0;
    for (let rx = px; rx < px + w; rx += cell, col++) {
      if ((row + col) % 2 !== 0) continue;
      const cw = Math.min(cell, px + w - rx);
      const ch = Math.min(cell, py + h - ry);
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(rx, ry, cw, ch);
    }
  }
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(px, py, w, 3);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  switch (skin) {
    case 'neon':
      drawBlockNeon(context, x, y, colorIndex, size);
      break;
    case 'pastel':
      drawBlockPastel(context, x, y, colorIndex, size);
      break;
    case 'pixel':
      drawBlockPixel(context, x, y, colorIndex, size);
      break;
    default:
      drawBlockRetro(context, x, y, colorIndex, size);
  }
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  if (colorIndex === BOMB_TYPE) {
    const cx = x * size + size / 2;
    const cy = y * size + size / 2;
    context.beginPath();
    context.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    context.fillStyle = '#ff7043';
    context.fill();
    context.beginPath();
    context.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
    context.fillStyle = '#ffe0b2';
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin === 'neon' ? 'rgba(255,255,255,0.06)' : (GRID_COLORS[theme] || GRID_COLORS.dark);
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver && !paused) animId = requestAnimationFrame(loop);
}

function applyTheme(next) {
  theme = next === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  if (board && current) draw();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

initTheme();

function updateSkinButtons() {
  skinButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.skin === skin));
}

function applySkin(next) {
  skin = SKINS.includes(next) ? next : 'retro';
  document.documentElement.setAttribute('data-skin', skin);
  localStorage.setItem(SKIN_STORAGE_KEY, skin);
  updateSkinButtons();
  if (board && current) draw();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_STORAGE_KEY);
  applySkin(SKINS.includes(saved) ? saved : 'retro');
}

skinButtons.forEach(btn => {
  btn.addEventListener('click', () => applySkin(btn.dataset.skin));
});

initSkin();

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  bombPending = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
