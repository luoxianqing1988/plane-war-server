// 基地模块
const Base = {
  maxHp: 10,
  hp: 10,
  // 闪红效果计时
  flashRedTimer: 0,

  // 基地在画布上的相对位置 (百分比)
  xRatio: 0.12,
  yRatio: 0.5,

  get isAlive() {
    return this.hp > 0;
  },

  get isDamaged() {
    return this.hp <= 5 && this.hp > 0;
  },

  get isCritical() {
    return this.hp <= 2 && this.hp > 0;
  },

  // 受到一次攻击
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.flashRedTimer = 12; // ~0.2秒闪红
  },

  reset() {
    this.hp = this.maxHp;
    this.flashRedTimer = 0;
  }
};
