// 敌机类型定义
const EnemyTypes = {
  SCOUT: {
    id: 'scout',
    name: '侦察机',
    color: '#4caf50',
    shapeColor: '#388e3c',
    size: 'small',
    width: 60,
    height: 60,
    difficulty: 'easy',
    score: 1,
    weight: 50
  },
  BOMBER: {
    id: 'bomber',
    name: '轰炸机',
    color: '#2196f3',
    shapeColor: '#1565c0',
    size: 'medium',
    width: 74,
    height: 74,
    difficulty: 'medium',
    score: 2,
    weight: 30
  },
  FIGHTER: {
    id: 'fighter',
    name: '战斗机',
    color: '#f44336',
    shapeColor: '#b71c1c',
    size: 'large',
    width: 86,
    height: 86,
    difficulty: 'hard',
    score: 3,
    weight: 20
  }
};

// 获取所有敌机类型的列表（按权重）
const EnemyTypeList = Object.values(EnemyTypes);

// 按分数动态计算敌机权重
//  ≤5分: 100% easy
//  5~70: easy³快速下降（41分起≤10%）, hard²缓升, medium中间凸起
//  ≥70: 100% hard
function getScoreWeights(score) {
  if (score <= 5) return { easy: 100, medium: 0, hard: 0 };
  if (score >= 70) return { easy: 0, medium: 0, hard: 100 };
  const t = (score - 5) / 65; // 0~1
  const easy = Math.round(100 * (1 - t) * (1 - t) * (1 - t));
  const hard = Math.round(100 * t * t);
  const medium = 100 - easy - hard;
  return { easy, medium, hard };
}

// 按分数动态权重随机抽取敌机类型（独立函数，传入分数传出类型）
function pickEnemyType(score) {
  const weights = getScoreWeights(score);
  
  const weightedList = EnemyTypeList.map(t => ({
    type: t,
    weight: t.id === 'scout' ? weights.easy :
            t.id === 'bomber' ? weights.medium :
            weights.hard
  }));
  
  const totalWeight = weightedList.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight <= 0) return EnemyTypeList[0];
  
  let r = Math.random() * totalWeight;
  for (const entry of weightedList) {
    r -= entry.weight;
    if (r <= 0) return entry.type;
  }
  return EnemyTypeList[0];
}

// 兼容旧接口
function randomEnemyType() {
  const score = typeof Game !== 'undefined' ? Game.score : 0;
  return pickEnemyType(score);
}

// ========== EnemyManager ==========
const EnemyManager = {
  // 敌机实例列表
  enemies: [],
  // 出兵冷却（回合数）
  spawnCooldown: 0,
  // 最大敌机数
  maxEnemies: 4,
  // 格子数（后台概念：第5格=出生点，第1格=攻击线）
  totalColumns: 4,
  totalRows: 3,
  // 自增ID
  _nextId: 1,

  // 初始化/重置
  reset() {
    this.enemies = [];
    this.spawnCooldown = 0;
    this._nextId = 1;
  },

  // ---- 出兵检查与生成 ----
  spawnPhase() {
    const aliveCount = this.getAliveCount();

    if (aliveCount === 0) {
      // 场上无任何敌机 -> 强制出1架
      this.spawnOne();
      this.spawnCooldown = 2;
      return true;
    }

    if (aliveCount >= this.maxEnemies) {
      // 已达上限，冷却保持为0直至有空位
      this.spawnCooldown = 0;
      return false;
    }

    // 场上有敌机但未达上限
    if (this.spawnCooldown === 0) {
      this.spawnOne();
      this.spawnCooldown = 2;
      return true;
    } else {
      this.spawnCooldown--;
      return false;
    }
  },

  // 生成一架敌机
  spawnOne() {
    // 随机选择航线（行）
    const row = Math.floor(Math.random() * this.totalRows);
    // 从第5格（出生点）出现
    const col = this.totalColumns;

    const type = randomEnemyType();
    if (typeof SoundFX !== 'undefined') SoundFX.spawn();
    const enemy = {
      id: this._nextId++,
      type: type,
      col: col,        // 5 = 出生点
      row: row,        // 0-2 航线
      alive: true
    };
    this.enemies.push(enemy);
    return enemy;
  },

  // ---- 所有敌机左移一格 (移动阶段在出兵阶段之前, 故刚生成的敌机不受影响) ----
  movePhase() {
    let moved = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.moveFromCol = e.col;  // 保存旧列号，用于滑动插值
      e.col--;
      moved = true;
    }
    return moved;
  },

  // ---- 攻击判定：检查第1格的敌机 ----
  // 注意：不再立即设置 alive=false，由攻击动画的 flash 阶段结束后负责移除
  attackPhase() {
    // 找到所有在第1格存活的敌机，按出现顺序（id升序）
    const attackers = this.enemies
      .filter(e => e.alive && e.col <= 1)
      .sort((a, b) => a.id - b.id);

    // 浅拷贝一份返回（攻击动画阶段会引用这些对象，动画结束才移除）
    return attackers.slice();
  },

  // ---- 查询存活敌机 ----
  getAliveEnemies() {
    return this.enemies.filter(e => e.alive);
  },

  getAliveCount() {
    return this.getAliveEnemies().length;
  },

  // ---- 清除死亡敌机 ----
  cleanup() {
    this.enemies = this.enemies.filter(e => e.alive);
  },

};
