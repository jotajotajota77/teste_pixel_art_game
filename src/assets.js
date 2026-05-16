// Asset loader: tries to fetch optional PNGs from /assets, but the game runs
// fine without any (entities draw procedurally). Add files to /assets and read
// them via assets.images[name].
const OPTIONAL = [
  "mage_sheet.png",
  "mage_idle.png",
  "mage_cast.png",
  "mage_death.png",
];

export async function loadAssets() {
  const images = {};
  await Promise.all(OPTIONAL.map(async (name) => {
    try {
      const img = await loadImage(`./assets/${name}`);
      images[name] = img;
    } catch {
      // missing asset is fine — procedural fallback is used
    }
  }));
  return { images };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
