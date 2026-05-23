// PROMPT:
//
// Paddle entity for Arkanoid. Keyboard (arrows/WASD) and mouse controls,
// boundary constraints, smooth per-frame movement. 88-char line limit.
//

const keys = new Set();

document.addEventListener('keydown', (e) => keys.add(e.code));
document.addEventListener('keyup',  (e) => keys.delete(e.code));

class Paddle {
  constructor(canvasWidth, canvasHeight) {
    this.width = 100;
    this.height = 12;
    this.x = (canvasWidth - this.width) / 2;
    this.y = canvasHeight - 40;
    this.speed = 7;
    this.canvasWidth = canvasWidth;
  }

  update(dt) {
    const scale = dt / 16.67;
    const moving =
      keys.has('ArrowLeft')  || keys.has('KeyA') ? -1 :
      keys.has('ArrowRight') || keys.has('KeyD') ?  1 : 0;

    this.x += moving * this.speed * scale;
    this.clamp();
  }

  trackMouse(mouseX) {
    this.x = mouseX - this.width / 2;
    this.clamp();
  }

  clamp() {
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > this.canvasWidth) {
      this.x = this.canvasWidth - this.width;
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#00cfff';
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 6);
    ctx.fill();
  }
}
