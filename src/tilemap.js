// Simple tilemap with random "rooms + paths" generation, AABB collision query.
// Tile ids: 0 grass, 1 stone (solid), 2 water (solid), 3 path/dirt.
export class Tilemap {
  constructor(w, h, tile) {
    this.w = w;
    this.h = h;
    this.tile = tile;
    this.pixelW = w * tile;
    this.pixelH = h * tile;
    this.data = new Uint8Array(w * h);
    this.spawn = { x: tile * 2, y: tile * 2 };
    this.coinSpots = [];
    this.enemySpots = [];
  }

  static generate(w, h, tile) {
    const m = new Tilemap(w, h, tile);
    for (let i = 0; i < m.data.length; i++) m.data[i] = 0;

    // border walls
    for (let x = 0; x < w; x++) { m.data[x] = 1; m.data[(h - 1) * w + x] = 1; }
    for (let y = 0; y < h; y++) { m.data[y * w] = 1; m.data[y * w + (w - 1)] = 1; }

    // scatter stone clusters
    for (let i = 0; i < 30; i++) {
      const cx = 2 + (Math.random() * (w - 4)) | 0;
      const cy = 2 + (Math.random() * (h - 4)) | 0;
      const r = 1 + (Math.random() * 2) | 0;
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r && Math.random() > 0.3)
            m._set(cx + x, cy + y, 1);
    }

    // a small water pond
    const pcx = (w * 0.7) | 0, pcy = (h * 0.6) | 0;
    for (let y = -3; y <= 3; y++)
      for (let x = -4; x <= 4; x++)
        if ((x * x) / 16 + (y * y) / 9 <= 1) m._set(pcx + x, pcy + y, 2);

    // carve a path strip near center
    const py = (h / 2) | 0;
    for (let x = 1; x < w - 1; x++) {
      m._set(x, py, 3);
      m._set(x, py + 1, 3);
    }

    // pick spawn on grass
    m.spawn = m._findOpenTile();

    // place pickups + enemies
    for (let i = 0; i < 12; i++) {
      const p = m._findOpenTile();
      m.coinSpots.push({ x: p.x + 4, y: p.y + 4 });
    }
    for (let i = 0; i < 6; i++) {
      const p = m._findOpenTile();
      m.enemySpots.push({ x: p.x, y: p.y });
    }
    return m;
  }

  _set(x, y, v) {
    if (x <= 0 || y <= 0 || x >= this.w - 1 || y >= this.h - 1) return;
    this.data[y * this.w + x] = v;
  }

  _findOpenTile() {
    for (let i = 0; i < 200; i++) {
      const x = 2 + (Math.random() * (this.w - 4)) | 0;
      const y = 2 + (Math.random() * (this.h - 4)) | 0;
      if (!this.solidTile(x, y)) return { x: x * this.tile, y: y * this.tile };
    }
    return { x: this.tile * 2, y: this.tile * 2 };
  }

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 1;
    return this.data[y * this.w + x];
  }

  solidTile(tx, ty) {
    const v = this.tileAt(tx, ty);
    return v === 1 || v === 2;
  }

  // returns true if the world-space rect overlaps any solid tile
  rectSolid(x, y, w, h) {
    const t = this.tile;
    const x0 = Math.floor(x / t);
    const y0 = Math.floor(y / t);
    const x1 = Math.floor((x + w - 1) / t);
    const y1 = Math.floor((y + h - 1) / t);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.solidTile(tx, ty)) return true;
    return false;
  }

  draw(ctx, camera) {
    const t = this.tile;
    const x0 = Math.max(0, Math.floor(camera.x / t));
    const y0 = Math.max(0, Math.floor(camera.y / t));
    const x1 = Math.min(this.w - 1, Math.floor((camera.x + ctx.canvas.width) / t));
    const y1 = Math.min(this.h - 1, Math.floor((camera.y + ctx.canvas.height) / t));

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const v = this.data[ty * this.w + tx];
        const px = tx * t - Math.round(camera.x);
        const py = ty * t - Math.round(camera.y);
        drawTile(ctx, v, px, py, t, tx, ty);
      }
    }
  }
}

function drawTile(ctx, v, px, py, t, tx, ty) {
  if (v === 0) {
    // grass
    ctx.fillStyle = "#4f8a4a";
    ctx.fillRect(px, py, t, t);
    ctx.fillStyle = "#3f7a3a";
    // pseudo-noise dots, deterministic on tile coord
    const seed = (tx * 928371 + ty * 12849) | 0;
    for (let i = 0; i < 6; i++) {
      const r = (seed * (i + 1) * 2654435761) >>> 0;
      ctx.fillRect(px + (r % t), py + ((r >> 8) % t), 1, 1);
    }
  } else if (v === 1) {
    // stone
    ctx.fillStyle = "#6f7283";
    ctx.fillRect(px, py, t, t);
    ctx.fillStyle = "#494c5b";
    ctx.fillRect(px, py + t - 2, t, 2);
    ctx.fillRect(px + t - 2, py, 2, t);
    ctx.fillStyle = "#8c90a3";
    ctx.fillRect(px, py, t, 1);
    ctx.fillRect(px, py, 1, t);
  } else if (v === 2) {
    // water
    const phase = ((Date.now() / 600 + tx * 0.7 + ty * 0.5) | 0) % 2;
    ctx.fillStyle = "#3a5fbf";
    ctx.fillRect(px, py, t, t);
    ctx.fillStyle = "#5a8be0";
    ctx.fillRect(px + 2, py + 4 + phase, 4, 1);
    ctx.fillRect(px + 9, py + 10 - phase, 5, 1);
  } else if (v === 3) {
    // path / dirt
    ctx.fillStyle = "#a07a4f";
    ctx.fillRect(px, py, t, t);
    ctx.fillStyle = "#8a6438";
    const seed = (tx * 73 + ty * 19) | 0;
    for (let i = 0; i < 4; i++) {
      const r = (seed * (i + 3) * 2654435761) >>> 0;
      ctx.fillRect(px + (r % t), py + ((r >> 4) % t), 1, 1);
    }
  }
}
