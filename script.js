// Configurable game variables.
const DOT_SPEED = 112;
const DOT_SPACING = { MIN: 46, MAX: 118 };
const PLAYER_SPEED = 430;
const YOYO_SHOOT_SPEED = 850;
const YOYO_RETURN_SPEED = 960;
const SHOOT_COOLDOWN = 3;
const LETTER_PROBABILITY = 0.28;
const TARGET_WORD = "PHOENIX";

const GAME_DURATION = 60;
const DOT_RADIUS = 11;
const PLAYER_RADIUS = 19;
const YOYO_RADIUS = 13;
const HIT_RADIUS = 24;
const FLIP_DURATION = 0.42;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const arena = document.getElementById("arena");
const timerEl = document.getElementById("timer");
const progressEl = document.getElementById("progress");
const cooldownEl = document.getElementById("cooldown");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");

let width = 0;
let height = 0;
let deviceRatio = 1;
let lastTime = performance.now();

const keys = new Set();
let dots = [];
let particles = [];
let rings = [];
let fireworks = [];
let collected = [];
let timeLeft = GAME_DURATION;
let gameState = "playing";
let nextDotId = 1;
let generatedSinceLetter = 0;
let flashTimer = 0;
let victoryTimer = 0;

const players = {
  top: createPlayer("top"),
  bottom: createPlayer("bottom")
};

function createPlayer(side) {
  return {
    side,
    x: 0,
    baseY: 0,
    yoyoY: 0,
    targetY: 0,
    state: "ready",
    cooldown: 0,
    shotHit: false,
    recoil: 0,
    color: side === "top" ? "#dfe9ff" : "#fff7dc"
  };
}

function resetGame() {
  dots = [];
  particles = [];
  rings = [];
  fireworks = [];
  collected = [];
  timeLeft = GAME_DURATION;
  gameState = "playing";
  nextDotId = 1;
  generatedSinceLetter = 0;
  flashTimer = 0;
  victoryTimer = 0;
  arena.classList.remove("error-flash", "win-glow");
  overlay.classList.add("hidden");
  updateProgress();
  updateTimer();
  positionPlayers();
  seedDots();
}

function resizeCanvas() {
  const rect = arena.getBoundingClientRect();
  width = Math.max(320, rect.width);
  height = Math.max(320, rect.height);
  deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * deviceRatio);
  canvas.height = Math.round(height * deviceRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  positionPlayers();
  if (dots.length === 0) {
    seedDots();
  }
}

function positionPlayers() {
  const streamY = getStreamY();
  players.top.x = clamp(players.top.x || width * 0.28, PLAYER_RADIUS + 16, width - PLAYER_RADIUS - 16);
  players.bottom.x = clamp(players.bottom.x || width * 0.72, PLAYER_RADIUS + 16, width - PLAYER_RADIUS - 16);

  players.top.baseY = Math.max(54, streamY - Math.min(160, height * 0.25));
  players.bottom.baseY = Math.min(height - 54, streamY + Math.min(160, height * 0.25));
  players.top.targetY = streamY - 2;
  players.bottom.targetY = streamY + 2;

  for (const player of Object.values(players)) {
    if (player.state === "ready") {
      player.yoyoY = player.baseY;
    } else {
      player.yoyoY = clamp(player.yoyoY, 0, height);
    }
  }
}

function getStreamY() {
  return height * 0.5;
}

function seedDots() {
  if (!width || !height) return;
  dots = [];
  let x = -DOT_SPACING.MAX;
  while (x < width + DOT_SPACING.MAX * 2) {
    x += randomRange(DOT_SPACING.MIN, DOT_SPACING.MAX);
    dots.push(createDot(x));
  }
}

// Dot generation favors blanks but guarantees the next needed letter appears often enough.
function createDot(x) {
  const neededLetter = TARGET_WORD[collected.length] || "";
  const mustPlaceLetter = neededLetter && generatedSinceLetter >= 7;
  const hasLetter = Boolean(neededLetter) && (mustPlaceLetter || Math.random() < LETTER_PROBABILITY);
  generatedSinceLetter = hasLetter ? 0 : generatedSinceLetter + 1;

  return {
    id: nextDotId++,
    x,
    y: getStreamY() + randomRange(-14, 14),
    radius: randomRange(DOT_RADIUS - 3, DOT_RADIUS + 4),
    letter: hasLetter ? neededLetter : "",
    flipped: false,
    flipTime: 0,
    flipBurstDone: false,
    collected: false,
    wobble: Math.random() * Math.PI * 2,
    alpha: randomRange(0.82, 1)
  };
}

