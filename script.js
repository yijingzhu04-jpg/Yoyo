// Tunable game variables.
const DOT_SPEED = 118;
const DOT_SPACING = 86;
const PLAYER_SPEED = 390;
const YOYO_SHOOT_SPEED = 720;
const YOYO_RETURN_SPEED = 920;
const SHOOT_COOLDOWN = 3;
const LETTER_PROBABILITY = 0.34;
const TARGET_WORD = "PHOENIX";

const DOT_RADIUS = 9;
const YOYO_RADIUS = 18;
const GAME_TIME = 60;
const DOT_SPACING_VARIANCE = 58;
const DOT_MIN_SPACING = 46;
const DOT_MAX_SPACING = 152;
const FORCE_LETTER_AFTER = 8;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const timerEl = document.getElementById("timer");
const progressEl = document.getElementById("progress");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const resultCard = document.getElementById("resultCard");
const resultEyebrow = document.getElementById("resultEyebrow");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const gameShell = document.querySelector(".game-shell");

const keys = new Set();
let width = 0;
let height = 0;
let streamY = 0;
let lastTime = performance.now();

const state = {
  started: false,
  active: false,
  remainingTime: GAME_TIME,
  progressIndex: 0,
  dots: [],
  particles: [],
  rings: [],
  fireworks: [],
  blankRun: 0,
  slowMotion: 1,
  endMode: null
};

const players = {
  top: createPlayer("top", "#eaf6ff"),
  bottom: createPlayer("bottom", "#fff2d6")
};

function createPlayer(side, color) {
  return {
    side,
    color,
    x: 0,
    anchorY: 0,
    yoyoX: 0,
    yoyoY: 0,
    shotX: 0,
    dir: side === "top" ? 1 : -1,
    state: "idle",
    cooldown: 0,
    hitThisShot: false,
    reelStretch: 0
  };
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  streamY = height * 0.5;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  players.top.anchorY = streamY - Math.min(170, height * 0.23);
  players.bottom.anchorY = streamY + Math.min(170, height * 0.23);
  if (!state.started) {
    players.top.x = width * 0.34;
    players.bottom.x = width * 0.66;
    resetYoyo(players.top);
    resetYoyo(players.bottom);
  }
}

function resetGame() {
  state.started = true;
  state.active = true;
  state.remainingTime = GAME_TIME;
  state.progressIndex = 0;
  state.dots = [];
  state.particles = [];
  state.rings = [];
  state.fireworks = [];
  state.blankRun = 0;
  state.slowMotion = 1;
  state.endMode = null;
  gameShell.classList.remove("victory-glow", "error-flash");
  endScreen.classList.remove("show");
  startScreen.classList.remove("show");

  players.top.x = width * 0.34;
  players.bottom.x = width * 0.66;
  Object.values(players).forEach((player) => {
    player.state = "idle";
    player.cooldown = 0;
    player.hitThisShot = false;
    resetYoyo(player);
  });

  seedDots();
  updateHud();
}

function seedDots() {
  state.dots = [];
  state.blankRun = 0;
  let x = -DOT_SPACING;
  while (x < width + DOT_SPACING * 4) {
    state.dots.push(createDot(x));
    x += nextSpacing();
  }
}

function createDot(x) {
  const letter = chooseHiddenLetter();
  return {
    x,
    y: streamY,
    radius: DOT_RADIUS + Math.random() * 2.5,
    letter,
    flipped: false,
    collected: false,
    flip: 0,
    pulse: Math.random() * Math.PI * 2,
    wobble: (Math.random() - 0.5) * 4,
    collectFlash: 0
  };
}

function chooseHiddenLetter() {
  if (state.progressIndex >= TARGET_WORD.length) return "";
  const needed = TARGET_WORD[state.progressIndex];
  const alreadyActive = state.dots.some((dot) => !dot.collected && dot.letter === needed);
  if (alreadyActive) {
    state.blankRun += 1;
    return "";
  }

  const shouldPlace = Math.random() < LETTER_PROBABILITY || state.blankRun >= FORCE_LETTER_AFTER;
  if (!shouldPlace) {
    state.blankRun += 1;
    return "";
  }

  state.blankRun = 0;
  return needed;
}

function nextSpacing() {
  // Bias spacing toward occasional clusters and gaps so the stream feels organic.
  const skewedRandom = Math.sign(Math.random() - 0.5) * Math.pow(Math.random(), 0.55);
  return clamp(DOT_SPACING + skewedRandom * DOT_SPACING_VARIANCE, DOT_MIN_SPACING, DOT_MAX_SPACING);
}

