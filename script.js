// YOYO MAZE
// This game uses only the HTML Canvas API. There is no game engine here.
// The code is written in small sections so it is easy to copy into CodePen.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const message = document.getElementById("gameMessage");
const resetButton = document.getElementById("resetButton");

// The maze is a simple grid. Each cell is 50 pixels.
// # = wall, S = start, F = finish, O = hole, . = safe floor.
const tileSize = 50;
const maze = [
  "##################",
  "#S...#...........#",
  "###..#.####.####.#",
  "#....#....#....#.#",
  "#.######..#.##.#.#",
  "#......#..#O#..#.#",
  "#.####.#..###.##.#",
  "#.#....#......#..#",
  "#.#.#########.#O.#",
  "#...O......#.....#",
  "#.#######..#####F#",
  "##################"
];

const colors = {
  floor: "#eff6ff",
  wall: "#172033",
  wallTop: "#24304a",
  grid: "rgba(17, 24, 39, 0.07)",
  start: "#34d399",
  finish: "#facc15",
  hole: "#38bdf8",
  holeDark: "#0f172a",
  string: "#64748b",
  pivot: "#f97316",
  yoyo: "#ef4444",
  yoyoShade: "#991b1b",
  ghost: "rgba(239, 68, 68, 0.18)",
  text: "#0f172a"
};

// Find a tile by its letter so the level can be edited easily.
function findTile(symbol) {
  for (let row = 0; row < maze.length; row += 1) {
    const column = maze[row].indexOf(symbol);

    if (column !== -1) {
      return {
        x: column * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2
      };
    }
  }

  return { x: tileSize * 1.5, y: tileSize * 1.5 };
}

const start = findTile("S");
const finish = findTile("F");

// Player 1 changes the angle. Player 2 changes the string length.
const controls = {
  left: false,
  right: false,
  in: false,
  out: false
};

const keys = {
  a: "left",
  d: "right",
  w: "in",
  s: "out"
};

let game;

function resetGame() {
  game = {
    x: start.x,
    y: start.y,
    angle: 0,
    stringLength: 44,
    minString: 20,
    maxString: 95,
    yoyoRadius: 15,
    state: "playing",
    pulse: 0
  };

  message.textContent = "Work together: reach FINISH without hitting walls or holes.";
}

function getYoyoPosition() {
  return {
    x: game.x,
    y: game.y
  };
}

function getTileAtPixel(x, y) {
  const column = Math.floor(x / tileSize);
  const row = Math.floor(y / tileSize);

  // Anything outside the canvas counts as a wall.
  if (row < 0 || row >= maze.length || column < 0 || column >= maze[0].length) {
    return "#";
  }

  return maze[row][column];
}

function isWallAtPixel(x, y) {
  return getTileAtPixel(x, y) === "#";
}

function circleTouchesWall(x, y, radius) {
  // Check eight points around the Yo-Yo. This is simple and works well for a grid maze.
  const points = [
    [x, y - radius],
    [x + radius, y],
    [x, y + radius],
    [x - radius, y],
    [x + radius * 0.7, y + radius * 0.7],
    [x - radius * 0.7, y + radius * 0.7],
    [x + radius * 0.7, y - radius * 0.7],
    [x - radius * 0.7, y - radius * 0.7]
  ];

  return points.some(([pointX, pointY]) => isWallAtPixel(pointX, pointY));
}

function circleTouchesHole(x, y, radius) {
  for (let row = 0; row < maze.length; row += 1) {
    for (let column = 0; column < maze[row].length; column += 1) {
      if (maze[row][column] !== "O") {
        continue;
      }

      const holeX = column * tileSize + tileSize / 2;
      const holeY = row * tileSize + tileSize / 2;
      const distance = Math.hypot(x - holeX, y - holeY);

      if (distance < radius + 15) {
        return true;
      }
    }
  }

  return false;
}

function reachesFinish(x, y) {
  return Math.hypot(x - finish.x, y - finish.y) < 26;
}

function updateGame() {
  if (game.state !== "playing") {
    game.pulse += 0.06;
    return;
  }

  // Player 1 controls direction.
  if (controls.left) {
    game.angle -= 0.045;
  }

  if (controls.right) {
    game.angle += 0.045;
  }

  // Player 2 controls string length. Longer string means more speed, while
  // shorter string gives careful, slow movement.
  if (controls.in) {
    game.stringLength -= 1.8;
  }

  if (controls.out) {
    game.stringLength += 1.8;
  }

  game.stringLength = Math.max(game.minString, Math.min(game.maxString, game.stringLength));

  const speed = 0.6 + (game.stringLength - game.minString) / 28;
  game.x += Math.cos(game.angle) * speed;
  game.y += Math.sin(game.angle) * speed;

  const yoyo = getYoyoPosition();

  if (circleTouchesWall(yoyo.x, yoyo.y, game.yoyoRadius)) {
    game.state = "lost";
    message.textContent = "Crash! The Yo-Yo touched a wall. Press R or Reset Maze.";
  } else if (circleTouchesHole(yoyo.x, yoyo.y, game.yoyoRadius)) {
    game.state = "lost";
    message.textContent = "Oh no! The Yo-Yo fell into a hole. Press R or Reset Maze.";
  } else if (reachesFinish(yoyo.x, yoyo.y)) {
    game.state = "won";
    message.textContent = "You solved YOYO MAZE together! Press R to play again.";
  }
}

