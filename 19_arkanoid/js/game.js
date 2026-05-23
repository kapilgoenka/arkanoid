// PROMPT:
//
// Build a kid-friendly Arkanoid/Breakout game in vanilla HTML5 Canvas with
// ball physics, paddle controls, brick destruction, power-ups, sound effects,
// and a session history screen. 88-char line limit.
//

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STATES = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
  GAME_OVER: 'GAME_OVER',
  YOU_WIN: 'YOU_WIN',
  HISTORY: 'HISTORY',
};

const game = {
  state: STATES.TITLE,
  score: 0,
  lives: 3,
  level: 1,
  lastTime: 0,
  sessionStart: 0,
  bricksDestroyed: 0,
};

const paddle = new Paddle(canvas.width, canvas.height);
const balls  = [new Ball(canvas.width / 2, paddle.y - 10)];
let bricks   = buildLevel(0);
const powerUps = [];
const scoreRef = { value: 0 }; // object so collision.js can mutate by reference

function activeBalls() { return balls.filter(b => !b.isLost(canvas.height)); }

function resetBall() {
  balls.length = 0;
  balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - 10));
}

function startLevel(levelIndex) {
  game.level = levelIndex + 1;
  bricks = buildLevel(levelIndex);
  powerUps.length = 0;
  const speed = LEVEL_SPEEDS[levelIndex] ?? 7.2;
  balls.forEach(b => b.setSpeed(speed));
  resetBall();
}

function saveSession() {
  const duration = (Date.now() - game.sessionStart) / 1000;
  history.save(game.score, game.level, game.bricksDestroyed, duration);
}

function activatePowerUp(type) {
  activatePowerUpGlow();
  if (type === 'expand') {
    paddle.width = Math.min(paddle.width * 1.5, canvas.width * 0.6);
    setTimeout(() => { paddle.width = 100; clearPowerUpGlow(); }, 10000);
  } else if (type === 'multiball') {
    const ref = balls.find(b => b.launched) || balls[0];
    [-25, 25].forEach(deg => {
      const rad = deg * Math.PI / 180;
      const nb  = new Ball(ref.x, ref.y, ref.radius);
      nb.launched = true;
      nb.speed    = ref.speed;
      nb.vx = ref.vx * Math.cos(rad) - ref.vy * Math.sin(rad);
      nb.vy = ref.vx * Math.sin(rad) + ref.vy * Math.cos(rad);
      balls.push(nb);
    });
  } else if (type === 'life') {
    game.lives += 1;
  } else if (type === 'slow') {
    balls.forEach(b => b.setSpeed(b.speed * 0.7));
    setTimeout(() => balls.forEach(b => b.setSpeed(b.speed / 0.7)), 8000);
  }
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  paddle.trackMouse(e.clientX - rect.left);
  // Unlaunched ball tracks the paddle centre
  balls.forEach(b => { if (!b.launched) b.x = paddle.x + paddle.width / 2; });
});

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - game.lastTime, 50);
  game.lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  switch (game.state) {
    case STATES.TITLE:       drawTitle();         break;
    case STATES.PLAYING:     updatePlaying(dt);   break;
    case STATES.PAUSED:      drawPaused();        break;
    case STATES.LEVEL_COMPLETE: drawLevelComplete(); break;
    case STATES.GAME_OVER:   drawGameOver();      break;
    case STATES.YOU_WIN:     drawYouWin();        break;
    case STATES.HISTORY:     drawHistory();       break;
  }

  requestAnimationFrame(gameLoop);
}

function updatePlaying(dt) {
  ctx.fillStyle = '#111122';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  paddle.update(dt);
  balls.forEach(b => { b.update(dt, canvas.width); updateTrail(b); });
  powerUps.forEach(p => p.update(dt));
  updateParticles(dt);

  // Collisions
  const launchedBalls = balls.filter(b => b.launched);
  const prevScore = scoreRef.value;
  launchedBalls.forEach(b => {
    checkBrickCollisions(b, bricks, powerUps, scoreRef);
    checkPaddleCollision(b, paddle);
  });
  const scoreDelta = scoreRef.value - prevScore;
  game.bricksDestroyed += Math.round(scoreDelta / 10);
  // Spawn particles at destroyed bricks
  if (scoreDelta > 0) {
    bricks.filter(b => b.status === 0 && !b._sparked).forEach(b => {
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 10);
      b._sparked = true;
    });
  }
  checkPowerUpCollisions(powerUps, paddle, activatePowerUp);
  game.score = scoreRef.value;

  // Win check
  if (allBricksCleared(bricks)) {
    const nextIndex = game.level; // game.level is 1-based; next level index = current
    if (nextIndex >= LEVEL_MAPS.length) {
      saveSession();
      audio.levelComplete();
      game.state = STATES.YOU_WIN;
    } else {
      startLevel(nextIndex);
      audio.levelComplete();
      game.state = STATES.LEVEL_COMPLETE;
    }
    return;
  }

  // Life loss — remove lost balls
  const alive = activeBalls();
  if (balls.some(b => b.launched) && alive.length === 0) {
    game.lives -= 1;
    audio.lifeLost();
    if (game.lives <= 0) {
      saveSession();
      audio.gameOver();
      game.state = STATES.GAME_OVER;
    } else {
      resetBall();
    }
    return;
  }
  // Sync balls array to only living balls
  if (balls.some(b => b.launched)) {
    balls.length = 0;
    alive.forEach(b => balls.push(b));
    if (balls.length === 0) resetBall();
  }

  // Draw
  bricks.forEach(b => b.draw(ctx));
  drawParticles(ctx);
  powerUps.filter(p => p.active).forEach(p => p.draw(ctx));
  drawPaddleWithGlow(ctx, paddle);
  drawTrail(ctx, balls[0]?.radius ?? 8);
  balls.forEach(b => b.draw(ctx));
  drawHUD();
}

