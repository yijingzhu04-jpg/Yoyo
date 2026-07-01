const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

const keys = {};
const ballRadius = 12;
const moveSpeed = 3;
const maxStringLength = 230;

const maze = {
  x: 250,
  y: 100,
  width: 400,
  height: 360
};

const insideExit = {
  x: 592,
  y: 392,
  width: 46,
  height: 46
};

const outsideExit = {
  x: 690,
  y: 392,
  width: 56,
  height: 56
};

// Simple wall rectangles inside the maze. The gaps leave one beginner-friendly route.
const walls = [
  { x: 310, y: 100, width: 18, height: 245 },
  { x: 380, y: 220, width: 18, height: 240 },
  { x: 470, y: 100, width: 18, height: 245 },
  { x: 560, y: 220, width: 18, height: 240 },
  { x: 310, y: 160, width: 120, height: 18 },
  { x: 470, y: 300, width: 120, height: 18 },
  { x: 380, y: 390, width: 130, height: 18 }
];

let insideBall;
let outsideBall;
let gameWon;

function resetGame() {
  insideBall = {
    x: 285,
    y: 130,
    radius: ballRadius,
    color: "#111"
  };

  outsideBall = {
    x: 450,
    y: 65,
    radius: ballRadius
  };

  gameWon = false;
  statusText.textContent = "Guide both Yo-Yos to their exits together.";
}

function circleTouchesRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  return distanceX * distanceX + distanceY * distanceY < circle.radius * circle.radius;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isInsideMazeBounds(ball) {
  return (
    ball.x - ball.radius >= maze.x &&
    ball.x + ball.radius <= maze.x + maze.width &&
    ball.y - ball.radius >= maze.y &&
    ball.y + ball.radius <= maze.y + maze.height
  );
}

function hitsMazeWall(ball) {
  return walls.some((wall) => circleTouchesRect(ball, wall));
}

function outsideBallTouchesMaze(ball) {
  return circleTouchesRect(ball, maze);
}

function moveInsideBall(dx, dy) {
  moveBallByAxis(insideBall, dx, 0, () => isInsideMazeBounds(insideBall) && !hitsMazeWall(insideBall));
  moveBallByAxis(insideBall, 0, dy, () => isInsideMazeBounds(insideBall) && !hitsMazeWall(insideBall));
}

function moveOutsideBall(dx, dy) {
  moveBallByAxis(outsideBall, dx, 0, () => staysOnCanvas(outsideBall) && !outsideBallTouchesMaze(outsideBall));
  moveBallByAxis(outsideBall, 0, dy, () => staysOnCanvas(outsideBall) && !outsideBallTouchesMaze(outsideBall));
}

function moveBallByAxis(ball, dx, dy, isMoveAllowed) {
  ball.x += dx;
  ball.y += dy;

  if (!isMoveAllowed()) {
    ball.x -= dx;
    ball.y -= dy;
  }
}

function staysOnCanvas(ball) {
  return (
    ball.x - ball.radius >= 0 &&
    ball.x + ball.radius <= canvas.width &&
    ball.y - ball.radius >= 0 &&
    ball.y + ball.radius <= canvas.height
  );
}

function updateControls() {
  let insideDx = 0;
  let insideDy = 0;
  let outsideDx = 0;
  let outsideDy = 0;

  if (keys.w) insideDy -= moveSpeed;
  if (keys.s) insideDy += moveSpeed;
  if (keys.a) insideDx -= moveSpeed;
  if (keys.d) insideDx += moveSpeed;

  if (keys.arrowup) outsideDy -= moveSpeed;
  if (keys.arrowdown) outsideDy += moveSpeed;
  if (keys.arrowleft) outsideDx -= moveSpeed;
  if (keys.arrowright) outsideDx += moveSpeed;

  moveInsideBall(insideDx, insideDy);
  moveOutsideBall(outsideDx, outsideDy);
}

function applyStringTension() {
  const dx = outsideBall.x - insideBall.x;
  const dy = outsideBall.y - insideBall.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= maxStringLength || distance === 0) {
    return;
  }

  const pullX = dx / distance;
  const pullY = dy / distance;
  const pullAmount = (distance - maxStringLength) / 2;

  // Each Yo-Yo gets pulled toward the other when the string is too tight.
  moveInsideBall(pullX * pullAmount, pullY * pullAmount);
  moveOutsideBall(-pullX * pullAmount, -pullY * pullAmount);
}

function isBallInZone(ball, zone) {
  return (
    ball.x >= zone.x &&
    ball.x <= zone.x + zone.width &&
    ball.y >= zone.y &&
    ball.y <= zone.y + zone.height
  );
}

function updateStatus() {
  const insideReady = isBallInZone(insideBall, insideExit);
  const outsideReady = isBallInZone(outsideBall, outsideExit);

  if (insideReady && outsideReady) {
    gameWon = true;
    statusText.textContent = "You Win! Press R to restart.";
  } else if (insideReady) {
    statusText.textContent = "Inside Yo-Yo is at the exit. Waiting for Player 2.";
  } else if (outsideReady) {
    statusText.textContent = "Outside Yo-Yo is at the exit. Waiting for Player 1.";
  } else {
    statusText.textContent = "Guide both Yo-Yos to their exits together.";
  }
}

function updateGame() {
  if (!gameWon) {
    updateControls();
    applyStringTension();
    updateStatus();
  }
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawExit(insideExit);
  drawExit(outsideExit);
  drawMaze();
  drawString();
  drawBall(insideBall, true);
  drawBall(outsideBall, false);

  if (gameWon) {
    drawWinMessage();
  }
}

function drawMaze() {
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  ctx.strokeRect(maze.x, maze.y, maze.width, maze.height);

  ctx.fillStyle = "#111";
  walls.forEach((wall) => {
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  });
}

function drawExit(exit) {
  ctx.fillStyle = "#72d572";
  ctx.fillRect(exit.x, exit.y, exit.width, exit.height);
}

function drawString() {
  const distance = Math.hypot(outsideBall.x - insideBall.x, outsideBall.y - insideBall.y);
  const isTight = distance > maxStringLength * 0.9;

  ctx.beginPath();
  ctx.moveTo(insideBall.x, insideBall.y);
  ctx.lineTo(outsideBall.x, outsideBall.y);
  ctx.strokeStyle = isTight ? "#d61f1f" : "#111";
  ctx.lineWidth = isTight ? 3 : 1;
  ctx.stroke();
}

function drawBall(ball, isInsideBall) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);

  if (isInsideBall) {
    ctx.fillStyle = "#111";
    ctx.fill();
  } else {
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawWinMessage() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";
  ctx.font = "bold 56px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("You Win!", canvas.width / 2, canvas.height / 2);
  ctx.font = "22px Arial, Helvetica, sans-serif";
  ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 44);
}

function gameLoop() {
  updateGame();
  drawGame();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "r") {
    resetGame();
    return;
  }

  keys[key] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

resetGame();
gameLoop();
