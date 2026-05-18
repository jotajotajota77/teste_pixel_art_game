// Pickup + enemy entities. Slime wanders; chases when player is close.

const DIR_VEC = {
  down:  { x: 0,  y: 1 },
  up:    { x: 0,  y: -1 },
  left:  { x: -1, y: 0 },
  right: { x: 1,  y: 0 },
};

const BOLT_FW = 24, BOLT_FH = 20;
const IMPACT_FW = 32, IMPACT_FH = 32;
const BURN_FW = 14, BURN_FH = 14;
const IMPACT_DUR = 0.42;
const BURN_DUR = 1.6;

// Rotation angle so the projectile's "forward" (positive x in sheet) points
// in the requested direction.
const DIR_ANGLE = {
  right: 0,
  down:  Math.PI / 2,
  left:  Math.PI,
  up:    -Math.PI / 2,
};

export class MagicBolt {
  constructor(player, assets) {
    this.kind = "bolt";
    this.facing = player.facing;
    this.w = 8;
    this.h = 8;
    const o = player.castOrigin();
    const d = DIR_VEC[player.facing];
    this.x = o.x - this.w / 2 + d.x * 4;
    this.y = o.y - this.h / 2 + d.y * 4;
    this.vx = d.x * 140;
    this.vy = d.y * 140;
    this.life = 0.9;
    this.t = 0;
    this.dead = false;
    this.sheet = assets?.images?.["fx_projectile.png"] || null;
  }
  update(dt, _player, map) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    if (map.rectSolid(nx, ny, this.w, this.h)) { this.dead = true; return; }
    this.x = nx;
    this.y = ny;
  }
  draw(ctx, camera) {
    const cx = Math.round(this.x + this.w / 2 - camera.x);
    const cy = Math.round(this.y + this.h / 2 - camera.y);
    if (this.sheet) {
      const frame = ((this.t * 14) | 0) % 4;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(DIR_ANGLE[this.facing] ?? 0);
      ctx.drawImage(this.sheet, frame * BOLT_FW, 0, BOLT_FW, BOLT_FH,
                    -BOLT_FW / 2, -BOLT_FH / 2, BOLT_FW, BOLT_FH);
      ctx.restore();
      return;
    }
    // procedural fallback
    const flick = ((this.t * 20) | 0) % 2;
    ctx.fillStyle = "rgba(255,220,120,0.35)";
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.fillStyle = flick ? "#fff7c4" : "#fde36a";
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  }
}

export class Impact {
  constructor(x, y, assets) {
    this.kind = "impact";
    this.x = x - IMPACT_FW / 2;
    this.y = y - IMPACT_FH / 2;
    this.w = 16;
    this.h = 16;
    this.t = 0;
    this.dead = false;
    this.sheet = assets?.images?.["fx_impact.png"] || null;
    this.damaged = new Set(); // slimes already damaged by this burst
  }
  update(dt) {
    this.t += dt;
    if (this.t >= IMPACT_DUR) this.dead = true;
  }
  // small AOE damage in the first 1/3 of the impact
  damageRect() {
    if (this.t > IMPACT_DUR * 0.4) return null;
    return { x: this.x + 4, y: this.y + 4, w: IMPACT_FW - 8, h: IMPACT_FH - 8 };
  }
  draw(ctx, camera) {
    if (!this.sheet) return;
    const p = Math.min(0.999, this.t / IMPACT_DUR);
    const frame = Math.floor(p * 6);
    const dx = Math.round(this.x - camera.x);
    const dy = Math.round(this.y - camera.y);
    ctx.drawImage(this.sheet, frame * IMPACT_FW, 0, IMPACT_FW, IMPACT_FH,
                  dx, dy, IMPACT_FW, IMPACT_FH);
  }
}

export class Burning {
  constructor(x, y, assets) {
    this.kind = "burning";
    this.x = x - BURN_FW / 2;
    this.y = y - BURN_FH / 2 + 4;
    this.w = BURN_FW;
    this.h = BURN_FH - 4;
    this.t = 0;
    this.dead = false;
    this.sheet = assets?.images?.["fx_burn.png"] || null;
    this.tickAccum = 0;
  }
  update(dt) {
    this.t += dt;
    this.tickAccum += dt;
    if (this.t >= BURN_DUR) this.dead = true;
  }
  // tick once every 0.3s for DoT
  consumeTick() {
    if (this.tickAccum >= 0.3) {
      this.tickAccum = 0;
      return true;
    }
    return false;
  }
  draw(ctx, camera) {
    const dx = Math.round(this.x - camera.x);
    const dy = Math.round(this.y - camera.y);
    if (this.sheet) {
      const frame = ((this.t * 10) | 0) % 4;
      const fadeOut = this.t > BURN_DUR - 0.3;
      if (fadeOut) ctx.globalAlpha = Math.max(0, (BURN_DUR - this.t) / 0.3);
      ctx.drawImage(this.sheet, frame * BURN_FW, 0, BURN_FW, BURN_FH,
                    dx, dy, BURN_FW, BURN_FH);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#e54b4b";
      ctx.fillRect(dx + 4, dy + 4, 6, 6);
    }
  }
}
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
