// 渲染模块 - 负责所有 Canvas 绘制
const Renderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,

  // ---- 图片缓存 ----
  images: {
    scout: null,
    bomber: null,
    fighter: null,
    bg: null,
  },
  _imagesLoaded: 0,
  get allImagesLoaded() {
    return this._imagesLoaded >= 4;
  },

  // 布局常量 (相对比例)
  LAYOUT: {
    baseX: 0.10,        // 基地水平位置
    baseWidth: 0.10,    // 基地宽度比例
    gridLeft: 0.24,     // 敌机网格左边界 (第1格)
    gridRight: 0.92,    // 敌机网格右边界 (第5格)
    gridTop: 0.15,      // 网格上边界
    gridBottom: 0.85,   // 网格下边界
  },

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.loadAssets();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 保持竖屏比例，限制最小高度
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  // ---- 预加载敌机图片 ----
  loadAssets() {
    const assetMap = {
      scout: 'assets/侦察机.png',
      bomber: 'assets/轰炸机.png',
      fighter: 'assets/战斗机.png',
      bg: 'assets/背景.png',
    };
    for (const [key, src] of Object.entries(assetMap)) {
      const img = new Image();
      img.onload = () => { this._imagesLoaded++; };
      img.onerror = () => {
        console.warn(`图片加载失败: ${src}`);
        this._imagesLoaded++;
      };
      img.src = src;
      this.images[key] = img;
    }
  },

  // ========== 主绘制方法 ==========
  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    this.drawSky(w, h);
    this.drawGround(w, h);
    this.drawEnemiesFromGame(w, h);
    this.drawKillEffect(w, h);
    this.drawBase(w, h);
    this.drawAttackAnim(w, h);
    this.drawActionHint(w, h);
  },

  // ---------- 计算网格参数 ----------
  getGridParams(w, h) {
    const L = this.LAYOUT;
    const gridLeft = w * L.gridLeft;
    const gridRight = w * L.gridRight;
    const gridTop = h * L.gridTop;
    const gridBottom = h * L.gridBottom;
    const colW = (gridRight - gridLeft) / 4;
    const rowH = (gridBottom - gridTop) / 3;
    return { gridLeft, gridRight, gridTop, gridBottom, colW, rowH };
  },

  // ---------- 将格子坐标转为像素坐标 ----------
  gridToPixel(col, row, w, h) {
    const g = this.getGridParams(w, h);
    // col 1=最左(攻击线), col 5=最右(出生点)
    const cx = g.gridLeft + (col - 1) * g.colW + g.colW / 2;
    const cy = g.gridTop + row * g.rowH + g.rowH / 2;
    return { x: cx, y: cy };
  },

  // ---------- 从游戏状态绘制敌机 ----------
  drawEnemiesFromGame(w, h) {
    const ctx = this.ctx;
    const enemies = EnemyManager.getAliveEnemies();
    // 击杀动画闪烁阶段跳过该敌机
    const killFlashId = (Game.killAnim && Game.killAnim.phase === 'flash')
      ? Game.killAnim.enemyData.id : null;
    // 攻击动画闪烁阶段跳过该敌机
    let attackFlashId = null;
    if (Game.attackAnim && Game.attackAnim.phase === 'flash') {
      attackFlashId = Game.attackAnim.queue[Game.attackAnim.currentIdx].id;
    }

    for (const e of enemies) {
      if (e.id === killFlashId || e.id === attackFlashId) continue;
      // 移动阶段插值：从 moveFromCol 滑动到当前 col
      let px, py;
      if (e.moveFromCol !== undefined && Game.phase === 'move') {
        const progress = Math.min(1, (Game.phaseTimer - 1) / (Game.phaseDuration - 1));
        const from = this.gridToPixel(e.moveFromCol, e.row, w, h);
        const to = this.gridToPixel(e.col, e.row, w, h);
        px = from.x + (to.x - from.x) * progress;
        py = from.y + (to.y - from.y) * progress;
      } else {
        const pos = this.gridToPixel(e.col, e.row, w, h);
        px = pos.x;
        py = pos.y;
      }
      this.drawPlane(ctx, px, py, e.type);
    }
  },

  // ========== 击杀动画绘制 ==========

  // ---- 入口 ----
  drawKillEffect(w, h) {
    const anim = Game.killAnim;
    if (!anim) return;

    if (anim.phase === 'laser') {
      this._drawLaserBeam(w, h, anim);
    } else if (anim.phase === 'explode') {
      this._drawExplosion(w, h, anim);
    } else if (anim.phase === 'flash') {
      this._drawExplosion(w, h, anim);
      this._drawFlashingEnemy(w, h, anim);
    }
  },

  // ---- 激光飞行 ----
  _drawLaserBeam(w, h, anim) {
    const ctx = this.ctx;
    const progress = Math.min(1, anim.timer / 60);  // 0→1 飞行1秒
    const bx = w * this.LAYOUT.baseX;
    const by = h * 0.45;
    const tx = anim.pixelX;
    const ty = anim.pixelY;

    // 当前光束末端位置
    const endX = bx + (tx - bx) * progress;
    const endY = by + (ty - by) * progress;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(endX, endY);

    // 外层光晕 (蓝色, 宽)
    ctx.save();
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 30;
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();

    // 中层光晕 (亮青)
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // 核心光束 (白色)
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 命中点提前亮光 (当激光接近目标时)
    if (progress > 0.6) {
      const glowSize = 6 + (progress - 0.6) * 30;
      ctx.save();
      ctx.globalAlpha = (progress - 0.6) * 1.5;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(200, 240, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(tx, ty, glowSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  },

  // ---- 爆炸粒子 ----
  _drawExplosion(w, h, anim) {
    const ctx = this.ctx;
    const tx = anim.pixelX;
    const ty = anim.pixelY;
    const timer = anim.timer;
    const isFlashPhase = anim.phase === 'flash';
    const progress = Math.min(1, isFlashPhase ? 1 : timer / 30);

    // 闪烁阶段：爆炸特效也和敌机一起闪烁（60帧内闪2下）
    if (isFlashPhase) {
      if (timer >= 58) return;
      const visible = (timer % 30) < 15;
      if (!visible) return;
    }

    // 爆炸中心闪光
    const flashSize = 20 + (1 - progress) * 25;
    ctx.save();
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 40;
    ctx.globalAlpha = 1 - progress * 0.8;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(tx, ty, flashSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 粒子 (12颗, 向外扩散)
    const particleCount = 14;
    const maxRadius = 40 + progress * 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + progress * 0.5;
      const radius = maxRadius * (0.3 + 0.7 * progress);
      const px = tx + Math.cos(angle) * radius;
      const py = ty + Math.sin(angle) * radius;
      const size = 3 + (1 - progress) * 5;

      // 粒子颜色: 黄→橙→红
      const t = progress;
      let r, g, b;
      if (t < 0.3) {
        r = 255; g = 200 + 55 * (t / 0.3); b = 50 - 50 * (t / 0.3);
      } else if (t < 0.6) {
        r = 255; g = 255 - 80 * ((t - 0.3) / 0.3); b = 0;
      } else {
        r = 255 - 100 * ((t - 0.6) / 0.4); g = 175 - 175 * ((t - 0.6) / 0.4); b = 0;
      }

      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.7;
      ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 烟雾/冲击波环
    ctx.save();
    ctx.globalAlpha = 0.15 * (1 - progress);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 30 + progress * 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // ---- 闪烁的敌机 (flash阶段) ----
  _drawFlashingEnemy(w, h, anim) {
    // 闪烁模式：60帧内闪2下（15帧可见→15帧隐藏→15帧可见→15帧隐藏）
    if (anim.timer >= 58) return;
    const visible = (anim.timer % 30) < 15;
    if (!visible) return;

    // 找到敌机用其原始类型绘制，但加红色闪烁效果
    const { type, col, row } = anim.enemyData;
    const { x, y } = this.gridToPixel(col, row, w, h);

    // 绘制红色轮廓闪烁效果
    this.drawPlane(this.ctx, x, y, type);

    // 叠加强光
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(x, y, type.width * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, type.width * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // ========== 攻击动画（敌机光球攻击基地） ==========
  drawAttackAnim(w, h) {
    const anim = Game.attackAnim;
    if (!anim) return;

    const ctx = this.ctx;
    const currentEnemy = anim.queue[anim.currentIdx];
    const { x: sx, y: sy } = this.gridToPixel(currentEnemy.col, currentEnemy.row, w, h);
    // 基地中心坐标
    const bx = w * this.LAYOUT.baseX;
    const baseCenterY = h * 0.5; // by(0.45h) + bh/2(0.10h)

    if (anim.phase === 'fly') {
      // 光球从敌机飞向基地 (2秒)
      const progress = Math.min(1, anim.timer / 120);
      const cx = sx + (bx - sx) * progress;
      const cy = sy + (baseCenterY - sy) * progress;

      // 拖尾粒子
      const tailLen = 12;
      for (let i = 0; i < tailLen; i++) {
        const t = i / tailLen;
        const tx = cx - (bx - sx) / tailLen * i * 0.5;
        const ty = cy - (baseCenterY - sy) / tailLen * i * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 * (1 - t);
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(tx, ty, 6 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 外层黄色光晕
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 35;
      ctx.fillStyle = '#ffdd44';
      ctx.beginPath();
      ctx.arc(cx, cy, 10 + (1 - progress) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 核心白点
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (anim.phase === 'explode') {
      // 爆炸特效 (0.33秒)
      const progress = Math.min(1, anim.timer / 20);
      const flashSize = 15 + (1 - progress) * 20;
      // 中心闪光
      ctx.save();
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 50;
      ctx.globalAlpha = 1 - progress * 0.7;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(bx, baseCenterY, flashSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 粒子 (10颗向外扩散)
      const particleCount = 10;
      const maxRadius = 25 + progress * 20;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + progress * 0.5;
        const r = maxRadius * (0.3 + 0.7 * progress);
        const px = bx + Math.cos(angle) * r;
        const py = baseCenterY + Math.sin(angle) * r;
        const size = 4 + (1 - progress) * 4;
        ctx.save();
        ctx.globalAlpha = 1 - progress * 0.6;
        ctx.fillStyle = '#ff6600';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (anim.phase === 'hit') {
      // 扣血特效 - 红色冲击波 + 闪光 (覆盖基地)
      const progress = Math.min(1, anim.timer / 120);
      // 红色冲击环
      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.5;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(bx, baseCenterY, 8 + progress * 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 红色半透明覆盖 (直接盖在基地上)
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - progress);
      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(bx, baseCenterY, 20 + (1 - progress) * 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 白色中心闪光
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - progress);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(bx, baseCenterY, 8 * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (anim.phase === 'flash') {
      // 敌机闪烁效果 (2秒, 闪4次: 30帧亮/30帧灭交替)
      if (anim.timer >= 118) return;
      const visible = (anim.timer % 30) < 15;
      if (!visible) return;

      // 在原位绘制敌机 + 红色闪光
      this.drawPlane(ctx, sx, sy, currentEnemy.type);

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(sx, sy, currentEnemy.type.width * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, currentEnemy.type.width * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // ---------- 天空背景 ----------
  drawActionHint(w, h) {
    if (Game.state !== 'playing') return;
    if (Game.phase !== 'action' || Game.actionResolved) return;
    if (Game.answering) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `bold ${Math.floor(h * 0.035)}px Arial, "Microsoft YaHei"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 脉冲透明度
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);
    ctx.globalAlpha = pulse;

    ctx.fillText('✈ 点击敌机答题', w / 2, h * 0.08);
    ctx.restore();
  },

  // ---------- 天空背景 ----------
  drawSky(w, h) {
    const ctx = this.ctx;
    const bg = this.images.bg;

    if (bg && bg.complete && bg.naturalWidth > 0) {
      // 使用背景图片，cover 适配：按 canvas 宽高比裁剪
      const imgW = bg.naturalWidth;
      const imgH = bg.naturalHeight;
      const canvasRatio = w / h;
      const imgRatio = imgW / imgH;

      let sx, sy, sw, sh;
      if (imgRatio > canvasRatio) {
        // 图片更宽：裁剪左右
        sh = imgH;
        sw = imgH * canvasRatio;
        sx = (imgW - sw) / 2;
        sy = 0;
      } else {
        // 图片更高：裁剪上下
        sw = imgW;
        sh = imgW / canvasRatio;
        sx = 0;
        sy = (imgH - sh) / 2;
      }

      ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      // 回退：线性渐变
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1a237e');
      grad.addColorStop(0.5, '#42a5f5');
      grad.addColorStop(1, '#bbdefb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  },

  // ---------- 地面/云线装饰 ----------
  drawGround(w, h) {
    const ctx = this.ctx;
    // 底部淡淡的云/地平线装饰
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, h * 0.9, w, h * 0.1);

    // 远处山/云剪影
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    for (let x = 0; x <= w; x += 20) {
      const y = h * 0.7 + Math.sin(x * 0.008) * 10 + Math.sin(x * 0.015) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  },

  // ---------- 基地 ----------
  drawBase(w, h) {
    const ctx = this.ctx;
    const bx = w * this.LAYOUT.baseX;
    const by = h * 0.45;
    const bw = w * 0.10;
    const bh = h * 0.20;

    // 基地被击中闪红效果
    if (Base.flashRedTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 30;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(bx, by + bh * 0.5, bw * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 一体式炮台 (统一形状)
    ctx.fillStyle = Base.isDamaged ? '#666' : '#78909c';
    ctx.beginPath();
    ctx.roundRect(bx - bw/2, by - bh * 0.3, bw, bh * 1.3, 6);
    ctx.fill();

    // 边框
    ctx.strokeStyle = Base.isDamaged ? '#555' : '#546e7a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 顶部炮口装饰
    ctx.fillStyle = Base.isDamaged ? '#555' : '#90a4ae';
    ctx.beginPath();
    ctx.arc(bx, by - bh * 0.3, bw * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 血条（HP）显示在基地上方
    const hpPct = Base.hp / Base.maxHp;
    const barW = bw * 1.2;
    const barH = 5;
    const barX = bx - barW / 2;
    const barY = by - bh * 0.3 - 14;

    ctx.save();
    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2);
    ctx.fill();
    // 血量
    const hpColor = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpPct, barH, 2);
    ctx.fill();
    ctx.restore();

    // 基地标签
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(h * 0.028)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`基地 ♥${Base.hp}`, bx, by + bh + 6);
  },

  // ---------- 绘制单架敌机 ----------
  // 素材图片机头朝上，游戏内敌机朝左飞行，故绕中心旋转 -90°
  drawPlane(ctx, x, y, typeConfig) {
    const img = this.images[typeConfig.id];
    const s = typeConfig.width;

    ctx.save();
    ctx.translate(x, y);

    if (img && img.complete && img.naturalWidth > 0) {
      // ---- 使用图片素材 ----
      ctx.rotate(-Math.PI / 2);       // 朝上→朝左
      // 关闭平滑插值，保持像素画锐利（防止 Retina 屏模糊）
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      // ---- 程序化回落（图片未加载时） ----
      // 机身 (圆角矩形)
      ctx.fillStyle = typeConfig.color;
      ctx.beginPath();
      ctx.roundRect(-s/2, -s/2, s, s, 5);
      ctx.fill();
      ctx.strokeStyle = typeConfig.shapeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 机翼 (三角形，朝左伸)
      ctx.fillStyle = typeConfig.shapeColor;
      // 上翼
      ctx.beginPath();
      ctx.moveTo(-s/2, -s*0.08);
      ctx.lineTo(-s/2 - s*0.3, -s*0.38);
      ctx.lineTo(-s/2, -s*0.26);
      ctx.closePath();
      ctx.fill();
      // 下翼
      ctx.beginPath();
      ctx.moveTo(-s/2, s*0.08);
      ctx.lineTo(-s/2 - s*0.3, s*0.38);
      ctx.lineTo(-s/2, s*0.26);
      ctx.closePath();
      ctx.fill();

      // 机头 (左三角，朝左)
      ctx.beginPath();
      ctx.moveTo(-s/2, 0);
      ctx.lineTo(-s/2 + s*0.32, -s*0.18);
      ctx.lineTo(-s/2 + s*0.32, s*0.18);
      ctx.closePath();
      ctx.fill();

      // 尾翼 (右小三角)
      ctx.beginPath();
      ctx.moveTo(s/2, 0);
      ctx.lineTo(s/2 - s*0.18, -s*0.1);
      ctx.lineTo(s/2 - s*0.18, s*0.1);
      ctx.closePath();
      ctx.fill();

      // 驾驶舱 (小圆点, 偏左)
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-s*0.1, 0, s*0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  // ---------- 绘制圆形 ----------
  _drawCircle(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (r > w/2) r = w/2;
    if (r > h/2) r = h/2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}
