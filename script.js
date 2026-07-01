const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
const idealStringLength = 230;
const maxStringLength = 310;
const playerRadius = 17;
const moveForce = 0.35;
const friction = 0.9;

let blackBall;
let whiteBall;
let dots;
let won = false;

const finishZones = {
  black: { x: 410, y: 78, radius: 42, label: "BLACK" },
  white: { x: 550, y: 78, radius: 42, label: "WHITE" }
};

// A hand-placed field keeps the game predictable while still feeling alive.
const dotLayout = [
  [170, 130, 20, 0.0], [300, 96, 16, 1.4], [455, 130, 24, 2.3],
  [630, 96, 18, 0.9], [780, 150, 22, 1.7], [110, 275, 17, 2.6],
  [255, 260, 27, 0.5], [420, 280, 19, 1.8], [570, 240, 25, 2.9],
  [730, 295, 18, 0.7], [870, 250, 21, 2.1], [180, 460, 24, 1.2],
  [350, 410, 18, 2.4], [510, 470, 27, 0.4], [690, 425, 20, 1.6],
  [835, 470, 17, 2.8], [470, 365, 15, 3.2], [610, 350, 16, 0.2]
];

function resetGame() {
  blackBall = createBall(365, canvas.height - 75, "#111");
  whiteBall = createBall(595, canvas.height - 75, "#fff");
  dots = dotLayout.map(([x, y, radius, phase]) => ({ x, y, radius, phase }));
  won = false;
}

function createBall(x, y, color) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    radius: playerRadius
  };
}

function handleInput() {
  const waiting = getWaitingState();

  if (!waiting.black) {
    if (keys.w) blackBall.vy -= moveForce;
    if (keys.s) blackBall.vy += moveForce;
    if (keys.a) blackBall.vx -= moveForce;
    if (keys.d) blackBall.vx += moveForce;
  }

  if (!waiting.white) {
    if (keys.ArrowUp) whiteBall.vy -= moveForce;
    if (keys.ArrowDown) whiteBall.vy += moveForce;
    if (keys.ArrowLeft) whiteBall.vx -= moveForce;
    if (keys.ArrowRight) whiteBall.vx += moveForce;
  }
}

function applyStringTension() {
  const dx = whiteBall.x - blackBall.x;
  const dy = whiteBall.y - blackBall.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= idealStringLength) {
    return;
  }

  const stretch = distance - idealStringLength;
  const pullStrength = stretch * 0.0028;
  const nx = dx / distance;
  const ny = dy / distance;

  // The longer the string stretches, the more both balls are pulled inward.
  blackBall.vx += nx * pullStrength;
  blackBall.vy += ny * pullStrength;
  whiteBall.vx -= nx * pullStrength;
  whiteBall.vy -= ny * pullStrength;

  if (distance > maxStringLength) {
    const extraPull = (distance - maxStringLength) * 0.006;
    blackBall.vx += nx * extraPull;
    blackBall.vy += ny * extraPull;
    whiteBall.vx -= nx * extraPull;
    whiteBall.vy -= ny * extraPull;
  }
}

function updateBall(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= friction;
  ball.vy *= friction;

  // Keep the balls inside the canvas with a soft wall bounce.
  if (ball.x < ball.radius) {
    ball.x = ball.radius;
    ball.vx *= -0.45;
  }
  if (ball.x > canvas.width - ball.radius) {
    ball.x = canvas.width - ball.radius;
    ball.vx *= -0.45;
  }
  if (ball.y < ball.radius) {
    ball.y = ball.radius;
    ball.vy *= -0.45;
  }
  if (ball.y > canvas.height - ball.radius) {
    ball.y = canvas.height - ball.radius;
    ball.vy *= -0.45;
  }
}

function resolveDotCollisions(time) {
  dots.forEach((dot) => {
    const dotRadius = pulsingRadius(dot, time);
    bounceAwayFromDot(blackBall, dot, dotRadius);
    bounceAwayFromDot(whiteBall, dot, dotRadius);
  });
}

function holdWaitingBalls() {
  const waiting = getWaitingState();

  if (waiting.black) {
    holdBallInZone(blackBall, finishZones.black);
  }
  if (waiting.white) {
    holdBallInZone(whiteBall, finishZones.white);
  }
}

