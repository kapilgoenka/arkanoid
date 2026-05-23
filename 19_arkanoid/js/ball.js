// PROMPT:
//
// Ball entity for Arkanoid. Handles position, velocity, wall bouncing,
// drawing, and launch mechanics. 88-char line limit.
//

class Ball {
  constructor(x, y, radius = 8) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = 5;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
  }

  launch() {
    if (this.launched) return;
    this.launched = true;
    // Slight random angle left or right of straight up
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    this.vx = Math.sin(angle) * this.speed;
    this.vy = -Math.cos(angle) * this.speed;
  }

  resetTo(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
  }

  setSpeed(newSpeed) {
    if (!this.launched) { this.speed = newSpeed; return; }
    const ratio = newSpeed / this.speed;
    this.vx *= ratio;
    this.vy *= ratio;
    this.speed = newSpeed;
  }

  update(dt, canvasWidth) {
    if (!this.launched) return;

    const scale = dt / 16.67; // normalise to 60 FPS
    this.x += this.vx * scale;
    this.y += this.vy * scale;

    // Left / right walls
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > canvasWidth) {
      this.x = canvasWidth - this.radius;
      this.vx = -Math.abs(this.vx);
    }

    // Top wall
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  // Returns true when ball has exited below the canvas (life lost)
  isLost(canvasHeight) {
    return this.y - this.radius > canvasHeight;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.closePath();
  }
}
