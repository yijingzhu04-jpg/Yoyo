// Yo-Yo Letter Link
// A two-player cooperative browser game made with plain JavaScript and Canvas.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("gameStage");
const wordProgress = document.getElementById("wordProgress");
const timerDisplay = document.getElementById("timer");
const messageScreen = document.getElementById("messageScreen");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");
const restartButton = document.getElementById("restartButton");
const restartSmall = document.getElementById("restartSmall");

const WORDS = ["DISCUSS", "REFLECT", "IMPROVE"];
const ROUND_SECONDS = 60;
const keys = {};

let width = 1000;
let height = 620;
let streamY = height / 2;
let selectedWord = "";
let collectedLetters = [];
let bubbles = [];
let particles = [];
let lastFrameTime = 0;
let timeLeft = ROUND_SECONDS;
let roundStartTime = 0;
let gameRunning = false;
let animationFrameId = null;

const players = {
  top: {
    x: width / 2,
    homeY: 96,
    yoyoY: 96,
    radius: 20,
    speed: 360,
    shotSpeed: 760,
    maxReach: 245,
    direction: 1,
    shooting: false,
    returning: false,
    color: "#76f7ff",
    glow: "rgba(118, 247, 255, 0.8)"
  },
  bottom: {
    x: width / 2,
    homeY: height - 96,
    yoyoY: height - 96,
    radius: 20,
    speed: 360,
    shotSpeed: 780,
    maxReach: 255,
    direction: -1,
    shooting: false,
    returning: false,
    color: "#ff8ee8",
    glow: "rgba(255, 142, 232, 0.78)"
  }
};

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  width = Math.max(720, rect.width);
  height = Math.max(500, rect.height);
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  streamY = height / 2;
  players.top.homeY = Math.max(76, height * 0.16);
  players.bottom.homeY = Math.min(height - 76, height * 0.84);
  resetRestingYoyos();
}

function resetRestingYoyos() {
  for (const player of Object.values(players)) {
    if (!player.shooting && !player.returning) {
      player.yoyoY = player.homeY;
    }
  }
}

function startRound() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }

  selectedWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  collectedLetters = [];
  particles = [];
  timeLeft = ROUND_SECONDS;
  gameRunning = true;
  roundStartTime = performance.now();
  lastFrameTime = roundStartTime;

  players.top.x = width / 2;
  players.bottom.x = width / 2;
  resetPlayerShot(players.top);
  resetPlayerShot(players.bottom);

  createProgressDisplay();
  createBubbleStream();
  hideMessage();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function createProgressDisplay() {
  wordProgress.innerHTML = "";

  for (let i = 0; i < selectedWord.length; i += 1) {
    const slot = document.createElement("span");
    slot.textContent = "_";
    wordProgress.appendChild(slot);
  }
}

function updateProgressDisplay() {
  const slots = wordProgress.querySelectorAll("span");

  slots.forEach((slot, index) => {
    slot.textContent = collectedLetters[index] || "_";
  });
}

