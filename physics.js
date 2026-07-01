(function () {
  "use strict";

  const DEFAULT_BALL = {
    x: 180,
    y: 240,
    radius: 28,
    vx: 0,
    vy: 0,
    rotation: 0,
    grounded: false,
  };

  class BallPhysics {
    constructor() {
      this.gravity = 2200;
      this.moveForce = 1650;
      this.autoRunForce = 860;
      this.jumpVelocity = -860;
      this.groundFriction = 0.86;
      this.airDrag = 0.992;
      this.maxSpeed = 720;
      this.reset();
    }

    reset() {
      this.ball = { ...DEFAULT_BALL };
    }

    step(deltaTime, input, level) {
      const ball = this.ball;
      const previous = { x: ball.x, y: ball.y };
      const wasGrounded = ball.grounded;

      ball.grounded = false;

      const cooperativeForce = input.horizontal * this.moveForce;
      ball.vx += (this.autoRunForce + cooperativeForce) * deltaTime;
      ball.vy += this.gravity * deltaTime;

      if (input.jump && wasGrounded) {
        ball.vy = this.jumpVelocity;
        ball.grounded = false;
      }

      ball.vx *= wasGrounded ? this.groundFriction : this.airDrag;
      ball.vx = Math.max(120, Math.min(this.maxSpeed, ball.vx));

      ball.x += ball.vx * deltaTime;
      ball.y += ball.vy * deltaTime;

      this.resolvePlatformCollisions(previous, level.getNearbyPlatforms(ball.x));
      ball.rotation += (ball.vx / ball.radius) * deltaTime;
    }

    resolvePlatformCollisions(previous, platforms) {
      const ball = this.ball;

      for (const platform of platforms) {
        const nearestX = clamp(ball.x, platform.x, platform.x + platform.width);
        const nearestY = clamp(ball.y, platform.y, platform.y + platform.height);
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared >= ball.radius * ball.radius) {
          continue;
        }

        const previousBottom = previous.y + ball.radius;
        const previousTop = previous.y - ball.radius;
        const previousRight = previous.x + ball.radius;
        const previousLeft = previous.x - ball.radius;

        if (previousBottom <= platform.y && ball.vy >= 0) {
          ball.y = platform.y - ball.radius;
          ball.vy = 0;
          ball.grounded = true;
        } else if (previousTop >= platform.y + platform.height && ball.vy < 0) {
          ball.y = platform.y + platform.height + ball.radius;
          ball.vy = 60;
        } else if (previousRight <= platform.x && ball.vx > 0) {
          ball.x = platform.x - ball.radius;
          ball.vx *= -0.18;
        } else if (previousLeft >= platform.x + platform.width && ball.vx < 0) {
          ball.x = platform.x + platform.width + ball.radius;
          ball.vx *= -0.18;
        } else if (distanceSquared > 0) {
          // Fallback for corner contacts, where the previous-position tests are ambiguous.
          const distance = Math.sqrt(distanceSquared);
          const overlap = ball.radius - distance;
          ball.x += (dx / distance) * overlap;
          ball.y += (dy / distance) * overlap;
        }
      }
    }

    hitsHazard(hazards) {
      const ball = this.ball;

      return hazards.some((hazard) => {
        const nearestX = clamp(ball.x, hazard.x, hazard.x + hazard.width);
        const nearestY = clamp(ball.y, hazard.y, hazard.y + hazard.height);
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;
        return dx * dx + dy * dy < ball.radius * ball.radius;
      });
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.BallPhysics = BallPhysics;
})();