function drawHUD() {
  ctx.font = 'bold 16px Courier New';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Score: ${game.score}`, 10, 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#aaaaff';
  ctx.fillText(`Level ${game.level}`, canvas.width / 2, 20);

  ctx.textAlign = 'right';
  // Hearts for lives
  ctx.fillStyle = '#ff4444';
  ctx.fillText('♥'.repeat(game.lives), canvas.width - 10, 20);

  // Mute indicator
  if (audio.muted) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '13px Courier New';
    ctx.fillText('🔇 M', canvas.width - 10, canvas.height - 8);
  }
}

// Track whether any power-up is active (for paddle glow)
let _powerUpActive = false;

function activatePowerUpGlow() { _powerUpActive = true; }
function clearPowerUpGlow()    { _powerUpActive = false; }

function drawPaddleWithGlow(ctx, paddle) {
  if (_powerUpActive) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 18;
  }
  paddle.draw(ctx);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

function drawTitle() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#00cfff';
  ctx.font = 'bold 64px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('ARKANOID', canvas.width / 2, 220);

  ctx.fillStyle = '#ffffff';
  ctx.font = '22px Courier New';
  ctx.fillText('Press SPACE to Play', canvas.width / 2, 320);

  ctx.fillStyle = '#888';
  ctx.font = '16px Courier New';
  ctx.fillText('Press H for My Progress', canvas.width / 2, 370);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);

  ctx.font = '20px Courier New';
  ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 50);
}

function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 48px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = '#fff';
  ctx.font = '22px Courier New';
  ctx.fillText(`Score: ${game.score}`, canvas.width / 2, canvas.height / 2 + 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px Courier New';
  ctx.fillText(
    `Level ${game.level} starting — Press SPACE`,
    canvas.width / 2, canvas.height / 2 + 70
  );
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 56px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

  ctx.fillStyle = '#fff';
  ctx.font = '22px Courier New';
  ctx.fillText(`Score: ${game.score}`, canvas.width / 2, canvas.height / 2 + 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px Courier New';
  ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 80);
}

function drawYouWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffdd00';
  ctx.font = 'bold 56px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('YOU WIN! 🎉', canvas.width / 2, canvas.height / 2 - 30);

  ctx.fillStyle = '#fff';
  ctx.font = '22px Courier New';
  ctx.fillText(`Final Score: ${game.score}`, canvas.width / 2, canvas.height / 2 + 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px Courier New';
  ctx.fillText('Press R to play again', canvas.width / 2, canvas.height / 2 + 80);
}

function drawHistory() {
  drawHistoryScreen(ctx, canvas);
}

canvas.addEventListener('click', () => {
  if (game.state === STATES.PLAYING) balls.forEach(b => b.launch());
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (game.state === STATES.TITLE) {
      game.sessionStart = Date.now();
      game.bricksDestroyed = 0;
      game.state = STATES.PLAYING;
    } else if (game.state === STATES.PLAYING) {
      balls.forEach(b => b.launch());
    } else if (game.state === STATES.LEVEL_COMPLETE) {
      game.state = STATES.PLAYING;
    }
  }
  if (e.code === 'KeyP' && game.state === STATES.PLAYING) {
    game.state = STATES.PAUSED;
  } else if (e.code === 'KeyP' && game.state === STATES.PAUSED) {
    game.state = STATES.PLAYING;
  }
  if (e.code === 'KeyR' &&
      (game.state === STATES.GAME_OVER || game.state === STATES.YOU_WIN)) {
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    scoreRef.value = 0;
    powerUps.length = 0;
    paddle.width = 100;
    startLevel(0);
    game.state = STATES.TITLE;
  }
  if (e.code === 'KeyH' && game.state === STATES.TITLE) {
    game.state = STATES.HISTORY;
  }
  if (e.code === 'Escape' && game.state === STATES.HISTORY) {
    game.state = STATES.TITLE;
  }
});

// Mobile touch controls
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (game.state === STATES.TITLE) {
    game.sessionStart = Date.now();
    game.bricksDestroyed = 0;
    game.state = STATES.PLAYING;
  } else if (game.state === STATES.PLAYING) {
    balls.forEach(b => b.launch());
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (game.state !== STATES.PLAYING) return;
  const rect  = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x     = (touch.clientX - rect.left) * (canvas.width / rect.width);
  paddle.trackMouse(x);
  balls.forEach(b => { if (!b.launched) b.x = paddle.x + paddle.width / 2; });
}, { passive: false });

requestAnimationFrame((ts) => {
  game.lastTime = ts;
  requestAnimationFrame(gameLoop);
});
