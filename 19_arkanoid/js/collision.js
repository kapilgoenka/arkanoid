// PROMPT:
//
// Collision detection for Arkanoid. Ball-brick AABB, ball-paddle angle
// variation, win condition, life-loss detection. 88-char line limit.
//

const POWERUP_TYPES = ['expand', 'multiball', 'life', 'slow'];
const POWERUP_CHANCE = 0.2;

function checkBrickCollisions(ball, bricks, powerUps, scoreRef) {
  for (const brick of bricks) {
    if (brick.status === 0) continue;

    const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    const dx    = ball.x - nearX;
    const dy    = ball.y - nearY;

    if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

    // Determine which axis to reflect on
    const overlapX = (brick.w / 2) - Math.abs(ball.x - (brick.x + brick.w / 2));
    const overlapY = (brick.h / 2) - Math.abs(ball.y - (brick.y + brick.h / 2));
    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }

    brick.status = 0;
    scoreRef.value += 10;

    if (Math.random() < POWERUP_CHANCE) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      powerUps.push(new PowerUp(brick.x + brick.w / 2, brick.y, type));
    }

    break; // one brick per ball per frame prevents double-hits
  }
}

function checkPaddleCollision(ball, paddle) {
  if (ball.vy <= 0) return; // only check when moving downward

  const ballBottom  = ball.y + ball.radius;
  const paddleTop   = paddle.y;
  const paddleRight = paddle.x + paddle.width;

  if (
    ballBottom >= paddleTop &&
    ballBottom <= paddleTop + paddle.height + Math.abs(ball.vy) &&
    ball.x >= paddle.x &&
    ball.x <= paddleRight
  ) {
    // Map hit position 0..1 across paddle width → angle -60°..+60°
    const hitPos = (ball.x - paddle.x) / paddle.width;
    const angle  = (hitPos - 0.5) * (Math.PI * 2 / 3); // ±60°
    const speed  = ball.speed;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y  = paddleTop - ball.radius; // prevent sticking
    audio.paddleBounce();
  }
}

function checkPowerUpCollisions(powerUps, paddle, activateCallback) {
  for (const pu of powerUps) {
    if (!pu.active) continue;
    if (
      pu.y + pu.h >= paddle.y &&
      pu.x >= paddle.x - pu.w / 2 &&
      pu.x <= paddle.x + paddle.width + pu.w / 2
    ) {
      pu.active = false;
      activateCallback(pu.type);
      audio.powerUp();
    }
  }
}

function allBricksCleared(bricks) {
  return bricks.every(b => b.status === 0);
}
