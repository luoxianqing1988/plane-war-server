// 题库模块
//   easy   → 侦察机 (1分)   5以内加法（加数≤5，和≤5）
//   medium → 轰炸机 (2分)   5以内减法 + 5加几 + 几减5
//   hard   → 战斗机 (3分)   剩余全部加减法（结果≤10）
const QuestionBank = {
  // 题库按难度分三组，每组是 { a, b, op, answer } 的数组
  easy: [],   // 5以内加法（加数≤5，和≤5）
  medium: [], // 5以内减法 + 5加几 + 几减5
  hard: [],   // 剩余全部加减法（结果≤10）

  // 每组当前的抽取游标（不放回抽取）
  _cursor: { easy: 0, medium: 0, hard: 0 },

  // ---- 初始化：穷举生成全部题目 ----
  //   easy   : 5以内加法（加数≤5，和≤5）             → 侦察机 (1分)
  //   medium : 5以内减法 + 5加几 + 几减5（结果≤10） → 轰炸机 (2分)
  //   hard   : 剩余全部加减法（结果≤10）               → 战斗机 (3分)
  generate() {
    this.easy = [];
    this.medium = [];
    this.hard = [];

    // ---- 简单：5以内加法 ----
    // a + b ≤ 5，a ≥ 1，b ≥ 1
    for (let a = 1; a <= 5; a++) {
      for (let b = 1; b <= 5; b++) {
        if (a + b <= 5) {
          this.easy.push({ a, b, op: '+', answer: a + b });
        }
      }
    }

    // ---- 中等 ----
    // ① 5以内减法：减数 ≤ 5，结果 ≤ 5
    for (let a = 2; a <= 10; a++) {
      for (let b = 1; b <= Math.min(5, a - 1); b++) {
        if (a - b <= 5) {
          this.medium.push({ a, b, op: '−', answer: a - b });
        }
      }
    }
    // ② 5加几：5 + b，和 ≤ 10
    for (let b = 1; b <= 5; b++) {
      this.medium.push({ a: 5, b, op: '+', answer: 5 + b });
    }
    // ③ 几减5：a - 5，结果 ≤ 10
    for (let a = 6; a <= 10; a++) {
      this.medium.push({ a, b: 5, op: '−', answer: a - 5 });
    }

    // ---- 困难：剩余全部加减法（结果 ≤ 10） ----
    // 加法：排除 easy（和≤5）和 medium（a=5）
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 10 - a; b++) {
        if (a + b > 5 && a !== 5) {
          this.hard.push({ a, b, op: '+', answer: a + b });
        }
      }
    }
    // 减法：排除 medium（减数≤5 且 结果≤5）
    for (let a = 2; a <= 10; a++) {
      for (let b = 1; b < a; b++) {
        const result = a - b;
        if (!(b <= 5 && result <= 5)) {
          this.hard.push({ a, b, op: '−', answer: result });
        }
      }
    }

    // 打乱每组
    this._shuffle(this.easy);
    this._shuffle(this.medium);
    this._shuffle(this.hard);

    this._cursor = { easy: 0, medium: 0, hard: 0 };
  },

  // ---- 按难度抽取一题（不放回，耗尽后重置） ----
  pick(difficulty) {
    let bank, cursorKey;
    if (difficulty === 'easy') {
      bank = this.easy;
      cursorKey = 'easy';
    } else if (difficulty === 'medium') {
      bank = this.medium;
      cursorKey = 'medium';
    } else {
      bank = this.hard;
      cursorKey = 'hard';
    }

    // 耗尽则重置（重新打乱）
    if (this._cursor[cursorKey] >= bank.length) {
      this._shuffle(bank);
      this._cursor[cursorKey] = 0;
    }

    const q = bank[this._cursor[cursorKey]];
    this._cursor[cursorKey]++;

    // 生成4个选项（1正确 + 3干扰项）
    const options = this._generateOptions(q.answer);
    return {
      a: q.a,
      b: q.b,
      op: q.op,
      answer: q.answer,
      options: options,
      correctIndex: options.indexOf(q.answer)
    };
  },

  // ---- 生成4个选项（无重复，范围 0~10） ----
  _generateOptions(correct) {
    const opts = new Set([correct]);
    while (opts.size < 4) {
      // 在 [max(0, correct-3), min(10, correct+3)] 范围内生成
      const min = Math.max(0, correct - 3);
      const max = Math.min(10, correct + 3);
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      opts.add(n);
    }
    // 转数组并打乱
    const arr = Array.from(opts);
    this._shuffle(arr);
    return arr;
  },

  // ---- Fisher-Yates 洗牌 ----
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
};
