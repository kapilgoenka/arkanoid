// PROMPT:
//
// Session history and progress comparison for Arkanoid. Saves each play
// session to localStorage, renders a My Progress screen on canvas with
// personal best, last 10 sessions table, and trend detection. 88-char limit.
//

const HISTORY_KEY  = 'arkanoid_sessions';
const MAX_SESSIONS = 50;

const history = {
  sessions: [],

  load() {
    try {
      this.sessions = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (_) {
      this.sessions = [];
    }
  },

  save(score, level, bricksDestroyed, durationSecs) {
    this.load();
    this.sessions.push({
      date: new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
      score,
      level,
      bricksDestroyed,
      duration: Math.round(durationSecs),
    });
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions.splice(0, this.sessions.length - MAX_SESSIONS);
    }
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.sessions));
    } catch (_) { /* storage full — silently skip */ }
  },

  personalBest() {
    if (!this.sessions.length) return null;
    return this.sessions.reduce(
      (best, s) => s.score > best.score ? s : best,
      this.sessions[0]
    );
  },

  lastN(n = 10) {
    return this.sessions.slice(-n).reverse();
  },

  // Returns true if the last 3 sessions show a strictly upward score trend
  isTrendingUp() {
    const recent = this.sessions.slice(-3);
    if (recent.length < 3) return false;
    return recent[0].score < recent[1].score && recent[1].score < recent[2].score;
  },
};

function drawHistoryScreen(ctx, canvas) {
  history.load();
  const best    = history.personalBest();
  const recent  = history.lastN(10);
  const W       = canvas.width;
  const H       = canvas.height;

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#00cfff';
  ctx.font = 'bold 32px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('MY PROGRESS', W / 2, 45);

  if (!best) {
    ctx.fillStyle = '#888';
    ctx.font = '18px Courier New';
    ctx.fillText('No sessions yet — play a game first!', W / 2, H / 2);
    ctx.fillStyle = '#555';
    ctx.font = '16px Courier New';
    ctx.fillText('Press ESC to go back', W / 2, H - 30);
    return;
  }

  // Personal best banner
  ctx.fillStyle = '#ffdd00';
  ctx.font = 'bold 18px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`★ Personal Best: ${best.score} pts`, 20, 80);
  ctx.fillStyle = '#888';
  ctx.font = '13px Courier New';
  ctx.fillText(`on ${best.date}  •  reached Level ${best.level}`, 20, 98);

  // Trend message
  if (history.isTrendingUp()) {
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText('You\'re improving! 📈', W - 20, 80);
  }

  // Table header
  const tableTop = 120;
  const rowH     = 38;
  ctx.fillStyle  = '#333355';
  ctx.fillRect(10, tableTop, W - 20, 22);
  ctx.fillStyle  = '#aaaaff';
  ctx.font       = 'bold 12px Courier New';
  ctx.textAlign  = 'left';
  const cols = [20, 160, 290, 410, 550];
  ['Date', 'Score', 'Level', 'Bricks', 'Time'].forEach((h, i) => {
    ctx.fillText(h, cols[i], tableTop + 15);
  });

  // Session rows
  recent.forEach((s, idx) => {
    const y        = tableTop + 22 + idx * rowH;
    const isPB     = s.score === best.score;
    const barWidth = Math.round(((s.score / best.score) * (W - 30)));

    // Row background
    ctx.fillStyle = isPB ? 'rgba(255,221,0,0.08)' : (idx % 2 === 0 ? '#111130' : '#0d0d28');
    ctx.fillRect(10, y, W - 20, rowH);

    // Progress bar (score vs personal best)
    ctx.fillStyle = isPB ? 'rgba(255,221,0,0.25)' : 'rgba(68,136,255,0.2)';
    ctx.fillRect(10, y, barWidth, rowH);

    // Star for personal best row
    ctx.fillStyle = isPB ? '#ffdd00' : '#aaa';
    ctx.font = isPB ? 'bold 13px Courier New' : '13px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(isPB ? `★ ${s.date}` : `  ${s.date}`, cols[0], y + 24);

    ctx.fillStyle = '#fff';
    ctx.fillText(s.score, cols[1], y + 24);
    ctx.fillText(s.level, cols[2], y + 24);
    ctx.fillText(s.bricksDestroyed, cols[3], y + 24);
    ctx.fillText(`${s.duration}s`, cols[4], y + 24);
  });

  ctx.fillStyle = '#555';
  ctx.font = '14px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('Press ESC to go back', W / 2, H - 16);
}
