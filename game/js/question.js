// ---- 题库模块（穷举法，每题带难度标签） ----
//
// 基本规则：算式里所有值（a, b, 结果）都 ≤ 10
//
// 低难度（侦察机 1分）：相加和 ≤ 5 的加法
// 中难度（轰炸机 2分）：
//   1) 被减数 ≤ 5 的减法
//   2) 加数/被加数、减数/被减数其中一个为 5 的加法或减法
// 高难度（战斗机 3分）：所有剩下的其他

const QuestionBank = {
  easy: [],
  medium: [],
  hard: [],

  _cursor: { easy: 0, medium: 0, hard: 0 },

  // ---- 穷举生成全部题目 ----
  generate() {
    this.easy = [];
    this.medium = [];
    this.hard = [];

    // 用 key 值去重
    const added = new Set();
    const addQ = (bank, a, b, op, answer) => {
      const key = a + '|' + b + '|' + op;
      if (added.has(key)) return;
      added.add(key);
      bank.push({ a, b, op, answer });
    };

    // ---- 生成所有加法（a + b ≤ 10, a ≥ 1, b ≥ 1） ----
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 10 - a; b++) {
        const sum = a + b;
        if (sum <= 5) {
          // 低难度：和 ≤ 5 的加法
          addQ(this.easy, a, b, '+', sum);
        } else if (a === 5 || b === 5) {
          // 中难度：其中一个数为 5（且和>5，否则会在easy）
          addQ(this.medium, a, b, '+', sum);
        } else {
          // 高难度：其他加法
          addQ(this.hard, a, b, '+', sum);
        }
      }
    }

    // ---- 生成所有减法（a > b, a ≤ 10, b ≥ 1） ----
    for (let a = 2; a <= 10; a++) {
      for (let b = 1; b < a; b++) {
        const result = a - b;
        if (a <= 5) {
          // 中难度：被减数 ≤ 5
          addQ(this.medium, a, b, '−', result);
        } else if (a === 5 || b === 5) {
          // 中难度：其中一个数为 5（且 a>5，否则会被上面捕获）
          addQ(this.medium, a, b, '−', result);
        } else {
          // 高难度：其他减法
          addQ(this.hard, a, b, '−', result);
        }
      }
    }

    // 打乱每组
    this._shuffle(this.easy);
    this._shuffle(this.medium);
    this._shuffle(this.hard);

    this._cursor = { easy: 0, medium: 0, hard: 0 };

    console.log('题库生成：简单 ' + this.easy.length + ' 题，中等 ' + this.medium.length + ' 题，困难 ' + this.hard.length + ' 题，共 ' + (this.easy.length + this.medium.length + this.hard.length) + ' 题');
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
