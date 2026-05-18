// Standalone animation viewer. Pick an action (idle / walk / melee / magic /
// death), a facing direction, and a slow-mo factor. Looping is automatic —
// one-shot actions retrigger after a short delay so the playback is hands-off.
import { Renderer } from "./renderer.js";
import { Camera } from "./camera.js";
import { Tilemap } from "./tilemap.js";
import { Player } from "./player.js";
import { MagicBolt, Impact, Burning } from "./entities.js";
import { loadAssets } from "./assets.js";

const TILE = 16;
const VIEW_W = 144;
const VIEW_H = 96;

const renderer = new Renderer(document.getElementById("screen"), VIEW_W, VIEW_H);
const camera = new Camera(VIEW_W, VIEW_H);
const phaseEl = document.getElementById("phase");

let assets, map, player, entities = [];
let mode = "breath";
let dir = "down";
let speed = 0.25;
let retriggerTimer = 0;

const world = {
  spawnBolt(p) { entities.push(new MagicBolt(p, assets)); },
  spawnImpact(x, y) { entities.push(new Impact(x, y, assets)); },
  spawnBurning(x, y) { entities.push(new Burning(x, y, assets)); },
};

const NO_INPUT = {
  pressed: () => false,
  down: () => false,
  axis: () => ({ x: 0, y: 0 }),
  endFrame: () => {},
};

function buildScene() {
  map = new Tilemap(12, 9, TILE);
  for (let i = 0; i < map.data.length; i++) map.data[i] = 0;
  // stone arena border so the bolt collides in any direction
  for (let x = 0; x < map.w; x++) { map.data[x] = 1; map.data[(map.h - 1) * map.w + x] = 1; }
  for (let y = 0; y < map.h; y++) { map.data[y * map.w] = 1; map.data[y * map.w + (map.w - 1)] = 1; }
  // dirt strip across the middle for a bit of variety
  const cy = (map.h / 2) | 0;
  for (let x = 1; x < map.w - 1; x++) map.data[cy * map.w + x] = 3;

  player = new Player(
    Math.round(map.w * TILE / 2 - 6),
    Math.round(map.h * TILE / 2 - 6),
    assets,
  );
  player.facing = dir;
  player.spawnX = player.x;
  player.spawnY = player.y;
  entities = [];
  camera.snapTo(player.x + player.w / 2, player.y + player.h / 2);
}

function setMode(newMode) {
  mode = newMode;
  retriggerTimer = 0;
  player.castTime = 0;
  player.castFired = false;
  player.meleeTime = 0;
  player.meleeHit.clear();
  player.attackCd = 0;
  player.iframes = 0;
  player.anim = 0;
  player.idleTime = 0;
  if (newMode !== "death") {
    player.dyingTime = 0;
    player.hp = player.maxHp;
    player.x = player.spawnX;
    player.y = player.spawnY;
  }
  for (const e of entities) e.dead = true;
  updateActiveButtons();
}

function setDir(newDir) {
  dir = newDir;
  player.facing = newDir;
  // restart current action so we see it from the new angle
  if (mode === "melee" || mode === "magic" || mode === "death") {
    setMode(mode);
  }
  updateActiveButtons();
}

function setSpeed(v) {
  speed = v;
  updateActiveButtons();
}

function updateActiveButtons() {
  document.querySelectorAll("button[data-mode]").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode));
  document.querySelectorAll("button[data-dir]").forEach(b =>
    b.classList.toggle("active", b.dataset.dir === dir));
  document.querySelectorAll("button[data-speed]").forEach(b =>
    b.classList.toggle("active", parseFloat(b.dataset.speed) === speed));
}

function tickMode(dt, realDt) {
  // keep facing aligned
  if (mode !== "walk") player.facing = dir;

  switch (mode) {
    case "breath":
      // player.update accumulates idleTime, which drives the breathing
      // animation from mage_idle.png (4-frame loop)
      break;
    case "walk":
      // sprite animates in place; we override anim each frame and restore
      // position after update so we don't drift into a wall
      player.facing = dir;
      player.anim = (player.anim + dt * 8);
      player.idleTime = 0;
      player.x = player.spawnX;
      player.y = player.spawnY;
      break;
    case "melee":
      if (player.meleeTime === 0 && player.dyingTime === 0) {
        retriggerTimer += realDt;
        if (retriggerTimer >= 0.5) {
          retriggerTimer = 0;
          player.meleeTime = 0.0001;
          player.meleeHit.clear();
          player.attackCd = 0.5;
        }
      }
      break;
    case "magic":
      if (player.castTime === 0 && player.dyingTime === 0) {
        retriggerTimer += realDt;
        // wait for the burning patch to fade before recasting
        const fxActive = entities.some(e =>
          e.kind === "bolt" || e.kind === "impact" || e.kind === "burning");
        if (!fxActive && retriggerTimer >= 0.7) {
          retriggerTimer = 0;
          player.castTime = 0.0001;
          player.castFired = false;
          player.attackCd = 1.0;
        }
      }
      break;
    case "death":
      if (player.dyingTime === 0) {
        retriggerTimer += realDt;
        if (retriggerTimer >= 0.8) {
          retriggerTimer = 0;
          player.hp = 1;
          player.hurt(1);
        }
      }
      break;
  }
}

function update(dt, realDt) {
  tickMode(dt, realDt);
  player.update(dt, NO_INPUT, map, world);
  for (const e of entities) e.update(dt, player, map);

  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (!e.dead) continue;
    if (e.kind === "bolt") world.spawnImpact(e.x + e.w / 2, e.y + e.h / 2);
    else if (e.kind === "impact") world.spawnBurning(e.x + 16, e.y + 16);
    entities.splice(i, 1);
  }
}

function render() {
  const ctx = renderer.begin("#1c2030");
  map.draw(ctx, camera);
  const drawList = [...entities, player].sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const e of drawList) e.draw(ctx, camera);
  renderer.present();
  // phase label outside the canvas
  if (phaseEl) phaseEl.textContent = currentPhase();
}

function currentPhase() {
  if (player.dyingTime > 0) return "DYING";
  if (player.castTime > 0 && player.castTime < 0.20) return "CHARGE";
  if (player.castTime > 0) return "RELEASE";
  if (player.meleeTime > 0) return "MELEE";
  for (const e of entities) {
    if (e.kind === "bolt") return "PROJECTILE";
    if (e.kind === "impact") return "IMPACT";
    if (e.kind === "burning") return "BURNING";
  }
  if (mode === "walk") return "WALK";
  return "BREATH";
}

async function start() {
  assets = await loadAssets();
  buildScene();

  document.querySelectorAll("button[data-mode]").forEach(b =>
    b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll("button[data-dir]").forEach(b =>
    b.addEventListener("click", () => setDir(b.dataset.dir)));
  document.querySelectorAll("button[data-speed]").forEach(b =>
    b.addEventListener("click", () => setSpeed(parseFloat(b.dataset.speed))));

  updateActiveButtons();

  let last = performance.now();
  function frame(now) {
    let realDt = (now - last) / 1000;
    last = now;
    if (realDt > 0.25) realDt = 0.25;
    const dt = realDt * speed;
    update(dt, realDt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
