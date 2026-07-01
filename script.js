// YO-YO CONVERGENCE
// A small cooperative canvas game with two tethered players.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};

const game = {
  width: canvas.width,
  height: canvas.height,
  time: 0,
  won: false,
  resetFlash: 0
};

const ballRadius = 14;
const finishRadius = 38;
const idealStringLength = 190;
const maxStringLength = 245;

const blackBall = {
  x: 120,
  y: 150,
  vx: 0,
  vy: 0,
  color: "#111111"
};

const whiteBall = {
  x: 780,
  y: 150,
  vx: 0,
  vy: 0,
  color: "#ffffff"
};

// Each obstacle has a home position, separate movement ranges, and its own speed.
const obstacles = [
  { x: 0.18, y: 0.38, r: 18, dx: 40, dy: 22, sx: 0.8, sy: 1.2, pulse: 1.7 },
  { x: 0.34, y: 0.24, r: 13, dx: 28, dy: 45, sx: 1.3, sy: 0.7, pulse: 2.1 },
  { x: 0.50, y: 0.35, r: 19, dx: 55, dy: 30, sx: 0.6, sy: 1.0, pulse: 1.4 },
  { x: 0.68, y: 0.25, r: 15, dx: 35, dy: 55, sx: 1.1, sy: 0.9, pulse: 1.9 },
  { x: 0.82, y: 0.40, r: 17, dx: 48, dy: 25, sx: 0.9, sy: 1.4, pulse: 2.3 },
  { x: 0.25, y: 0.58, r: 16, dx: 60, dy: 32, sx: 0.7, sy: 1.1, pulse: 1.8 },
  { x: 0.43, y: 0.62, r: 12, dx: 30, dy: 48, sx: 1.5, sy: 0.8, pulse: 2.5 },
  { x: 0.60, y: 0.56, r: 18, dx: 45, dy: 35, sx: 0.8, sy: 1.3, pulse: 1.6 },
  { x: 0.76, y: 0.64, r: 14, dx: 34, dy: 50, sx: 1.2, sy: 0.6, pulse: 2.0 },
  { x: 0.52, y: 0.78, r: 16, dx: 70, dy: 18, sx: 0.5, sy: 1.6, pulse: 1.5 }
];

function resetGame() {
  blackBall.x = 120;
  blackBall.y = 150;
  blackBall.vx = 0;
  blackBall.vy = 0;

  whiteBall.x = game.width - 120;
  whiteBall.y = 150;
  whiteBall.vx = 0;
  whiteBall.vy = 0;

  game.time = 0;
  game.won = false;
  game.resetFlash = 12;
}

function updateBallFromInput(ball, up, down, left, right) {
  const acceleration = 0.34;

  if (keys[up]) ball.vy -= acceleration;
  if (keys[down]) ball.vy += acceleration;
  if (keys[left]) ball.vx -= acceleration;
  if (keys[right]) ball.vx += acceleration;
}

function moveBall(ball) {
  const friction = 0.88;
  const maxSpeed = 4.2;

  ball.vx *= friction;
  ball.vy *= friction;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Keep each yo-yo ball inside the canvas.
  ball.x = clamp(ball.x, ballRadius, game.width - ballRadius);
  ball.y = clamp(ball.y, ballRadius, game.height - ballRadius);
}

function applyStringPull() {
  const dx = whiteBall.x - blackBall.x;
  const dy = whiteBall.y - blackBall.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= idealStringLength) return;

  const nx = dx / distance;
  const ny = dy / distance;
  const stretch = distance - idealStringLength;
  const pullStrength = stretch > maxStringLength - idealStringLength ? 0.032 : 0.014;
  const force = stretch * pullStrength;

  // Both balls are gently pulled toward the other end of the string.
  blackBall.vx += nx * force;
  blackBall.vy += ny * force;
  whiteBall.vx -= nx * force;
  whiteBall.vy -= ny * force;
}

function getObstaclePosition(obstacle) {
  return {
    x: obstacle.x * game.width + Math.sin(game.time * obstacle.sx) * obstacle.dx,
    y: obstacle.y * game.height + Math.cos(game.time * obstacle.sy) * obstacle.dy,
    r: obstacle.r + Math.sin(game.time * obstacle.pulse) * 4
  };
}

