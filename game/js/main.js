// 入口模块
(function() {
  'use strict';

  function init() {
    // 初始化 UI 引用
    Game.initUI();

    // 初始化渲染器
    Renderer.init('battlefield');

    // Canvas 点击事件
    setupCanvasClick();

    // 答题按钮事件
    setupAnswerButtons();

    // 游戏初始化
    Game.reset();
    Game.updateUI();

    // 题库初始化
    QuestionBank.generate();

    // 显示开始页面（不再自动开始游戏）
    Game.showStartOverlay();

    // 启动游戏循环
    loop();
  }

  function loop() {
    Game.update();
    Renderer.draw();
    requestAnimationFrame(loop);
  }

  // ---- Canvas 点击：检测敌机点击 ----
  function setupCanvasClick() {
    const canvas = document.getElementById('battlefield');
    canvas.addEventListener('click', function(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = Renderer.width / rect.width;
      const scaleY = Renderer.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // 检测是否点击到敌机
      const enemies = EnemyManager.getAliveEnemies();
      for (const enemy of enemies) {
        const { x, y } = Renderer.gridToPixel(enemy.col, enemy.row, Renderer.width, Renderer.height);
        const halfW = enemy.type.width * 1.2;   // 点击判定略大于图形
        const halfH = enemy.type.height * 1.2;

        if (Math.abs(mx - x) < halfW && Math.abs(my - y) < halfH) {
          Game.clickEnemy(enemy.id);
          break;
        }
      }
    });
  }

  // ---- 答题按钮点击事件 ----
  function setupAnswerButtons() {
    document.querySelectorAll('.answer-btn').forEach((btn) => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.dataset.index);
        Game.submitAnswer(index);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