function drawMaze() {
  for (let row = 0; row < maze.length; row += 1) {
    for (let column = 0; column < maze[row].length; column += 1) {
      const tile = maze[row][column];
      const x = column * tileSize;
      const y = row * tileSize;

      ctx.fillStyle = tile === "#" ? colors.wall : colors.floor;
      ctx.fillRect(x, y, tileSize, tileSize);

      if (tile === "#") {
        ctx.fillStyle = colors.wallTop;
        ctx.fillRect(x + 5, y + 5, tileSize - 10, tileSize - 10);
      } else {
        ctx.strokeStyle = colors.grid;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }

      if (tile === "S" || tile === "F") {
        drawGoalTile(x, y, tile);
      }

      if (tile === "O") {
        drawHole(x + tileSize / 2, y + tileSize / 2);
      }
    }
  }
}

function drawGoalTile(x, y, tile) {
  ctx.fillStyle = tile === "S" ? colors.start : colors.finish;
  ctx.fillRect(x + 8, y + 8, tileSize - 16, tileSize - 16);

  ctx.fillStyle = colors.text;
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tile === "S" ? "START" : "FINISH", x + tileSize / 2, y + tileSize / 2);
}

function drawHole(x, y) {
  const gradient = ctx.createRadialGradient(x - 4, y - 4, 4, x, y, 20);
  gradient.addColorStop(0, colors.hole);
  gradient.addColorStop(0.55, "#0369a1");
  gradient.addColorStop(1, colors.holeDark);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawYoyo() {
  const yoyo = getYoyoPosition();
  const stringEndX = yoyo.x - Math.cos(game.angle) * game.stringLength;
  const stringEndY = yoyo.y - Math.sin(game.angle) * game.stringLength;

  ctx.strokeStyle = colors.string;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(stringEndX, stringEndY);
  ctx.lineTo(yoyo.x, yoyo.y);
  ctx.stroke();

  ctx.fillStyle = colors.pivot;
  ctx.beginPath();
  ctx.arc(stringEndX, stringEndY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Draw a small arrow that shows Player 1's current direction.
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(yoyo.x, yoyo.y);
  ctx.lineTo(yoyo.x + Math.cos(game.angle) * 32, yoyo.y + Math.sin(game.angle) * 32);
  ctx.stroke();

  ctx.fillStyle = colors.ghost;
  ctx.beginPath();
  ctx.arc(yoyo.x, yoyo.y, game.yoyoRadius + 8, 0, Math.PI * 2);
  ctx.fill();

  const yoyoGradient = ctx.createRadialGradient(yoyo.x - 7, yoyo.y - 8, 4, yoyo.x, yoyo.y, game.yoyoRadius);
  yoyoGradient.addColorStop(0, "#fecaca");
  yoyoGradient.addColorStop(0.45, colors.yoyo);
  yoyoGradient.addColorStop(1, colors.yoyoShade);

  ctx.fillStyle = yoyoGradient;
  ctx.beginPath();
  ctx.arc(yoyo.x, yoyo.y, game.yoyoRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawStringMeter() {
  const meterX = 18;
  const meterY = canvas.height - 26;
  const meterWidth = 180;
  const fillWidth = ((game.stringLength - game.minString) / (game.maxString - game.minString)) * meterWidth;

  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  ctx.fillRect(meterX - 8, meterY - 28, meterWidth + 16, 44);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("String length / speed", meterX, meterY - 17);

  ctx.fillStyle = "#334155";
  ctx.fillRect(meterX, meterY - 4, meterWidth, 10);

  ctx.fillStyle = "#7dd3fc";
  ctx.fillRect(meterX, meterY - 4, fillWidth, 10);
}

function drawOverlay() {
  if (game.state === "playing") {
    return;
  }

  const alpha = 0.68 + Math.sin(game.pulse) * 0.08;

  ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(game.state === "won" ? "YOU WIN!" : "TRY AGAIN", canvas.width / 2, canvas.height / 2 - 22);

  ctx.font = "20px Arial";
  ctx.fillText("Press R or click Reset Maze", canvas.width / 2, canvas.height / 2 + 32);
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawYoyo();
  drawStringMeter();
  drawOverlay();
}

function gameLoop() {
  updateGame();
  drawGame();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (keys[key]) {
    controls[keys[key]] = true;
  }

  if (key === "r") {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (keys[key]) {
    controls[keys[key]] = false;
  }
});

resetButton.addEventListener("click", resetGame);

resetGame();
gameLoop();
