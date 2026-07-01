const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const keys = {};

const ballRadius = 15;
const moveSpeed = 230;
const idealStringLength = 460;
const overStretchLength = 560;
const finish = {
  x: WIDTH / 2,
  y: HEIGHT - 74,
  radius: 34
};

const blackBall = {
  x: 190,
  y: 82,
  vx: 0,
  vy: 0,
  color: "#111111"
};

const whiteBall = {
  x: WIDTH - 190,
  y: 82,
  vx: 0,
  vy: 0,
  color: "#ffffff"
};

// Each dot uses its own movement range, speed, and pulse timing.
const dots = [
  { x: 210, y: 190, rx: 25, ry: 16, sx: 0.9, sy: 0.5, r: 16, pulse: 3, ps: 2.1, phase: 0.2 },
  { x: 360, y: 155, rx: 18, ry: 26, sx: 0.6, sy: 1.0, r: 13, pulse: 4, ps: 1.6, phase: 1.1 },
  { x: 520, y: 185, rx: 34, ry: 12, sx: 0.8, sy: 0.7, r: 17, pulse: 3, ps: 1.9, phase: 2.4 },
  { x: 690, y: 150, rx: 22, ry: 28, sx: 0.7, sy: 0.9, r: 14, pulse: 4, ps: 1.8, phase: 3.3 },
  { x: 150, y: 310, rx: 38, ry: 18, sx: 0.5, sy: 0.8, r: 15, pulse: 3, ps: 2.4, phase: 4.0 },
  { x: 300, y: 300, rx: 19, ry: 35, sx: 1.0, sy: 0.6, r: 18, pulse: 3, ps: 1.5, phase: 2.9 },
  { x: 455, y: 285, rx: 42, ry: 14, sx: 0.4, sy: 1.1, r: 14, pulse: 4, ps: 2.0, phase: 5.1 },
  { x: 610, y: 315, rx: 25, ry: 34, sx: 0.8, sy: 0.5, r: 16, pulse: 3, ps: 1.7, phase: 0.8 },
  { x: 760, y: 285, rx: 30, ry: 20, sx: 0.6, sy: 0.9, r: 13, pulse: 5, ps: 2.2, phase: 1.7 },
  { x: 220, y: 430, rx: 28, ry: 30, sx: 0.7, sy: 0.7, r: 17, pulse: 4, ps: 1.4, phase: 3.8 },
  { x: 375, y: 445, rx: 34, ry: 18, sx: 0.9, sy: 0.4, r: 14, pulse: 3, ps: 2.5, phase: 2.2 },
  { x: 535, y: 420, rx: 20, ry: 32, sx: 0.5, sy: 1.0, r: 15, pulse: 5, ps: 1.8, phase: 4.7 },
  { x: 700, y: 445, rx: 36, ry: 14, sx: 0.8, sy: 0.6, r: 16, pulse: 3, ps: 2.3, phase: 5.6 }
];

let time = 0;
let lastTime = 0;
let won = false;
let flashMessage = "";
let flashTimer = 0;

function resetGame(message = "") {
  blackBall.x = 190;
  blackBall.y = 82;
  blackBall.vx = 0;
  blackBall.vy = 0;

  whiteBall.x = WIDTH - 190;
  whiteBall.y = 82;
  whiteBall.vx = 0;
  whiteBall.vy = 0;

  won = false;
  flashMessage = message;
  flashTimer = message ? 1.1 : 0;
}

function updateBallFromInput(ball, up, left, down, right, dt) {
  let inputX = 0;
  let inputY = 0;

  if (keys[left]) inputX -= 1;
  if (keys[right]) inputX += 1;
  if (keys[up]) inputY -= 1;
  if (keys[down]) inputY += 1;

  // Normalize diagonal movement so it is not faster than straight movement.
  const length = Math.hypot(inputX, inputY);
  if (length > 0) {
    inputX /= length;
    inputY /= length;
  }

  ball.vx += inputX * moveSpeed * 6 * dt;
  ball.vy += inputY * moveSpeed * 6 * dt;
}

function applyStringPull(dt) {
  const dx = whiteBall.x - blackBall.x;
  const dy = whiteBall.y - blackBall.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= overStretchLength) return;

  const nx = dx / distance;
  const ny = dy / distance;
  const stretch = distance - idealStringLength;
  const pull = stretch * 3.6 * dt;

  // The pull is shared, nudging both players back toward cooperation.
  blackBall.vx += nx * pull;
  blackBall.vy += ny * pull;
  whiteBall.vx -= nx * pull;
  whiteBall.vy -= ny * pull;
}

