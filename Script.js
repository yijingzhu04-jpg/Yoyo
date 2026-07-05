(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const timerEl = document.getElementById('timer');
  const introEl = document.getElementById('intro');
  const clickMomentEl = document.getElementById('click-moment');
  const timeUpEl = document.getElementById('time-up');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const retryBtn = document.getElementById('retry-btn');

  const GAME_DURATION = 90;
  const RIBBON_SEGMENTS = 48;
  const MAX_REVEAL_STAGE = 4;
  const CIRCLE_COUNT = 12;

  let width, height, centerX, centerY;
  let state = 'intro';
  let timeRemaining = GAME_DURATION;
  let lastTimestamp = 0;
  let keys = {};
  let ambientParticles = [];
  let explosionParticles = [];
  let ripple = null;
  let audioCtx = null;
  let haloFormed = false;

  const yoYos = [
    { x: 0, y: 0, vx: 0, vy: 0, radius: 18, color: 'rgba(160, 200, 255, 0.35)' },
    { x: 0, y: 0, vx: 0, vy: 0, radius: 18, color: 'rgba(200, 180, 255, 0.35)' }
  ];

  let ribbon = [];
  let circles = [];
  let haloAngle = 0;
  let convergeProgress = 0;
  let yoYoAttractProgress = 0;
  let clickMomentTimer = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    centerX = width / 2;
    centerY = height / 2;
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, volume = 0.08, type = 'sine', delay = 0) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration + 0.1);
  }

  function playRevealChime() {
    playTone(523.25, 0.6, 0.05);
    playTone(659.25, 0.5, 0.03, 'sine', 0.05);
  }

  function playCompleteChime() {
    playTone(523.25, 0.8, 0.06);
    playTone(659.25, 0.7, 0.05, 'sine', 0.08);
    playTone(783.99, 0.6, 0.04, 'sine', 0.16);
  }

  function playFinalSwell() {
    playTone(130.81, 3.5, 0.07, 'sine');
    playTone(196.0, 3.0, 0.05, 'sine', 0.3);
    playTone(261.63, 2.5, 0.04, 'sine', 0.6);
    playTone(392.0, 2.0, 0.03, 'triangle', 1.0);
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;
    return dist(px, py, nearX, nearY);
  }

  function createBrokenCircle(x, y, radius) {
    const segmentCount = 5 + Math.floor(Math.random() * 3);
    const arcs = [];
    const gapSize = (Math.PI * 2) / segmentCount * 0.55;
    for (let i = 0; i < segmentCount; i++) {
      const startAngle = (i / segmentCount) * Math.PI * 2 + randomRange(-0.1, 0.1);
      arcs.push({
        start: startAngle,
        end: startAngle + gapSize
      });
    }
    return {
      x, y,
      originX: x,
      originY: y,
      radius,
      arcs,
      revealStage: 0,
      revealAnim: 0,
      ribbonInside: false,
      floatPhase: randomRange(0, Math.PI * 2),
      floatSpeed: randomRange(0.3, 0.6),
      glow: 0
    };
  }

  function generateCircles() {
    circles = [];
    const margin = 80;
    const minDist = 100;
    let attempts = 0;
    while (circles.length < CIRCLE_COUNT && attempts < 500) {
      attempts++;
      const radius = randomRange(26, 40);
      const x = randomRange(margin + radius, width - margin - radius);
      const y = randomRange(margin + radius + 40, height - margin - radius);
      let ok = true;
      for (const c of circles) {
        if (dist(x, y, c.x, c.y) < c.radius + radius + minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        circles.push(createBrokenCircle(x, y, radius));
      }
    }
  }

  function initRibbon() {
    ribbon = [];
    for (let i = 0; i <= RIBBON_SEGMENTS; i++) {
      const t = i / RIBBON_SEGMENTS;
      ribbon.push({
        x: yoYos[0].x + (yoYos[1].x - yoYos[0].x) * t,
        y: yoYos[0].y + (yoYos[1].y - yoYos[0].y) * t,
        oldX: 0,
        oldY: 0
      });
    }
  }

  function initAmbientParticles() {
    ambientParticles = [];
    for (let i = 0; i < 60; i++) {
      ambientParticles.push({
        x: randomRange(0, width),
        y: randomRange(0, height),
        size: randomRange(0.5, 2),
        speed: randomRange(0.1, 0.4),
        phase: randomRange(0, Math.PI * 2),
        opacity: randomRange(0.1, 0.4)
      });
    }
  }

  function resetGame() {
    state = 'playing';
    timeRemaining = GAME_DURATION;
    convergeProgress = 0;
    yoYoAttractProgress = 0;
    clickMomentTimer = 0;
    haloFormed = false;
    explosionParticles = [];
    ripple = null;
    haloAngle = 0;

    yoYos[0].x = width * 0.3;
    yoYos[0].y = height * 0.45;
    yoYos[0].vx = 0;
    yoYos[0].vy = 0;

    yoYos[1].x = width * 0.7;
    yoYos[1].y = height * 0.55;
    yoYos[1].vx = 0;
    yoYos[1].vy = 0;

    generateCircles();
    initRibbon();
    initAmbientParticles();

    introEl.classList.add('hidden');
    clickMomentEl.classList.add('hidden');
    timeUpEl.classList.add('hidden');
    timerEl.classList.remove('hidden', 'urgent');
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = Math.ceil(timeRemaining % 60);
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.classList.toggle('urgent', timeRemaining <= 15);
  }

  function updateYoYos(dt) {
    const accel = 420;
    const friction = 0.92;
    const maxSpeed = 280;

    const controls = [
      { up: 'w', down: 's', left: 'a', right: 'd' },
      { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' }
    ];

    for (let i = 0; i < 2; i++) {
      const y = yoYos[i];
      const c = controls[i];

      if (state === 'converging' || state === 'attracting' || state === 'clickMoment') {
        if (state === 'attracting' || state === 'clickMoment') {
          const dx = centerX - y.x;
          const dy = centerY - y.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const attract = state === 'clickMoment' ? 3 : 2.2;
          y.vx += (dx / d) * 200 * attract * dt;
          y.vy += (dy / d) * 200 * attract * dt;
          y.vx *= 0.94;
          y.vy *= 0.94;
        }
        continue;
      }

      let ax = 0;
      let ay = 0;
      if (keys[c.up]) ay -= accel;
      if (keys[c.down]) ay += accel;
      if (keys[c.left]) ax -= accel;
      if (keys[c.right]) ax += accel;

      y.vx += ax * dt;
      y.vy += ay * dt;
      y.vx *= friction;
      y.vy *= friction;

      const speed = Math.sqrt(y.vx * y.vx + y.vy * y.vy);
      if (speed > maxSpeed) {
        y.vx = (y.vx / speed) * maxSpeed;
        y.vy = (y.vy / speed) * maxSpeed;
      }

      y.x += y.vx * dt;
      y.y += y.vy * dt;

      const pad = 30;
      y.x = Math.max(pad, Math.min(width - pad, y.x));
      y.y = Math.max(pad, Math.min(height - pad, y.y));
    }
  }

  function simulateRibbon() {
    const gravity = 0.15;
    const iterations = 6;
    const segmentLen = dist(yoYos[0].x, yoYos[0].y, yoYos[1].x, yoYos[1].y) / RIBBON_SEGMENTS;

    ribbon[0].x = yoYos[0].x;
    ribbon[0].y = yoYos[0].y;
    ribbon[RIBBON_SEGMENTS].x = yoYos[1].x;
    ribbon[RIBBON_SEGMENTS].y = yoYos[1].y;

    for (let i = 1; i < RIBBON_SEGMENTS; i++) {
      const p = ribbon[i];
      const velX = (p.x - p.oldX) * 0.98;
      const velY = (p.y - p.oldY) * 0.98;
      p.oldX = p.x;
      p.oldY = p.y;
      p.x += velX;
      p.y += velY + gravity;
    }

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < RIBBON_SEGMENTS; i++) {
        const p1 = ribbon[i];
        const p2 = ribbon[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (d - segmentLen) / d;
        const offsetX = dx * diff * 0.5;
        const offsetY = dy * diff * 0.5;

        if (i > 0) {
          p1.x += offsetX;
          p1.y += offsetY;
        }
        if (i < RIBBON_SEGMENTS - 1) {
          p2.x -= offsetX;
          p2.y -= offsetY;
        }
      }
    }

    ribbon[0].x = yoYos[0].x;
    ribbon[0].y = yoYos[0].y;
    ribbon[RIBBON_SEGMENTS].x = yoYos[1].x;
    ribbon[RIBBON_SEGMENTS].y = yoYos[1].y;
  }

  function checkRibbonCollisions() {
    if (state !== 'playing') return;

    const hitThreshold = 14;

    for (const circle of circles) {
      if (circle.revealStage >= MAX_REVEAL_STAGE) continue;

      let minDist = Infinity;
      for (let i = 0; i < RIBBON_SEGMENTS; i++) {
        const p1 = ribbon[i];
        const p2 = ribbon[i + 1];
        const d = pointToSegmentDistance(circle.x, circle.y, p1.x, p1.y, p2.x, p2.y);
        minDist = Math.min(minDist, d);
      }

      const inside = minDist < hitThreshold;

      if (inside && !circle.ribbonInside) {
        circle.revealStage++;
        circle.revealAnim = 0;
        circle.glow = 1;

        if (circle.revealStage >= MAX_REVEAL_STAGE) {
          playCompleteChime();
        } else {
          playRevealChime();
        }
      }

      circle.ribbonInside = inside;
    }

    if (circles.every(c => c.revealStage >= MAX_REVEAL_STAGE)) {
      state = 'converging';
      convergeProgress = 0;
      playFinalSwell();
    }
  }

  function updateCircles(dt, time) {
    for (const circle of circles) {
      if (state === 'playing') {
        circle.x = circle.originX + Math.sin(time * circle.floatSpeed + circle.floatPhase) * 6;
        circle.y = circle.originY + Math.cos(time * circle.floatSpeed * 0.7 + circle.floatPhase) * 4;
      }

      if (circle.revealAnim < 1) {
        circle.revealAnim = Math.min(1, circle.revealAnim + dt * 1.2);
      }

      if (circle.glow > 0) {
        circle.glow = Math.max(0, circle.glow - dt * 0.8);
      }
    }

    if (state === 'converging' || state === 'attracting' || state === 'clickMoment') {
      convergeProgress = Math.min(1, convergeProgress + dt * 0.3);
      const ease = easeInOutCubic(convergeProgress);
      const haloRadius = Math.min(width, height) * 0.22;

      for (const circle of circles) {
        circle.x = circle.originX + (centerX - circle.originX) * ease;
        circle.y = circle.originY + (centerY - circle.originY) * ease;
        const targetRadius = haloRadius * (1 + (1 - ease) * 0.3);
        circle.radius += (targetRadius * 0.04 - circle.radius) * 0.05;
        circle.glow = Math.max(circle.glow, 0.5 * ease);
      }

      if (convergeProgress >= 1 && !haloFormed) {
        haloFormed = true;
        state = 'attracting';
      }

      if (state === 'attracting') {
        yoYoAttractProgress = Math.min(1, yoYoAttractProgress + dt * 0.5);
        const d0 = dist(yoYos[0].x, yoYos[0].y, centerX, centerY);
        const d1 = dist(yoYos[1].x, yoYos[1].y, centerX, centerY);

        if (d0 < 28 && d1 < 28) {
          state = 'clickMoment';
          clickMomentTimer = 0;
          triggerExplosion();
          timerEl.classList.add('hidden');
        }
      }
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function triggerExplosion() {
    ripple = { radius: 0, maxRadius: Math.min(width, height) * 0.5, opacity: 1 };
    for (let i = 0; i < 120; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(50, 300);
      explosionParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomRange(1.5, 3),
        maxLife: 3,
        size: randomRange(1, 4),
        hue: randomRange(200, 260)
      });
    }
    setTimeout(() => {
      clickMomentEl.classList.remove('hidden');
    }, 1200);
  }

  function updateParticles(dt) {
    const time = performance.now() * 0.001;
    for (const p of ambientParticles) {
      p.y -= p.speed * dt * 20;
      p.x += Math.sin(time + p.phase) * 0.15;
      if (p.y < -10) {
        p.y = height + 10;
        p.x = randomRange(0, width);
      }
    }

    explosionParticles = explosionParticles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      return p.life > 0;
    });

    if (ripple) {
      ripple.radius += dt * 200;
      ripple.opacity -= dt * 0.4;
      if (ripple.opacity <= 0) ripple = null;
    }
  }

  function drawBackground() {
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.7);
    grad.addColorStop(0, '#0e0e1a');
    grad.addColorStop(0.5, '#080810');
    grad.addColorStop(1, '#030308');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAmbientParticles() {
    for (const p of ambientParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 200, 255, ${p.opacity})`;
      ctx.fill();
    }
  }

  function getRevealArcLength(stage) {
    const fractions = [0, 0.15, 0.45, 0.82, 1.0];
    return fractions[Math.min(stage, MAX_REVEAL_STAGE)] || 0;
  }

  function drawBrokenCircle(circle) {
    const revealFraction = getRevealArcLength(circle.revealStage);
    const animFraction = circle.revealStage > 0
      ? getRevealArcLength(circle.revealStage - 1) +
        (revealFraction - getRevealArcLength(circle.revealStage - 1)) * easeInOutCubic(circle.revealAnim)
      : 0;

    const baseOpacity = circle.revealStage >= MAX_REVEAL_STAGE ? 0.9 : 0.25;
    const glowBoost = circle.glow * 0.5;

    if (state === 'converging' || state === 'attracting' || state === 'clickMoment') {
      const fadeOut = state === 'converging' ? easeInOutCubic(convergeProgress) : 1;
      ctx.globalAlpha = Math.max(0, 1 - fadeOut * 0.85);
    }

    for (const arc of circle.arcs) {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, arc.start, arc.end);
      ctx.strokeStyle = `rgba(140, 170, 220, ${baseOpacity + glowBoost})`;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (animFraction > 0) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + animFraction * Math.PI * 2;

      ctx.save();
      ctx.shadowColor = 'rgba(150, 200, 255, 0.8)';
      ctx.shadowBlur = 20 + glowBoost * 30;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, startAngle, endAngle);
      ctx.strokeStyle = `rgba(180, 220, 255, ${0.6 + glowBoost})`;
      ctx.lineWidth = circle.revealStage >= MAX_REVEAL_STAGE ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    if (circle.revealStage >= MAX_REVEAL_STAGE) {
      ctx.save();
      ctx.shadowColor = 'rgba(120, 180, 255, 0.6)';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  function drawHalo() {
    if (state !== 'converging' && state !== 'attracting' && state !== 'clickMoment') return;

    const haloRadius = Math.min(width, height) * 0.22;
    let haloOpacity = 0;

    if (state === 'converging') {
      haloOpacity = easeInOutCubic(convergeProgress) * 0.5;
    } else {
      haloOpacity = 0.5 + yoYoAttractProgress * 0.4;
    }

    if (state === 'clickMoment') {
      haloOpacity = 0.9 + Math.sin(clickMomentTimer * 2) * 0.1;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(140, 190, 255, 0.9)';
    ctx.shadowBlur = 60;
    ctx.beginPath();
    ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 220, 255, ${haloOpacity})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.shadowBlur = 80;
    ctx.beginPath();
    ctx.arc(centerX, centerY, haloRadius + 20, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140, 180, 255, ${haloOpacity * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const innerGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, haloRadius);
    innerGrad.addColorStop(0, `rgba(160, 200, 255, ${haloOpacity * 0.08})`);
    innerGrad.addColorStop(0.7, `rgba(120, 160, 255, ${haloOpacity * 0.03})`);
    innerGrad.addColorStop(1, 'rgba(80, 120, 200, 0)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(centerX - haloRadius, centerY - haloRadius, haloRadius * 2, haloRadius * 2);
    ctx.restore();
  }

  function drawRibbon() {
    if (ribbon.length < 2) return;

    ctx.save();
    ctx.shadowColor = 'rgba(120, 180, 255, 0.9)';
    ctx.shadowBlur = 25;

    const gradient = ctx.createLinearGradient(
      ribbon[0].x, ribbon[0].y,
      ribbon[RIBBON_SEGMENTS].x, ribbon[RIBBON_SEGMENTS].y
    );
    gradient.addColorStop(0, 'rgba(140, 190, 255, 0.7)');
    gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(180, 160, 255, 0.7)');

    ctx.beginPath();
    ctx.moveTo(ribbon[0].x, ribbon[0].y);
    for (let i = 1; i <= RIBBON_SEGMENTS; i++) {
      const p = ribbon[i];
      const prev = ribbon[i - 1];
      const cx = (prev.x + p.x) / 2;
      const cy = (prev.y + p.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
    }
    const last = ribbon[RIBBON_SEGMENTS];
    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.shadowBlur = 40;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();
    ctx.restore();
  }

  function drawYoYo(yoyo) {
    ctx.save();

    const grad = ctx.createRadialGradient(
      yoyo.x - 4, yoyo.y - 4, 2,
      yoyo.x, yoyo.y, yoyo.radius
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(0.4, 'rgba(180, 200, 255, 0.12)');
    grad.addColorStop(1, 'rgba(100, 140, 200, 0.05)');

    ctx.shadowColor = 'rgba(150, 190, 255, 0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(yoyo.x, yoyo.y, yoyo.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(yoyo.x, yoyo.y, yoyo.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(yoyo.x - 5, yoyo.y - 5, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();

    ctx.restore();
  }

  function drawRipple() {
    if (!ripple) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, ripple.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 220, 255, ${ripple.opacity * 0.6})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, ripple.radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200, 230, 255, ${ripple.opacity * 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawExplosionParticles() {
    for (const p of explosionParticles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${alpha * 0.8})`;
      ctx.shadowColor = `hsla(${p.hue}, 80%, 75%, 0.5)`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
  }

  function render(time) {
    drawBackground();
    drawAmbientParticles();

    for (const circle of circles) {
      drawBrokenCircle(circle);
    }

    drawHalo();
    drawRibbon();

    for (const yoyo of yoYos) {
      drawYoYo(yoyo);
    }

    drawRipple();
    drawExplosionParticles();
  }

  function update(dt, time) {
    if (state === 'playing') {
      timeRemaining -= dt;
      updateTimerDisplay();
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        state = 'timeUp';
        timerEl.classList.add('hidden');
        timeUpEl.classList.remove('hidden');
      }
    }

    updateYoYos(dt);
    simulateRibbon();
    checkRibbonCollisions();
    updateCircles(dt, time);
    updateParticles(dt);

    if (state === 'clickMoment') {
      clickMomentTimer += dt;
      haloAngle += dt * 0.2;
    }
  }

  function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    const time = timestamp * 0.001;

    if (state !== 'intro' && state !== 'timeUp') {
      update(dt, time);
      render(time);
    } else {
      drawBackground();
      drawAmbientParticles();
    }

    requestAnimationFrame(gameLoop);
  }

  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  window.addEventListener('resize', () => {
    resize();
    if (state === 'intro') {
      initAmbientParticles();
    }
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  startBtn.addEventListener('click', () => {
    initAudio();
    resize();
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  retryBtn.addEventListener('click', () => {
    initAudio();
    resetGame();
  });

  resize();
  initAmbientParticles();
  requestAnimationFrame(gameLoop);
})();
