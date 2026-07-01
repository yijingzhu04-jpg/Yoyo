// YO-YO CONVERGENCE
// A small cooperative canvas game made with beginner-friendly vanilla JavaScript.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
let width = 0;
let height = 0;
let pixelRatio = 1;
let lastTime = 0;
let gameWon = false;
let resetFlash = 0;

const finish = {
  x: 0,
  y: 0,
  radius: 42
};

const playerRadius = 14;
const playerSpeed = 260;
const friction = 0.88;
const pullStrength = 5.5;
let idealStringLength = 0;
let stretchedStringLength = 0;

const blackBall = createBall("#111111");
const whiteBall = createBall("#ffffff");
const dots = [];

// The dot positions are stored as percentages so they adapt to canvas resizing.
const dotMap = [
  [0.12, 0.18, 18, 0.0], [0.24, 0.15, 12, 0.8], [0.38, 0.16, 16, 1.7],
  [0.61, 0.14, 13, 2.4], [0.78, 0.18, 19, 0.3], [0.90, 0.25, 14, 1.2],
  [0.16, 0.35, 15, 2.1], [0.31, 0.33, 21, 0.5], [0.48, 0.28, 12, 1.4],
  [0.68, 0.33, 18, 2.8], [0.84, 0.39, 16, 0.9], [0.09, 0.55, 14, 1.9],
  [0.25, 0.69, 17, 0.6], [0.41, 0.66, 20, 2.6], [0.59, 0.67, 15, 1.1],
  [0.75, 0.69, 22, 2.0], [0.92, 0.59, 13, 0.2], [0.14, 0.78, 20, 1.3],
  [0.32, 0.81, 13, 2.7], [0.51, 0.84, 17, 0.4], [0.70, 0.79, 14, 1.8],
  [0.87, 0.78, 19, 2.3], [0.50, 0.22, 11, 0.7], [0.50, 0.75, 11, 2.2]
];

function createBall(color) {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    color
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  pixelRatio = window.devicePixelRatio || 1;
  width = rect.width;
  height = rect.height;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  finish.x = width / 2;
  finish.y = height / 2;
  idealStringLength = width * 0.36;
  stretchedStringLength = width * 0.52;
  resetGame();
}

function resetGame() {
  blackBall.x = width * 0.25;
  blackBall.y = height * 0.5;
  blackBall.vx = 0;
  blackBall.vy = 0;

  whiteBall.x = width * 0.75;
  whiteBall.y = height * 0.5;
  whiteBall.vx = 0;
  whiteBall.vy = 0;

  gameWon = false;
  resetFlash = 0.25;
}

function buildDots() {
  dots.length = 0;

  for (let i = 0; i < dotMap.length; i++) {
    const [xPercent, yPercent, radius, phase] = dotMap[i];

    dots.push({
      xPercent,
      yPercent,
      baseRadius: radius,
      phase,
      moveSpeed: 0.35 + i * 0.025,
      moveRangePercent: 0.025 + i * 0.0012
    });
  }
}

function update(deltaTime, time) {
  if (resetFlash > 0) {
    resetFlash -= deltaTime;
  }

  if (gameWon) {
    return;
  }

  moveBall(blackBall, "KeyW", "KeyS", "KeyA", "KeyD", deltaTime);
  moveBall(whiteBall, "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", deltaTime);
  applyStringPull(deltaTime);
  keepBallOnCanvas(blackBall);
  keepBallOnCanvas(whiteBall);

  if (hitsAnyDot(time)) {
    resetGame();
    return;
  }

  const distanceBetweenBalls = distance(blackBall.x, blackBall.y, whiteBall.x, whiteBall.y);
  const blackInFinish = distance(blackBall.x, blackBall.y, finish.x, finish.y) < finish.radius - 4;
  const whiteInFinish = distance(whiteBall.x, whiteBall.y, finish.x, finish.y) < finish.radius - 4;

  // Both players must be in the finish zone and close to each other.
  if (blackInFinish && whiteInFinish && distanceBetweenBalls < playerRadius * 2.8) {
    gameWon = true;
    blackBall.vx = 0;
    blackBall.vy = 0;
    whiteBall.vx = 0;
    whiteBall.vy = 0;
  }
}

function moveBall(ball, upKey, downKey, leftKey, rightKey, deltaTime) {
  let ax = 0;
  let ay = 0;

  if (keys[upKey]) ay -= 1;
  if (keys[downKey]) ay += 1;
  if (keys[leftKey]) ax -= 1;
  if (keys[rightKey]) ax += 1;

  // Normalize diagonal movement so it is not faster than straight movement.
  if (ax !== 0 || ay !== 0) {
    const length = Math.hypot(ax, ay);
    ax /= length;
    ay /= length;
  }

  ball.vx += ax * playerSpeed * deltaTime * 4;
  ball.vy += ay * playerSpeed * deltaTime * 4;
  ball.vx *= friction;
  ball.vy *= friction;
  ball.x += ball.vx * deltaTime;
  ball.y += ball.vy * deltaTime;
}