function holdBallInZone(ball, zone) {
  ball.vx *= 0.55;
  ball.vy *= 0.55;
  ball.x += (zone.x - ball.x) * 0.08;
  ball.y += (zone.y - ball.y) * 0.08;
}

function getWaitingState() {
  const blackFinished = isInsideZone(blackBall, finishZones.black);
  const whiteFinished = isInsideZone(whiteBall, finishZones.white);

  return {
    black: blackFinished && !whiteFinished,
    white: whiteFinished && !blackFinished
  };
}

function bounceAwayFromDot(ball, dot, dotRadius) {
  const dx = ball.x - dot.x;
  const dy = ball.y - dot.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = ball.radius + dotRadius;

  if (distance >= minDistance) {
    return;
  }

  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  const overlap = minDistance - distance;

  ball.x += nx * overlap;
  ball.y += ny * overlap;
  ball.vx += nx * 2.2;
  ball.vy += ny * 2.2;
}

function pulsingRadius(dot, time) {
  return dot.radius + Math.sin(time * 0.003 + dot.phase) * 5;
}

function checkWin() {
  const blackFinished = isInsideZone(blackBall, finishZones.black);
  const whiteFinished = isInsideZone(whiteBall, finishZones.white);
  won = blackFinished && whiteFinished;
}

function isInsideZone(ball, zone) {
  return Math.hypot(ball.x - zone.x, ball.y - zone.y) < zone.radius - ball.radius * 0.25;
}

function update(time) {
  if (!won) {
    handleInput();
    applyStringTension();
    updateBall(blackBall);
    updateBall(whiteBall);
    resolveDotCollisions(time);
    holdWaitingBalls();
    checkWin();
  }
}

function draw(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawFinishZone(finishZones.black);
  drawFinishZone(finishZones.white);
  drawDots(time);
  drawString();
  drawBall(blackBall);
  drawBall(whiteBall);
  drawStatusText();
}

function drawFinishZone(zone) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(88, 184, 112, 0.22)";
  ctx.strokeStyle = "rgba(49, 138, 70, 0.75)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2d7b42";
  ctx.font = "700 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(zone.label, zone.x, zone.y + 4);
  ctx.restore();
}

function drawDots(time) {
  dots.forEach((dot) => {
    const radius = pulsingRadius(dot, time);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(130, 130, 130, 0.20)";
    ctx.strokeStyle = "rgba(120, 120, 120, 0.16)";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  });
}

function drawString() {
  const distance = Math.hypot(whiteBall.x - blackBall.x, whiteBall.y - blackBall.y);
  const stretchRatio = Math.min(1, Math.max(0, (distance - idealStringLength) / (maxStringLength - idealStringLength)));
  const isOverstretched = distance > maxStringLength;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(blackBall.x, blackBall.y);
  ctx.lineTo(whiteBall.x, whiteBall.y);
  ctx.strokeStyle = isOverstretched ? "#d72727" : `rgb(${70 + stretchRatio * 80}, ${70 - stretchRatio * 30}, ${70 - stretchRatio * 30})`;
  ctx.lineWidth = isOverstretched ? 3 : 1.5 + stretchRatio;
  ctx.setLineDash(distance < idealStringLength + 18 ? [10, 8] : []);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ball) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStatusText() {
  const distance = Math.hypot(whiteBall.x - blackBall.x, whiteBall.y - blackBall.y);
  const blackFinished = isInsideZone(blackBall, finishZones.black);
  const whiteFinished = isInsideZone(whiteBall, finishZones.white);

  ctx.save();
  ctx.fillStyle = "#222";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";

  if (won) {
    ctx.font = "700 48px Arial";
    ctx.fillText("You Win!", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px Arial";
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 36);
  } else if (blackFinished || whiteFinished) {
    ctx.fillText("One yo-yo is waiting. Bring the other home.", canvas.width / 2, 34);
  } else if (distance > maxStringLength) {
    ctx.fillStyle = "#d72727";
    ctx.fillText("Tension high - move back together.", canvas.width / 2, 34);
  } else {
    ctx.fillStyle = "#666";
    ctx.fillText("Coordinate movement through the pulsing field.", canvas.width / 2, 34);
  }

  ctx.restore();
}

function gameLoop(time) {
  update(time);
  draw(time);
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  keys[event.key.toLowerCase()] = true;
  keys[event.key] = true;

  if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
  keys[event.key] = false;
});

resetGame();
requestAnimationFrame(gameLoop);
