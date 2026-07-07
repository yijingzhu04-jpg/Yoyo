// Tunable gameplay variables. Adjust these values to rebalance the game.
const DOT_SPEED = 120;
const DOT_SPACING = 72;
const PLAYER_SPEED = 440;
const YOYO_SHOOT_SPEED = 980;
const YOYO_RETURN_SPEED = 1180;
const SHOOT_COOLDOWN = 2;
const LETTER_PROBABILITY = 0.26;
const TARGET_WORD = "PHOENIX";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const progressElement = document.getElementById("progress");
const arenaWrap = document.querySelector(".arena-wrap");
const victoryElement = document.getElementById("victory");
const restartButton = document.getElementById("restartButton");

const keys = new Set();
const dots = [];
const particles = [];
const rings = [];
const fireworks = [];

let width = canvas.width;
let height = canvas.height;
let centerY = height / 2;
let lastTime = performance.now();
let progressIndex = 0;
let gameWon = false;
let victoryTime = 0;
let screenGlow = 0;
let nextLetterChanceBoost = 0;

const players = {
  top: createPlayer({
    name: "Player 1",
    color: "#f8fbff",
    yRatio: 0.25,
    direction: 1,
    moveLeft: "a",
    moveRight: "d",
    shootKey: "w",
    cooldown: SHOOT_COOLDOWN,
  }),
  bottom: createPlayer({
    name: "Player 2",
    color: "#fff1e7",
    yRatio: 0.75,
    direction: -1,
    moveLeft: "arrowleft",
    moveRight: "arrowright",
    shootKey: "arrowup",
    cooldown: 0.35,
  }),
};

// ---------------------------------------------------------------------------
// Setup and dot generation
// ---------------------------------------------------------------------------

