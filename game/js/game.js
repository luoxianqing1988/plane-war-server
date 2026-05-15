// 游戏状态模块 (阶段三：答题系统)
const Game = {
  // 游戏状态
  state: 'idle',         // idle | playing | gameover
  round: 0,
  score: 0,

  // 回合子阶段
  phase: null,           // 'move' | 'spawn' | 'action' | 'attack' | 'check'
  phaseTimer: 0,
  phaseDuration: 0,
  actionResolved: false, // action阶段玩家是否已完成操作

  // 答题状态
  answering: false,
  answerData: {
    enemyId: null,
    question: null,
    timeRemaining: 10,
    timeMax: 10,
    startTime: 0,
    resolved: false,     // 是否已得出结果（答对/答错/超时）
    result: null,        // 'correct' | 'wrong' | 'timeout'
    pickedIndex: -1,     // 玩家点击的选项索引
    feedbackTimer: 0     // 结果显示停留帧数
  },

  // 上一回合攻击记录
  lastAttackResult: [],
  // 击杀动画状态
  killAnim: null,  // { phase, timer, enemyData, pixelX, pixelY }
  // 临时存储答对敌机信息（overlay关闭后启动动画）
  _pendingKillEnemy: null,

  // 攻击动画状态（敌机攻击基地）
  attackAnim: null, // { queue, currentIdx, timer, phase:'fly'|'hit' }
  // 攻击阶段是否已经有待处理的攻击者
  _attackProcessed: false,

  // ---- UI 元素引用 ----
  dom: {},

  // ---- 初始化UI引用 ----
  initUI() {
    this.dom = {
      scoreValue: document.getElementById('score-value'),
      hpValue: document.getElementById('hp-value'),
      battlefield: document.getElementById('battlefield'),
      overlay: document.getElementById('answer-overlay'),
      questionText: document.getElementById('question-text'),
      timerBar: document.getElementById('timer-bar'),
      timerText: document.getElementById('timer-text'),
      answerBtns: document.querySelectorAll('.answer-btn'),
      answerGrid: document.getElementById('answer-grid'),
      feedback: document.getElementById('answer-feedback'),
      gameoverOverlay: document.getElementById('gameover-overlay'),
      finalScore: document.getElementById('final-score'),
      bestScore: document.getElementById('best-score'),
      restartBtn: document.getElementById('restart-btn'),
      startOverlay: document.getElementById('start-overlay'),
      startBtn: document.getElementById('start-btn'),
      continueBtn: document.getElementById('continue-btn'),
      saveExitBtn: document.getElementById('save-exit-btn')
    };

    // 重启按钮事件
    this.dom.restartBtn.addEventListener('click', () => {
      this.clearSave();
      this.reset();
      this.startGame();
    });

    // 开始按钮事件
    this.dom.startBtn.addEventListener('click', () => {
      this.clearSave();
      this.hideStartOverlay();
      this.startGame();
    });

    // 继续挑战按钮事件
    this.dom.continueBtn.addEventListener('click', () => {
      this.loadGame();
    });

    // 保存退出按钮事件
    this.dom.saveExitBtn.addEventListener('click', () => {
      this.saveGame();
      this.reset();
      this.showStartOverlay();
      this.dom.saveExitBtn.classList.add('hidden');
    });
  },

  hideStartOverlay() {
    this.dom.startOverlay.classList.add('hidden');
  },

  showStartOverlay() {
    this.dom.startOverlay.classList.remove('hidden');
    // 检查是否有存档，显示/隐藏"继续挑战"按钮
    this.dom.continueBtn.classList.toggle('hidden', !this.hasSavedGame());
  },

  // ---- 更新UI ----
  updateUI() {
    this.dom.scoreValue.textContent = this.score;
    this.dom.hpValue.textContent = Base.hp;
  },

  // ---- 开始游戏 ----
  startGame() {
    this.reset();
    QuestionBank.generate();
    this.state = 'playing';
    this.dom.saveExitBtn.classList.remove('hidden');
    this.startNewRound();
  },

  reset() {
    this.state = 'idle';
    this.round = 0;
    this.score = 0;
    this.phase = null;
    this.phaseTimer = 0;
    this.actionResolved = false;
    this.answering = false;
    this.killAnim = null;
    this._pendingKillEnemy = null;
    this.attackAnim = null;
    this._attackProcessed = false;
    this.lastAttackResult = [];
    this.resetAnswerData();
    EnemyManager.reset();
    Base.reset();
    this.dom.saveExitBtn.classList.add('hidden');
    this.updateUI();
    this.hideOverlay();
    this.hideGameOver();
  },

  resetAnswerData() {
    this.answerData = {
      enemyId: null,
      question: null,
      timeRemaining: 10,
      timeMax: 10,
      startTime: 0,
      resolved: false,
      result: null,
      pickedIndex: -1,
      feedbackTimer: 0
    };
  },

  // ---- 新回合 ----
  startNewRound() {
    this.round++;
    this.phase = 'move';
    this.phaseTimer = 0;
    this.phaseDuration = 20;
    this.actionResolved = false;
    SoundFX.roundStart();
    this.log(`=== 第 ${this.round} 回合 ===`);
    this.updateUI();
  },

  // ---- 帧更新 ----
  update() {
    if (this.state !== 'playing') return;

    // 基地闪红计时递减
    if (Base.flashRedTimer > 0) {
      Base.flashRedTimer--;
    }

    // 如果正在答题，处理答题逻辑
    if (this.answering) {
      this.updateAnswering();
      return;
    }

    // 如果正在播放击杀动画（答题结束后播放）
    if (this.killAnim) {
      this.updateKillAnim();
      return;
    }

    // 回合状态机
    this.phaseTimer++;

    switch (this.phase) {
      case 'move': {
        if (this.phaseTimer === 1) {
          EnemyManager.movePhase();
          this.log(`[移动] ${this.enemyPositionSummary()}`);
        }
        if (this.phaseTimer >= this.phaseDuration) {
          this.phase = 'spawn';
          this.phaseTimer = 0;
          this.phaseDuration = 30;
          // 清理滑动插值状态
          for (const e of EnemyManager.enemies) e.moveFromCol = undefined;
          this.log('[出兵] 检查冷却...');
        }
        break;
      }

      case 'spawn': {
        if (this.phaseTimer === 1) {
          const spawned = EnemyManager.spawnPhase();
          this.log(spawned ? '[出兵] 新敌机登场' : `[出兵] 冷却=${EnemyManager.spawnCooldown}`);
        }
        if (this.phaseTimer >= this.phaseDuration) {
          this.phase = 'action';
          this.phaseTimer = 0;
          this.actionResolved = false;
          this.log('[行动] 点击敌机答题');
        }
        break;
      }

      case 'action': {
        // 等待玩家点击敌机开始答题（由 clickEnemy 触发）
        // 不设超时，玩家不答题则永久等待
        if (this.actionResolved) {
          this.phase = 'attack';
          this.phaseTimer = 0;
          this.phaseDuration = 50;
          this.log('[攻击] 检查第1格敌机...');
        }
        // 显示提示文字引导玩家点击
        this.drawActionHint();
        break;
      }

      case 'attack': {
        // 第1帧：获取攻击者
        if (this.phaseTimer === 1 && !this._attackProcessed) {
          const attackers = EnemyManager.attackPhase();
          this._attackProcessed = true;
          if (attackers.length > 0) {
            // 启动攻击动画序列
            this._startAttackAnim(attackers);
            this.log(`[攻击] ${attackers.length} 架敌机袭击基地！`);
          } else {
            this.log('[攻击] 无敌机抵达');
          }
        }

        // 如果正在播放攻击动画，更新它
        if (this.attackAnim) {
          this._updateAttackAnim();
        }

        // 无动画 或 动画已完成 → 计时结束进入下一阶段
        if (!this.attackAnim && this.phaseTimer >= this.phaseDuration) {
          this.phase = 'check';
          this.phaseTimer = 0;
          this._attackProcessed = false;
        }
        break;
      }

      case 'check': {
        if (this.phaseTimer === 1) {
          EnemyManager.cleanup();
          this.log(`[状态] 场上存活: ${EnemyManager.getAliveCount()} 架`);
          if (!Base.isAlive) {
            this.state = 'gameover';
            this.log('=== 游戏结束！===');
            this.showGameOver();
            return;
          }
        }
        if (this.phaseTimer >= this.phaseDuration) {
          this.startNewRound();
        }
        break;
      }
    }

    this.updateUI();
  },

  // ---- 绘制行动提示 -----
  drawActionHint() {
    // 用 Canvas 提示 "点击敌机答题"
    const canvas = this.dom.battlefield;
    // 不直接画，后续由 renderer 处理
  },

  // ---- 游戏结束 ----
  showGameOver() {
    SoundFX.gameOver();
    const finalScore = this.score;
    const bestScore = parseInt(localStorage.getItem('planeWarBestScore') || '0');
    const newBest = finalScore > bestScore;

    if (newBest) {
      localStorage.setItem('planeWarBestScore', finalScore.toString());
    }

    this.dom.finalScore.textContent = finalScore;
    this.dom.bestScore.textContent = newBest ? finalScore : bestScore;
    this.dom.gameoverOverlay.classList.remove('hidden');
    this.dom.saveExitBtn.classList.add('hidden');
    this.clearSave();
  },

  hideGameOver() {
    this.dom.gameoverOverlay.classList.add('hidden');
  },

  // ========== 答题逻辑 ==========

  // ---- 玩家点击敌机 ----
  clickEnemy(enemyId) {
    if (this.state !== 'playing') return false;
    if (this.answering) return false;
    if (this.phase !== 'action') return false;
    if (this.actionResolved) return false;

    // 找到对应的敌机
    const enemies = EnemyManager.getAliveEnemies();
    const enemy = enemies.find(e => e.id === enemyId);
    if (!enemy) return false;

    // 开始答题
    this.startAnswering(enemy);
    return true;
  },

  // ---- 进入答题 ----
  startAnswering(enemy) {
    this.answering = true;
    SoundFX.clickEnemy();

    // 获取题目
    const question = QuestionBank.pick(enemy.type.difficulty);

    this.answerData.enemyId = enemy.id;
    this.answerData.question = question;
    this.answerData.timeRemaining = 10;
    this.answerData.timeMax = 10;
    this.answerData.startTime = Date.now();
    this.answerData.resolved = false;
    this.answerData.result = null;
    this.answerData.pickedIndex = -1;
    this.answerData.feedbackTimer = 0;

    // 显示覆盖层
    this.showOverlay(question);
    this.log(`[答题] ${question.a} ${question.op} ${question.b} = ?`);

    // Canvas变灰
    this.dom.battlefield.classList.add('grayscale');
  },

  // ---- 显示答题覆盖层 ----
  showOverlay(question) {
    const d = this.dom;
    d.questionText.textContent = `${question.a} ${question.op} ${question.b} = ?`;
    d.timerBar.style.width = '100%';
    d.timerBar.style.backgroundColor = '#4caf50';
    d.timerText.textContent = '10';
    d.feedback.classList.add('hidden');
    d.feedback.className = 'hidden';
    d.overlay.classList.remove('hidden');
    d.saveExitBtn.classList.add('hidden'); // 答题时隐藏保存按钮

    // 设置选项按钮
    d.answerBtns.forEach((btn, i) => {
      btn.textContent = question.options[i];
      btn.className = 'answer-btn';
      btn.disabled = false;
    });
  },

  // ---- 隐藏答题覆盖层 ----
  hideOverlay() {
    this.dom.overlay.classList.add('hidden');
    this.dom.battlefield.classList.remove('grayscale');
    if (this.state === 'playing') {
      this.dom.saveExitBtn.classList.remove('hidden');
    }
  },

  // ---- 答题帧更新 ----
  updateAnswering() {
    const ad = this.answerData;

    // 如果已得出结果，等待反馈时间后退出/播放动画
    if (ad.resolved) {
      ad.feedbackTimer--;

      if (ad.result === 'correct' && this._pendingKillEnemy) {
        // 正确：先让用户看到"✓ 正确！"，然后关闭 overlay，再启动击杀动画
        if (ad.feedbackTimer <= 0) {
          const enemyData = this._pendingKillEnemy;
          this._pendingKillEnemy = null;
          this.hideOverlay();
          this.answering = false;
          this.actionResolved = true;

          // 启动击杀动画
          const w = Renderer.width;
          const h = Renderer.height;
          const pos = Renderer.gridToPixel(enemyData.col, enemyData.row, w, h);
          this.killAnim = {
            phase: 'laser',
            timer: 0,
            enemyData: { id: enemyData.id, type: enemyData.type, col: enemyData.col, row: enemyData.row },
            pixelX: pos.x,
            pixelY: pos.y
          };
          this.log('[行动] 答题结束，击杀动画开始');
        }
      } else {
        // 错误/超时：反馈时间到后直接退出
        if (ad.feedbackTimer <= 0) {
          this.exitAnswering();
        }
      }
      return;
    }

    // 更新计时
    const elapsed = (Date.now() - ad.startTime) / 1000;
    ad.timeRemaining = Math.max(0, ad.timeMax - elapsed);

    // 更新UI
    const ratio = ad.timeRemaining / ad.timeMax;
    const pct = ratio * 100;
    this.dom.timerBar.style.width = pct + '%';

    // 颜色渐变：绿 → 黄 → 红
    if (ratio > 0.5) {
      const g = Math.floor(175 + 80 * (1 - ratio) * 2);
      this.dom.timerBar.style.backgroundColor = `rgb(76, ${g}, 50)`;
    } else {
      const r = Math.floor(76 + 168 * (1 - ratio * 2));
      this.dom.timerBar.style.backgroundColor = `rgb(${r}, ${Math.floor(175 * ratio * 2)}, 50)`;
    }

    this.dom.timerText.textContent = Math.ceil(ad.timeRemaining);

    // 超时检查
    if (ad.timeRemaining <= 0) {
      this.answerTimeout();
    }
  },

  // ---- 击杀动画更新 ----
  updateKillAnim() {
    const anim = this.killAnim;
    anim.timer++;

    if (anim.phase === 'laser') {
      // 激光飞行阶段 (~60帧 = 1秒)
      if (anim.timer >= 60) {
        anim.phase = 'explode';
        anim.timer = 0;
        SoundFX.killExplosion();
        this.log('[特效] 激光命中！');
      }
    } else if (anim.phase === 'explode') {
      // 爆炸阶段 (~30帧 = 0.5秒)
      if (anim.timer >= 30) {
        anim.phase = 'flash';
        anim.timer = 0;
      }
    } else if (anim.phase === 'flash') {
      // 闪烁阶段 (~60帧 = 1秒, 闪2下)
      if (anim.timer >= 60) {
        // 动画结束，移除敌机
        const enemy = EnemyManager.enemies.find(e => e.id === anim.enemyData.id);
        if (enemy) enemy.alive = false;
        this.killAnim = null;
        this.log('[特效] 击杀动画结束');
      }
    }
  },

  // ========== 攻击动画（敌机攻击基地） ==========
  // 每个敌机的攻击流程：fly(2s) → explode(0.33s) → hit(0.25s) → flash(2s)
  _startAttackAnim(attackers) {
    this.attackAnim = {
      queue: attackers.slice(),
      currentIdx: 0,
      timer: 0,
      phase: 'fly'
    };
  },

  _updateAttackAnim() {
    const anim = this.attackAnim;
    anim.timer++;

    const D = {
      fly: 120,     // 2秒光球飞行
      explode: 20,  // ~0.33秒爆炸特效
      hit: 120,     // 2秒基地扣血特效
      flash: 120    // 2秒敌机闪烁消失
    };

    const currentEnemy = anim.queue[anim.currentIdx];

    if (anim.phase === 'fly') {
      if (anim.timer >= D.fly) {
        anim.phase = 'explode';
        anim.timer = 0;
      }
    } else if (anim.phase === 'explode') {
      if (anim.timer >= D.explode) {
        // 爆炸结束：基地扣血 + 闪红
        Base.takeDamage(1);
        SoundFX.baseHit();
        this.updateUI();
        this.log(`[攻击] 基地受损! HP: ${Base.hp}/${Base.maxHp}`);

        if (!Base.isAlive) {
          // 基地被摧毁，立即结束攻击阶段
          this.attackAnim = null;
          this.phaseTimer = this.phaseDuration;
          return;
        }

        anim.phase = 'hit';
        anim.timer = 0;
      }
    } else if (anim.phase === 'hit') {
      if (anim.timer >= D.hit) {
        // 扣血特效结束，开始敌机闪烁
        anim.phase = 'flash';
        anim.timer = 0;
      }
    } else if (anim.phase === 'flash') {
      if (anim.timer >= D.flash) {
        // 闪烁结束：移除当前敌机
        const enemy = EnemyManager.enemies.find(e => e.id === currentEnemy.id);
        if (enemy) {
          enemy.alive = false;
        }

        anim.currentIdx++;
        if (anim.currentIdx < anim.queue.length) {
          // 下一架敌机攻击
          anim.phase = 'fly';
          anim.timer = 0;
        } else {
          // 全部攻击完成，强制结束攻击阶段
          this.attackAnim = null;
          this.phaseTimer = this.phaseDuration;
        }
      }
    }
  },

  // ---- 提交答案 ----
  submitAnswer(index) {
    const ad = this.answerData;
    if (ad.resolved) return;
    ad.pickedIndex = index;

    const question = ad.question;
    const isCorrect = (question.options[index] === question.answer);

    if (isCorrect) {
      // 答对了
      SoundFX.correct();
      ad.result = 'correct';
      ad.resolved = true;
      ad.feedbackTimer = 30; // 显示"✓ 正确！" 0.5秒后关闭

      // 标记按钮
      this.dom.answerBtns.forEach((btn, i) => {
        btn.disabled = true;
        if (question.options[i] === question.answer) {
          btn.classList.add('correct');
        }
      });

      // 显示反馈文字
      this.dom.feedback.textContent = '✓ 正确！';
      this.dom.feedback.className = 'correct-text';

      // 积分增加，暂存敌机信息（动画在overlay关闭后启动）
      const enemy = EnemyManager.getAliveEnemies().find(e => e.id === ad.enemyId);
      if (enemy) {
        this.score += enemy.type.score;
        this.log(`[击毁] ${enemy.type.name} +${enemy.type.score}分`);
        this._pendingKillEnemy = {
          id: enemy.id,
          type: enemy.type,
          col: enemy.col,
          row: enemy.row
        };
      }

    } else {
      // 答错了
      SoundFX.wrong();
      ad.result = 'wrong';
      ad.resolved = true;
      ad.feedbackTimer = 30; // ~0.5s 停留

      // 标记按钮
      this.dom.answerBtns.forEach((btn, i) => {
        btn.disabled = true;
        if (question.options[i] === question.answer) {
          btn.classList.add('correct');
        } else if (i === index) {
          btn.classList.add('wrong');
        }
      });

      // 显示反馈
      this.dom.feedback.textContent = `✗ 错误！正确答案是 ${question.answer}`;
      this.dom.feedback.className = 'wrong-text';
    }

    this.updateUI();
  },

  // ---- 超时 ----
  answerTimeout() {
    const ad = this.answerData;
    if (ad.resolved) return;

    ad.result = 'timeout';
    ad.resolved = true;
    ad.feedbackTimer = 30;

    // 禁用按钮
    this.dom.answerBtns.forEach(btn => { btn.disabled = true; });

    // 显示正确答案
    this.dom.answerBtns.forEach((btn, i) => {
      if (ad.question.options[i] === ad.question.answer) {
        btn.classList.add('correct');
      }
    });

    this.dom.feedback.textContent = `⏰ 时间到！答案是 ${ad.question.answer}`;
    this.dom.feedback.className = 'timeout-text';

    this.log('[超时] 答题超时');
  },

  // ---- 退出答题，继续回合 ----
  exitAnswering() {
    this.hideOverlay();
    this.answering = false;
    this.actionResolved = true;
    this.log('[行动] 答题结束');
  },

  // ========== 辅助 ==========

  enemyPositionSummary() {
    const alive = EnemyManager.getAliveEnemies();
    if (alive.length === 0) return '无';
    return alive.map(e => `#${e.id}(${e.type.id})第${e.col}格`).join(', ');
  },

  log() {}, // no-op（调试日志已移除）

  // ---- 更新调试信息 ----
  updateDebugInfo() {},

  // ========== 存档系统 ==========

  // ---- 查询是否存在存档 ----
  hasSavedGame() {
    return localStorage.getItem('planeWarSave') !== null;
  },

  // ---- 清除存档 ----
  clearSave() {
    localStorage.removeItem('planeWarSave');
  },

  // ---- 保存游戏 ----
  saveGame() {
    if (this.state !== 'playing') return;

    // 如果正在答题或播放动画，先清理到干净状态
    if (this.answering) {
      this.hideOverlay();
      this.answering = false;
      this.phase = 'action';
      this.phaseTimer = 0;
      this.actionResolved = false;
    }
    this.killAnim = null;
    this._pendingKillEnemy = null;
    this.attackAnim = null;
    this._attackProcessed = false;
    this.resetAnswerData();

    const saveData = {
      version: 1,
      round: this.round,
      score: this.score,
      phase: this.phase,
      phaseTimer: this.phaseTimer,
      phaseDuration: this.phaseDuration,
      actionResolved: this.actionResolved,
      baseHp: Base.hp,
      baseMaxHp: Base.maxHp,
      enemies: EnemyManager.enemies.filter(e => e.alive).map(e => ({
        id: e.id,
        typeId: e.type.id,
        col: e.col,
        row: e.row
      })),
      spawnCooldown: EnemyManager.spawnCooldown,
      nextId: EnemyManager._nextId,
      questionCursors: { ...QuestionBank._cursor }
    };

    localStorage.setItem('planeWarSave', JSON.stringify(saveData));
  },

  // ---- 加载存档 ----
  loadGame() {
    const raw = localStorage.getItem('planeWarSave');
    if (!raw) return false;

    const data = JSON.parse(raw);

    // 先重置到干净状态
    this.reset();
    QuestionBank.generate();

    // 恢复核心状态
    this.state = 'playing';
    this.round = data.round;
    this.score = data.score;
    this.phase = data.phase;
    this.phaseTimer = data.phaseTimer;
    this.phaseDuration = data.phaseDuration;
    this.actionResolved = data.actionResolved;

    // 攻击/动画阶段无法保存，跳到检查阶段
    if (this.phase === 'attack') {
      this.phase = 'check';
      this.phaseTimer = 0;
      this.phaseDuration = 20;
    }
    // 如果正处在答题状态，回退到行动阶段
    if (this.phase === 'action' && this.actionResolved) {
      this.actionResolved = false;
    }

    // 恢复基地血量
    Base.hp = data.baseHp;
    Base.maxHp = data.baseMaxHp;
    Base.flashRedTimer = 0;

    // 恢复敌机
    EnemyManager._nextId = data.nextId;
    EnemyManager.spawnCooldown = data.spawnCooldown;
    EnemyManager.enemies = data.enemies.map(e => ({
      id: e.id,
      type: EnemyTypes[e.typeId.toUpperCase()],
      col: e.col,
      row: e.row,
      alive: true
    }));

    // 恢复题库游标
    QuestionBank._cursor = { ...data.questionCursors };

    // 确保覆盖层关闭
    this.hideOverlay();
    this.hideGameOver();
    this.hideStartOverlay();
    this.dom.saveExitBtn.classList.remove('hidden');

    this.updateUI();
    return true;
  },

};