function updateHud() {
  timerEl.textContent = `TIME: ${Math.max(0, Math.ceil(state.remainingTime))}`;
  progressEl.textContent = TARGET_WORD
    .split("")
    .map((letter, index) => (index < state.progressIndex ? letter : "_"))
    .join(" ");
}

function startShot(player) {
  if (!state.active || player.state !== "idle" || player.cooldown > 0) return;
  player.state = "shooting";
  player.shotX = player.x;
  player.yoyoX = player.x;
  player.hitThisShot = false;
  player.reelStretch = 1;
}

function resetYoyo(player) {
  player.yoyoX = player.x;
  player.yoyoY = player.anchorY;
  player.shotX = player.x;
}

function updatePlayers(dt) {
  movePlayer(players.top, dt, keys.has("a"), keys.has("d"));
  movePlayer(players.bottom, dt, keys.has("ArrowLeft"), keys.has("ArrowRight"));

  if (keys.has("w")) startShot(players.top);
  if (keys.has("ArrowUp")) startShot(players.bottom);

  updateYoyo(players.top, dt);
  updateYoyo(players.bottom, dt);
}

function movePlayer(player, dt, left, right) {
  const input = (right ? 1 : 0) - (left ? 1 : 0);
  player.x += input * PLAYER_SPEED * dt;
  player.x = clamp(player.x, 54, width - 54);
  if (player.state === "idle") {
    resetYoyo(player);
  }
  if (player.cooldown > 0) {
    player.cooldown = Math.max(0, player.cooldown - dt);
  }
  player.reelStretch = Math.max(0, player.reelStretch - dt * 4);
}

function updateYoyo(player, dt) {
  const maxReach = Math.abs(streamY - player.anchorY) + 34;
  const targetY = player.anchorY + maxReach * player.dir;

  if (player.state === "shooting") {
    player.yoyoY += YOYO_SHOOT_SPEED * player.dir * dt;
    player.yoyoX = player.shotX;
    checkShotCollision(player);
    if ((player.dir > 0 && player.yoyoY >= targetY) || (player.dir < 0 && player.yoyoY <= targetY)) {
      player.yoyoY = targetY;
      player.state = "returning";
      if (player.side === "top" && !player.hitThisShot) {
        player.cooldown = SHOOT_COOLDOWN;
        addMissSparks(player.yoyoX, streamY);
      }
    }
  } else if (player.state === "returning") {
    const delta = player.anchorY - player.yoyoY;
    const step = Math.sign(delta) * YOYO_RETURN_SPEED * dt;
    if (Math.abs(step) >= Math.abs(delta)) {
      player.state = "idle";
      resetYoyo(player);
    } else {
      player.yoyoY += step;
    }
    player.yoyoX = lerp(player.yoyoX, player.x, 0.12);
  }
}

function checkShotCollision(player) {
  for (const dot of state.dots) {
    if (dot.collected) continue;
    const distance = Math.hypot(player.yoyoX - dot.x, player.yoyoY - dot.y);
    if (distance > YOYO_RADIUS + dot.radius + 2) continue;

    player.hitThisShot = true;
    player.state = "returning";
    player.reelStretch = 1;

    if (player.side === "top") {
      revealDot(dot);
    } else {
      collectDot(dot);
    }
    break;
  }
}

function revealDot(dot) {
  if (dot.flipped) return;
  dot.flipped = true;
  dot.flip = 1;
  addFlipParticles(dot.x, dot.y, dot.letter);
}

function collectDot(dot) {
  if (!dot.flipped) {
    addMissSparks(dot.x, dot.y);
    return;
  }

  dot.collected = true;
  dot.collectFlash = 1;
  if (dot.letter && dot.letter === TARGET_WORD[state.progressIndex]) {
    state.progressIndex += 1;
    addCollectParticles(dot.x, dot.y, dot.letter);
    addRing(dot.x, dot.y, "#ffc76f", 18, 86);
    if (state.progressIndex === TARGET_WORD.length) {
      completeGame();
    }
  } else {
    punishMistake(dot.x, dot.y);
  }
  updateHud();
}

function punishMistake(x, y) {
  state.progressIndex = Math.max(0, state.progressIndex - 1);
  gameShell.classList.remove("error-flash");
  void gameShell.offsetWidth;
  gameShell.classList.add("error-flash");
  addErrorParticles(x, y);
  addRing(x, y, "#ff4268", 12, 74);
}

