// PROMPT:
//
// Particle system for Arkanoid brick destruction effects and ball trail.
// Particles fade and move outward; trail uses ghost positions. 88-char limit.
//

const particles = [];

class Particle {
  constructor(x, y, color) {
    this.x    = x;
    this.y    = y;
    this.vx   = (Math.random() - 0.5) * 5;
    this.vy   = (Math.random() - 0.5) * 5;
    this.life = 1.0;
    this.decay = 0.04 + Math.random() * 0.04;
    this.size  = 2 + Math.random() * 3;
    this.color = color;
  }

  update(dt) {
    const scale = dt / 16.67;
    this.x    += this.vx * scale;
    this.y    += this.vy * scale;
    this.life -= this.decay * scale;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle   = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx) {
  particles.forEach(p => p.draw(ctx));
}

// Ball trail — ring buffer of last 4 positions
const trail = [];
const TRAIL_LEN = 4;

function updateTrail(ball) {
  if (!ball.launched) { trail.length = 0; return; }
  trail.push({ x: ball.x, y: ball.y });
  if (trail.length > TRAIL_LEN) trail.shift();
}

function drawTrail(ctx, ballRadius) {
  trail.forEach((pos, i) => {
    const alpha = (i + 1) / (TRAIL_LEN + 1) * 0.35;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ballRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}
