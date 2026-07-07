// Configurable gameplay values.
const DOT_SPEED = 105;
const DOT_SPACING = 62;
const PLAYER_SPEED = 430;
const YOYO_SHOOT_SPEED = 860;
const YOYO_RETURN_SPEED = 1120;
const SHOOT_COOLDOWN = 2000;
const LETTER_PROBABILITY = 0.32;
const TARGET_WORD = "PHOENIX";

// Additional tuning constants kept separate from the requested headline config.
const DOT_SIZE = 18;
const YOYO_RADIUS = 16;
const HIT_RADIUS = 25;
const P1_REST_DISTANCE = 55;
const P2_REST_DISTANCE = 55;
const LETTER_FORCE_AFTER_BLANKS = 5;
const MESSAGE_DURATION = 950;
const PARTICLE_GRAVITY = 28;

const gameEl = document.querySelector("#game");
const dotsLayer = document.querySelector("#dotsLayer");
const effectsLayer = document.querySelector("#effectsLayer");
const progressEl = document.querySelector("#progress");
const messageEl = document.querySelector("#message");
const victoryEl = document.querySelector("#victory");
const restartButton = document.querySelector("#restartButton");
const playerTopEl = document.querySelector("#playerTop");
const playerBottomEl = document.querySelector("#playerBottom");
const topYoyoEl = playerTopEl.querySelector(".yoyo");
const bottomYoyoEl = playerBottomEl.querySelector(".yoyo");
const topStringEl = playerTopEl.querySelector(".string");
const bottomStringEl = playerBottomEl.querySelector(".string");
const cooldownMeterEl = playerTopEl.querySelector(".cooldown-meter span");

const keys = new Set();
const dots = [];
const particles = [];
let gameRect = null;
let streamY = 0;
let lastFrame = performance.now();
let collectedLetters = [];
let blanksSinceLetter = 0;
let isPaused = false;
let messageTimer = 0;
let victoryTimer = 0;
let animationFrameId = 0;

const players = {
  top: createPlayer("top"),
  bottom: createPlayer("bottom")
};

function createPlayer(role) {
  return {
    role,
    x: 0,
    yoyoOffset: 0,
    shotState: "ready",
    cooldownUntil: 0,
    maxShotDistance: 0
  };
}

function initializeGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  updateGameMeasurements();
  resetPlayers();
  resetProgress();
  resetDots();
  clearEffects();
  isPaused = false;
  victoryTimer = 0;
  document.body.classList.remove("victory-glow", "slow-motion");
  victoryEl.classList.remove("show");
  victoryEl.setAttribute("aria-hidden", "true");
  renderProgress();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateGameMeasurements() {
  gameRect = gameEl.getBoundingClientRect();
  streamY = gameRect.height / 2;
  players.top.maxShotDistance = Math.max(120, streamY - getTopRestY() + 36);
  players.bottom.maxShotDistance = Math.max(120, getBottomRestY() - streamY + 36);
}

function resetPlayers() {
  players.top.x = gameRect.width * 0.3;
  players.bottom.x = gameRect.width * 0.7;
  for (const player of Object.values(players)) {
    player.yoyoOffset = 0;
    player.shotState = "ready";
    player.cooldownUntil = 0;
  }
  renderPlayers(performance.now());
}

function resetDots() {
  dots.forEach((dot) => dot.el.remove());
  dots.length = 0;
  blanksSinceLetter = 0;

  const count = Math.ceil(gameRect.width / DOT_SPACING) + 5;
  for (let i = 0; i < count; i += 1) {
    createDot(i * DOT_SPACING - DOT_SPACING);
  }
}

function resetProgress() {
  collectedLetters = [];
}

function createDot(x) {
  const el = document.createElement("div");
  el.className = "dot";
  el.innerHTML = `
    <div class="dot-inner">
      <div class="dot-front"></div>
      <div class="dot-back"></div>
    </div>
  `;
  dotsLayer.appendChild(el);

  const dot = {
    el,
    backEl: el.querySelector(".dot-back"),
    x,
    y: streamY,
    hiddenLetter: chooseHiddenLetter(),
    flipped: false,
    collected: false
  };
  applyDotFace(dot);
  dots.push(dot);
  return dot;
}

