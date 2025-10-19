const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const gameOverScreen = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');

const box = 20;
const speed = 220; // ms per frame — increased to slow the snake
let snake = [];
let direction = 'RIGHT';
let waterDrop = {};
let score = 0;
let gameInterval; // legacy, kept for reference
let animationId = null; // requestAnimationFrame id
let lastTick = 0; // timestamp of last logical move
let tickInterval = speed; // ms per logical move (adjustable by difficulty)
let prevSnake = []; // store previous logical positions for interpolation
let running = false; // true while game logic should run
// Preload water drop image (match actual filename in img/ which is case-sensitive)
const waterImg = new Image();
waterImg.src = 'img/Waterdrop.png';
let waterImgLoaded = false;
let waterImgNatural = { w: 0, h: 0 };
waterImg.onload = () => { waterImgLoaded = true; waterImgNatural.w = waterImg.naturalWidth; waterImgNatural.h = waterImg.naturalHeight; };

// Preload person image for snake segments
const personImg = new Image();
personImg.src = 'img/Person.png';
let personImgLoaded = false;
let personImgNatural = { w: 0, h: 0 };
personImg.onload = () => { personImgLoaded = true; personImgNatural.w = personImg.naturalWidth; personImgNatural.h = personImg.naturalHeight; };

// Sound: simple WebAudio 'ding' and toggle
let audioCtx = null;
let soundEnabled = true;
const SOUND_KEY = 'wfw_sound_enabled';
// restore preference
try { const stored = localStorage.getItem(SOUND_KEY); if (stored !== null) soundEnabled = stored === '1'; } catch(e) {}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playDing() {
  if (!soundEnabled) return;
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.connect(g);
    g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    o.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    // ignore audio errors
  }
}

// wire up sound toggle UI
window.addEventListener('load', () => {
  const toggle = document.getElementById('soundToggle');
  if (toggle) {
    toggle.checked = soundEnabled;
    toggle.addEventListener('change', (e) => {
      soundEnabled = !!e.target.checked;
      try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch (err) {}
    });
  }
});

function initGame() {
  // clear previous game state / handlers if any
  if (gameInterval) clearInterval(gameInterval);
  if (animationId) cancelAnimationFrame(animationId);
  // avoid multiple key listeners stacking
  document.removeEventListener('keydown', changeDirection);

  snake = [{ x: 5 * box, y: 5 * box }];
  direction = 'RIGHT';
  score = 0;
  // determine target score from difficulty select
  const diff = document.getElementById('difficultySelect')?.value || 'medium';
  let targetScore = 10;
  if (diff === 'easy') targetScore = 5;
  else if (diff === 'hard') targetScore = 15;
  // store on window so other functions can read it
  window.targetScore = targetScore;
  // adjust speed by difficulty (higher difficulty = faster = smaller interval)
  if (diff === 'easy') tickInterval = 300;
  else if (diff === 'medium') tickInterval = 220;
  else if (diff === 'hard') tickInterval = 140;

  scoreDisplay.textContent = `Score: ${score} / ${window.targetScore}`;
  spawnWater();
  document.addEventListener('keydown', changeDirection);
  // initialize previous positions for interpolation
  prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));
  lastTick = performance.now();
  running = true;
  // start RAF loop
  animationId = requestAnimationFrame(loop);
}

function spawnWater() {
  // Compute grid size
  const cols = Math.floor(gameCanvas.width / box);
  const rows = Math.floor(gameCanvas.height / box);

  // We'll leave a one-cell margin around the edge so drops don't appear touching the border
  const minCol = 1;
  const maxCol = Math.max(cols - 2, minCol); // ensure at least one valid column
  const minRow = 1;
  const maxRow = Math.max(rows - 2, minRow);

  // Try generating a position that doesn't overlap the snake. Safety cap to avoid infinite loop.
  let tries = 0;
  const maxTries = 1000;
  let xIndex, yIndex;
  do {
    xIndex = Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol;
    yIndex = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;
    tries++;
    if (tries >= maxTries) break;
  } while (snake.some(seg => seg.x === xIndex * box && seg.y === yIndex * box));

  waterDrop = {
    x: xIndex * box,
    y: yIndex * box
  };
}

