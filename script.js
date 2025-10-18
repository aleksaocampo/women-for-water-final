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
let gameInterval;

function initGame() {
  // clear previous game state / handlers if any
  clearInterval(gameInterval);
  // avoid multiple key listeners stacking
  document.removeEventListener('keydown', changeDirection);

  snake = [{ x: 5 * box, y: 5 * box }];
  direction = 'RIGHT';
  score = 0;
  scoreDisplay.textContent = `Score: ${score}`;
  spawnWater();
  document.addEventListener('keydown', changeDirection);
  gameInterval = setInterval(draw, speed);
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

function draw() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  ctx.fillStyle = '#0077b6';
  snake.forEach((segment) => {
    ctx.fillRect(segment.x, segment.y, box - 2, box - 2);
  });

  ctx.fillStyle = '#00b4d8';
  ctx.beginPath();
  ctx.arc(waterDrop.x + box / 2, waterDrop.y + box / 2, box / 3, 0, Math.PI * 2);
  ctx.fill();

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
  clearInterval(gameInterval);
  gameCanvas.style.display = 'none';
  scoreDisplay.style.display = 'none';
  gameOverScreen.style.display = 'block';
  finalScore.textContent = `Score: ${score}`;
}

function winGame() {
  clearInterval(gameInterval);
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
