(function () {
  "use strict";

  class GameLevel {
    constructor() {
      this.platformHeight = 34;
      this.baseY = 560;
      this.reset();
    }

    reset() {
      this.platforms = [
        { x: -400, y: this.baseY, width: 1000, height: this.platformHeight },
      ];
      this.hazards = [];
      this.nextX = 600;
      this.segmentIndex = 0;
      this.difficulty = 0;
    }

    update(cameraX, viewportWidth) {
      this.difficulty = Math.min(1, Math.max(0, cameraX / 9000));
      this.generateUntil(cameraX + viewportWidth * 1.75);
      this.trimBehind(cameraX - 700);
    }

    generateUntil(targetX) {
      while (this.nextX < targetX) {
        this.addSegment();
      }
    }

    addSegment() {
      this.segmentIndex += 1;

      const wave = Math.sin(this.segmentIndex * 0.92);
      const y = this.baseY + wave * 62 - this.difficulty * 56;
      const width = 360 + pseudoRandom(this.segmentIndex, 11) * 260 - this.difficulty * 90;
      const gap = 120 + pseudoRandom(this.segmentIndex, 29) * (170 + this.difficulty * 180);
      const platform = {
        x: this.nextX + gap,
        y,
        width: Math.max(230, width),
        height: this.platformHeight,
      };

      this.platforms.push(platform);
      this.addHazards(platform);

      this.nextX = platform.x + platform.width;
    }

    addHazards(platform) {
      const hazardChance = 0.3 + this.difficulty * 0.38;

      if (pseudoRandom(this.segmentIndex, 47) > hazardChance || platform.width < 280) {
        return;
      }

      const count = pseudoRandom(this.segmentIndex, 61) > 0.72 + this.difficulty * 0.12 ? 2 : 1;

      for (let index = 0; index < count; index += 1) {
        const hazardWidth = 34;
        const inset = 80 + pseudoRandom(this.segmentIndex + index, 83) * (platform.width - 160);

        this.hazards.push({
          x: platform.x + inset,
          y: platform.y - 34,
          width: hazardWidth,
          height: 34,
        });
      }
    }

    trimBehind(limitX) {
      this.platforms = this.platforms.filter((platform) => platform.x + platform.width > limitX);
      this.hazards = this.hazards.filter((hazard) => hazard.x + hazard.width > limitX);
    }

    getNearbyPlatforms(x) {
      return this.platforms.filter((platform) => {
        return platform.x < x + 220 && platform.x + platform.width > x - 220;
      });
    }

    getVisiblePlatforms(cameraX, viewportWidth) {
      return this.platforms.filter((platform) => {
        return platform.x < cameraX + viewportWidth + 100 && platform.x + platform.width > cameraX - 100;
      });
    }

    getVisibleHazards(cameraX, viewportWidth) {
      return this.hazards.filter((hazard) => {
        return hazard.x < cameraX + viewportWidth + 100 && hazard.x + hazard.width > cameraX - 100;
      });
    }
  }

  function pseudoRandom(seed, salt) {
    const value = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  window.GameLevel = GameLevel;
})();
