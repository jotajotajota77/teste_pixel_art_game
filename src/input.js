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

  // Bind on-screen touch buttons. Each element with data-input="<name>"
  // toggles that input name in `held` on press/release.
  bindTouch(root = document) {
    const press = (name) => {
      if (!this.held.has(name)) this.justPressed.add(name);
      this.held.add(name);
    };
    const release = (name) => this.held.delete(name);

    for (const el of root.querySelectorAll("[data-input]")) {
      const name = el.dataset.input;
      const onDown = (e) => { e.preventDefault(); press(name); el.classList.add("active"); };
      const onUp = (e) => { e.preventDefault(); release(name); el.classList.remove("active"); };
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("pointerleave", (e) => {
        if (e.buttons === 0) return;
        release(name);
        el.classList.remove("active");
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }
}
