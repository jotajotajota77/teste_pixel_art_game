// Top-down player: 4-direction movement, AABB collision against tilemap,
// simple animation, attack with cooldown, hurt iframes.
//
// Uses assets.images["mage_sheet.png"] when available — a 4x4 sheet of 32x32
// frames. Row mapping: 0=down, 1=left (mirrored for right), 3=up.
const SPRITE_SIZE = 32;
const ROW = { down: 0, left: 1, right: 1, up: 3 };

export class Player {
  constructor(x, y, assets) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.speed = 64; // px / sec
    this.facing = "down";
    this.anim = 0;
    this.maxHp = 4;
    this.hp = 4;
    this.iframes = 0;
    this.attackCd = 0;
    this.attacking = false;
    this.assets = assets;
    this.walkSheet = assets?.images?.["mage_sheet.png"] || null;
    this.idleSheet = assets?.images?.["mage_idle.png"] || null;
    this.sheet = this.walkSheet; // fallback gate for procedural draw
    this.idleTime = 0;
  }

  hurt(n) {
    if (this.iframes > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.iframes = 1.0;
    if (this.hp === 0) {
      // respawn
      this.hp = this.maxHp;
      this.iframes = 1.5;
    }
  }

  update(dt, input, map) {
    this.iframes = Math.max(0, this.iframes - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.attacking = this.attackCd > 0.18; // active during first ~180ms

    if (input.pressed("attack") && this.attackCd === 0) {
      this.attackCd = 0.30;
      this.attacking = true;
    }

    const a = input.axis();
    let mx = a.x, my = a.y;
    if (mx && my) { mx *= 0.7071; my *= 0.7071; }

    if (mx !== 0 || my !== 0) {
      if (Math.abs(mx) > Math.abs(my)) this.facing = mx > 0 ? "right" : "left";
      else this.facing = my > 0 ? "down" : "up";
      this.anim += dt * 8;
      this.idleTime = 0;
    } else {
      this.anim = 0;
      this.idleTime += dt;
    }

    // axis-separated collision
    const dx = mx * this.speed * dt;
    const dy = my * this.speed * dt;
    if (!map.rectSolid(this.x + dx, this.y, this.w, this.h)) this.x += dx;
    if (!map.rectSolid(this.x, this.y + dy, this.w, this.h)) this.y += dy;
  }

  draw(ctx, camera) {
    const px = Math.round(this.x - camera.x);
    const py = Math.round(this.y - camera.y);

    // flicker during iframes
    if (this.iframes > 0 && (this.iframes * 20 | 0) % 2 === 0) return;

    // sprite-based draw using the mage sheet, when loaded
    if (this.sheet) {
      this._drawSprite(ctx, px, py);
      return;
    }

    // --- procedural fallback below ---
    // body
    const skin = "#f0c89a";
    const tunic = "#3a8a4a";
    const tunicDark = "#27662f";
    const hair = "#3a2a1a";

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 1, py + this.h - 1, this.w - 2, 2);

    // body block
    ctx.fillStyle = tunic;
    ctx.fillRect(px + 2, py + 5, 8, 6);
    ctx.fillStyle = tunicDark;
    ctx.fillRect(px + 2, py + 10, 8, 1);

    // walking legs (frames)
    const f = (this.anim | 0) % 4;
    ctx.fillStyle = "#1a1a22";
    if (f === 0 || f === 2) {
      ctx.fillRect(px + 3, py + 11, 2, 1);
      ctx.fillRect(px + 7, py + 11, 2, 1);
    } else if (f === 1) {
      ctx.fillRect(px + 3, py + 11, 2, 1);
      ctx.fillRect(px + 7, py + 10, 2, 2);
    } else {
      ctx.fillRect(px + 3, py + 10, 2, 2);
      ctx.fillRect(px + 7, py + 11, 2, 1);
    }

    // head
    ctx.fillStyle = skin;
    ctx.fillRect(px + 3, py + 1, 6, 5);
    ctx.fillStyle = hair;
    ctx.fillRect(px + 3, py, 6, 2);
    if (this.facing === "left") ctx.fillRect(px + 3, py + 2, 1, 2);
    if (this.facing === "right") ctx.fillRect(px + 8, py + 2, 1, 2);

    // eyes
    ctx.fillStyle = "#000";
    if (this.facing === "down") {
      ctx.fillRect(px + 4, py + 3, 1, 1);
      ctx.fillRect(px + 7, py + 3, 1, 1);
    } else if (this.facing === "up") {
      // back of head, no eyes
    } else if (this.facing === "left") {
      ctx.fillRect(px + 4, py + 3, 1, 1);
    } else {
      ctx.fillRect(px + 7, py + 3, 1, 1);
    }

    // attack swipe
    if (this.attacking) {
      ctx.fillStyle = "#f5e9b0";
      const sx = this.facing === "left" ? px - 6 : this.facing === "right" ? px + this.w : px + 2;
      const sy = this.facing === "up" ? py - 6 : this.facing === "down" ? py + this.h : py + 4;
      const sw = (this.facing === "left" || this.facing === "right") ? 6 : 8;
      const sh = (this.facing === "up" || this.facing === "down") ? 6 : 8;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
    }
  }

  _drawSprite(ctx, px, py) {
    const moving = this.anim > 0;
    const useIdle = !moving && this.idleSheet;
    const sheet = useIdle ? this.idleSheet : this.walkSheet;
    // walk cycles 4 frames at ~8fps, idle cycles 4 frames at ~3fps (breathing)
    const frame = moving
      ? ((this.anim | 0) % 4)
      : ((this.idleTime * 3) | 0) % 4;
    const row = ROW[this.facing];
    const flip = this.facing === "right";

    const sx = frame * SPRITE_SIZE;
    const sy = row * SPRITE_SIZE;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 1, py + this.h - 1, this.w - 2, 2);

    // sprite is bottom-aligned: bottom of sprite at py + this.h
    const dx = px + (this.w - SPRITE_SIZE) / 2;
    const dy = py + this.h - SPRITE_SIZE + 2;

    if (flip) {
      ctx.save();
      ctx.translate(Math.round(dx + SPRITE_SIZE), Math.round(dy));
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
      ctx.restore();
    } else {
      ctx.drawImage(
        sheet, sx, sy, SPRITE_SIZE, SPRITE_SIZE,
        Math.round(dx), Math.round(dy), SPRITE_SIZE, SPRITE_SIZE
      );
    }

    if (this.attacking) {
      ctx.fillStyle = "rgba(255,240,160,0.9)";
      const ax = this.facing === "left" ? px - 6 : this.facing === "right" ? px + this.w : px + 2;
      const ay = this.facing === "up" ? py - 6 : this.facing === "down" ? py + this.h : py + 4;
      const aw = (this.facing === "left" || this.facing === "right") ? 6 : 8;
      const ah = (this.facing === "up" || this.facing === "down") ? 6 : 8;
      ctx.fillRect(ax, ay, aw, ah);
    }
  }
}
