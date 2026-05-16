// 音效模块 - 使用预录音频文件替换代码合成
const SoundFX = {
  _ctx: null,
  _buffers: {},

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

  // ---- 异步加载所有音频 ----
  init() {
    const ctx = this._getCtx();
    if (!ctx) return;

    const sounds = [
      'click_enemy', 'correct', 'wrong', 'explosion',
      'base_hit', 'game_over', 'round_start', 'spawn', 'victory'
    ];

    return Promise.all(sounds.map(name => {
      return fetch(`audio/${name}.wav`)
        .then(r => r.arrayBuffer())
        .then(buf => ctx.decodeAudioData(buf))
        .then(decoded => { this._buffers[name] = decoded; })
        .catch(() => {}); // 静默失败，降级为无音效
    }));
  },

  // ---- 播放音效 ----
  _play(name, volume) {
    if (!this._ctx || !this._buffers[name]) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    const src = this._ctx.createBufferSource();
    src.buffer = this._buffers[name];

    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(volume || 1.0, this._ctx.currentTime);

    src.connect(gain);
    gain.connect(this._ctx.destination);
    src.start();
  },

  // ---- 兼容旧接口 ----

  clickEnemy() { this._play('click_enemy', 0.7); },
  correct()     { this._play('correct', 0.8); },
  wrong()       { this._play('wrong', 0.7); },
  killExplosion() { this._play('explosion', 0.6); },
  baseHit()     { this._play('base_hit', 0.7); },
  gameOver()    { this._play('game_over', 0.8); },
  roundStart()  { this._play('round_start', 0.6); },
  spawn()       { this._play('spawn', 0.5); },
  victory()     { this._play('victory', 0.8); },
};

// 在 DOM 加载完成后初始化音效
document.addEventListener('DOMContentLoaded', () => {
  // 尝试在用户首次交互时初始化 AudioContext
  const initAudio = () => {
    SoundFX.init();
    document.removeEventListener('click', initAudio);
    document.removeEventListener('touchstart', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('touchstart', initAudio);
});
