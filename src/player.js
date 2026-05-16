// Top-down player: 4-direction movement, AABB collision against tilemap,
// simple animation, attack with cooldown, hurt iframes.
//
// Uses assets.images["mage_sheet.png"] when available — a 4x4 sheet of 32x32
// frames. Row mapping: 0=down, 1=left (mirrored for right), 3=up.
const SPRITE_SIZE = 32;
const ROW = { down: 0, left: 1, right: 1, up: 3 };
const CAST_DUR = 0.40;       // total cast animation length (s)
const CAST_FIRE_AT = 0.20;   // moment the bolt spawns within the cast
const MELEE_DUR = 0.32;      // total melee swing length (s)
const MELEE_HIT_START = 0.14;
const MELEE_HIT_END = 0.24;  // active damage window
const DEATH_DUR = 1.2;       // full death animation (8 frames)
const DEATH_LINGER = 0.8;    // corpse stays before respawn

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
    this.castSheet = assets?.images?.["mage_cast.png"] || null;
    this.deathSheet = assets?.images?.["mage_death.png"] || null;
    this.meleeSheet = assets?.images?.["mage_melee.png"] || null;
    this.chargeSheet = assets?.images?.["fx_charge.png"] || null;
    this.sheet = this.walkSheet; // fallback gate for procedural draw
    this.idleTime = 0;
    this.castTime = 0;       // 0 = not casting, advances to CAST_DUR
    this.castFired = false;  // bolt spawned this cast
    this.meleeTime = 0;      // 0 = not swinging, advances to MELEE_DUR
    this.meleeHit = new Set(); // slimes already hit by current swing
    this.dyingTime = 0;      // 0 = alive, >0 = dying
    this.spawnX = x;
    this.spawnY = y;
  }

  hurt(n) {
    if (this.iframes > 0 || this.dyingTime > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.iframes = 1.0;
    if (this.hp === 0) {
      this.dyingTime = 0.0001;
      this.castTime = 0;
      this.attackCd = 0;
    }
  }

  update(dt, input, map, world) {
    if (this.dyingTime > 0) {
      this.dyingTime += dt;
      if (this.dyingTime >= DEATH_DUR + DEATH_LINGER) {
        // respawn
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.hp = this.maxHp;
        this.dyingTime = 0;
        this.iframes = 1.0;
        this.facing = "down";
      }
      return;
    }
    this.iframes = Math.max(0, this.iframes - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);

    const idle = this.castTime === 0 && this.meleeTime === 0 && this.attackCd === 0;
    // start a melee swing
    if (input.pressed("melee") && idle) {
      this.meleeTime = 0.0001;
      this.meleeHit.clear();
      this.attackCd = MELEE_DUR + 0.05;
    } else if (input.pressed("magic") && idle) {
      this.castTime = 0.0001;
      this.castFired = false;
      this.attackCd = CAST_DUR + 0.10;
    }

    if (this.castTime > 0) {
      this.castTime += dt;
      if (!this.castFired && this.castTime >= CAST_FIRE_AT) {
        this.castFired = true;
        if (world) world.spawnBolt(this);
      }
      if (this.castTime >= CAST_DUR) this.castTime = 0;
    }
    if (this.meleeTime > 0) {
      this.meleeTime += dt;
      if (this.meleeTime >= MELEE_DUR) this.meleeTime = 0;
    }
    this.attacking = this.meleeTime > 0; // back-compat flag

    const a = input.axis();
    let mx = a.x, my = a.y;
    if (mx && my) { mx *= 0.7071; my *= 0.7071; }
    // movement slows during cast / melee
    if (this.castTime > 0) { mx *= 0.25; my *= 0.25; }
    if (this.meleeTime > 0) { mx *= 0.45; my *= 0.45; }

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

    // death takes priority over flicker / regular draw
    if (this.dyingTime > 0 && this.deathSheet) {
      this._drawDeath(ctx, px, py);
      return;
    }

    // flicker during iframes
    if (this.iframes > 0 && (this.iframes * 20 | 0) % 2 === 0) return;

    // sprite-based draw using the mage sheet, when loaded
    if (this.sheet) {
      this._drawSprite(ctx, px, py);
      // draw charge FX above the player during cast wind-up
      if (this.castTime > 0 && this.castTime < CAST_FIRE_AT && this.chargeSheet) {
        this._drawChargeFX(ctx, px, py);
      }
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

  _drawChargeFX(ctx, px, py) {
    const FW = 24, FH = 24;
    const p = Math.min(0.999, this.castTime / CAST_FIRE_AT);
    const frame = Math.floor(p * 4);
    // staff tip offset by facing
    let cx = px + this.w / 2 - FW / 2;
    let cy = py - 8;
    if (this.facing === "left")  { cx -= 8; cy += 4; }
    if (this.facing === "right") { cx += 8; cy += 4; }
    if (this.facing === "up")    { cy -= 2; }
    ctx.drawImage(this.chargeSheet, frame * FW, 0, FW, FH, Math.round(cx), Math.round(cy), FW, FH);
  }

  // Hit rect for the melee swing during its active frame. Returns null when
  // the swing is not in its damage window.
  meleeHitRect() {
    if (this.meleeTime < MELEE_HIT_START || this.meleeTime > MELEE_HIT_END) return null;
    const reach = 10;
    if (this.facing === "down")  return { x: this.x - 2, y: this.y + this.h, w: this.w + 4, h: reach };
    if (this.facing === "up")    return { x: this.x - 2, y: this.y - reach, w: this.w + 4, h: reach };
    if (this.facing === "left")  return { x: this.x - reach, y: this.y - 2, w: reach, h: this.h + 4 };
    return { x: this.x + this.w, y: this.y - 2, w: reach, h: this.h + 4 };
  }

  _drawDeath(ctx, px, py) {
    const p = Math.min(0.999, this.dyingTime / DEATH_DUR);
    const frame = Math.min(7, Math.floor(p * 8));
    const sx = frame * SPRITE_SIZE;
    const dx = Math.round(px + (this.w - SPRITE_SIZE) / 2);
    const dy = Math.round(py + this.h - SPRITE_SIZE + 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(px + 1, py + this.h - 1, this.w - 2, 2);
    ctx.drawImage(
      this.deathSheet,
      sx, 0, SPRITE_SIZE, SPRITE_SIZE,
      dx, dy, SPRITE_SIZE, SPRITE_SIZE
    );
  }

  _drawSprite(ctx, px, py) {
    const casting = this.castTime > 0 && this.castSheet;
    const meleeing = this.meleeTime > 0 && this.meleeSheet;
    const moving = this.anim > 0;
    let sheet, frame;
    if (meleeing) {
      sheet = this.meleeSheet;
      const p = Math.min(0.999, this.meleeTime / MELEE_DUR);
      frame = Math.floor(p * 4);
    } else if (casting) {
      sheet = this.castSheet;
      const p = Math.min(0.999, this.castTime / CAST_DUR);
      frame = Math.floor(p * 4);
    } else if (!moving && this.idleSheet) {
      sheet = this.idleSheet;
      frame = ((this.idleTime * 3) | 0) % 4;
    } else {
      sheet = this.walkSheet;
      frame = ((this.anim | 0) % 4);
    }
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

  }
}