function updateGame(delta) {
  const slowFactor = gameState === "won" ? 0.42 : 1;
  const dt = Math.min(delta, 0.033) * slowFactor;

  if (gameState === "playing") {
    timeLeft -= delta;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame(false);
    }

    updatePlayers(dt);
    updateDots(dt);
    updateCollisions();
  }

  if (gameState === "won") {
    victoryTimer += delta;
    updateVictory(delta);
  }

  updateFlips(dt);
  updateParticles(delta);
  updateRings(delta);
  updateCooldownHud();
  updateTimer();

  if (flashTimer > 0) {
    flashTimer -= delta;
  }
}

function updatePlayers(dt) {
  movePlayer(players.top, (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), dt);
  movePlayer(players.bottom, (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0), dt);

  if (keys.has("KeyW")) shoot(players.top);
  if (keys.has("ArrowUp")) shoot(players.bottom);

  for (const player of Object.values(players)) {
    if (player.cooldown > 0) {
      player.cooldown = Math.max(0, player.cooldown - dt);
    }

    if (player.state === "shooting") {
      const direction = player.side === "top" ? 1 : -1;
      player.yoyoY += direction * YOYO_SHOOT_SPEED * dt;
      player.recoil = Math.max(player.recoil, 1);
      if ((direction === 1 && player.yoyoY >= player.targetY) || (direction === -1 && player.yoyoY <= player.targetY)) {
        player.yoyoY = player.targetY;
        player.state = "returning";
      }
    } else if (player.state === "returning") {
      const distance = player.baseY - player.yoyoY;
      const step = Math.sign(distance) * YOYO_RETURN_SPEED * dt;
      if (Math.abs(step) >= Math.abs(distance)) {
        player.yoyoY = player.baseY;
        player.state = "ready";
        if (player.side === "top" && !player.shotHit) {
          triggerCooldown(player);
        }
      } else {
        player.yoyoY += step;
      }
    }

    player.recoil = Math.max(0, player.recoil - dt * 4.5);
  }
}

function movePlayer(player, direction, dt) {
  player.x = clamp(player.x + direction * PLAYER_SPEED * dt, PLAYER_RADIUS + 16, width - PLAYER_RADIUS - 16);
}

function shoot(player) {
  if (player.state !== "ready" || player.cooldown > 0 || gameState !== "playing") return;
  player.state = "shooting";
  player.shotHit = false;
}

function triggerCooldown(player) {
  player.cooldown = SHOOT_COOLDOWN;
  cooldownEl.classList.add("is-cooling");
  spawnParticles(player.x, getStreamY(), "#ff425f", 18, 130);
}

function updateDots(dt) {
  for (const dot of dots) {
    dot.x -= DOT_SPEED * dt;
    dot.wobble += dt * 2.6;
    dot.y += Math.sin(dot.wobble) * 0.018;
  }

  dots = dots.filter(dot => dot.x > -DOT_SPACING.MAX && !dot.collected);
  let rightEdge = dots.reduce((max, dot) => Math.max(max, dot.x), -DOT_SPACING.MAX);
  while (rightEdge < width + DOT_SPACING.MAX) {
    rightEdge += randomRange(DOT_SPACING.MIN, DOT_SPACING.MAX);
    dots.push(createDot(rightEdge));
  }
}

function updateFlips(dt) {
  for (const dot of dots) {
    if (dot.flipped && dot.flipTime < FLIP_DURATION) {
      dot.flipTime = Math.min(FLIP_DURATION, dot.flipTime + dt);
      if (!dot.flipBurstDone && dot.flipTime > FLIP_DURATION * 0.45) {
        dot.flipBurstDone = true;
        spawnParticles(dot.x, dot.y, "#ffffff", 16, 90);
      }
    }
  }
}

function updateCollisions() {
  for (const player of Object.values(players)) {
    if (player.state !== "shooting") continue;

    for (const dot of dots) {
      if (dot.collected) continue;
      const distance = Math.hypot(player.x - dot.x, player.yoyoY - dot.y);
      if (distance > HIT_RADIUS + dot.radius) continue;

      player.shotHit = true;
      player.state = "returning";

      if (player.side === "top") {
        revealDot(dot);
      } else {
        collectDot(dot);
      }
      break;
    }
  }
}

function revealDot(dot) {
  if (dot.flipped) return;
  dot.flipped = true;
  dot.flipTime = 0.001;
  dot.flipBurstDone = false;
}

