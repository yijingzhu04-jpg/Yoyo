// YO-YO Twin Maze
// A small two-player canvas game made with beginner-friendly JavaScript.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const message = document.getElementById("message");

const keys = {};

const ballRadius = 11;
const moveSpeed = 2.5;
const bounceDistance = 8;
const maxTrailLength = 45;

const starts = {
  player1: { x: 55, y: 55 },
  player2: { x: 745, y: 465 }
};

const finishZones = {
  player1: { x: 690, y: 35, width: 75, height: 75, label: "P1 FINISH" },
  player2: { x: 35, y: 410, width: 75, height: 75, label: "P2 FINISH" }
};

// Every wall is a rectangle. This keeps drawing and collision simple.
const walls = [
  // Outer maze border
  { x: 0, y: 0, width: 800, height: 18 },
  { x: 0, y: 502, width: 800, height: 18 },
  { x: 0, y: 0, width: 18, height: 520 },
  { x: 782, y: 0, width: 18, height: 520 },

  // Inside maze walls and obstacles
  { x: 100, y: 95, width: 270, height: 18 },
  { x: 430, y: 95, width: 245, height: 18 },
  { x: 100, y: 95, width: 18, height: 155 },
  { x: 220, y: 170, width: 18, height: 185 },
  { x: 330, y: 95, width: 18, height: 160 },
  { x: 430, y: 95, width: 18, height: 180 },
  { x: 555, y: 170, width: 18, height: 185 },
  { x: 665, y: 95, width: 18, height: 255 },
  { x: 100, y: 250, width: 130, height: 18 },
  { x: 330, y: 255, width: 118, height: 18 },
  { x: 555, y: 350, width: 128, height: 18 },
  { x: 118, y: 355, width: 330, height: 18 },
  { x: 430, y: 355, width: 18, height: 95 },
  { x: 305, y: 430, width: 268, height: 18 },
  { x: 560, y: 250, width: 18, height: 100 }
];

const players = [
  {
    name: "Player 1",
    color: "#111",
    outline: "#111",
    controls: { up: "w", down: "s", left: "a", right: "d" },
    finish: finishZones.player1,
    start: starts.player1
  },
  {
    name: "Player 2",
    color: "#fff",
    outline: "#111",
    controls: { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" },
    finish: finishZones.player2,
    start: starts.player2
  }
];

let gameWon = false;

function resetGame() {
  players.forEach((player) => {
    player.x = player.start.x;
    player.y = player.start.y;
    player.trail = [{ x: player.x, y: player.y }];
    player.inFinish = false;
  });

  message.textContent = "Both players must be inside their finish zones at the same time.";
  gameWon = false;
}

resetGame();

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === "r") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

function circleTouchesRect(circleX, circleY, radius, rect) {
  // Find the closest point on the rectangle to the circle center.
  const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function circleInsideRect(circleX, circleY, radius, rect) {
  return (
    circleX - radius >= rect.x &&
    circleX + radius <= rect.x + rect.width &&
    circleY - radius >= rect.y &&
    circleY + radius <= rect.y + rect.height
  );
}

function movePlayer(player) {
  let moveX = 0;
  let moveY = 0;

  if (keys[player.controls.up]) moveY -= moveSpeed;
  if (keys[player.controls.down]) moveY += moveSpeed;
  if (keys[player.controls.left]) moveX -= moveSpeed;
  if (keys[player.controls.right]) moveX += moveSpeed;

  // Normalize diagonal movement so it is not faster than straight movement.
  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.707;
    moveY *= 0.707;
  }

  if (moveX === 0 && moveY === 0) {
    return;
  }

  const nextX = player.x + moveX;
  const nextY = player.y + moveY;
  const hitWall = walls.some((wall) => circleTouchesRect(nextX, nextY, ballRadius, wall));

  if (hitWall) {
    // Bounce backward a little when a wall is touched.
    player.x -= Math.sign(moveX) * bounceDistance;
    player.y -= Math.sign(moveY) * bounceDistance;
  } else {
    player.x = nextX;
    player.y = nextY;
  }

  keepPlayerInBounds(player);
  addTrailPoint(player);
}

function keepPlayerInBounds(player) {
  player.x = Math.max(ballRadius, Math.min(canvas.width - ballRadius, player.x));
  player.y = Math.max(ballRadius, Math.min(canvas.height - ballRadius, player.y));
}

function addTrailPoint(player) {
  player.trail.push({ x: player.x, y: player.y });

  if (player.trail.length > maxTrailLength) {
    player.trail.shift();
  }
}

function updateFinishStatus() {
  players.forEach((player) => {
    player.inFinish = circleInsideRect(player.x, player.y, ballRadius, player.finish);
  });

  if (players.every((player) => player.inFinish)) {
    gameWon = true;
    message.textContent = "You Win! Press R to restart.";
  } else if (players.some((player) => player.inFinish)) {
    message.textContent = "One player is ready. Wait there until both balls finish together!";
  } else {
    message.textContent = "Both players must be inside their finish zones at the same time.";
  }
}

function drawFinishZone(zone, fill, textColor) {
  ctx.fillStyle = fill;
  ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  ctx.fillStyle = textColor;
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(zone.label, zone.x + zone.width / 2, zone.y + zone.height / 2 + 4);
}

function drawStartArea(x, y, label) {
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x - 22, y - 22, 44, 44);
  ctx.setLineDash([]);
  ctx.fillStyle = "#111";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 36);
}

function drawTrail(player) {
  if (player.trail.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(player.trail[0].x, player.trail[0].y);

  player.trail.forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });

  ctx.strokeStyle = player.color === "#111" ? "rgba(0, 0, 0, 0.35)" : "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPlayer(player) {
  drawTrail(player);

  ctx.beginPath();
  ctx.arc(player.x, player.y, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.strokeStyle = player.outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Small center dot helps each circle look like a yo-yo.
  ctx.beginPath();
  ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = player.color === "#111" ? "#fff" : "#111";
  ctx.fill();
}

function drawMaze() {
  ctx.fillStyle = "#111";
  walls.forEach((wall) => {
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawFinishZone(finishZones.player1, "#111", "#fff");
  drawFinishZone(finishZones.player2, "#fff", "#111");
  drawStartArea(starts.player1.x, starts.player1.y, "P1 START");
  drawStartArea(starts.player2.x, starts.player2.y, "P2 START");
  drawMaze();

  players.forEach(drawPlayer);

  if (gameWon) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(250, 205, 300, 95);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.strokeRect(250, 205, 300, 95);
    ctx.fillStyle = "#111";
    ctx.font = "36px Arial";
    ctx.textAlign = "center";
    ctx.fillText("You Win", canvas.width / 2, 265);
  }
}

function gameLoop() {
  if (!gameWon) {
    players.forEach(movePlayer);
    updateFinishStatus();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
