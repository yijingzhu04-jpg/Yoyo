// Configurable game variables.
const DOT_SPEED = 118;
const DOT_SPACING = 86;
const PLAYER_SPEED = 390;
const YOYO_SHOOT_SPEED = 720;
const YOYO_RETURN_SPEED = 930;
const SHOOT_COOLDOWN = 3;
const LETTER_PROBABILITY = 0.34;
const TARGET_WORD = "PHOENIX";

// Secondary tuning values.
const GAME_SECONDS = 60;
const DOT_RADIUS = 9;
const YOYO_RADIUS = 18;
const DOT_SPACING_VARIANCE = 62;
const DOT_MIN_SPACING = 44;
const DOT_MAX_SPACING = 158;
const FORCE_LETTER_AFTER = 8;
const FIREWORK_COUNT = 9;

const dom = {
  app: document.getElementById("app"),
  canvas: document.getElementById("gameCanvas"),
  timer: document.getElementById("timer"),
  progress: document.getElementById("progress"),
  startScreen: document.getElementById("startScreen"),
  endScreen: document.getElementById("endScreen"),
  resultCard: document.getElementById("resultCard"),
  resultEyebrow: document.getElementById("resultEyebrow"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton")
};

const ctx = dom.canvas.getContext("2d");
const pressedKeys = new Set();

class PhoenixGame {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.streamY = 0;
    this.lastFrame = performance.now();
    this.isPlaying = false;
    this.hasStarted = false;
    this.endState = null;
    this.timeLeft = GAME_SECONDS;
    this.progressIndex = 0;
    this.slowMotion = 1;
    this.effects = new EffectSystem(this);
    this.stream = new DotStream(this);
    this.players = {
      top: new Player(this, {
        id: "P1",
        side: "top",
        direction: 1,
        color: "#c8efff",
        leftKey: "a",
        rightKey: "d",
        shootKey: "w"
      }),
      bottom: new Player(this, {
        id: "P2",
        side: "bottom",
        direction: -1,
        color: "#ffe0a3",
        leftKey: "ArrowLeft",
        rightKey: "ArrowRight",
        shootKey: "ArrowUp"
      })
    };

    this.bindEvents();
    this.resize();
    this.stream.seed();
    this.updateHud();
    requestAnimationFrame((time) => this.loop(time));
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
        event.preventDefault();
      }
      pressedKeys.add(normalizeKey(event.key));
    });
    window.addEventListener("keyup", (event) => {
      pressedKeys.delete(normalizeKey(event.key));
    });
    dom.startButton.addEventListener("click", () => this.start());
    dom.restartButton.addEventListener("click", () => this.start());
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.streamY = this.height * 0.5;
    dom.canvas.width = Math.floor(this.width * ratio);
    dom.canvas.height = Math.floor(this.height * ratio);
    dom.canvas.style.width = `${this.width}px`;
    dom.canvas.style.height = `${this.height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.players.top.setAnchor(this.width * 0.34, this.streamY - Math.min(172, this.height * 0.23));
    this.players.bottom.setAnchor(this.width * 0.66, this.streamY + Math.min(172, this.height * 0.23));
    this.stream.reflow();
  }

  start() {
    this.hasStarted = true;
    this.isPlaying = true;
    this.endState = null;
    this.timeLeft = GAME_SECONDS;
    this.progressIndex = 0;
    this.slowMotion = 1;
    dom.app.classList.remove("is-victory", "is-error");
    dom.endScreen.classList.remove("overlay--visible");
    dom.startScreen.classList.remove("overlay--visible");
    dom.resultCard.classList.remove("is-win", "is-lose");

    this.players.top.reset(this.width * 0.34);
    this.players.bottom.reset(this.width * 0.66);
    this.effects.clear();
    this.stream.seed();
    this.updateHud();
  }

  loop(time) {
    const rawDt = Math.min(0.033, (time - this.lastFrame) / 1000 || 0);
    this.lastFrame = time;

    if (this.isPlaying) {
      this.updateTimer(rawDt);
      this.updatePlayers(rawDt);
      this.stream.update(rawDt * this.slowMotion);
    }

    this.effects.update(rawDt);
    this.draw();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  updateTimer(dt) {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.updateHud();
    if (this.timeLeft <= 0) {
      this.finish(false);
    }
  }

  updatePlayers(dt) {
    this.players.top.update(dt);
    this.players.bottom.update(dt);
  }

  updateHud() {
    dom.timer.textContent = `TIME: ${Math.ceil(this.timeLeft)}`;
    dom.progress.textContent = TARGET_WORD
      .split("")
      .map((letter, index) => (index < this.progressIndex ? letter : "_"))
      .join(" ");
  }

  nextNeededLetter() {
    return TARGET_WORD[this.progressIndex] || "";
  }

  revealDot(dot) {
    if (dot.revealed || dot.removed) return;
    dot.revealed = true;
    dot.flipTime = 1;
    this.effects.flip(dot.x, dot.y, dot.letter);
  }

  collectDot(dot) {
    if (dot.removed) return;

    if (!dot.revealed) {
      this.effects.blocked(dot.x, dot.y);
      return;
    }

    dot.removed = true;
    if (dot.letter && dot.letter === this.nextNeededLetter()) {
      this.progressIndex += 1;
      this.effects.collect(dot.x, dot.y, dot.letter);
      this.updateHud();
      if (this.progressIndex === TARGET_WORD.length) {
        this.completeWord();
      }
      return;
    }

    this.progressIndex = Math.max(0, this.progressIndex - 1);
    this.updateHud();
    this.effects.error(dot.x, dot.y);
    pulseClass(dom.app, "is-error");
  }

  completeWord() {
    if (this.endState) return;
    this.isPlaying = false;
    this.slowMotion = 0.18;
    dom.app.classList.add("is-victory");
    this.effects.victory();
    window.setTimeout(() => this.finish(true), 620);
  }

  finish(won) {
    if (this.endState) return;
    this.isPlaying = false;
    this.endState = won ? "win" : "lose";
    dom.resultCard.classList.toggle("is-win", won);
    dom.resultCard.classList.toggle("is-lose", !won);
    dom.resultEyebrow.textContent = won ? "Victory" : "Time out";
    dom.resultTitle.textContent = won ? "PHOENIX COMPLETE!" : "TIME OUT";
    dom.resultText.textContent = won
      ? "The last letter clicks into place. Fireworks bloom as PHOENIX rises."
      : "The countdown reached zero before PHOENIX was completed.";
    dom.endScreen.classList.add("overlay--visible");
    if (!won) this.effects.error(this.width / 2, this.streamY);
  }

  draw() {
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackdrop();
    this.stream.draw();
    this.players.top.draw();
    this.players.bottom.draw();
    this.effects.draw();
  }

  drawBackdrop() {
    const glow = ctx.createRadialGradient(
      this.width / 2,
      this.streamY,
      10,
      this.width / 2,
      this.streamY,
      Math.max(this.width, this.height) * 0.64
    );
    glow.addColorStop(0, "rgba(255,255,255,0.085)");
    glow.addColorStop(0.35, "rgba(100,120,190,0.07)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 18]);
    ctx.beginPath();
    ctx.moveTo(0, this.streamY);
    ctx.lineTo(this.width, this.streamY);
    ctx.stroke();
    ctx.restore();
  }
}

class DotStream {
  constructor(game) {
    this.game = game;
    this.dots = [];
    this.blankRun = 0;
  }

  seed() {
    this.dots = [];
    this.blankRun = 0;
    let x = -DOT_SPACING;
    while (x < this.game.width + DOT_SPACING * 4) {
      this.dots.push(this.createDot(x));
      x += this.nextSpacing();
    }
  }

  reflow() {
    for (const dot of this.dots) {
      dot.y = this.game.streamY + dot.offsetY;
    }
  }

  update(dt) {
    for (const dot of this.dots) {
      dot.x -= DOT_SPEED * dt;
      dot.y = this.game.streamY + dot.offsetY;
      dot.pulse += dt * 3.2;
      dot.flipTime = Math.max(0, dot.flipTime - dt * 2.8);
    }

    this.dots = this.dots.filter((dot) => !dot.removed && dot.x > -DOT_MAX_SPACING);

    let rightMost = this.dots.reduce((max, dot) => Math.max(max, dot.x), -DOT_SPACING);
    while (rightMost < this.game.width + DOT_SPACING * 4) {
      rightMost += this.nextSpacing();
      this.dots.push(this.createDot(rightMost));
    }
  }

  createDot(x) {
    return {
      x,
      y: this.game.streamY,
      offsetY: randomRange(-3.5, 3.5),
      radius: randomRange(DOT_RADIUS - 1, DOT_RADIUS + 2.5),
      letter: this.chooseLetter(),
      revealed: false,
      removed: false,
      flipTime: 0,
      pulse: randomRange(0, Math.PI * 2)
    };
  }

  chooseLetter() {
    const needed = this.game.nextNeededLetter();
    if (!needed) return "";

    const alreadyOnScreen = this.dots.some((dot) => !dot.removed && dot.letter === needed);
    if (alreadyOnScreen) {
      this.blankRun += 1;
      return "";
    }

    const shouldPlace = Math.random() < LETTER_PROBABILITY || this.blankRun >= FORCE_LETTER_AFTER;
    if (!shouldPlace) {
      this.blankRun += 1;
      return "";
    }

    this.blankRun = 0;
    return needed;
  }

  nextSpacing() {
    // Uneven distribution: a mix of tight clusters and wider gaps, clamped for playability.
    const direction = Math.random() < 0.5 ? -1 : 1;
    const organicBias = Math.pow(Math.random(), 0.52);
    return clamp(
      DOT_SPACING + direction * organicBias * DOT_SPACING_VARIANCE,
      DOT_MIN_SPACING,
      DOT_MAX_SPACING
    );
  }

  findHit(x, y, radius) {
    return this.dots.find((dot) => {
      if (dot.removed) return false;
      return distance(x, y, dot.x, dot.y) <= radius + dot.radius + 2;
    });
  }

  draw() {
    for (const dot of this.dots) {
      this.drawDot(dot);
    }
  }

  drawDot(dot) {
    const flipScale = dot.flipTime > 0 ? Math.max(0.1, Math.abs(Math.cos((1 - dot.flipTime) * Math.PI))) : 1;
    const pulseAlpha = 0.72 + Math.sin(dot.pulse) * 0.18;

    ctx.save();
    ctx.translate(dot.x, dot.y);
    ctx.scale(flipScale, 1);
    ctx.shadowBlur = dot.revealed && dot.letter ? 26 : 17;
    ctx.shadowColor = dot.revealed && dot.letter
      ? "rgba(255,197,111,0.92)"
      : `rgba(255,255,255,${pulseAlpha})`;
    ctx.fillStyle = dot.revealed ? "rgba(247,250,255,0.96)" : "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, dot.radius, 0, Math.PI * 2);
    ctx.fill();

    if (dot.revealed && dot.letter) {
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#111729";
      ctx.font = "900 14px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dot.letter, 0, 0.8);
    } else if (dot.revealed) {
      ctx.fillStyle = "rgba(9,13,26,0.42)";
      ctx.beginPath();
      ctx.arc(0, 0, dot.radius * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Player {
  constructor(game, config) {
    this.game = game;
    this.id = config.id;
    this.side = config.side;
    this.direction = config.direction;
    this.color = config.color;
    this.leftKey = config.leftKey;
    this.rightKey = config.rightKey;
    this.shootKey = config.shootKey;
    this.x = 0;
    this.anchorY = 0;
    this.yoyoX = 0;
    this.yoyoY = 0;
    this.shotX = 0;
    this.state = "idle";
    this.cooldown = 0;
    this.hitDuringShot = false;
    this.elastic = 0;
  }

  setAnchor(x, y) {
    this.anchorY = y;
    if (!this.game.hasStarted) {
      this.reset(x);
    }
  }

  reset(x) {
    this.x = clamp(x, 56, this.game.width - 56);
    this.state = "idle";
    this.cooldown = 0;
    this.hitDuringShot = false;
    this.elastic = 0;
    this.resetYoyo();
  }

  resetYoyo() {
    this.shotX = this.x;
    this.yoyoX = this.x;
    this.yoyoY = this.anchorY;
  }

  update(dt) {
    this.updateMovement(dt);
    this.updateCooldown(dt);
    this.tryShoot();
    this.updateYoyo(dt);
    this.elastic = Math.max(0, this.elastic - dt * 4);
  }

  updateMovement(dt) {
    const move = (pressedKeys.has(this.rightKey) ? 1 : 0) - (pressedKeys.has(this.leftKey) ? 1 : 0);
    this.x = clamp(this.x + move * PLAYER_SPEED * dt, 56, this.game.width - 56);
    if (this.state === "idle") {
      this.resetYoyo();
    }
  }

  updateCooldown(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  tryShoot() {
    if (!pressedKeys.has(this.shootKey)) return;
    if (!this.game.isPlaying || this.state !== "idle" || this.cooldown > 0) return;

    this.state = "shooting";
    this.shotX = this.x;
    this.yoyoX = this.x;
    this.yoyoY = this.anchorY;
    this.hitDuringShot = false;
    this.elastic = 1;
  }

  updateYoyo(dt) {
    const reach = Math.abs(this.game.streamY - this.anchorY) + 38;
    const targetY = this.anchorY + reach * this.direction;

    if (this.state === "shooting") {
      this.yoyoY += YOYO_SHOOT_SPEED * this.direction * dt;
      this.yoyoX = this.shotX;
      this.checkCollision();

      const reachedEnd = this.direction > 0 ? this.yoyoY >= targetY : this.yoyoY <= targetY;
      if (reachedEnd) {
        this.yoyoY = targetY;
        this.beginReturn();
        if (this.side === "top" && !this.hitDuringShot) {
          this.cooldown = SHOOT_COOLDOWN;
          this.game.effects.cooldown(this.shotX, this.game.streamY);
        }
      }
      return;
    }

    if (this.state === "returning") {
      const delta = this.anchorY - this.yoyoY;
      const step = Math.sign(delta) * YOYO_RETURN_SPEED * dt;
      this.yoyoX = lerp(this.yoyoX, this.x, 0.13);

      if (Math.abs(step) >= Math.abs(delta)) {
        this.state = "idle";
        this.resetYoyo();
      } else {
        this.yoyoY += step;
      }
    }
  }

  checkCollision() {
    const dot = this.game.stream.findHit(this.yoyoX, this.yoyoY, YOYO_RADIUS);
    if (!dot) return;

    this.hitDuringShot = true;
    this.elastic = 1;
    this.beginReturn();

    if (this.side === "top") {
      this.game.revealDot(dot);
    } else {
      this.game.collectDot(dot);
    }
  }

  beginReturn() {
    this.state = "returning";
  }

  draw() {
    this.drawString();
    this.drawAnchor();
    this.drawYoyo();
  }

  drawString() {
    const controlY = (this.anchorY + this.yoyoY) / 2 - this.direction * this.elastic * 18;

    ctx.save();
    ctx.strokeStyle = this.side === "top" ? "rgba(191,234,255,0.74)" : "rgba(255,216,160,0.74)";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(this.x, this.anchorY);
    ctx.quadraticCurveTo((this.x + this.yoyoX) / 2, controlY, this.yoyoX, this.yoyoY);
    ctx.stroke();
    ctx.restore();
  }

  drawAnchor() {
    const cooldownRatio = this.cooldown / SHOOT_COOLDOWN;

    ctx.save();
    ctx.translate(this.x, this.anchorY);
    ctx.shadowBlur = 24;
    ctx.shadowColor = cooldownRatio > 0 ? "rgba(255,79,118,0.95)" : this.color;
    ctx.fillStyle = cooldownRatio > 0 ? "#ff6c8d" : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#080d1b";
    ctx.font = "900 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.id, 0, 1);

    if (cooldownRatio > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 29, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldownRatio));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawYoyo() {
    const gradient = ctx.createRadialGradient(
      this.yoyoX - 7,
      this.yoyoY - 7,
      2,
      this.yoyoX,
      this.yoyoY,
      YOYO_RADIUS + 9
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.58, this.color);
    gradient.addColorStop(1, "rgba(115,130,174,0.95)");

    ctx.save();
    ctx.shadowBlur = 28;
    ctx.shadowColor = this.color;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.yoyoX, this.yoyoY, YOYO_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(this.yoyoX, this.yoyoY + this.direction * (YOYO_RADIUS + 3), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class EffectSystem {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this.rings = [];
    this.fireworks = [];
  }

  clear() {
    this.particles = [];
    this.rings = [];
    this.fireworks = [];
  }

  update(dt) {
    for (const particle of this.particles) {
      particle.age += dt;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.986;
      particle.vy *= 0.986;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const ring of this.rings) {
      ring.life -= dt;
      ring.radius += ring.speed * dt;
    }
    this.rings = this.rings.filter((ring) => ring.life > 0);

    for (const firework of this.fireworks) {
      firework.delay -= dt;
      if (firework.delay <= 0 && !firework.fired) {
        firework.fired = true;
        this.fireworkBurst(firework.x, firework.y, firework.color);
      }
    }
    this.fireworks = this.fireworks.filter((firework) => !firework.fired);
  }

  flip(x, y, letter) {
    const color = letter ? "#ffc56f" : "#ffffff";
    this.ring(x, y, color, 9, 46);
    this.burst(x, y, color, 16, 36, 120, 0.58, 2.4);
  }

  collect(x, y, letter) {
    this.ring(x, y, "#ffc56f", 18, 90);
    this.burst(x, y, "#ffc56f", 30, 80, 205, 0.82, 3.1);
    this.particles.push(makeParticle(x, y - 10, 0, -42, "#ffffff", 0.72, 4, letter));
  }

  blocked(x, y) {
    this.ring(x, y, "#bfeaff", 7, 36);
    this.burst(x, y, "#bfeaff", 8, 22, 72, 0.35, 1.8);
  }

  cooldown(x, y) {
    this.burst(x, y, "#ff4f76", 12, 34, 105, 0.42, 2);
  }

  error(x, y) {
    this.ring(x, y, "#ff4f76", 16, 82);
    this.burst(x, y, "#ff4f76", 22, 60, 150, 0.68, 2.8);
  }

  victory() {
    this.ring(this.game.width / 2, this.game.streamY, "#ffc56f", 24, 260);
    this.ring(this.game.width / 2, this.game.streamY, "#ffffff", 8, 185);

    for (let i = 0; i < FIREWORK_COUNT; i += 1) {
      this.fireworks.push({
        x: this.game.width * randomRange(0.18, 0.82),
        y: this.game.height * randomRange(0.18, 0.56),
        color: Math.random() > 0.42 ? "#ffc56f" : "#ffffff",
        delay: i * 0.11,
        fired: false
      });
    }
  }

  fireworkBurst(x, y, color) {
    this.ring(x, y, color, 7, 112);
    for (let i = 0; i < 44; i += 1) {
      const angle = (i / 44) * Math.PI * 2 + randomRange(-0.08, 0.08);
      const speed = randomRange(90, 270);
      this.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 1.08, 2.4));
    }
  }

  burst(x, y, color, count, minSpeed, maxSpeed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(minSpeed, maxSpeed);
      this.particles.push(makeParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
    }
  }

  ring(x, y, color, radius, speed) {
    this.rings.push({ x, y, color, radius, speed, life: 0.82, maxLife: 0.82 });
  }

  draw() {
    this.drawRings();
    this.drawParticles();
  }

  drawRings() {
    for (const ring of this.rings) {
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

  drawParticles() {
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = particle.color;

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

function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function pulseClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

new PhoenixGame();