// Dot generation favors the currently needed letter and forces one after
// several blanks so the stream always remains completable.
function chooseHiddenLetter() {
  if (collectedLetters.length >= TARGET_WORD.length) {
    return "";
  }

  const shouldForceLetter = blanksSinceLetter >= LETTER_FORCE_AFTER_BLANKS;
  const shouldHideLetter = shouldForceLetter || Math.random() < LETTER_PROBABILITY;

  if (!shouldHideLetter) {
    blanksSinceLetter += 1;
    return "";
  }

  blanksSinceLetter = 0;
  return TARGET_WORD[collectedLetters.length];
}

function recycleDot(dot) {
  const rightmostX = dots.reduce((max, current) => Math.max(max, current.x), -Infinity);
  dot.x = rightmostX + DOT_SPACING;
  dot.y = streamY;
  dot.hiddenLetter = chooseHiddenLetter();
  dot.flipped = false;
  dot.collected = false;
  dot.el.className = "dot";
  applyDotFace(dot);
}

function applyDotFace(dot) {
  dot.backEl.textContent = dot.hiddenLetter;
  dot.el.classList.toggle("empty", !dot.hiddenLetter);
}

function gameLoop(now) {
  const rawDelta = Math.min((now - lastFrame) / 1000, 0.033);
  const delta = document.body.classList.contains("slow-motion") ? rawDelta * 0.62 : rawDelta;
  lastFrame = now;

  if (!isPaused) {
    updatePlayers(delta, now);
    updateShots(delta, now);
    updateDots(delta);
    detectCollisions(now);
  } else if (victoryEl.classList.contains("show")) {
    victoryTimer += rawDelta;
    if (victoryTimer > 0.12) {
      spawnVictoryFirework();
      victoryTimer = 0;
    }
  }

  updateParticles(delta);
  renderDots();
  renderPlayers(now);
  updateMessage(delta);
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Player movement and input handling.
function updatePlayers(delta) {
  movePlayer(players.top, getHorizontalInput("KeyA", "KeyD"), delta);
  movePlayer(players.bottom, getHorizontalInput("ArrowLeft", "ArrowRight"), delta);

  if (keys.has("KeyW")) {
    tryShoot(players.top);
  }

  if (keys.has("ArrowUp")) {
    tryShoot(players.bottom);
  }
}

function getHorizontalInput(leftKey, rightKey) {
  return (keys.has(rightKey) ? 1 : 0) - (keys.has(leftKey) ? 1 : 0);
}

function movePlayer(player, direction, delta) {
  if (direction === 0) {
    return;
  }

  const padding = 44;
  player.x += direction * PLAYER_SPEED * delta;
  player.x = clamp(player.x, padding, gameRect.width - padding);
}

function tryShoot(player) {
  const now = performance.now();
  if (player.shotState !== "ready") {
    return;
  }

  if (player.role === "top" && now < player.cooldownUntil) {
    return;
  }

  player.shotState = "out";
}

// Yo-yo shooting uses a simple out-and-return state machine for elasticity.
function updateShots(delta, now) {
  for (const player of Object.values(players)) {
    if (player.shotState === "out") {
      player.yoyoOffset += YOYO_SHOOT_SPEED * delta;
      if (player.yoyoOffset >= player.maxShotDistance) {
        player.yoyoOffset = player.maxShotDistance;
        player.shotState = "return";
      }
    } else if (player.shotState === "return") {
      player.yoyoOffset -= YOYO_RETURN_SPEED * delta;
      if (player.yoyoOffset <= 0) {
        player.yoyoOffset = 0;
        player.shotState = "ready";
        if (player.role === "top") {
          player.cooldownUntil = now + SHOOT_COOLDOWN;
        }
      }
    }
  }
}

function updateDots(delta) {
  for (const dot of dots) {
    dot.x -= DOT_SPEED * delta;
    if (dot.x < -DOT_SPACING * 1.5) {
      recycleDot(dot);
    }
  }
}

// Collision mechanics are intentionally separate for each role:
// P1 reveals hidden dot backs, while P2 can only collect flipped dots.
function detectCollisions(now) {
  if (players.top.shotState !== "ready") {
    collideTopPlayer(now);
  }

  if (players.bottom.shotState !== "ready") {
    collideBottomPlayer();
  }
}

function collideTopPlayer(now) {
  const yoyo = getYoyoCenter(players.top);
  const dot = findCollidingDot(yoyo, (candidate) => !candidate.flipped && !candidate.collected);
  if (!dot) {
    return;
  }

  flipDot(dot);
  players.top.shotState = "return";
  players.top.cooldownUntil = now + SHOOT_COOLDOWN;
}

function collideBottomPlayer() {
  const yoyo = getYoyoCenter(players.bottom);
  const dot = findCollidingDot(yoyo, (candidate) => candidate.flipped && !candidate.collected);
  if (!dot) {
    return;
  }

  collectDot(dot);
  players.bottom.shotState = "return";
}

function findCollidingDot(point, predicate) {
  return dots.find((dot) => {
    if (!predicate(dot)) {
      return false;
    }

    const dx = dot.x + DOT_SIZE / 2 - point.x;
    const dy = dot.y - point.y;
    return Math.hypot(dx, dy) <= HIT_RADIUS + YOYO_RADIUS;
  });
}

function flipDot(dot) {
  dot.flipped = true;
  dot.el.classList.add("flipped");
  spawnBurst(dot.x + DOT_SIZE / 2, dot.y, dot.hiddenLetter ? "#7df4ff" : "#ffffff", 14);
  showMessage(dot.hiddenLetter ? `Revealed ${dot.hiddenLetter}` : "Empty", false);
}

// Collection enforces PHOENIX order. Empty or stale letters cost one progress.
function collectDot(dot) {
  dot.collected = true;
  dot.el.classList.add("collecting");
  spawnBurst(dot.x + DOT_SIZE / 2, dot.y, dot.hiddenLetter ? "#ffd47a" : "#ff5f74", dot.hiddenLetter ? 22 : 16);
  createLightRing(dot.x + DOT_SIZE / 2, dot.y, dot.hiddenLetter ? "#ffd47a" : "#ff5f74");

  if (!dot.hiddenLetter) {
    punish("Empty dot!");
  } else if (dot.hiddenLetter !== TARGET_WORD[collectedLetters.length]) {
    punish(`Needed ${TARGET_WORD[collectedLetters.length] || "nothing"}, not ${dot.hiddenLetter}`);
  } else {
    collectedLetters.push(dot.hiddenLetter);
    renderProgress();
    showMessage(`${dot.hiddenLetter} collected`, false);
  }

  setTimeout(() => recycleDot(dot), 360);

  if (collectedLetters.length === TARGET_WORD.length) {
    winGame();
  }
}

function punish(text) {
  if (collectedLetters.length > 0) {
    collectedLetters.pop();
    renderProgress();
  }

  gameEl.classList.remove("error-flash");
  // Force a reflow so repeated mistakes restart the shake animation.
  void gameEl.offsetWidth;
  gameEl.classList.add("error-flash");
  showMessage(text, true);
}

function renderProgress() {
  progressEl.textContent = TARGET_WORD
    .split("")
    .map((letter, index) => (collectedLetters[index] === letter ? letter : "_"))
    .join(" ");
}

// Rendering keeps the DOM style writes grouped after gameplay updates.
function renderDots() {
  for (const dot of dots) {
    dot.el.style.transform = `translate(${dot.x}px, ${dot.y - DOT_SIZE / 2}px)`;
  }
}

function renderPlayers(now) {
  playerTopEl.style.left = `${players.top.x}px`;
  playerBottomEl.style.left = `${players.bottom.x}px`;

  topYoyoEl.style.transform = `translate(-50%, ${players.top.yoyoOffset}px)`;
  bottomYoyoEl.style.transform = `translate(-50%, ${-players.bottom.yoyoOffset}px)`;
  topStringEl.style.height = `${P1_REST_DISTANCE + players.top.yoyoOffset}px`;
  bottomStringEl.style.height = `${P2_REST_DISTANCE + players.bottom.yoyoOffset}px`;

  const remainingCooldown = Math.max(0, players.top.cooldownUntil - now);
  const cooldownRatio = remainingCooldown / SHOOT_COOLDOWN;
  cooldownMeterEl.style.transform = `scaleX(${1 - cooldownRatio})`;
}

function getYoyoCenter(player) {
  if (player.role === "top") {
    return {
      x: player.x,
      y: getTopRestY() + player.yoyoOffset
    };
  }

  return {
    x: player.x,
    y: getBottomRestY() - player.yoyoOffset
  };
}

function getTopRestY() {
  return gameRect.height * 0.15 + P1_REST_DISTANCE;
}

function getBottomRestY() {
  return gameRect.height * 0.85 - P2_REST_DISTANCE;
}

// Particle helpers power flips, collection bursts, punishment feedback, and victory.
function spawnBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 210;
    createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.52 + Math.random() * 0.38,
      color,
      size: 3 + Math.random() * 4
    });
  }
}

