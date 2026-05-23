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
};

const paddle = new Paddle(canvas.width, canvas.height);
const balls  = [new Ball(canvas.width / 2, paddle.y - 10)];
let bricks   = buildLevel(0);

function activeBalls() { return balls.filter(b => !b.isLost(canvas.height)); }

function resetBall() {
  balls.length = 0;
  balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - 10));
}

function startLevel(levelIndex) {
  game.level = levelIndex + 1;
  bricks = buildLevel(levelIndex);
  balls.forEach(b => b.setSpeed(LEVEL_SPEEDS[levelIndex] ?? 7.2));
  resetBall();
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
  balls.forEach(b => b.update(dt, canvas.width));

  // Remove lost balls; lose a life when the last one exits
  const alive = activeBalls();
  if (alive.length === 0) {
    game.lives -= 1;
    if (game.lives <= 0) {
      game.state = STATES.GAME_OVER;
    } else {
      resetBall();
    }
    return;
  }

  bricks.forEach(b => b.draw(ctx));
  paddle.draw(ctx);
  balls.forEach(b => b.draw(ctx));
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
  ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = '#fff';
  ctx.font = '20px Courier New';
  ctx.fillText('Press SPACE for next level', canvas.width / 2, canvas.height / 2 + 60);
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
  // Populated in KGO-25
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#00cfff';
  ctx.font = 'bold 36px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('MY PROGRESS', canvas.width / 2, 80);

  ctx.fillStyle = '#888';
  ctx.font = '18px Courier New';
  ctx.fillText('Press ESC to go back', canvas.width / 2, canvas.height - 40);
}

canvas.addEventListener('click', () => {
  if (game.state === STATES.PLAYING) balls.forEach(b => b.launch());
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (game.state === STATES.TITLE) {
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
    resetBall();
    game.state = STATES.TITLE;
  }
  if (e.code === 'KeyH' && game.state === STATES.TITLE) {
    game.state = STATES.HISTORY;
  }
  if (e.code === 'Escape' && game.state === STATES.HISTORY) {
    game.state = STATES.TITLE;
  }
});

requestAnimationFrame((ts) => {
  game.lastTime = ts;
  requestAnimationFrame(gameLoop);
});
