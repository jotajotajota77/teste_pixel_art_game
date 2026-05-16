import { Renderer } from "./renderer.js";
import { Input } from "./input.js";
import { Camera } from "./camera.js";
import { Tilemap } from "./tilemap.js";
import { Player } from "./player.js";
import { Slime, Coin, MagicBolt, Impact, Burning } from "./entities.js";
import { loadAssets } from "./assets.js";

const TILE = 16;
const VIEW_W = 320;
const VIEW_H = 180;

const renderer = new Renderer(document.getElementById("screen"), VIEW_W, VIEW_H);
const input = new Input();
input.bindTouch();
const camera = new Camera(VIEW_W, VIEW_H);

let assets, map, player, entities, debug = false, coinsCollected = 0;

const world = {
  spawnBolt(p) { entities.push(new MagicBolt(p, assets)); },
  spawnImpact(x, y) { entities.push(new Impact(x, y, assets)); },
  spawnBurning(x, y) { entities.push(new Burning(x, y, assets)); },
};

function buildLevel() {
  map = Tilemap.generate(50, 30, TILE);
  player = new Player(map.spawn.x, map.spawn.y, assets);
  entities = [];
  for (const p of map.coinSpots) entities.push(new Coin(p.x, p.y, assets));
  for (const p of map.enemySpots) entities.push(new Slime(p.x, p.y, assets));
  camera.snapTo(player.x, player.y);
  coinsCollected = 0;
}

async function start() {
  assets = await loadAssets();
  buildLevel();

  let last = performance.now();
  const STEP = 1000 / 60;
  let acc = 0;

  function frame(now) {
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250;
    acc += dt;
    while (acc >= STEP) {
      update(STEP / 1000);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function update(dt) {
  if (input.pressed("F1")) debug = !debug;
  if (input.pressed("F2")) buildLevel();

  player.update(dt, input, map, world);

  for (const e of entities) e.update(dt, player, map);

  // bolt vs slime
  for (const b of entities) {
    if (b.dead || b.kind !== "bolt") continue;
    for (const s of entities) {
      if (s.dead || s.kind !== "slime") continue;
      if (aabb(b, s)) { s.dead = true; b.dead = true; break; }
    }
  }

  // melee swing vs slime
  const hit = player.meleeHitRect();
  if (hit) {
    for (const s of entities) {
      if (s.dead || s.kind !== "slime") continue;
      if (player.meleeHit.has(s)) continue;
      if (aabb(hit, s)) {
        s.dead = true;
        player.meleeHit.add(s);
      }
    }
  }

  // impact AOE damage to slimes
  for (const im of entities) {
    if (im.dead || im.kind !== "impact") continue;
    const r = im.damageRect();
    if (!r) continue;
    for (const s of entities) {
      if (s.dead || s.kind !== "slime") continue;
      if (im.damaged.has(s)) continue;
      if (aabb(r, s)) { s.dead = true; im.damaged.add(s); }
    }
  }

  // burning patch damages slimes overlapping it (DoT)
  for (const bn of entities) {
    if (bn.dead || bn.kind !== "burning") continue;
    if (!bn.consumeTick()) continue;
    for (const s of entities) {
      if (s.dead || s.kind !== "slime") continue;
      if (aabb(bn, s)) s.dead = true;
    }
  }

  // player pickups + damage
  for (const e of entities) {
    if (e.dead) continue;
    if (!aabb(player, e)) continue;
    if (e.kind === "coin") {
      e.dead = true;
      coinsCollected++;
    } else if (e.kind === "slime") {
      player.hurt(1);
    }
  }
  // when a bolt dies, spawn an impact at its position; when an impact dies,
  // leave a burning patch behind
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (!e.dead) continue;
    if (e.kind === "bolt") {
      world.spawnImpact(e.x + e.w / 2, e.y + e.h / 2);
    } else if (e.kind === "impact") {
      world.spawnBurning(e.x + 16, e.y + 16);
    }
    entities.splice(i, 1);
  }

  camera.follow(player.x + player.w / 2, player.y + player.h / 2, map.pixelW, map.pixelH);
  input.endFrame();
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function render() {
  const ctx = renderer.begin("#1c2030");
  map.draw(ctx, camera);

  // depth-sort entities + player by feet
  const drawList = [...entities, player].sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const e of drawList) e.draw(ctx, camera);

  if (debug) drawDebug(ctx);
  drawHud(ctx);
  renderer.present();
}

function drawHud(ctx) {
  // hearts
  for (let i = 0; i < player.maxHp; i++) {
    const filled = i < player.hp;
    const x = 4 + i * 10;
    drawHeart(ctx, x, 4, filled);
  }
  // coins
  ctx.fillStyle = "#fde36a";
  ctx.fillRect(VIEW_W - 28, 6, 6, 6);
  ctx.fillStyle = "#caa53b";
  ctx.fillRect(VIEW_W - 28, 11, 6, 1);
  ctx.fillStyle = "#fff";
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  ctx.fillText("x " + coinsCollected, VIEW_W - 20, 5);
}

function drawHeart(ctx, x, y, filled) {
  ctx.fillStyle = filled ? "#e54b4b" : "#3a2a2a";
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x + 5, y, 2, 1);
  ctx.fillRect(x, y + 1, 8, 3);
  ctx.fillRect(x + 1, y + 4, 6, 1);
  ctx.fillRect(x + 2, y + 5, 4, 1);
  ctx.fillRect(x + 3, y + 6, 2, 1);
}

function drawDebug(ctx) {
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 1;
  for (const e of [player, ...entities]) {
    ctx.strokeRect(
      Math.round(e.x - camera.x) + 0.5,
      Math.round(e.y - camera.y) + 0.5,
      e.w - 1,
      e.h - 1
    );
  }
  ctx.fillStyle = "#0f0";
  ctx.font = "8px monospace";
  ctx.fillText(`fps target 60  ent ${entities.length}  cam ${camera.x|0},${camera.y|0}`, 4, VIEW_H - 12);
}

start();