function updateDots(dt) {
  for (const dot of state.dots) {
    dot.x -= DOT_SPEED * dt * state.slowMotion;
    dot.y = streamY + dot.wobble;
    dot.pulse += dt * 3;
    dot.flip = Math.max(0, dot.flip - dt * 2.6);
    dot.collectFlash = Math.max(0, dot.collectFlash - dt * 4);
  }

  state.dots = state.dots.filter((dot) => dot.x > -DOT_SPACING && !dot.collected);
  let rightMost = state.dots.reduce((max, dot) => Math.max(max, dot.x), -DOT_SPACING);
  while (rightMost < width + DOT_SPACING * 3) {
    rightMost += nextSpacing();
    state.dots.push(createDot(rightMost));
  }
}

function updateTimer(dt) {
  state.remainingTime -= dt;
  if (state.remainingTime <= 0) {
    state.remainingTime = 0;
    endGame(false);
  }
  updateHud();
}

function completeGame() {
  state.active = false;
  state.slowMotion = 0.18;
  spawnVictoryEffects();
  gameShell.classList.add("victory-glow");
  setTimeout(() => endGame(true), 650);
}

function endGame(won) {
  if (state.endMode) return;
  state.active = false;
  state.endMode = won ? "win" : "lose";
  resultCard.classList.toggle("win", won);
  resultCard.classList.toggle("lose", !won);
  resultEyebrow.textContent = won ? "Victory" : "Time out";
  resultTitle.textContent = won ? "PHOENIX COMPLETE!" : "TIME OUT";
  resultText.textContent = won
    ? "The final letter clicks into place and the firebird rises in a burst of light."
    : "The stream fades before PHOENIX can be completed. Try again together.";
  endScreen.classList.add("show");
  if (!won) addRing(width / 2, streamY, "#ff4268", 40, 170);
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= dt;
    particle.age += dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  for (const ring of state.rings) {
    ring.radius += ring.speed * dt;
    ring.life -= dt;
  }
  state.rings = state.rings.filter((ring) => ring.life > 0);

  for (const firework of state.fireworks) {
    firework.delay -= dt;
    if (firework.delay <= 0 && !firework.fired) {
      firework.fired = true;
      addFireworkBurst(firework.x, firework.y, firework.color);
    }
  }
  state.fireworks = state.fireworks.filter((firework) => !firework.fired);
}

function addFlipParticles(x, y, hasLetter) {
  const color = hasLetter ? "#ffc76f" : "#ffffff";
  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 36 + Math.random() * 105;
    state.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 0.55, 2.4));
  }
  addRing(x, y, color, 8, 42);
}

function addCollectParticles(x, y, letter) {
  for (let i = 0; i < 28; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 190;
    state.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, "#ffc76f", 0.82, 3.2));
  }
  state.particles.push(makeParticle(x, y - 12, 0, -42, "#ffffff", 0.75, 5, letter));
}

function addErrorParticles(x, y) {
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 72 + Math.random() * 120;
    state.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, "#ff4268", 0.6, 2.8));
  }
}

function addMissSparks(x, y) {
  for (let i = 0; i < 10; i += 1) {
    const vx = (Math.random() - 0.5) * 110;
    const vy = (Math.random() - 0.5) * 34;
    state.particles.push(makeParticle(x, y, vx, vy, "#ff4268", 0.42, 1.8));
  }
}

function spawnVictoryEffects() {
  addRing(width / 2, streamY, "#ffc76f", 26, 260);
  addRing(width / 2, streamY, "#ffffff", 8, 180);
  for (let i = 0; i < 9; i += 1) {
    state.fireworks.push({
      x: width * (0.18 + Math.random() * 0.64),
      y: height * (0.2 + Math.random() * 0.42),
      color: Math.random() > 0.45 ? "#ffc76f" : "#ffffff",
      delay: i * 0.11,
      fired: false
    });
  }
}

function addFireworkBurst(x, y, color) {
  addRing(x, y, color, 6, 110);
  for (let i = 0; i < 42; i += 1) {
    const angle = (i / 42) * Math.PI * 2 + Math.random() * 0.16;
    const speed = 85 + Math.random() * 185;
    state.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 1.05, 2.6));
  }
}

function addRing(x, y, color, radius, speed) {
  state.rings.push({ x, y, color, radius, speed, life: 0.8, maxLife: 0.8 });
}

function makeParticle(x, y, vx, vy, color, life, size, text = "") {
  return {
    x,
    y,
    vx,
    vy,
    color,
    life,
    maxLife: life,
    age: 0,
    size,
    text
  };
}

function drawScene() {
  ctx.clearRect(0, 0, width, height);
  drawAtmosphere();
  drawStreamGuide();
  drawDots();
  drawPlayers();
  drawRings();
  drawParticles();
}

