(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const restartButton = document.getElementById("restartButton");

  const input = new window.PlayerInput();
  const physics = new window.BallPhysics();
  const level = new window.GameLevel();

  const game = {
    cameraX: 0,
    scrollX: 0,
    scrollSpeed: 170,
    score: 0,
    bestScore: 0,
    running: true,
    lastTime: performance.now(),
  };

  restartButton.addEventListener("click", restart);
  window.addEventListener("keydown", (event) => {
    if (!game.running && (event.code === "Enter" || event.code === "Space")) {
      restart();
    }
  });

  restart();
  requestAnimationFrame(loop);

  function restart() {
    physics.reset();
    level.reset();

    game.cameraX = 0;
    game.scrollX = 0;
    game.scrollSpeed = 170;
    game.score = 0;
    game.running = true;
    game.lastTime = performance.now();

    scoreElement.textContent = "0 m";
  }

  function loop(now) {
    const deltaTime = Math.min((now - game.lastTime) / 1000, 1 / 30);
    game.lastTime = now;

    if (game.running) {
      update(deltaTime);
    }

    render();
    requestAnimationFrame(loop);
  }

  function update(deltaTime) {
    const viewportWidth = canvas.width;
    const inputState = input.getState();

    game.scrollSpeed = 170 + Math.min(150, physics.ball.x / 80);
    game.scrollX += game.scrollSpeed * deltaTime;

    level.update(game.cameraX, viewportWidth);
    physics.step(deltaTime, inputState, level);

    const followX = physics.ball.x - viewportWidth * 0.34;
    game.cameraX = Math.max(game.scrollX, followX, 0);
    game.score = Math.max(game.score, Math.floor(physics.ball.x / 10));
    game.bestScore = Math.max(game.bestScore, game.score);
    scoreElement.textContent = `${game.score} m`;

    const visibleHazards = level.getVisibleHazards(game.cameraX, viewportWidth);
    const fellTooFar = physics.ball.y - physics.ball.radius > canvas.height + 180;
    const crushedByScroll = physics.ball.x + physics.ball.radius < game.cameraX;

    if (fellTooFar || crushedByScroll || physics.hitsHazard(visibleHazards)) {
      game.running = false;
    }
  }

  function render() {
    drawSky();
    drawParallax();
    drawLevel();
    drawBall();
    drawVignette();

    if (!game.running) {
      drawGameOver();
    }
  }

  function drawSky() {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#111a3c");
    gradient.addColorStop(0.48, "#151f44");
    gradient.addColorStop(1, "#070a17");

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawParallax() {
    drawStars(0.12, 28, "#8dcfff");
    drawStars(0.24, 18, "#9ff75c");

    context.save();
    context.translate(-game.cameraX * 0.32, 0);

    for (let x = -400; x < game.cameraX * 0.32 + canvas.width + 600; x += 360) {
      const height = 160 + Math.sin(x * 0.01) * 34;
      context.fillStyle = "rgba(88, 224, 255, 0.08)";
      context.beginPath();
      context.moveTo(x, canvas.height);
      context.lineTo(x + 150, canvas.height - height);
      context.lineTo(x + 330, canvas.height);
      context.closePath();
      context.fill();
    }

    context.restore();
  }

  function drawStars(speed, count, color) {
    context.save();
    context.fillStyle = color;

    for (let index = 0; index < count; index += 1) {
      const worldX = index * 211 + 80;
      const x = wrap(worldX - game.cameraX * speed, canvas.width + 220) - 110;
      const y = 45 + ((index * 97) % 230);
      const radius = 1.2 + (index % 3) * 0.8;

      context.globalAlpha = 0.25 + (index % 4) * 0.12;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  function drawLevel() {
    const platforms = level.getVisiblePlatforms(game.cameraX, canvas.width);
    const hazards = level.getVisibleHazards(game.cameraX, canvas.width);

    context.save();
    context.translate(-game.cameraX, 0);

    for (const platform of platforms) {
      drawPlatform(platform);
    }

    for (const hazard of hazards) {
      drawSpike(hazard);
    }

    context.restore();
  }

  function drawPlatform(platform) {
    const topGradient = context.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
    topGradient.addColorStop(0, "#42d7ff");
    topGradient.addColorStop(1, "#1d355f");

    context.fillStyle = topGradient;
    roundRect(platform.x, platform.y, platform.width, platform.height, 12);
    context.fill();

    context.fillStyle = "rgba(7, 10, 23, 0.62)";
    context.fillRect(platform.x + 12, platform.y + 18, platform.width - 24, 7);

    context.strokeStyle = "rgba(255, 255, 255, 0.22)";
    context.lineWidth = 2;
    context.stroke();
  }

  function drawSpike(hazard) {
    context.fillStyle = "#ff4f79";
    context.strokeStyle = "#ffc0cf";
    context.lineWidth = 2;

    context.beginPath();
    context.moveTo(hazard.x, hazard.y + hazard.height);
    context.lineTo(hazard.x + hazard.width / 2, hazard.y);
    context.lineTo(hazard.x + hazard.width, hazard.y + hazard.height);
    context.closePath();
    context.fill();
    context.stroke();
  }

  function drawBall() {
    const ball = physics.ball;
    const screenX = ball.x - game.cameraX;
    const screenY = ball.y;

    context.save();
    context.translate(screenX, screenY);
    context.rotate(ball.rotation);

    const gradient = context.createRadialGradient(-10, -12, 4, 0, 0, ball.radius);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.22, "#9ff75c");
    gradient.addColorStop(0.62, "#58e0ff");
    gradient.addColorStop(1, "#2454ff");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, ball.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(7, 10, 23, 0.82)";
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, ball.radius * 0.54, 0, Math.PI * 2);
    context.stroke();

    // The yo-yo grooves make rotation readable at speed.
    context.strokeStyle = "rgba(255, 255, 255, 0.78)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-ball.radius * 0.92, 0);
    context.lineTo(ball.radius * 0.92, 0);
    context.moveTo(0, -ball.radius * 0.92);
    context.lineTo(0, ball.radius * 0.92);
    context.stroke();

    context.restore();
  }

  function drawVignette() {
    const gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      120,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.72
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.38)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawGameOver() {
    context.fillStyle = "rgba(7, 10, 23, 0.72)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#eef7ff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "800 72px system-ui, sans-serif";
    context.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 70);

    context.fillStyle = "#a7b9d6";
    context.font = "500 28px system-ui, sans-serif";
    context.fillText(`Distance: ${game.score} m  |  Best: ${game.bestScore} m`, canvas.width / 2, canvas.height / 2);
    context.fillText("Press Restart, Enter, or Space to roll again", canvas.width / 2, canvas.height / 2 + 48);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function wrap(value, width) {
    return ((value % width) + width) % width;
  }
})();
