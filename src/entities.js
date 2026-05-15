// Pickup + enemy entities. Slime wanders; chases when player is close.
export class Coin {
  constructor(x, y) {
    this.kind = "coin";
    this.x = x;
    this.y = y;
    this.w = 6;
    this.h = 6;
    this.bob = Math.random() * Math.PI * 2;
    this.dead = false;
  }
  update(dt) {
    this.bob += dt * 5;
  }
  draw(ctx, camera) {
    const dy = Math.sin(this.bob) * 1.5;
    const px = Math.round(this.x - camera.x);
    const py = Math.round(this.y - camera.y + dy);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(px, this.y - camera.y + 6 | 0, 6, 1);
    ctx.fillStyle = "#caa53b";
    ctx.fillRect(px, py, 6, 6);
    ctx.fillStyle = "#fde36a";
    ctx.fillRect(px + 1, py + 1, 4, 4);
    ctx.fillStyle = "#fff7c4";
    ctx.fillRect(px + 2, py + 1, 1, 1);
  }
}

export class Slime {
  constructor(x, y) {
    this.kind = "slime";
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 10;
    this.vx = 0;
    this.vy = 0;
    this.tick = Math.random() * 2;
    this.dirTimer = 0;
    this.dead = false;
    this.squish = 0;
  }
  update(dt, player, map) {
    this.tick += dt;
    this.squish = (Math.sin(this.tick * 4) + 1) * 0.5;

    const dx = (player.x + player.w / 2) - (this.x + this.w / 2);
    const dy = (player.y + player.h / 2) - (this.y + this.h / 2);
    const dist2 = dx * dx + dy * dy;

    if (dist2 < 64 * 64) {
      // chase
      const inv = 1 / Math.sqrt(dist2 || 1);
      this.vx = dx * inv * 30;
      this.vy = dy * inv * 30;
    } else {
      this.dirTimer -= dt;
      if (this.dirTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        this.vx = Math.cos(a) * 18;
        this.vy = Math.sin(a) * 18;
        this.dirTimer = 1.0 + Math.random() * 1.5;
      }
    }

    const mx = this.vx * dt;
    const my = this.vy * dt;
    if (!map.rectSolid(this.x + mx, this.y, this.w, this.h)) this.x += mx;
    else this.vx *= -1;
    if (!map.rectSolid(this.x, this.y + my, this.w, this.h)) this.y += my;
    else this.vy *= -1;
  }
  draw(ctx, camera) {
    const px = Math.round(this.x - camera.x);
    const py = Math.round(this.y - camera.y);
    const sq = this.squish;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 1, py + this.h - 1, this.w - 2, 2);
    ctx.fillStyle = "#4ab07a";
    ctx.fillRect(px + 1, py + 3 - (sq | 0), 10, 7 + (sq | 0));
    ctx.fillStyle = "#7ad8a6";
    ctx.fillRect(px + 2, py + 3 - (sq | 0), 8, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(px + 3, py + 5, 2, 2);
    ctx.fillRect(px + 7, py + 5, 2, 2);
    ctx.fillStyle = "#000";
    ctx.fillRect(px + 4, py + 6, 1, 1);
    ctx.fillRect(px + 8, py + 6, 1, 1);
  }
}
