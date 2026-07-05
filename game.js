(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const timerEl = document.getElementById('timer');
  const restartBtn = document.getElementById('restart');
  const overlayEl = document.getElementById('overlay');
  const finaleEl = document.getElementById('finale');

  const GAME_DURATION = 90;
  const RIBBON_SEGMENTS = 24;
  const YOYO_RADIUS = 18;
  const MOVE_SPEED = 280;
  const FRICTION = 0.88;
  const CIRCLE_COUNT = 14;
  const REVEAL_STAGES = 4;

  let width, height, dpr;
  let lastTime = 0;
  let gameTime = GAME_DURATION;
  let gameOver = false;
  let finalePhase = 'play';
  let finaleTimer = 0;
  let particles = [];
  let ambientParticles = [];
  let ripples = [];
  let audioCtx = null;

  const keys = {};
  const players = [
    { x: 0, y: 0, vx: 0, vy: 0, color: [160, 200, 255] },
    { x: 0, y: 0, vx: 0, vy: 0, color: [255, 190, 210] },
  ];

  let ribbonNodes = [];
  let brokenCircles = [];
  let haloCircle = { radius: 0, alpha: 0, rotation: 0 };
  let yoYoAttraction = 0;

  // ─── Audio ───────────────────────────────────────────────

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration, type, volume, delay) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume || 0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function playRevealChime() {
    playTone(523.25, 0.6, 'sine', 0.06);
    playTone(659.25, 0.5, 'sine', 0.04, 0.05);
  }

  function playCompleteChime() {
    playTone(523.25, 0.8, 'sine', 0.07);
    playTone(659.25, 0.7, 'sine', 0.06, 0.08);
    playTone(783.99, 0.9, 'sine', 0.05, 0.16);
  }

  function playFinaleSwell() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130.81, t);
    osc.frequency.exponentialRampToValueAtTime(261.63, t + 3);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 3);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 5.5);
  }

  // ─── Setup ───────────────────────────────────────────────

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return dist(px, py, cx, cy);
  }

  function initRibbon() {
    ribbonNodes = [];
    for (let i = 0; i <= RIBBON_SEGMENTS; i++) {
      const t = i / RIBBON_SEGMENTS;
      ribbonNodes.push({
        x: players[0].x + (players[1].x - players[0].x) * t,
        y: players[0].y + (players[1].y - players[0].y) * t,
        ox: 0,
        oy: 0,
      });
    }
  }

  function initBrokenCircles() {
    brokenCircles = [];
    const margin = 90;
    const minDist = 100;

    for (let i = 0; i < CIRCLE_COUNT; i++) {
      let x, y, r, valid, attempts = 0;
      do {
        valid = true;
        r = randomRange(28, 42);
        x = randomRange(margin + r, width - margin - r);
        y = randomRange(margin + r, height - margin - r);

        for (const c of brokenCircles) {
          if (dist(x, y, c.x, c.y) < minDist + r + c.r) {
            valid = false;
            break;
          }
        }
        for (const p of players) {
          if (dist(x, y, p.x, p.y) < 120) {
            valid = false;
            break;
          }
        }
        attempts++;
      } while (!valid && attempts < 80);

      if (valid) {
        const gapCount = 4 + Math.floor(Math.random() * 3);
        const gaps = [];
        for (let g = 0; g < gapCount; g++) {
          gaps.push({
            start: randomRange(0, Math.PI * 2),
            size: randomRange(0.25, 0.55),
          });
        }
        brokenCircles.push({
          x, y, r,
          stage: 0,
          completed: false,
          gaps,
          floatPhase: randomRange(0, Math.PI * 2),
          floatSpeed: randomRange(0.3, 0.7),
          glow: 0,
          insideRibbon: false,
          detachX: 0,
          detachY: 0,
          targetX: 0,
          targetY: 0,
          currentX: x,
          currentY: y,
          alpha: 1,
        });
      }
    }
  }

  function initAmbientParticles() {
    ambientParticles = [];
    for (let i = 0; i < 60; i++) {
      ambientParticles.push({
        x: randomRange(0, width),
        y: randomRange(0, height),
        vx: randomRange(-8, 8),
        vy: randomRange(-12, -4),
        size: randomRange(0.5, 2),
        alpha: randomRange(0.1, 0.35),
        phase: randomRange(0, Math.PI * 2),
      });
    }
  }

  function resetGame() {
    gameTime = GAME_DURATION;
    gameOver = false;
    finalePhase = 'play';
    finaleTimer = 0;
    particles = [];
    ripples = [];
    haloCircle = { radius: 0, alpha: 0, rotation: 0 };
    yoYoAttraction = 0;

    players[0].x = width * 0.3;
    players[0].y = height * 0.5;
    players[0].vx = 0;
    players[0].vy = 0;
    players[1].x = width * 0.7;
    players[1].y = height * 0.5;
    players[1].vx = 0;
    players[1].vy = 0;

    initRibbon();
    initBrokenCircles();
    initAmbientParticles();

    timerEl.textContent = formatTime(gameTime);
    timerEl.classList.remove('urgent', 'hidden');
    overlayEl.classList.remove('fade-out');
    finaleEl.hidden = true;
    finaleEl.querySelector('h1').classList.remove('visible');
    finaleEl.querySelector('.subtitle').classList.remove('visible');
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.ceil(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  // ─── Input ───────────────────────────────────────────────

  window.addEventListener('keydown', (e) => {
    initAudio();
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  restartBtn.addEventListener('click', () => { initAudio(); resetGame(); });
  window.addEventListener('resize', () => { resize(); resetGame(); });

  // ─── Physics ─────────────────────────────────────────────

  function updatePlayers(dt) {
    if (finalePhase === 'attract' || finalePhase === 'click') {
      const cx = width / 2;
      const cy = height / 2;
      const strength = yoYoAttraction * 180;
      for (const p of players) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / d) * strength * dt;
        p.vy += (dy / d) * strength * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      return;
    }

    if (finalePhase !== 'play') return;

    const p1 = players[0];
    let ax1 = 0, ay1 = 0;
    if (keys['KeyW'] || keys['Keyw']) ay1 -= 1;
    if (keys['KeyS'] || keys['Keys']) ay1 += 1;
    if (keys['KeyA'] || keys['Keya']) ax1 -= 1;
    if (keys['KeyD'] || keys['Keyd']) ax1 += 1;
    const len1 = Math.sqrt(ax1 * ax1 + ay1 * ay1) || 1;
    p1.vx += (ax1 / len1) * MOVE_SPEED * dt;
    p1.vy += (ay1 / len1) * MOVE_SPEED * dt;

    const p2 = players[1];
    let ax2 = 0, ay2 = 0;
    if (keys['ArrowUp']) ay2 -= 1;
    if (keys['ArrowDown']) ay2 += 1;
    if (keys['ArrowLeft']) ax2 -= 1;
    if (keys['ArrowRight']) ax2 += 1;
    const len2 = Math.sqrt(ax2 * ax2 + ay2 * ay2) || 1;
    p2.vx += (ax2 / len2) * MOVE_SPEED * dt;
    p2.vy += (ay2 / len2) * MOVE_SPEED * dt;

    for (const p of players) {
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(YOYO_RADIUS, Math.min(width - YOYO_RADIUS, p.x));
      p.y = Math.max(YOYO_RADIUS, Math.min(height - YOYO_RADIUS, p.y));
    }
  }

  function updateRibbon(dt) {
    const segLen = dist(players[0].x, players[0].y, players[1].x, players[1].y) / RIBBON_SEGMENTS;

    ribbonNodes[0].x = players[0].x;
    ribbonNodes[0].y = players[0].y;
    ribbonNodes[RIBBON_SEGMENTS].x = players[1].x;
    ribbonNodes[RIBBON_SEGMENTS].y = players[1].y;

    for (let iter = 0; iter < 6; iter++) {
      for (let i = 1; i < RIBBON_SEGMENTS; i++) {
        const node = ribbonNodes[i];
        const prev = ribbonNodes[i - 1];
        const next = ribbonNodes[i + 1];

        const targetX = (prev.x + next.x) / 2;
        const targetY = (prev.y + next.y) / 2;
        node.x += (targetX - node.x) * 0.35;
        node.y += (targetY - node.y) * 0.35;
      }

      for (let i = 0; i < RIBBON_SEGMENTS; i++) {
        const a = ribbonNodes[i];
        const b = ribbonNodes[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (d - segLen) / d;
        const offsetX = dx * diff * 0.5;
        const offsetY = dy * diff * 0.5;

        if (i > 0) {
          a.x += offsetX;
          a.y += offsetY;
        }
        if (i < RIBBON_SEGMENTS - 1) {
          b.x -= offsetX;
          b.y -= offsetY;
        }
      }

      ribbonNodes[0].x = players[0].x;
      ribbonNodes[0].y = players[0].y;
      ribbonNodes[RIBBON_SEGMENTS].x = players[1].x;
      ribbonNodes[RIBBON_SEGMENTS].y = players[1].y;
    }

    for (let i = 1; i < RIBBON_SEGMENTS; i++) {
      const node = ribbonNodes[i];
      node.ox += (node.x - (ribbonNodes[i - 1].x + ribbonNodes[i + 1].x) / 2) * 0.08;
      node.oy += (node.y - (ribbonNodes[i - 1].y + ribbonNodes[i + 1].y) / 2) * 0.08;
      node.ox *= 0.92;
      node.oy *= 0.92;
    }
  }

  function getRibbonSegments() {
    const segs = [];
    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      segs.push({
        x1: ribbonNodes[i].x,
        y1: ribbonNodes[i].y,
        x2: ribbonNodes[i + 1].x,
        y2: ribbonNodes[i + 1].y,
      });
    }
    return segs;
  }

  function ribbonNearCenter(cx, cy, threshold) {
    const segs = getRibbonSegments();
    for (const s of segs) {
      if (pointToSegmentDist(cx, cy, s.x1, s.y1, s.x2, s.y2) < threshold) {
        return true;
      }
    }
    return false;
  }

  function updateCircleCollisions() {
    if (finalePhase !== 'play') return;

    for (const circle of brokenCircles) {
      if (circle.completed) continue;

      const hitRadius = 14;
      const near = ribbonNearCenter(circle.x, circle.y, hitRadius);

      if (near && !circle.insideRibbon) {
        circle.insideRibbon = true;
        circle.stage++;

        if (circle.stage >= REVEAL_STAGES) {
          circle.stage = REVEAL_STAGES;
          circle.completed = true;
          circle.glow = 1;
          playCompleteChime();
        } else {
          playRevealChime();
        }
      } else if (!near) {
        circle.insideRibbon = false;
      }

      if (circle.completed) {
        circle.glow = Math.min(1, circle.glow + 0.02);
      }
    }

    const allDone = brokenCircles.every((c) => c.completed);
    if (allDone && brokenCircles.length > 0 && finalePhase === 'play') {
      startFinale();
    }
  }

  function startFinale() {
    finalePhase = 'detach';
    finaleTimer = 0;
    timerEl.classList.add('hidden');
    overlayEl.classList.add('fade-out');

    const cx = width / 2;
    const cy = height / 2;
    const haloR = Math.min(width, height) * 0.18;

    brokenCircles.forEach((c, i) => {
      c.detachX = c.x;
      c.detachY = c.y;
      const angle = (i / brokenCircles.length) * Math.PI * 2 - Math.PI / 2;
      c.targetX = cx + Math.cos(angle) * haloR;
      c.targetY = cy + Math.sin(angle) * haloR;
    });
  }

  function updateFinale(dt) {
    if (finalePhase === 'play') return;

    finaleTimer += dt;
    const cx = width / 2;
    const cy = height / 2;
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    if (finalePhase === 'detach') {
      const t = Math.min(1, finaleTimer / 2.5);
      const e = ease(t);

      brokenCircles.forEach((c) => {
        c.currentX = c.detachX + (c.targetX - c.detachX) * e;
        c.currentY = c.detachY + (c.targetY - c.detachY) * e;
        c.alpha = 0.6 + e * 0.4;
      });

      if (t >= 1) {
        finalePhase = 'formHalo';
        finaleTimer = 0;
        haloCircle.radius = Math.min(width, height) * 0.18;
      }
    }

    if (finalePhase === 'formHalo') {
      const t = Math.min(1, finaleTimer / 2);
      haloCircle.alpha = ease(t);
      haloCircle.rotation += dt * 0.15;

      brokenCircles.forEach((c) => {
        c.alpha = 1 - ease(t) * 0.7;
      });

      if (t >= 1) {
        finalePhase = 'attract';
        finaleTimer = 0;
        yoYoAttraction = 0.3;
        playFinaleSwell();
      }
    }

    if (finalePhase === 'attract') {
      yoYoAttraction = Math.min(1.2, yoYoAttraction + dt * 0.25);
      const d0 = dist(players[0].x, players[0].y, cx, cy);
      const d1 = dist(players[1].x, players[1].y, cx, cy);

      if (d0 < 40 && d1 < 40) {
        finalePhase = 'click';
        finaleTimer = 0;
        triggerClickMoment();
      }
    }

    if (finalePhase === 'click') {
      haloCircle.alpha = 1;
      haloCircle.rotation += dt * 0.08;
    }
  }

  function triggerClickMoment() {
    ripples.push({ x: width / 2, y: height / 2, radius: 20, alpha: 0.9, speed: 120, elapsed: 0 });
    ripples.push({ x: width / 2, y: height / 2, radius: 10, alpha: 0.7, speed: 180, delay: 0.15, elapsed: 0 });

    for (let i = 0; i < 80; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(60, 280);
      particles.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: randomRange(1, 4),
        alpha: randomRange(0.5, 1),
        life: randomRange(1.5, 3),
        maxLife: 3,
        hue: randomRange(180, 260),
      });
    }

    finaleEl.hidden = false;
    requestAnimationFrame(() => {
      finaleEl.querySelector('h1').classList.add('visible');
      setTimeout(() => {
        finaleEl.querySelector('.subtitle').classList.add('visible');
      }, 400);
    });

    playTone(261.63, 2, 'sine', 0.1);
    playTone(392, 2.5, 'sine', 0.07, 0.1);
    playTone(523.25, 3, 'sine', 0.05, 0.2);
  }

  function updateParticles(dt) {
    for (const p of ambientParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += dt;
      if (p.y < -10) {
        p.y = height + 10;
        p.x = randomRange(0, width);
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      p.alpha = (p.life / p.maxLife) * 0.8;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.elapsed = (r.elapsed || 0) + dt;
      if (r.delay && r.elapsed < r.delay) continue;
      const active = r.elapsed - (r.delay || 0);
      r.radius += r.speed * dt;
      r.alpha = Math.max(0, 0.9 - active * 0.6);
      if (r.alpha <= 0) ripples.splice(i, 1);
    }
  }

  function updateTimer(dt) {
    if (finalePhase !== 'play' || gameOver) return;
    gameTime -= dt;
    if (gameTime <= 10) timerEl.classList.add('urgent');
    if (gameTime <= 0) {
      gameTime = 0;
      gameOver = true;
    }
    timerEl.textContent = formatTime(gameTime);
  }

  // ─── Rendering ───────────────────────────────────────────

  function drawBackground() {
    const grad = ctx.createRadialGradient(
      width * 0.5, height * 0.45, 0,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.7
    );
    grad.addColorStop(0, '#0e0e1f');
    grad.addColorStop(0.5, '#080812');
    grad.addColorStop(1, '#030308');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAmbientParticles() {
    for (const p of ambientParticles) {
      const flicker = 0.5 + 0.5 * Math.sin(p.phase * 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 200, 255, ${p.alpha * flicker})`;
      ctx.fill();
    }
  }

  function drawBrokenCircle(circle, time) {
    const float = Math.sin(time * circle.floatSpeed + circle.floatPhase) * 3;
    const drawX = finalePhase === 'play' ? circle.x : circle.currentX;
    const drawY = finalePhase === 'play' ? circle.y + float : circle.currentY + float * 0.3;
    const { r, stage, completed, gaps, glow, alpha } = circle;

    if (finalePhase !== 'play' && alpha < 0.05) return;

    const baseAlpha = alpha !== undefined ? alpha : 1;

    if (stage === 0 && !completed) {
      ctx.save();
      ctx.globalAlpha = 0.18 * baseAlpha;
      ctx.strokeStyle = 'rgba(160, 180, 220, 0.5)';
      ctx.lineWidth = 1.2;
      for (const gap of gaps) {
        const arcStart = gap.start + gap.size;
        const arcEnd = gap.start + Math.PI * 2 / gaps.length * 1.5;
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, arcStart, arcEnd);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const revealFraction = stage / REVEAL_STAGES;
    const glowIntensity = completed ? glow : revealFraction * 0.6;

    if (glowIntensity > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(150, 200, 255, ${glowIntensity * 0.8})`;
      ctx.shadowBlur = 20 + glowIntensity * 25;
    }

    const hue = 200 + glowIntensity * 30;
    const sat = 60 + glowIntensity * 30;
    const lit = 65 + glowIntensity * 20;
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${(0.3 + glowIntensity * 0.7) * baseAlpha})`;
    ctx.lineWidth = 1.5 + glowIntensity * 2;
    ctx.lineCap = 'round';

    if (completed) {
      ctx.beginPath();
      ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, ${glowIntensity * 0.4 * baseAlpha})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(drawX, drawY, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const totalArc = Math.PI * 2 * revealFraction;
      const segments = Math.max(1, stage);
      const segArc = totalArc / segments;

      for (let i = 0; i < segments; i++) {
        const startAngle = -Math.PI / 2 + i * segArc;
        const endAngle = startAngle + segArc * 0.85;
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, startAngle, endAngle);
        ctx.stroke();
      }

      if (stage === 1) {
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit + 15}%, ${0.9 * baseAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(drawX, drawY, r, -Math.PI / 2, -Math.PI / 2 + 0.3);
        ctx.stroke();
      }
    }

    if (glowIntensity > 0) ctx.restore();
  }

  function drawHalo() {
    if (haloCircle.alpha <= 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const r = haloCircle.radius;

    ctx.save();
    ctx.globalAlpha = haloCircle.alpha;

    for (let i = 3; i >= 0; i--) {
      ctx.shadowColor = `rgba(140, 190, 255, ${0.3 - i * 0.05})`;
      ctx.shadowBlur = 30 + i * 20;
      ctx.strokeStyle = `rgba(${180 + i * 15}, ${210 + i * 10}, 255, ${0.15 + i * 0.1})`;
      ctx.lineWidth = 2 + i * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + i * 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.3);
    grad.addColorStop(0, 'rgba(180, 210, 255, 0)');
    grad.addColorStop(0.5, 'rgba(150, 190, 255, 0.15)');
    grad.addColorStop(1, 'rgba(100, 150, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawRibbon() {
    if (ribbonNodes.length < 2) return;

    const points = ribbonNodes.map((n) => ({
      x: n.x + n.ox * 0.5,
      y: n.y + n.oy * 0.5,
    }));

    ctx.save();

    ctx.shadowColor = 'rgba(120, 180, 255, 0.6)';
    ctx.shadowBlur = 25;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);

    const ribbonGrad = ctx.createLinearGradient(
      players[0].x, players[0].y,
      players[1].x, players[1].y
    );
    ribbonGrad.addColorStop(0, 'rgba(160, 200, 255, 0.15)');
    ribbonGrad.addColorStop(0.3, 'rgba(200, 180, 255, 0.55)');
    ribbonGrad.addColorStop(0.5, 'rgba(255, 220, 240, 0.75)');
    ribbonGrad.addColorStop(0.7, 'rgba(200, 180, 255, 0.55)');
    ribbonGrad.addColorStop(1, 'rgba(255, 190, 210, 0.15)');

    ctx.strokeStyle = ribbonGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.shadowBlur = 40;
    ctx.strokeStyle = 'rgba(220, 210, 255, 0.25)';
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  function drawYoYo(player) {
    const { x, y, color } = player;
    const [cr, cg, cb] = color;

    ctx.save();

    ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.4)`;
    ctx.shadowBlur = 20;

    const outerGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, YOYO_RADIUS);
    outerGrad.addColorStop(0, `rgba(255, 255, 255, 0.25)`);
    outerGrad.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, 0.12)`);
    outerGrad.addColorStop(0.8, `rgba(${cr}, ${cg}, ${cb}, 0.06)`);
    outerGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0.02)`);

    ctx.beginPath();
    ctx.arc(x, y, YOYO_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const highlight = ctx.createRadialGradient(x - 6, y - 6, 0, x - 2, y - 2, 10);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.beginPath();
    ctx.arc(x, y, YOYO_RADIUS - 2, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.3)`;
    ctx.fill();

    ctx.restore();
  }

  function drawRipples() {
    for (const r of ripples) {
      if (r.delay && r.elapsed < r.delay) continue;
      ctx.save();
      ctx.strokeStyle = `rgba(180, 210, 255, ${r.alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(150, 200, 255, ${r.alpha * 0.5})`;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawExplosionParticles() {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 70%, 75%, ${p.alpha})`;
      ctx.shadowColor = `hsla(${p.hue}, 70%, 75%, ${p.alpha * 0.5})`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
  }

  function render(time) {
    drawBackground();
    drawAmbientParticles();

    for (const circle of brokenCircles) {
      drawBrokenCircle(circle, time);
    }

    drawHalo();
    drawRibbon();

    for (const player of players) {
      drawYoYo(player);
    }

    drawRipples();
    drawExplosionParticles();
  }

  // ─── Game Loop ───────────────────────────────────────────

  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    updateTimer(dt);
    updatePlayers(dt);
    updateRibbon(dt);
    updateCircleCollisions();
    updateFinale(dt);
    updateParticles(dt);

    render(timestamp / 1000);
    requestAnimationFrame(tick);
  }

  resize();
  resetGame();
  requestAnimationFrame(tick);
})();
