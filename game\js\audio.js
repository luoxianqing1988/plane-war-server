// 音效模块 - 使用 Web Audio API 合成，无需外部文件
const SoundFX = {
  _ctx: null,

  _getCtx() {
    if (!this._ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      this._ctx = new Ctor();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  },

  // ---- 基础合成工具 ----

  // 单音
  _tone(freq, duration, type, volume, delay) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  // 频率滑动
  _sweep(fromFreq, toFreq, duration, type, volume) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(fromFreq, t);
    osc.frequency.linearRampToValueAtTime(toFreq, t + duration);
    gain.gain.setValueAtTime(volume || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  // 白噪声
  _noise(duration, volume) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buffer = ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  },

  // ---- 公共音效接口 ----

  // 点中敌机（进入答题）
  clickEnemy() {
    this._sweep(500, 800, 0.1, 'sine', 0.2);
  },

  // 答题正确（上行琶音 C-E-G）
  correct() {
    this._tone(523, 0.12, 'sine', 0.25, 0);
    this._tone(659, 0.12, 'sine', 0.25, 0.1);
    this._tone(784, 0.18, 'sine', 0.25, 0.2);
  },

  // 答题错误（下降嗡嗡声）
  wrong() {
    this._sweep(300, 100, 0.3, 'sawtooth', 0.15);
  },

  // 敌机爆炸
  killExplosion() {
    this._noise(0.15, 0.25);
    this._tone(80, 0.3, 'sine', 0.2);
  },

  // 基地受攻击
  baseHit() {
    this._tone(120, 0.2, 'sine', 0.3);
    this._noise(0.1, 0.15);
  },

  // 游戏结束（下行三音）
  gameOver() {
    this._tone(400, 0.25, 'sine', 0.25, 0);
    this._tone(300, 0.25, 'sine', 0.2, 0.25);
    this._tone(200, 0.3, 'sine', 0.15, 0.5);
  },

  // 新回合
  roundStart() {
    this._sweep(500, 900, 0.15, 'sine', 0.15);
  },

  // 出兵
  spawn() {
    this._sweep(300, 600, 0.12, 'sine', 0.12);
    this._noise(0.06, 0.08);
  },
};