function createParticle({ x, y, vx, vy, life, color, size, firework = false }) {
  const el = document.createElement("div");
  el.className = firework ? "firework" : "particle";
  el.style.color = color;
  el.style.background = color;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  effectsLayer.appendChild(el);

  particles.push({
    el,
    x,
    y,
    vx,
    vy,
    life,
    maxLife: life
  });
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= delta;
    particle.vy += PARTICLE_GRAVITY * delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;

    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    particle.el.style.opacity = alpha;
    particle.el.style.transform = `translate(${particle.x}px, ${particle.y}px) scale(${0.55 + alpha * 0.85})`;

    if (particle.life <= 0) {
      particle.el.remove();
      particles.splice(i, 1);
    }
  }
}

function createLightRing(x, y, color = "#7df4ff") {
  const ring = document.createElement("div");
  ring.className = "light-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.borderColor = color;
  effectsLayer.appendChild(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
}

function clearEffects() {
  particles.splice(0).forEach((particle) => particle.el.remove());
  effectsLayer.replaceChildren();
}

function showMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
  messageEl.classList.add("show");
  messageTimer = MESSAGE_DURATION / 1000;
}

function updateMessage(delta) {
  if (messageTimer <= 0) {
    return;
  }

  messageTimer -= delta;
  if (messageTimer <= 0) {
    messageEl.classList.remove("show");
  }
}