function createBubbleStream() {
  const letters = selectedWord.split("").map((letter, index) => ({
    letter,
    wordIndex: index,
    empty: false
  }));

  const emptyCount = 10;
  const contents = shuffle([
    ...letters,
    ...Array.from({ length: emptyCount }, () => ({ letter: "", wordIndex: -1, empty: true }))
  ]);

  const spacing = Math.max(78, Math.min(102, width / 10));
  const startX = width + spacing;

  bubbles = contents.map((content, index) => ({
    x: startX + index * spacing,
    baseY: streamY,
    radius: 24,
    spacing,
    driftSeed: Math.random() * Math.PI * 2,
    letter: content.letter,
    wordIndex: content.wordIndex,
    empty: content.empty,
    revealed: false,
    active: true,
    revealPulse: 0,
    emptyFlash: 0,
    shake: 0,
    collectPulse: 0
  }));
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function gameLoop(now) {
  if (!gameRunning) {
    return;
  }

  const delta = Math.min((now - lastFrameTime) / 1000, 0.033);
  lastFrameTime = now;
  timeLeft = Math.max(0, ROUND_SECONDS - Math.floor((now - roundStartTime) / 1000));

  update(delta, now / 1000);
  draw(now / 1000);
  updateTimer();

  if (collectedLetters.length === selectedWord.length) {
    endRound(true);
    return;
  }

  if (timeLeft <= 0) {
    endRound(false);
    return;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function update(delta, elapsed) {
  movePlayers(delta);
  updateShots(delta);
  updateBubbles(delta, elapsed);
  updateParticles(delta);
  checkCollisions();
}

function movePlayers(delta) {
  const top = players.top;
  const bottom = players.bottom;
  const leftLimit = 38;
  const rightLimit = width - 38;

  if (keys.KeyA) {
    top.x -= top.speed * delta;
  }
  if (keys.KeyD) {
    top.x += top.speed * delta;
  }
  if (keys.ArrowLeft) {
    bottom.x -= bottom.speed * delta;
  }
  if (keys.ArrowRight) {
    bottom.x += bottom.speed * delta;
  }

  top.x = clamp(top.x, leftLimit, rightLimit);
  bottom.x = clamp(bottom.x, leftLimit, rightLimit);
}

function updateShots(delta) {
  for (const player of Object.values(players)) {
    if (!player.shooting && !player.returning) {
      player.yoyoY = player.homeY;
      continue;
    }

    if (player.shooting) {
      player.yoyoY += player.direction * player.shotSpeed * delta;

      const reachedTopLimit = player.direction < 0 && player.yoyoY <= player.homeY - player.maxReach;
      const reachedBottomLimit = player.direction > 0 && player.yoyoY >= player.homeY + player.maxReach;

      if (reachedTopLimit || reachedBottomLimit) {
        player.shooting = false;
        player.returning = true;
      }
    } else if (player.returning) {
      const distanceHome = player.homeY - player.yoyoY;
      const step = Math.sign(distanceHome) * player.shotSpeed * 1.2 * delta;

      if (Math.abs(step) >= Math.abs(distanceHome)) {
        resetPlayerShot(player);
      } else {
        player.yoyoY += step;
      }
    }
  }
}

function updateBubbles(delta, elapsed) {
  const activeBubbles = bubbles.filter((bubble) => bubble.active);
  const farthestX = activeBubbles.reduce((maxX, bubble) => Math.max(maxX, bubble.x), -Infinity);
  const streamSpeed = 56;

  for (const bubble of bubbles) {
    if (!bubble.active) {
      continue;
    }

    bubble.x -= streamSpeed * delta;
    bubble.baseY = streamY;
    bubble.y = streamY + Math.sin(elapsed * 1.4 + bubble.driftSeed) * 18;
    bubble.x += Math.sin(elapsed * 0.9 + bubble.driftSeed) * 6 * delta;

    if (bubble.x < -bubble.radius - 16) {
      bubble.x = farthestX + bubble.spacing;
    }

    bubble.revealPulse = Math.max(0, bubble.revealPulse - delta * 2.8);
    bubble.emptyFlash = Math.max(0, bubble.emptyFlash - delta * 3.5);
    bubble.shake = Math.max(0, bubble.shake - delta * 4.8);
    bubble.collectPulse = Math.max(0, bubble.collectPulse - delta * 3.4);
  }
}

function updateParticles(delta) {
  particles = particles.filter((particle) => particle.life > 0);

  for (const particle of particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= delta;
  }
}

function checkCollisions() {
  for (const bubble of bubbles) {
    if (!bubble.active) {
      continue;
    }

    if (players.top.shooting && isTouching(players.top, bubble)) {
      revealBubble(bubble);
      players.top.shooting = false;
      players.top.returning = true;
    }

    if (players.bottom.shooting && isTouching(players.bottom, bubble)) {
      const collectionReacted = tryCollectBubble(bubble);

      if (collectionReacted) {
        players.bottom.shooting = false;
        players.bottom.returning = true;
      }
    }
  }
}

function isTouching(player, bubble) {
  const distance = Math.hypot(player.x - bubble.x, player.yoyoY - bubble.y);
  return distance < player.radius + bubble.radius - 2;
}

function revealBubble(bubble) {
  bubble.revealed = true;
  bubble.revealPulse = 1;

  if (bubble.empty) {
    bubble.emptyFlash = 1;
  }
}

function tryCollectBubble(bubble) {
  // Player 2 can only collect revealed balls that contain the next needed letter.
  if (!bubble.revealed || bubble.empty) {
    return false;
  }

  const nextIndex = collectedLetters.length;

  if (bubble.wordIndex === nextIndex && bubble.letter === selectedWord[nextIndex]) {
    collectedLetters.push(bubble.letter);
    bubble.active = false;
    createParticleBurst(bubble.x, bubble.y, bubble.letter);
    updateProgressDisplay();
    return true;
  }

  bubble.shake = 1;
  return true;
}

function createParticleBurst(x, y, letter) {
  for (let i = 0; i < 24; i += 1) {
    const angle = (Math.PI * 2 * i) / 24;
    const speed = 80 + Math.random() * 110;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      color: i % 2 === 0 ? "#76f7ff" : "#99ffce",
      life: 0.55 + Math.random() * 0.35
    });
  }

  particles.push({
    x,
    y,
    vx: 0,
    vy: -35,
    radius: 11,
    color: "#ffffff",
    life: 0.42,
    letter
  });
}

function draw(elapsed) {
  ctx.clearRect(0, 0, width, height);
  drawAimZones();
  drawBubbles(elapsed);
  drawParticles();
  drawPlayer(players.top, "PLAYER 1 - REVEAL");
  drawPlayer(players.bottom, "PLAYER 2 - COLLECT");
}

function drawAimZones() {
  ctx.save();
  ctx.strokeStyle = "rgba(118, 247, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(34, players.top.homeY + players.top.maxReach);
  ctx.lineTo(width - 34, players.top.homeY + players.top.maxReach);
  ctx.moveTo(34, players.bottom.homeY - players.bottom.maxReach);
  ctx.lineTo(width - 34, players.bottom.homeY - players.bottom.maxReach);
  ctx.stroke();
  ctx.restore();
}

function drawBubbles(elapsed) {
  for (const bubble of bubbles) {
    if (!bubble.active) {
      continue;
    }

    const shakeOffset = bubble.shake > 0 ? Math.sin(elapsed * 70) * 7 * bubble.shake : 0;
    const x = bubble.x + shakeOffset;
    const y = bubble.y || streamY;
    const pulse = bubble.revealPulse;
    const flash = bubble.emptyFlash;
    const radius = bubble.radius + pulse * 4 + flash * 3;
    const gradient = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, radius);

    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.38 + flash * 0.35})`);
    gradient.addColorStop(0.34, `rgba(118, 247, 255, ${0.12 + pulse * 0.2})`);
    gradient.addColorStop(1, "rgba(118, 247, 255, 0.03)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.strokeStyle = bubble.revealed
      ? `rgba(153, 255, 206, ${0.5 + pulse * 0.4})`
      : "rgba(208, 248, 255, 0.34)";
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = bubble.revealed ? 22 + pulse * 18 : 14;
    ctx.shadowColor = bubble.revealed ? "rgba(153, 255, 206, 0.72)" : "rgba(118, 247, 255, 0.28)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.28, radius * 0.26, Math.PI * 1.1, Math.PI * 1.75);
    ctx.stroke();

    if (bubble.revealed && !bubble.empty) {
      ctx.fillStyle = "#edf8ff";
      ctx.font = "700 24px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(153, 255, 206, 0.95)";
      ctx.fillText(bubble.letter, x, y + 1);
    }
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = clamp(particle.life / 0.75, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = particle.color;

    if (particle.letter) {
      ctx.font = "800 30px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(particle.letter, particle.x, particle.y);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPlayer(player, label) {
  const labelY = player.direction > 0 ? player.homeY - 42 : player.homeY + 46;

  ctx.save();
  ctx.strokeStyle = player.glow;
  ctx.lineWidth = 1.4;
  ctx.shadowBlur = 14;
  ctx.shadowColor = player.glow;
  ctx.beginPath();
  ctx.moveTo(player.x, player.homeY);
  ctx.lineTo(player.x, player.yoyoY);
  ctx.stroke();

  drawYoyoBall(player.x, player.yoyoY, player.radius, player.color, player.glow);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(237, 248, 255, 0.65)";
  ctx.font = "700 12px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0.12em";
  ctx.fillText(label, player.x, labelY);
  ctx.restore();
}

function drawYoyoBall(x, y, radius, color, glow) {
  const gradient = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(1, "rgba(5, 8, 18, 0.78)");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 24;
  ctx.shadowColor = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.42, 0, Math.PI * 2);
  ctx.stroke();
}

function shoot(player) {
  if (!gameRunning || player.shooting || player.returning) {
    return;
  }

  player.shooting = true;
}

function resetPlayerShot(player) {
  player.shooting = false;
  player.returning = false;
  player.yoyoY = player.homeY;
}

function updateTimer() {
  timerDisplay.textContent = String(timeLeft).padStart(2, "0");
  timerDisplay.classList.toggle("warning", timeLeft <= 10);
}

function endRound(won) {
  gameRunning = false;
  animationFrameId = null;
  draw(performance.now() / 1000);

  if (won) {
    messageTitle.textContent = "Word Complete";
    messageText.textContent = `Great teamwork! You revealed, discussed, and collected ${selectedWord}.`;
  } else {
    messageTitle.textContent = "Time's Up";
    messageText.textContent = `The hidden word was ${selectedWord}. Talk it through and try again.`;
  }

  messageScreen.classList.remove("hidden");
}

function hideMessage() {
  messageScreen.classList.add("hidden");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (event.code === "KeyW") {
    shoot(players.top);
  }

  if (event.code === "ArrowUp") {
    shoot(players.bottom);
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  createBubbleStream();
});

restartButton.addEventListener("click", startRound);
restartSmall.addEventListener("click", startRound);

resizeCanvas();
startRound();
