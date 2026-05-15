// Inspect a PNG sprite sheet: prints dimensions and a frame grid summary.
// Usage:  node tools/inspect-spritesheet.mjs <path.png> [frameW] [frameH]
import fs from "node:fs";

const [, , file, fwArg, fhArg] = process.argv;
if (!file) {
  console.error("usage: node tools/inspect-spritesheet.mjs <png> [frameW] [frameH]");
  process.exit(1);
}

const buf = fs.readFileSync(file);
if (buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  console.error("not a PNG file");
  process.exit(1);
}
// IHDR chunk starts at byte 8; width/height are in the next 13 bytes.
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const depth = buf[24];
const colorType = buf[25];

const COLOR = { 0: "grayscale", 2: "rgb", 3: "indexed", 4: "grayscale+alpha", 6: "rgba" }[colorType] || "?";
console.log(`file:   ${file}`);
console.log(`size:   ${w} x ${h}px`);
console.log(`format: ${depth}-bit ${COLOR}`);

const fw = Number(fwArg) || 16;
const fh = Number(fhArg) || 16;
if (w % fw === 0 && h % fh === 0) {
  console.log(`grid:   ${w / fw} cols x ${h / fh} rows  (frame ${fw}x${fh}, total ${(w / fw) * (h / fh)} frames)`);
} else {
  console.log(`grid:   does NOT tile evenly with frame ${fw}x${fh}`);
  console.log(`        try: ${suggestFrames(w, h).join(", ")}`);
}

function suggestFrames(w, h) {
  const out = [];
  for (const s of [8, 12, 16, 24, 32, 48, 64])
    if (w % s === 0 && h % s === 0) out.push(`${s}x${s}`);
  return out.length ? out : ["nenhum tamanho comum encaixa"];
}
