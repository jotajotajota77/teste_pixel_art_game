// Keyboard input: held-down state + edge-triggered "just pressed".
const KEY_ALIAS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
  Space: "attack", Enter: "attack",
  F1: "F1", F2: "F2",
};

export class Input {
  constructor() {
    this.held = new Set();
    this.justPressed = new Set();
    window.addEventListener("keydown", (e) => {
      const k = KEY_ALIAS[e.code];
      if (!k) return;
      if (e.code === "F1" || e.code === "F2" || e.code === "Space") e.preventDefault();
      if (!this.held.has(k)) this.justPressed.add(k);
      this.held.add(k);
    });
    window.addEventListener("keyup", (e) => {
      const k = KEY_ALIAS[e.code];
      if (!k) return;
      this.held.delete(k);
    });
    window.addEventListener("blur", () => this.held.clear());
  }

  down(name) { return this.held.has(name); }
  pressed(name) { return this.justPressed.has(name); }

  axis() {
    const x = (this.down("right") ? 1 : 0) - (this.down("left") ? 1 : 0);
    const y = (this.down("down") ? 1 : 0) - (this.down("up") ? 1 : 0);
    return { x, y };
  }

  endFrame() { this.justPressed.clear(); }
}