function winGame() {
  isPaused = true;
  victoryTimer = 0;
  victoryEl.classList.add("show");
  victoryEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("victory-glow", "slow-motion");
  showMessage("PHOENIX COMPLETE!", false);

  for (let i = 0; i < 9; i += 1) {
    setTimeout(() => {
      createLightRing(gameRect.width / 2, streamY, i % 2 === 0 ? "#7df4ff" : "#ffd47a");
      spawnVictoryFirework();
    }, i * 130);
  }
}

function spawnVictoryFirework() {
  const x = 90 + Math.random() * Math.max(120, gameRect.width - 180);
  const y = 70 + Math.random() * Math.max(120, gameRect.height - 140);
  const colors = ["#ffffff", "#7df4ff", "#ffd47a", "#8aa8ff"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  createLightRing(x, y, color);
  for (let i = 0; i < 24; i += 1) {
    const angle = (Math.PI * 2 * i) / 24;
    const speed = 95 + Math.random() * 190;
    createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.9 + Math.random() * 0.55,
      color,
      size: 3 + Math.random() * 3,
      firework: true
    });
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

window.addEventListener("keydown", (event) => {
  const trackedKeys = ["KeyA", "KeyD", "KeyW", "ArrowLeft", "ArrowRight", "ArrowUp"];
  if (!trackedKeys.includes(event.code)) {
    return;
  }

  event.preventDefault();
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  const topRatio = players.top.x / gameRect.width;
  const bottomRatio = players.bottom.x / gameRect.width;
  updateGameMeasurements();
  players.top.x = clamp(gameRect.width * topRatio, 44, gameRect.width - 44);
  players.bottom.x = clamp(gameRect.width * bottomRatio, 44, gameRect.width - 44);
});

restartButton.addEventListener("click", () => {
  lastFrame = performance.now();
  initializeGame();
});

initializeGame();
