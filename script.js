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
const tickInterval = speed; // ms per logical move
let prevSnake = []; // store previous logical positions for interpolation
let running = false; // true while game logic should run
// Preload water drop image (match actual filename in img/ which is case-sensitive)
const waterImg = new Image();
waterImg.src = 'img/Waterdrop.png';
let waterImgLoaded = false;
waterImg.onload = () => { waterImgLoaded = true; };

function initGame() {
  // clear previous game state / handlers if any
  if (gameInterval) clearInterval(gameInterval);
  if (animationId) cancelAnimationFrame(animationId);
  // avoid multiple key listeners stacking
  document.removeEventListener('keydown', changeDirection);

  snake = [{ x: 5 * box, y: 5 * box }];
  direction = 'RIGHT';
  score = 0;
  scoreDisplay.textContent = `Score: ${score}`;
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
  // Draw body segments as squares (skip index 0 which is the head)
  ctx.fillStyle = '#0077b6';
  for (let i = 1; i < snake.length; i++) {
    const segment = snake[i];
    ctx.fillRect(segment.x, segment.y, box - 2, box - 2);
  }

  // Draw head as a triangle pointing in the current direction
  if (snake.length > 0) {
    // interpolate head position between prevSnake[0] and snake[0]
    const prevHead = prevSnake[0] || snake[0];
    const nextHead = snake[0];
    const headPos = {
      x: Math.round(prevHead.x + (nextHead.x - prevHead.x) * interp),
      y: Math.round(prevHead.y + (nextHead.y - prevHead.y) * interp)
    };
    const padding = 2; // small padding so the triangle doesn't touch the border
    ctx.fillStyle = '#023e8a';
    ctx.beginPath();
    if (direction === 'RIGHT') {
      ctx.moveTo(headPos.x + box - padding, headPos.y + box / 2); // tip
      ctx.lineTo(headPos.x + padding, headPos.y + padding);
      ctx.lineTo(headPos.x + padding, headPos.y + box - padding);
    } else if (direction === 'LEFT') {
      ctx.moveTo(headPos.x + padding, headPos.y + box / 2);
      ctx.lineTo(headPos.x + box - padding, headPos.y + padding);
      ctx.lineTo(headPos.x + box - padding, headPos.y + box - padding);
    } else if (direction === 'UP') {
      ctx.moveTo(headPos.x + box / 2, headPos.y + padding);
      ctx.lineTo(headPos.x + padding, headPos.y + box - padding);
      ctx.lineTo(headPos.x + box - padding, headPos.y + box - padding);
    } else if (direction === 'DOWN') {
      ctx.moveTo(headPos.x + box / 2, headPos.y + box - padding);
      ctx.lineTo(headPos.x + padding, headPos.y + padding);
      ctx.lineTo(headPos.x + box - padding, headPos.y + padding);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#00b4d8';
  // Try to draw the water drop image centered in the cell. Fall back to a circle.
  if (waterImgLoaded) {
    const imgSize = Math.round(box * 0.8); // slightly smaller than cell
    const imgX = waterDrop.x + Math.floor((box - imgSize) / 2);
    const imgY = waterDrop.y + Math.floor((box - imgSize) / 2);
    ctx.drawImage(waterImg, imgX, imgY, imgSize, imgSize);
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
    scoreDisplay.textContent = `Score: ${score}`;
    // If player reached the target score, they win
    if (score >= 10) {
      winGame();
      return;
    }
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
}

function winGame() {
  if (gameInterval) clearInterval(gameInterval);
  if (animationId) cancelAnimationFrame(animationId);
  running = false;
  gameCanvas.style.display = 'none';
  scoreDisplay.style.display = 'none';
  gameOverScreen.style.display = 'block';
  finalScore.textContent = `You win! Final score: ${score}`;
}

startBtn.onclick = () => {
  startBtn.style.display = 'none';
  gameCanvas.style.display = 'block';
  scoreDisplay.style.display = 'block';
  initGame();
};

restartBtn.onclick = () => {
  gameOverScreen.style.display = 'none';
  gameCanvas.style.display = 'block';
  scoreDisplay.style.display = 'block';
  initGame();
};