function collectDot(dot) {
  if (!dot.flipped) {
    spawnParticles(dot.x, dot.y, "#7d8da8", 10, 70);
    return;
  }

  dot.collected = true;
  const expectedLetter = TARGET_WORD[collected.length];
  if (dot.letter && dot.letter === expectedLetter) {
    collected.push(dot.letter);
    spawnParticles(dot.x, dot.y, "#ffd784", 34, 180);
    rings.push(createRing(dot.x, dot.y, "#ffd784", 18, 96, 0.68));
    updateProgress();

    if (collected.join("") === TARGET_WORD) {
      endGame(true);
    }
  } else {
    // Stale duplicate letters are punished like empty backs so the word stays ordered.
    if (collected.length > 0) {
      collected.pop();
    }
    updateProgress();
    punishEmptyCollect(dot.x, dot.y);
  }
}

function punishEmptyCollect(x, y) {
  flashTimer = 0.3;
  arena.classList.remove("error-flash");
  void arena.offsetWidth;
  arena.classList.add("error-flash");
  spawnParticles(x, y, "#ff425f", 28, 150);
}

function endGame(won) {
  if (gameState !== "playing") return;
  gameState = won ? "won" : "lost";
  overlay.classList.remove("hidden");

  if (won) {
    arena.classList.add("win-glow");
    overlayKicker.textContent = "Victory";
    overlayTitle.textContent = "PHOENIX COMPLETE!";
    overlayText.textContent = "The hidden letters have risen from the stream.";
    launchVictory();
  } else {
    overlayKicker.textContent = "Time Out";
    overlayTitle.textContent = "TIME OUT";
    overlayText.textContent = "The stream fades before PHOENIX is complete.";
    spawnParticles(width * 0.5, height * 0.5, "#ff425f", 44, 150);
  }
}

function launchVictory() {
  for (let i = 0; i < 5; i++) {
    rings.push(createRing(width * 0.5, height * 0.5, "#ffffff", 20 + i * 18, Math.max(width, height) * 0.58, 1.1 + i * 0.13));
  }

  for (let i = 0; i < 9; i++) {
    fireworks.push({
      x: randomRange(width * 0.18, width * 0.82),
      y: randomRange(height * 0.2, height * 0.8),
      delay: i * 0.12,
      fired: false
    });
  }
}

function updateVictory(dt) {
  for (const firework of fireworks) {
    firework.delay -= dt;
    if (!firework.fired && firework.delay <= 0) {
      firework.fired = true;
      spawnParticles(firework.x, firework.y, Math.random() > 0.5 ? "#ffffff" : "#ffd784", 46, 230);
      rings.push(createRing(firework.x, firework.y, "#ffffff", 8, 82, 0.62));
    }
  }

  if (victoryTimer > 1.8) {
    victoryTimer = 0;
    fireworks = [];
    launchVictory();
  }
}

function updateParticles(dt) {
  particles = particles.filter(particle => {
    particle.life -= dt;
    if (particle.life <= 0) return false;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 1.7;
    particle.vy *= 1 - dt * 1.7;
    particle.vy += particle.gravity * dt;
    return true;
  });
}

function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = randomRange(0, Math.PI * 2);
    const velocity = randomRange(speed * 0.25, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      radius: randomRange(1.4, 3.8),
      life: randomRange(0.35, 0.95),
      maxLife: 0.95,
      color,
      gravity: randomRange(-20, 38)
    });
  }
}

function createRing(x, y, color, startRadius, endRadius, life) {
  return { x, y, color, radius: startRadius, startRadius, endRadius, life, maxLife: life };
}

function updateRings(dt) {
  rings = rings.filter(ring => {
    ring.life -= dt;
    if (ring.life <= 0) return false;
    const progress = 1 - ring.life / ring.maxLife;
    ring.radius = lerp(ring.startRadius, ring.endRadius, easeOutCubic(progress));
    return true;
  });
}