function drawAtmosphere() {
  const gradient = ctx.createRadialGradient(width / 2, streamY, 10, width / 2, streamY, Math.max(width, height) * 0.64);
  gradient.addColorStop(0, "rgba(255,255,255,0.08)");
  gradient.addColorStop(0.28, "rgba(70,85,140,0.08)");
  gradient.addColorStop(1, "rgba(5,7,17,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawStreamGuide() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 18]);
  ctx.beginPath();
  ctx.moveTo(0, streamY);
  ctx.lineTo(width, streamY);
  ctx.stroke();
  ctx.restore();
}

function drawDots() {
  for (const dot of state.dots) {
    const glow = 0.68 + Math.sin(dot.pulse) * 0.18;
    const scaleX = dot.flip > 0 ? Math.abs(Math.cos((1 - dot.flip) * Math.PI)) : 1;
    ctx.save();
    ctx.translate(dot.x, dot.y);
    ctx.scale(Math.max(0.12, scaleX), 1);
    ctx.shadowBlur = dot.flipped && dot.letter ? 24 : 16;
    ctx.shadowColor = dot.flipped && dot.letter ? "rgba(255,199,111,0.95)" : `rgba(255,255,255,${glow})`;
    ctx.fillStyle = dot.flipped ? "rgba(242,246,255,0.96)" : "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, dot.radius + dot.collectFlash * 8, 0, Math.PI * 2);
    ctx.fill();

    if (dot.flipped && dot.letter) {
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#111527";
      ctx.font = "900 14px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dot.letter, 0, 0.5);
    } else if (dot.flipped) {
      ctx.fillStyle = "rgba(12,17,34,0.42)";
      ctx.beginPath();
      ctx.arc(0, 0, dot.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayers() {
  drawPlayer(players.top);
  drawPlayer(players.bottom);
}

function drawPlayer(player) {
  const cooldownRatio = player.cooldown / SHOOT_COOLDOWN;
  ctx.save();
  ctx.strokeStyle = player.side === "top" ? "rgba(170,220,255,0.72)" : "rgba(255,220,165,0.72)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(player.x, player.anchorY);
  const controlY = (player.anchorY + player.yoyoY) / 2 + player.reelStretch * 16 * -player.dir;
  ctx.quadraticCurveTo((player.x + player.yoyoX) / 2, controlY, player.yoyoX, player.yoyoY);
  ctx.stroke();

  drawAnchor(player, cooldownRatio);
  drawYoyoBall(player, cooldownRatio);
  ctx.restore();
}

function drawAnchor(player, cooldownRatio) {
  ctx.save();
  ctx.translate(player.x, player.anchorY);
  ctx.shadowBlur = 24;
  ctx.shadowColor = player.color;
  ctx.fillStyle = cooldownRatio > 0 ? "rgba(255,66,104,0.86)" : player.color;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(5,7,17,0.86)";
  ctx.font = "900 13px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.side === "top" ? "P1" : "P2", 0, 1);
  if (cooldownRatio > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.68)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldownRatio));
    ctx.stroke();
  }
  ctx.restore();
}

function drawYoyoBall(player, cooldownRatio) {
  const gradient = ctx.createRadialGradient(player.yoyoX - 6, player.yoyoY - 7, 2, player.yoyoX, player.yoyoY, YOYO_RADIUS + 8);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.55, cooldownRatio > 0 ? "#ff8aa1" : player.color);
  gradient.addColorStop(1, "rgba(120,135,175,0.92)");
  ctx.fillStyle = gradient;
  ctx.shadowBlur = 28;
  ctx.shadowColor = cooldownRatio > 0 ? "rgba(255,66,104,0.9)" : player.color;
  ctx.beginPath();
  ctx.arc(player.yoyoX, player.yoyoY, YOYO_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(player.yoyoX, player.yoyoY + player.dir * (YOYO_RADIUS + 3), 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawRings() {
  for (const ring of state.rings) {
    const alpha = Math.max(0, ring.life / ring.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 24;
    ctx.shadowColor = ring.color;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 18;
    ctx.shadowColor = particle.color;
    ctx.fillStyle = particle.color;
    if (particle.text) {
      ctx.font = "900 24px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(particle.text, particle.x, particle.y);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function loop(now) {
  const rawDt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  const dt = rawDt * state.slowMotion;

  if (state.active) {
    updateTimer(rawDt);
    updatePlayers(rawDt);
    updateDots(dt);
  }
  updateParticles(rawDt);
  drawScene();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
startButton.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);

resizeCanvas();
seedDots();
updateHud();
requestAnimationFrame(loop);
