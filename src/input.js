// Keyboard input: held-down state + edge-triggered "just pressed".
const KEY_ALIAS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down",
  Space: "attack", Enter: "attack",
  F1: "F1", F2: "F2", KeyP: "P",
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

// Auto-walks the hero in a square pattern. Wraps a real Input — if the user
// presses any movement key, it yields control until they release.
export class AutoInput {
  constructor(real) {
    this.real = real;
    this.t = 0;
    this.seq = [
      { dx: 0,  dy: 1,  dur: 1.5 },  // down
      { dx: 1,  dy: 0,  dur: 1.5 },  // right
      { dx: 0,  dy: -1, dur: 1.5 },  // up
      { dx: -1, dy: 0,  dur: 1.5 },  // left
    ];
    this.idx = 0;
  }
  _step(dt) {
    this.t += dt;
    if (this.t >= this.seq[this.idx].dur) {
      this.t = 0;
      this.idx = (this.idx + 1) % this.seq.length;
    }
  }
  tick(dt) { this._step(dt); }
  down(name) { return this.real.down(name); }
  pressed(name) { return this.real.pressed(name); }
  axis() {
    const a = this.real.axis();
    if (a.x !== 0 || a.y !== 0) return a; // manual override
    const s = this.seq[this.idx];
    return { x: s.dx, y: s.dy };
  }
  endFrame() { this.real.endFrame(); }
}