function applyStringPull(deltaTime) {
  const dx = whiteBall.x - blackBall.x;
  const dy = whiteBall.y - blackBall.y;
  const length = Math.hypot(dx, dy);

  if (length <= stretchedStringLength) {
    return;
  }

  const nx = dx / length;
  const ny = dy / length;
  const stretch = length - stretchedStringLength;
  const pull = stretch * pullStrength * deltaTime;

  blackBall.vx += nx * pull;
  blackBall.vy += ny * pull;
  whiteBall.vx -= nx * pull;
  whiteBall.vy -= ny * pull;
}

function keepBallOnCanvas(ball) {
  ball.x = clamp(ball.x, playerRadius, width - playerRadius);
  ball.y = clamp(ball.y, playerRadius, height - playerRadius);
}

function hitsAnyDot(time) {
  for (const dot of dots) {
    const position = dotPosition(dot, time);

    const blackDistance = distance(blackBall.x, blackBall.y, position.x, position.y);
    const whiteDistance = distance(whiteBall.x, whiteBall.y, position.x, position.y);
    const blackHit = blackDistance < playerRadius + dot.baseRadius;
    const whiteHit = whiteDistance < playerRadius + dot.baseRadius;
    const stringHit = pointToSegmentDistance(
      position.x,
      position.y,
      blackBall.x,
      blackBall.y,
      whiteBall.x,
      whiteBall.y
    ) < dot.baseRadius + 2;

    if (blackHit || whiteHit || stringHit) {
      return true;
    }
  }

  return false;
}

function draw(time) {
  ctx.clearRect(0, 0, width, height);

  drawFinish(time);
  drawDots(time);
  drawString();
  drawBall(blackBall);
  drawBall(whiteBall);
  drawMessages();
}

function drawFinish(time) {
  const pulse = Math.sin(time * 2.2) * 0.15 + 0.85;

  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(0, 180, 90, 0.7)";
  ctx.fillStyle = `rgba(60, 220, 130, ${0.28 + pulse * 0.12})`;
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.radius * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0, 150, 70, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDots(time) {
  ctx.fillStyle = "rgba(120, 120, 120, 0.25)";

  for (const dot of dots) {
    const position = dotPosition(dot, time);

    ctx.beginPath();
    ctx.arc(
      position.x,
      position.y,
      dot.baseRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawString() {
  const length = distance(blackBall.x, blackBall.y, whiteBall.x, whiteBall.y);
  const overStretched = length > stretchedStringLength;

  ctx.save();
  ctx.strokeStyle = overStretched ? "#e53935" : "#777777";
  ctx.lineWidth = overStretched ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(blackBall.x, blackBall.y);
  ctx.lineTo(whiteBall.x, whiteBall.y);
  ctx.stroke();

  if (length > idealStringLength) {
    ctx.setLineDash([6, 8]);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = overStretched ? "#e53935" : "#555555";
    ctx.stroke();
  }

  ctx.restore();
}

function drawBall(ball) {
  ctx.save();
  ctx.fillStyle = ball.color;
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, playerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMessages() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (gameWon) {
    ctx.fillStyle = "rgba(0, 120, 55, 0.95)";
    ctx.font = "700 46px Arial, Helvetica, sans-serif";
    ctx.fillText("You Win!", finish.x, finish.y - finish.radius - 34);
    ctx.font = "16px Arial, Helvetica, sans-serif";
    ctx.fillText("Press R to play again", finish.x, finish.y - finish.radius - 5);
  } else if (resetFlash > 0) {
    ctx.fillStyle = `rgba(220, 0, 0, ${resetFlash * 2.2})`;
    ctx.font = "700 20px Arial, Helvetica, sans-serif";
    ctx.fillText("Reset", finish.x, 34);
  }

  ctx.restore();
}

function dotPosition(dot, time) {
  // Each dot keeps its x value and glides vertically at its own slow pace.
  const wave = Math.sin(time * dot.moveSpeed + dot.phase);
  const verticalOffset = wave * dot.moveRangePercent * height;

  return {
    x: dot.xPercent * width,
    y: dot.yPercent * height + verticalOffset
  };
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const segmentX = bx - ax;
  const segmentY = by - ay;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return distance(px, py, ax, ay);
  }

  // Project the point onto the string, then clamp it to the segment ends.
  const t = clamp(
    ((px - ax) * segmentX + (py - ay) * segmentY) / segmentLengthSquared,
    0,
    1
  );
  const closestX = ax + t * segmentX;
  const closestY = ay + t * segmentY;

  return distance(px, py, closestX, closestY);
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gameLoop(timestamp) {
  const time = timestamp / 1000;
  const deltaTime = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  update(deltaTime, time);
  draw(time);
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (event.code === "KeyR") {
    resetGame();
  }

  // Arrow keys normally scroll the page. Stop that while playing.
  if (event.code.startsWith("Arrow")) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("resize", resizeCanvas);

buildDots();
resizeCanvas();
requestAnimationFrame(gameLoop);
