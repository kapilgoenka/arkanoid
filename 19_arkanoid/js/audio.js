// PROMPT:
//
// Web Audio API sound manager for Arkanoid. Synthesizes all sounds via
// oscillators — no audio files needed. Mute toggle via M key.
//

const audio = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  play(freq, type, duration, endFreq = null) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (endFreq) {
      osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  },

  brickHit()      { this.play(500, 'square', 0.1); },
  paddleBounce()  { this.play(300, 'sine', 0.08); },
  lifeLost()      { this.play(400, 'sawtooth', 0.5, 150); },

  powerUp() {
    [261, 329, 392].forEach((f, i) => {
      setTimeout(() => this.play(f, 'sine', 0.15), i * 80);
    });
  },

  levelComplete() {
    [392, 494, 587].forEach((f, i) => {
      setTimeout(() => this.play(f, 'sine', 0.25), i * 100);
    });
  },

  gameOver() {
    [300, 250, 200, 150].forEach((f, i) => {
      setTimeout(() => this.play(f, 'sawtooth', 0.2), i * 150);
    });
  },

  toggleMute() { this.muted = !this.muted; },
};

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') audio.toggleMute();
});

['click', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, () => audio.init(), { once: true });
});