function drawGame() {
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  drawStreamGuide();
  drawDots();
  drawPlayers();
  drawParticles();
  drawRings();
  if (flashTimer > 0) drawErrorVeil();
  if (gameState === "won") drawVictoryGlow();
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.62);
  gradient.addColorStop(0, "rgba(255,255,255,0.035)");
  gradient.addColorStop(0.45, "rgba(25,35,62,0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStreamGuide() {
  const y = getStreamY();
  const line = ctx.createLinearGradient(0, y, width, y);
  line.addColorStop(0, "rgba(255,255,255,0)");
  line.addColorStop(0.2, "rgba(255,255,255,0.11)");
  line.addColorStop(0.5, "rgba(255,255,255,0.22)");
  line.addColorStop(0.8, "rgba(255,255,255,0.11)");
  line.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

function drawDots() {
  for (const dot of dots) {
    const progress = dot.flipped ? dot.flipTime / FLIP_DURATION : 0;
    const scaleX = dot.flipped ? Math.max(0.13, Math.abs(Math.cos(progress * Math.PI))) : 1;
    const showingBack = dot.flipped && progress > 0.5;
    const glow = dot.letter && showingBack ? "rgba(255, 215, 132, 0.85)" : `rgba(255,255,255,${0.65 * dot.alpha})`;

    ctx.save();
    ctx.translate(dot.x, dot.y);
    ctx.scale(scaleX, 1);
    ctx.shadowColor = glow;
    ctx.shadowBlur = showingBack ? 28 : 18;
    ctx.fillStyle = showingBack ? "rgba(245,250,255,0.95)" : `rgba(255,255,255,${dot.alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, dot.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (showingBack && dot.letter) {
      ctx.save();
      ctx.font = `900 ${Math.round(dot.radius * 1.25)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#111722";
      ctx.shadowColor = "rgba(255, 215, 132, 0.92)";
      ctx.shadowBlur = 16;
      ctx.fillText(dot.letter, dot.x, dot.y + 0.5);
      ctx.restore();
    }
  }
}

function drawPlayers() {
  drawPlayer(players.top);
  drawPlayer(players.bottom);
}

function drawPlayer(player) {
  const direction = player.side === "top" ? 1 : -1;
  const baseBounce = player.recoil * direction * -4;
  const baseY = player.baseY + baseBounce;
  const stringGradient = ctx.createLinearGradient(player.x, baseY, player.x, player.yoyoY);
  stringGradient.addColorStop(0, "rgba(255,255,255,0.18)");
  stringGradient.addColorStop(1, "rgba(255,255,255,0.68)");

  ctx.save();
  ctx.strokeStyle = stringGradient;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(player.x, baseY);
  const curve = player.state === "ready" ? 0 : direction * Math.sin(performance.now() * 0.012) * 8;
  ctx.quadraticCurveTo(player.x + curve, (baseY + player.yoyoY) * 0.5, player.x, player.yoyoY);
  ctx.stroke();

  ctx.shadowColor = player.color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(player.x, baseY, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.stroke();

  ctx.shadowBlur = 26;
  const yoyoGradient = ctx.createRadialGradient(player.x - 4, player.yoyoY - 4, 2, player.x, player.yoyoY, YOYO_RADIUS + 4);
  yoyoGradient.addColorStop(0, "#ffffff");
  yoyoGradient.addColorStop(0.56, player.color);
  yoyoGradient.addColorStop(1, "rgba(120,140,180,0.72)");
  ctx.fillStyle = yoyoGradient;
  ctx.beginPath();
  ctx.arc(player.x, player.yoyoY, YOYO_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.76)";
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.7 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRings() {
  for (const ring of rings) {
    const alpha = clamp(ring.life / ring.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = ring.color;
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawErrorVeil() {
  ctx.save();
  ctx.globalAlpha = flashTimer * 0.7;
  ctx.fillStyle = "rgba(255, 66, 95, 0.2)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawVictoryGlow() {
  const pulse = 0.55 + Math.sin(performance.now() * 0.004) * 0.18;
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.55);
  glow.addColorStop(0, `rgba(255, 246, 205, ${0.22 * pulse})`);
  glow.addColorStop(0.42, `rgba(255, 255, 255, ${0.08 * pulse})`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function updateProgress() {
  const slots = TARGET_WORD.split("").map((letter, index) => collected[index] || "_");
  progressEl.textContent = slots.join(" ");
}

function updateTimer() {
  timerEl.textContent = `TIME: ${Math.ceil(timeLeft)}`;
}

function updateCooldownHud() {
  const cooldown = players.top.cooldown;
  if (cooldown > 0) {
    cooldownEl.textContent = `P1 COOLDOWN ${cooldown.toFixed(1)}s`;
    cooldownEl.classList.add("is-cooling");
  } else {
    cooldownEl.textContent = "P1 READY";
    cooldownEl.classList.remove("is-cooling");
  }
}

function loop(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  updateGame(delta);
  drawGame();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

window.addEventListener("keydown", event => {
  if (["KeyA", "KeyD", "KeyW", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
});

window.addEventListener("keyup", event => {
  keys.delete(event.code);
});

window.addEventListener("resize", resizeCanvas);
restartButton.addEventListener("click", resetGame);

resizeCanvas();
resetGame();
requestAnimationFrame(loop);
