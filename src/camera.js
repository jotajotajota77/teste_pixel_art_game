// Camera with deadzone follow + world bounds clamp.
export class Camera {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;
    this.deadzone = { w: 40, h: 24 };
  }

  snapTo(cx, cy) {
    this.x = Math.round(cx - this.viewW / 2);
    this.y = Math.round(cy - this.viewH / 2);
  }

  follow(cx, cy, worldW, worldH) {
    const dz = this.deadzone;
    const left = this.x + (this.viewW - dz.w) / 2;
    const right = left + dz.w;
    const top = this.y + (this.viewH - dz.h) / 2;
    const bot = top + dz.h;

    if (cx < left) this.x -= left - cx;
    else if (cx > right) this.x += cx - right;
    if (cy < top) this.y -= top - cy;
    else if (cy > bot) this.y += cy - bot;

    if (worldW > this.viewW) this.x = clamp(this.x, 0, worldW - this.viewW);
    else this.x = (worldW - this.viewW) / 2;
    if (worldH > this.viewH) this.y = clamp(this.y, 0, worldH - this.viewH);
    else this.y = (worldH - this.viewH) / 2;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