function changeDirection(e) {
  if (e.key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
  else if (e.key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
  else if (e.key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
  else if (e.key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
}

function loop(timestamp) {
  if (!running) return; // stop scheduling frames if game not running
  // timestamp provided by RAF; calculate progress since lastTick
  const elapsed = timestamp - lastTick;

  // If enough time passed, perform a logical tick (move snake)
  if (elapsed >= tickInterval) {
    // advance lastTick by multiples of tickInterval to avoid drift
    const steps = Math.floor(elapsed / tickInterval);
    for (let s = 0; s < steps; s++) {
      tick();
    }
    lastTick = timestamp - (elapsed % tickInterval);
  }

  // Calculate interpolation factor for rendering between ticks
  const interp = Math.min(1, (timestamp - lastTick) / tickInterval);

  // Render using interpolated positions
  draw(interp);

  animationId = requestAnimationFrame(loop);
}

function draw(interp = 1) {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  // Draw snake segments (all segments as person images if available, interpolated)
  for (let i = 0; i < snake.length; i++) {
    const prev = prevSnake[i] || snake[i];
    const next = snake[i];
    const segPos = {
      x: Math.round(prev.x + (next.x - prev.x) * interp),
      y: Math.round(prev.y + (next.y - prev.y) * interp)
    };

    if (personImgLoaded && personImgNatural.w && personImgNatural.h) {
      // fit image inside a square box while preserving aspect ratio
      const maxSize = box * 0.9;
      const ratio = personImgNatural.w / personImgNatural.h;
      let drawW = maxSize;
      let drawH = maxSize;
      if (ratio > 1) {
        // wider than tall
        drawH = Math.round(maxSize / ratio);
      } else if (ratio < 1) {
        // taller than wide
        drawW = Math.round(maxSize * ratio);
      }
      const imgX = segPos.x + Math.floor((box - drawW) / 2);
      const imgY = segPos.y + Math.floor((box - drawH) / 2);
      ctx.drawImage(personImg, imgX, imgY, drawW, drawH);
    } else {
      ctx.fillStyle = '#0077b6';
      ctx.fillRect(segPos.x, segPos.y, box - 2, box - 2);
    }
  }

  ctx.fillStyle = '#00b4d8';
  // Try to draw the water drop image centered in the cell. Fall back to a circle.
  if (waterImgLoaded && waterImgNatural.w && waterImgNatural.h) {
    const maxSize = box * 0.8; // slightly smaller than cell
    const ratio = waterImgNatural.w / waterImgNatural.h;
    let drawW = maxSize;
    let drawH = maxSize;
    if (ratio > 1) drawH = Math.round(maxSize / ratio);
    else if (ratio < 1) drawW = Math.round(maxSize * ratio);
    const imgX = waterDrop.x + Math.floor((box - drawW) / 2);
    const imgY = waterDrop.y + Math.floor((box - drawH) / 2);
    ctx.drawImage(waterImg, imgX, imgY, drawW, drawH);
  } else {
    ctx.beginPath();
    ctx.arc(waterDrop.x + box / 2, waterDrop.y + box / 2, box / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rendering-only code stops here. Logical movement handled in tick().
}

// Perform a single logical tick (move snake by one grid cell)
function tick() {
  // store previous positions for interpolation
  prevSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));

  let head = { ...snake[0] };
  if (direction === 'UP') head.y -= box;
  if (direction === 'DOWN') head.y += box;
  if (direction === 'LEFT') head.x -= box;
  if (direction === 'RIGHT') head.x += box;

  if (head.x === waterDrop.x && head.y === waterDrop.y) {
    score++;
    scoreDisplay.textContent = `Score: ${score} / ${window.targetScore || 10}`;
    // If player reached the target score, they win
    if (score >= (window.targetScore || 10)) {
      winGame();
      return;
    }
    // Play ding (resume audio context on user gesture if needed)
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    playDing();
    spawnWater();
  } else {
    snake.pop();
  }

  if (
    head.x < 0 ||
    head.x >= gameCanvas.width ||
    head.y < 0 ||
    head.y >= gameCanvas.height ||
    snakeCollision(head)
  ) {
    gameOver();
    return;
  }

  snake.unshift(head);
}

function snakeCollision(head) {
  return snake.some((segment) => segment.x === head.x && segment.y === head.y);
}

function gameOver() {
  if (gameInterval) clearInterval(gameInterval);
  if (animationId) cancelAnimationFrame(animationId);
  running = false;
  gameCanvas.style.display = 'none';
  scoreDisplay.style.display = 'none';
  gameOverScreen.style.display = 'block';
  finalScore.textContent = `Score: ${score}`;
  // hide subtitle on game over
  const subtitleEl = document.getElementById('subtitle');
  if (subtitleEl) subtitleEl.style.display = 'none';
}

function winGame() {
  if (gameInterval) clearInterval(gameInterval);
  if (animationId) cancelAnimationFrame(animationId);
  running = false;
  gameCanvas.style.display = 'none';
  scoreDisplay.style.display = 'none';
  gameOverScreen.style.display = 'block';
  finalScore.textContent = `You win! Final score: ${score}`;
  const subtitleEl = document.getElementById('subtitle');
  if (subtitleEl) subtitleEl.style.display = 'none';
}

startBtn.onclick = () => {
  startBtn.style.display = 'none';
  gameCanvas.style.display = 'block';
  scoreDisplay.style.display = 'block';
  // ensure subtitle visible when starting a game
  const subtitleEl = document.getElementById('subtitle');
  if (subtitleEl) subtitleEl.style.display = 'block';
  initGame();
};

restartBtn.onclick = () => {
  gameOverScreen.style.display = 'none';
  gameCanvas.style.display = 'block';
  scoreDisplay.style.display = 'block';
  // show subtitle again when restarting
  const subtitleEl = document.getElementById('subtitle');
  if (subtitleEl) subtitleEl.style.display = 'block';
  initGame();
};