function createPlayer(config) {
  return {
    ...config,
    x: width * 0.5,
    baseY: height * config.yRatio,
    yoyoY: height * config.yRatio,
    radius: 18,
    targetReach: 0.2,
    shootProgress: 0,
    isShooting: false,
    isReturning: false,
    cooldownLeft: 0,
    trail: [],
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  width = rect.width;
  height = rect.height;
  centerY = height / 2;
  players.top.baseY = height * players.top.yRatio;
  players.bottom.baseY = height * players.bottom.yRatio;

  for (const player of Object.values(players)) {
    player.x = clamp(player.x, 54, width - 54);
    if (!player.isShooting && !player.isReturning) {
      player.yoyoY = player.baseY;
    }
  }

  seedDots();
}

function seedDots() {
  dots.length = 0;
  const dotCount = Math.ceil(width / DOT_SPACING) + 5;
  const startX = -DOT_SPACING;
  for (let index = 0; index < dotCount; index += 1) {
    dots.push(createDot(startX + index * DOT_SPACING));
  }
}

function createDot(x) {
  return {
    id: globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    x,
    y: centerY,
    radius: 11,
    hiddenLetter: chooseHiddenLetter(),
    flipped: false,
    flipProgress: 0,
    removing: false,
    removeProgress: 0,
    wobble: Math.random() * Math.PI * 2,
  };
}

function chooseHiddenLetter() {
  if (progressIndex >= TARGET_WORD.length) {
    return "";
  }

  const currentLetterAlreadyAvailable = dots.some(
    (dot) => !dot.removing && dot.hiddenLetter === TARGET_WORD[progressIndex]
  );
  const probability = currentLetterAlreadyAvailable
    ? LETTER_PROBABILITY * 0.35
    : Math.min(0.82, LETTER_PROBABILITY + nextLetterChanceBoost);

  if (Math.random() < probability) {
    nextLetterChanceBoost = 0;
    return TARGET_WORD[progressIndex];
  }

  nextLetterChanceBoost = Math.min(0.42, nextLetterChanceBoost + 0.035);
  return "";
}

function updateProgressDisplay() {
  progressElement.textContent = TARGET_WORD
    .split("")
    .map((letter, index) => (index < progressIndex ? letter : "_"))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Main game loop
// ---------------------------------------------------------------------------

function update(delta) {
  const timeScale = gameWon ? 0.34 : 1;
  const scaledDelta = delta * timeScale;

  if (gameWon) {
    victoryTime += delta;
    screenGlow = Math.min(1, screenGlow + delta * 0.8);
    updateParticles(delta);
    updateVictoryEffects(delta);
    return;
  }

  updatePlayers(delta);
  updateDots(scaledDelta);
  updateParticles(delta);
  updateRings(delta);
  detectCollisions();
  screenGlow = Math.max(0, screenGlow - delta * 1.8);
}

// ---------------------------------------------------------------------------
// Player movement, shooting, and yo-yo return behavior
// ---------------------------------------------------------------------------

function updatePlayers(delta) {
  updatePlayerMovement(players.top, delta);
  updatePlayerMovement(players.bottom, delta);
  updateYoyo(players.top, delta);
  updateYoyo(players.bottom, delta);
}

function updatePlayerMovement(player, delta) {
  const left = keys.has(player.moveLeft);
  const right = keys.has(player.moveRight);
  const direction = Number(right) - Number(left);
  player.x = clamp(player.x + direction * PLAYER_SPEED * delta, 42, width - 42);
  player.cooldownLeft = Math.max(0, player.cooldownLeft - delta);

  if (keys.has(player.shootKey)) {
    tryShoot(player);
  }
}

function tryShoot(player) {
  if (player.isShooting || player.isReturning || player.cooldownLeft > 0 || gameWon) {
    return;
  }

  player.isShooting = true;
  player.shootProgress = 0;
  player.targetReach = player.direction === 1
    ? (centerY - player.baseY) / Math.max(1, height)
    : (player.baseY - centerY) / Math.max(1, height);
}

function updateYoyo(player, delta) {
  const maxReach = Math.abs(centerY - player.baseY);
  const speed = player.isShooting ? YOYO_SHOOT_SPEED : YOYO_RETURN_SPEED;

  if (player.isShooting) {
    player.shootProgress += (speed * delta) / Math.max(1, maxReach);
    const elastic = easeOutBack(Math.min(player.shootProgress, 1));
    player.yoyoY = player.baseY + player.direction * maxReach * elastic;
    if (player.shootProgress >= 1) {
      player.isShooting = false;
      player.isReturning = true;
    }
  } else if (player.isReturning) {
    const distance = player.yoyoY - player.baseY;
    const returnStep = Math.sign(distance) * YOYO_RETURN_SPEED * delta;
    if (Math.abs(returnStep) >= Math.abs(distance)) {
      player.yoyoY = player.baseY;
      player.isReturning = false;
      if (player === players.top) {
        player.cooldownLeft = SHOOT_COOLDOWN;
      }
    } else {
      player.yoyoY -= returnStep;
    }
  } else {
    player.yoyoY += (player.baseY - player.yoyoY) * Math.min(1, delta * 14);
  }

  player.trail.unshift({ x: player.x, y: player.yoyoY, life: 1 });
  player.trail = player.trail
    .map((point) => ({ ...point, life: point.life - delta * 4 }))
    .filter((point) => point.life > 0)
    .slice(0, 9);
}

// ---------------------------------------------------------------------------
// Dot scrolling, reveal flips, collision, and collection rules
// ---------------------------------------------------------------------------

function updateDots(delta) {
  for (const dot of dots) {
    dot.x -= DOT_SPEED * delta;
    dot.y = centerY + Math.sin(dot.wobble + performance.now() * 0.0012) * 1.5;

    if (dot.flipped) {
      dot.flipProgress = Math.min(1, dot.flipProgress + delta * 4.6);
    }

    if (dot.removing) {
      dot.removeProgress = Math.min(1, dot.removeProgress + delta * 5.5);
    }
  }

  for (let index = dots.length - 1; index >= 0; index -= 1) {
    if (dots[index].removeProgress >= 1) {
      dots.splice(index, 1);
    }
  }

  dots.sort((a, b) => a.x - b.x);

  while (dots.length && dots[0].x < -DOT_SPACING) {
    dots.shift();
  }

  while (!dots.length || dots[dots.length - 1].x < width + DOT_SPACING * 2) {
    const nextX = dots.length ? dots[dots.length - 1].x + DOT_SPACING : width + DOT_SPACING;
    dots.push(createDot(nextX));
  }
}

function detectCollisions() {
  for (const dot of dots) {
    if (dot.removing) {
      continue;
    }

    const topHit = players.top.isShooting && distance(players.top.x, players.top.yoyoY, dot.x, dot.y) < 28;
    if (topHit && !dot.flipped) {
      revealDot(dot);
      players.top.isShooting = false;
      players.top.isReturning = true;
    }

    const bottomHit = players.bottom.isShooting && dot.flipped && distance(players.bottom.x, players.bottom.yoyoY, dot.x, dot.y) < 30;
    if (bottomHit) {
      collectDot(dot);
      players.bottom.isShooting = false;
      players.bottom.isReturning = true;
    }
  }
}

function revealDot(dot) {
  dot.flipped = true;
  dot.flipProgress = 0.02;
  spawnBurst(dot.x, dot.y, dot.hiddenLetter ? "#ffffff" : "#aab4c8", 18, 120);
  rings.push(createRing(dot.x, dot.y, dot.hiddenLetter ? "rgba(255,255,255,0.7)" : "rgba(170,180,200,0.4)", 38));
}

function collectDot(dot) {
  dot.removing = true;
  const expected = TARGET_WORD[progressIndex];

  if (dot.hiddenLetter && dot.hiddenLetter === expected) {
    progressIndex += 1;
    updateProgressDisplay();
    spawnBurst(dot.x, dot.y, "#fff0d9", 28, 190);
    rings.push(createRing(dot.x, dot.y, "rgba(255,240,210,0.84)", 58));
    screenGlow = 0.4;
    clearStaleLetters();

    if (progressIndex === TARGET_WORD.length) {
      triggerVictory();
    }
  } else if (dot.hiddenLetter) {
    punish(dot.x, dot.y, "#ff7a8a");
  } else {
    punish(dot.x, dot.y, "#ff4d5e");
  }
}

// Existing letters are cleared after progress changes so newly collected
// letters always match the current target and the game remains completable.
function clearStaleLetters() {
  const expected = TARGET_WORD[progressIndex];
  for (const dot of dots) {
    if (!dot.removing && dot.hiddenLetter && dot.hiddenLetter !== expected) {
      dot.hiddenLetter = "";
    }
  }
}

function punish(x, y, color) {
  progressIndex = Math.max(0, progressIndex - 1);
  updateProgressDisplay();
  spawnBurst(x, y, color, 24, 170);
  rings.push(createRing(x, y, "rgba(255,77,94,0.7)", 48));
  screenGlow = 0.7;
  arenaWrap.classList.remove("error");
  void arenaWrap.offsetWidth;
  arenaWrap.classList.add("error");
}

// ---------------------------------------------------------------------------
// Victory, particles, and other effects
// ---------------------------------------------------------------------------

function triggerVictory() {
  gameWon = true;
  victoryTime = 0;
  victoryElement.classList.remove("hidden");
  screenGlow = 1;

  for (let i = 0; i < 8; i += 1) {
    setTimeout(() => launchFirework(Math.random() * width, height * (0.18 + Math.random() * 0.48)), i * 130);
  }

  for (let i = 0; i < 5; i += 1) {
    rings.push(createRing(width / 2, centerY, `rgba(255,255,255,${0.58 - i * 0.08})`, 120 + i * 54));
  }
}

function updateVictoryEffects(delta) {
  if (Math.random() < delta * 7) {
    launchFirework(width * (0.15 + Math.random() * 0.7), height * (0.18 + Math.random() * 0.52));
  }
  updateRings(delta);
}

function launchFirework(x, y) {
  const hue = 28 + Math.random() * 34;
  const color = `hsl(${hue}, 100%, ${76 + Math.random() * 14}%)`;
  fireworks.push({ x, y, life: 1 });
  spawnBurst(x, y, color, 52, 330);
  rings.push(createRing(x, y, "rgba(255,255,255,0.68)", 84));
}

function createRing(x, y, color, maxRadius) {
  return {
    x,
    y,
    color,
    maxRadius,
    radius: 0,
    life: 1,
  };
}

function updateRings(delta) {
  for (const ring of rings) {
    ring.radius += ring.maxRadius * delta * 1.75;
    ring.life -= delta * 1.35;
  }

  for (let index = rings.length - 1; index >= 0; index -= 1) {
    if (rings[index].life <= 0) {
      rings.splice(index, 1);
    }
  }
}

function spawnBurst(x, y, color, amount, power) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = power * (0.25 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + Math.random() * 2.8,
      color,
      life: 1,
      decay: 0.7 + Math.random() * 0.8,
    });
  }
}