function moveBall(ball, dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Gentle friction keeps the movement smooth but controllable.
  ball.vx *= 0.84;
  ball.vy *= 0.84;

  ball.x = clamp(ball.x, ballRadius, WIDTH - ballRadius);
  ball.y = clamp(ball.y, ballRadius, HEIGHT - ballRadius);
}

function getDotPosition(dot) {
  return {
    x: dot.x + Math.sin(time * dot.sx + dot.phase) * dot.rx,
    y: dot.y + Math.cos(time * dot.sy + dot.phase) * dot.ry,
    radius: dot.r + Math.sin(time * dot.ps + dot.phase) * dot.pulse
  };
}

function checkCollisions() {
  for (const dot of dots) {
    const liveDot = getDotPosition(dot);

    if (circleTouchingBall(liveDot, blackBall) || circleTouchingBall(liveDot, whiteBall)) {
      resetGame("Dot touched. Try again.");
      return;
    }

    if (circleTouchingLine(liveDot, blackBall, whiteBall)) {
      resetGame("String touched. Try again.");
      return;
    }
  }
}

function checkWin() {
  const blackInFinish = distance(blackBall.x, blackBall.y, finish.x, finish.y) < finish.radius;
  const whiteInFinish = distance(whiteBall.x, whiteBall.y, finish.x, finish.y) < finish.radius;
  const ballsTogether = distance(blackBall.x, blackBall.y, whiteBall.x, whiteBall.y) < ballRadius * 2.4;

  won = blackInFinish && whiteInFinish && ballsTogether;
}

function update(dt) {
  if (flashTimer > 0) {
    flashTimer -= dt;
  }

  if (won) return;

  updateBallFromInput(blackBall, "w", "a", "s", "d", dt);
  updateBallFromInput(whiteBall, "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", dt);
  applyStringPull(dt);
  moveBall(blackBall, dt);
  moveBall(whiteBall, dt);
  checkCollisions();
  checkWin();
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawFinish();
  drawDots();
  drawString();
  drawBall(blackBall);
  drawBall(whiteBall);
  drawStatusText();
}

function drawFinish() {
  ctx.save();
  ctx.shadowColor = "rgba(44, 190, 93, 0.75)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "rgba(44, 190, 93, 0.22)";
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(44, 190, 93, 0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawDots() {
  ctx.fillStyle = "rgba(120, 120, 120, 0.34)";

  for (const dot of dots) {
    const liveDot = getDotPosition(dot);
    ctx.beginPath();
    ctx.arc(liveDot.x, liveDot.y, liveDot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawString() {
  const stringLength = distance(blackBall.x, blackBall.y, whiteBall.x, whiteBall.y);
  const overStretched = stringLength > overStretchLength;

  ctx.strokeStyle = overStretched ? "#e33434" : "#9a9a9a";
  ctx.lineWidth = overStretched ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(blackBall.x, blackBall.y);
  ctx.lineTo(whiteBall.x, whiteBall.y);
  ctx.stroke();
}

function drawBall(ball) {
  ctx.fillStyle = ball.color;
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawStatusText() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 42px Arial, Helvetica, sans-serif";

  if (won) {
    ctx.fillStyle = "#1d9f52";
    ctx.shadowColor = "rgba(44, 190, 93, 0.6)";
    ctx.shadowBlur = 18;
    ctx.fillText("You Win!", WIDTH / 2, HEIGHT / 2);
  } else if (flashTimer > 0) {
    ctx.font = "700 24px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "#e33434";
    ctx.fillText(flashMessage, WIDTH / 2, 58);
  }

  ctx.restore();
}

function circleTouchingBall(circle, ball) {
  return distance(circle.x, circle.y, ball.x, ball.y) < circle.radius + ballRadius;
}

function circleTouchingLine(circle, start, end) {
  const lineDistance = distanceFromPointToSegment(circle.x, circle.y, start.x, start.y, end.x, end.y);
  return lineDistance < circle.radius + 2;
}

function distanceFromPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distance(px, py, ax, ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  return distance(px, py, closestX, closestY);
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;
  time += dt;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;

  if (key === "r") {
    resetGame();
  }

  // Stop arrow keys from scrolling the page while Player 2 moves.
  if (key.startsWith("Arrow")) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = false;
});

resetGame();
requestAnimationFrame(gameLoop);