function checkCollisions() {
  for (const obstacle of obstacles) {
    const dot = getObstaclePosition(obstacle);

    if (circleTouchesBall(dot, blackBall) || circleTouchesBall(dot, whiteBall)) {
      resetGame();
      return;
    }

    if (circleTouchesLine(dot, blackBall, whiteBall)) {
      resetGame();
      return;
    }
  }
}

function circleTouchesBall(circle, ball) {
  return Math.hypot(circle.x - ball.x, circle.y - ball.y) < circle.r + ballRadius;
}

function circleTouchesLine(circle, start, end) {
  const distance = distanceFromPointToSegment(circle.x, circle.y, start.x, start.y, end.x, end.y);
  return distance < circle.r + 2;
}

function distanceFromPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

function checkWin() {
  const finish = getFinish();
  const blackInFinish = Math.hypot(blackBall.x - finish.x, blackBall.y - finish.y) < finishRadius - 4;
  const whiteInFinish = Math.hypot(whiteBall.x - finish.x, whiteBall.y - finish.y) < finishRadius - 4;
  const ballsTogether = Math.hypot(blackBall.x - whiteBall.x, blackBall.y - whiteBall.y) < 34;

  if (blackInFinish && whiteInFinish && ballsTogether) {
    game.won = true;
    blackBall.vx = 0;
    blackBall.vy = 0;
    whiteBall.vx = 0;
    whiteBall.vy = 0;
  }
}

function getFinish() {
  return {
    x: game.width / 2,
    y: game.height - 80
  };
}

function update() {
  if (!game.won) {
    game.time += 0.016;

    updateBallFromInput(blackBall, "w", "s", "a", "d");
    updateBallFromInput(whiteBall, "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight");

    applyStringPull();
    moveBall(blackBall);
    moveBall(whiteBall);
    checkCollisions();
    checkWin();
  }

  if (game.resetFlash > 0) {
    game.resetFlash -= 1;
  }
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);

  drawFinish();
  drawObstacles();
  drawString();
  drawBall(blackBall, true);
  drawBall(whiteBall, false);
  drawHud();
}

function drawFinish() {
  const finish = getFinish();

  ctx.save();
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finishRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(54, 209, 93, 0.20)";
  ctx.shadowColor = "rgba(54, 209, 93, 0.85)";
  ctx.shadowBlur = 22;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finishRadius * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(54, 209, 93, 0.55)";
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    const dot = getObstaclePosition(obstacle);

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120, 120, 120, 0.34)";
    ctx.fill();
  }
}

function drawString() {
  const distance = Math.hypot(whiteBall.x - blackBall.x, whiteBall.y - blackBall.y);
  const overstretched = distance > maxStringLength;

  ctx.beginPath();
  ctx.moveTo(blackBall.x, blackBall.y);
  ctx.lineTo(whiteBall.x, whiteBall.y);
  ctx.lineWidth = overstretched ? 3 : 2;
  ctx.strokeStyle = overstretched ? "#e73737" : "#777777";
  ctx.stroke();
}

function drawBall(ball, isBlack) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#111111";
  ctx.stroke();

  if (!isBlack) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111111";
    ctx.fill();
  }
}

function drawHud() {
  const centerX = game.width / 2;

  if (game.resetFlash > 0) {
    ctx.fillStyle = `rgba(231, 55, 55, ${game.resetFlash / 35})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (game.won) {
    ctx.fillStyle = "#111111";
    ctx.font = "700 54px Arial, Helvetica, sans-serif";
    ctx.fillText("You Win!", centerX, game.height / 2);
    ctx.font = "18px Arial, Helvetica, sans-serif";
    ctx.fillText("Press R to restart", centerX, game.height / 2 + 54);
  } else {
    ctx.fillStyle = "#666666";
    ctx.font = "15px Arial, Helvetica, sans-serif";
    ctx.fillText("Meet together inside the green finish point.", centerX, 28);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = getKeyName(event);
  keys[key] = true;

  if (key.startsWith("Arrow")) {
    event.preventDefault();
  }

  if (key === "r") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = getKeyName(event);
  keys[key] = false;

  if (key.startsWith("Arrow")) {
    event.preventDefault();
  }
});

function getKeyName(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

resetGame();
gameLoop();