function updateParticles(delta) {
  for (const particle of particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 1 - delta * 2.2;
    particle.vy *= 1 - delta * 2.2;
    particle.vy += 46 * delta;
    particle.life -= particle.decay * delta;
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    if (particles[index].life <= 0) {
      particles.splice(index, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  drawStreamGuide();
  drawDots();
  drawPlayers();
  drawRings();
  drawParticles();
  drawScreenGlow();
  drawCooldownMeters();
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(width / 2, centerY, 20, width / 2, centerY, width * 0.62);
  gradient.addColorStop(0, "rgba(255,255,255,0.09)");
  gradient.addColorStop(0.35, "rgba(70,78,124,0.10)");
  gradient.addColorStop(1, "rgba(3,5,13,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 179 + performance.now() * 0.006) % width;
    const y = (i * 97) % height;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + (i % 3) * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStreamGuide() {
  const gradient = ctx.createLinearGradient(0, centerY, width, centerY);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
}

function drawDots() {
  for (const dot of dots) {
    const removeScale = dot.removing ? 1 - easeInOut(dot.removeProgress) : 1;
    const flipScale = dot.flipped ? Math.abs(Math.cos(dot.flipProgress * Math.PI)) : 1;
    const visibleFlipScale = Math.max(0.14, flipScale);
    const radius = dot.radius * removeScale;

    ctx.save();
    ctx.translate(dot.x, dot.y);
    ctx.scale(visibleFlipScale, 1);
    ctx.globalAlpha = removeScale;
    ctx.shadowBlur = dot.flipped && dot.hiddenLetter ? 26 : 16;
    ctx.shadowColor = "#fff";

    const dotGradient = ctx.createRadialGradient(-3, -4, 1, 0, 0, radius);
    dotGradient.addColorStop(0, "#ffffff");
    dotGradient.addColorStop(0.6, dot.flipped ? "#eef2ff" : "#f8fbff");
    dotGradient.addColorStop(1, "rgba(255,255,255,0.42)");
    ctx.fillStyle = dotGradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    if (dot.flipped && dot.flipProgress > 0.48 && dot.hiddenLetter) {
      ctx.scale(1 / visibleFlipScale, 1);
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#10131f";
      ctx.font = `900 ${radius * 1.35}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dot.hiddenLetter, 0, 1);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `800 ${radius * 0.82}px ui-sans-serif, system-ui`;
      ctx.fillText(dot.hiddenLetter, 0, 0);
    }

    ctx.restore();
  }
}

function drawPlayers() {
  drawPlayer(players.top);
  drawPlayer(players.bottom);
}

function drawPlayer(player) {
  ctx.save();
  ctx.lineCap = "round";

  const stringGradient = ctx.createLinearGradient(player.x, player.baseY, player.x, player.yoyoY);
  stringGradient.addColorStop(0, "rgba(255,255,255,0.2)");
  stringGradient.addColorStop(1, "rgba(255,255,255,0.86)");
  ctx.strokeStyle = stringGradient;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(player.x, player.baseY);
  ctx.quadraticCurveTo(player.x + Math.sin(performance.now() * 0.008) * 8, (player.baseY + player.yoyoY) / 2, player.x, player.yoyoY);
  ctx.stroke();

  for (const point of player.trail) {
    ctx.globalAlpha = point.life * 0.24;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, player.radius * point.life * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 28;
  ctx.shadowColor = player.color;
  const ballGradient = ctx.createRadialGradient(player.x - 6, player.yoyoY - 7, 2, player.x, player.yoyoY, player.radius);
  ballGradient.addColorStop(0, "#ffffff");
  ballGradient.addColorStop(0.48, player.color);
  ballGradient.addColorStop(1, "rgba(180,190,210,0.58)");
  ctx.fillStyle = ballGradient;
  ctx.beginPath();
  ctx.arc(player.x, player.yoyoY, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(10,12,20,0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.yoyoY, player.radius * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  drawPlayerAnchor(player);
  ctx.restore();
}

function drawPlayerAnchor(player) {
  const labelY = player.direction === 1 ? player.baseY - 34 : player.baseY + 38;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.roundRect(player.x - 42, player.baseY - 8, 84, 16, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.name, player.x, labelY);
}

function drawRings() {
  for (const ring of rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ring.life);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = ring.color;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.shadowBlur = 18;
    ctx.shadowColor = particle.color;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * particle.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCooldownMeters() {
  const player = players.top;
  if (player.cooldownLeft <= 0 || gameWon) {
    return;
  }

  const ratio = player.cooldownLeft / SHOOT_COOLDOWN;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(player.x, player.baseY, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ratio));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 10px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("RECHARGE", player.x, player.baseY - 42);
  ctx.restore();
}

function drawScreenGlow() {
  if (screenGlow <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = screenGlow * 0.24;
  ctx.fillStyle = gameWon ? "#fff3df" : "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function loop(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function resetGame() {
  progressIndex = 0;
  gameWon = false;
  victoryTime = 0;
  screenGlow = 0;
  nextLetterChanceBoost = 0;
  particles.length = 0;
  rings.length = 0;
  fireworks.length = 0;
  victoryElement.classList.add("hidden");
  arenaWrap.classList.remove("error");

  for (const player of Object.values(players)) {
    player.x = width * 0.5;
    player.yoyoY = player.baseY;
    player.isShooting = false;
    player.isReturning = false;
    player.cooldownLeft = 0;
    player.trail.length = 0;
  }

  updateProgressDisplay();
  seedDots();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function easeOutBack(value) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function easeInOut(value) {
  return value < 0.5
    ? 2 * value * value
    : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "w", "a", "d"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", resizeCanvas);
restartButton.addEventListener("click", resetGame);

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRectPolyfill(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}

resizeCanvas();
updateProgressDisplay();
requestAnimationFrame(loop);
