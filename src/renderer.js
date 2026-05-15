// Pixel-perfect renderer: draws to a low-res offscreen canvas, then scales
// up with nearest-neighbor to the visible canvas. Integer scale factor only.
export class Renderer {
  constructor(displayCanvas, viewW, viewH) {
    this.display = displayCanvas;
    this.dctx = displayCanvas.getContext("2d");
    this.viewW = viewW;
    this.viewH = viewH;

    this.buffer = document.createElement("canvas");
    this.buffer.width = viewW;
    this.buffer.height = viewH;
    this.bctx = this.buffer.getContext("2d");
    this.bctx.imageSmoothingEnabled = false;
    this.dctx.imageSmoothingEnabled = false;

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const margin = 80;
    const scale = Math.max(
      1,
      Math.floor(Math.min(
        (window.innerWidth - 32) / this.viewW,
        (window.innerHeight - margin) / this.viewH
      ))
    );
    this.scale = scale;
    this.display.width = this.viewW * scale;
    this.display.height = this.viewH * scale;
    this.dctx.imageSmoothingEnabled = false;
  }

  begin(clearColor) {
    this.bctx.fillStyle = clearColor;
    this.bctx.fillRect(0, 0, this.viewW, this.viewH);
    return this.bctx;
  }

  present() {
    this.dctx.drawImage(this.buffer, 0, 0, this.display.width, this.display.height);
  }
}
