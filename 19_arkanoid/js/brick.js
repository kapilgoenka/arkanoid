// PROMPT:
//
// Brick and PowerUp entities for Arkanoid. Brick tracks status (active/
// destroyed). PowerUp drops from bricks and falls to paddle. 88-char limit.
//

const BRICK_W      = 72;
const BRICK_H      = 20;
const BRICK_PAD    = 4;
const BRICK_TOP    = 50;
const BRICK_LEFT   = 24;

class Brick {
  constructor(row, col, color) {
    this.row   = row;
    this.col   = col;
    this.color = color;
    this.x     = BRICK_LEFT + col * (BRICK_W + BRICK_PAD);
    this.y     = BRICK_TOP  + row * (BRICK_H + BRICK_PAD);
    this.w     = BRICK_W;
    this.h     = BRICK_H;
    this.status = 1; // 1 = active, 0 = destroyed
  }

  draw(ctx) {
    if (this.status === 0) return;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // Subtle highlight on top edge
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(this.x, this.y, this.w, 3);
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x     = x;
    this.y     = y;
    this.type  = type;   // 'expand' | 'multiball' | 'life' | 'slow'
    this.w     = 40;
    this.h     = 16;
    this.speed = 2.5;
    this.active = true;

    const META = {
      expand:   { color: '#22cc66', label: 'EX' },
      multiball: { color: '#00cfff', label: 'MB' },
      life:     { color: '#ff4444', label: '1UP' },
      slow:     { color: '#8888ff', label: 'SL' },
    };
    this.color = META[type].color;
    this.label = META[type].label;
  }

  update(dt) {
    this.y += this.speed * (dt / 16.67);
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(this.x - this.w / 2, this.y, this.w, this.h, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, this.x, this.y + 11);
  }
}
