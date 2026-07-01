(function () {
  "use strict";

  class PlayerInput {
    constructor() {
      this.keys = new Set();
      this.jumpQueued = false;

      window.addEventListener("keydown", (event) => {
        this.keys.add(event.code);

        if (event.code === "KeyW" || event.code === "ArrowUp" || event.code === "Space") {
          this.jumpQueued = true;
        }

        if (this.isGameKey(event.code)) {
          event.preventDefault();
        }
      });

      window.addEventListener("keyup", (event) => {
        this.keys.delete(event.code);

        if (this.isGameKey(event.code)) {
          event.preventDefault();
        }
      });
    }

    isGameKey(code) {
      return [
        "KeyA",
        "KeyD",
        "KeyW",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "Space",
      ].includes(code);
    }

    getState() {
      const playerOneAxis = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      const playerTwoAxis = Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));

      const state = {
        // Both players affect one shared yo-yo. Matching inputs give stronger movement.
        horizontal: Math.max(-1, Math.min(1, (playerOneAxis + playerTwoAxis) / 2)),
        jump: this.jumpQueued,
      };

      this.jumpQueued = false;
      return state;
    }
  }

  window.PlayerInput = PlayerInput;
})();
