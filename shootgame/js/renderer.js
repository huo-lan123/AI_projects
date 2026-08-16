// ==================== 渲染器（以撒暗黑卡通风） ====================

const Renderer = {

    // ---------- 背景 ----------
    drawBackground(ctx) {
        ctx.fillStyle = COLORS.bgDark;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    },

    // ---------- 房间地板 ----------
    drawRoomFloor(ctx, room) {
        const b = room.getInteriorBounds();
        const ts = CONFIG.TILE_SIZE;

        // 地板底色
        ctx.fillStyle = COLORS.bgFloor;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // 瓦片纹理
        for (let gy = 0; gy < CONFIG.ROOM_INNER_ROWS; gy++) {
            for (let gx = 0; gx < CONFIG.ROOM_INNER_COLS; gx++) {
                const px = b.x + gx * ts;
                const py = b.y + gy * ts;

                // 交替色调
                if ((gx + gy) % 2 === 0) {
                    ctx.fillStyle = COLORS.bgFloorTile;
                } else {
                    ctx.fillStyle = COLORS.bgFloorDark;
                }
                ctx.fillRect(px, py, ts, ts);

                // 瓦片缝隙线
                ctx.strokeStyle = COLORS.bgFloorTileLine;
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
            }
        }

        // 地板暗角（vignette效果）
        const grad = ctx.createRadialGradient(
            b.x + b.w / 2, b.y + b.h / 2, 0,
            b.x + b.w / 2, b.y + b.h / 2, b.w / 1.5
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, b.y, b.w, b.h);
    },

    // ---------- 墙壁和门 ----------
    drawRoomWalls(ctx, room) {
        const ox = CONFIG.ROOM_OFFSET_X;
        const oy = CONFIG.ROOM_OFFSET_Y;
        const ts = CONFIG.TILE_SIZE;
        const totalW = CONFIG.ROOM_PIXEL_WIDTH;
        const totalH = CONFIG.ROOM_PIXEL_HEIGHT;
        const wallT = CONFIG.WALL_THICKNESS;

        // 上墙
        this._drawWallStrip(ctx, ox, oy, totalW, ts, 'horizontal');
        // 下墙
        this._drawWallStrip(ctx, ox, oy + (CONFIG.ROOM_TOTAL_ROWS - wallT) * ts, totalW, ts, 'horizontal');
        // 左墙
        this._drawWallStrip(ctx, ox, oy + ts, ts, CONFIG.ROOM_INNER_ROWS * ts, 'vertical');
        // 右墙
        this._drawWallStrip(ctx, ox + (CONFIG.ROOM_TOTAL_COLS - wallT) * ts, oy + ts, ts, CONFIG.ROOM_INNER_ROWS * ts, 'vertical');

        // 门
        this._drawDoors(ctx, room);
    },

    _drawWallStrip(ctx, x, y, w, h, orient) {
        const ts = CONFIG.TILE_SIZE;

        if (orient === 'horizontal') {
            // 砖块纹理
            const cols = Math.ceil(w / ts);
            for (let i = 0; i < cols; i++) {
                const bx = x + i * ts;
                ctx.fillStyle = COLORS.wallTop;
                ctx.fillRect(bx, y, ts, h * 0.3);
                ctx.fillStyle = COLORS.wall;
                ctx.fillRect(bx, y + h * 0.3, ts, h * 0.7);
                // 砖缝
                ctx.strokeStyle = COLORS.wallShadow;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(bx, y);
                ctx.lineTo(bx, y + h);
                ctx.stroke();
            }
        } else {
            const rows = Math.ceil(h / ts);
            for (let i = 0; i < rows; i++) {
                const by = y + i * ts;
                ctx.fillStyle = COLORS.wallTop;
                ctx.fillRect(x, by, w * 0.3, ts);
                ctx.fillStyle = COLORS.wall;
                ctx.fillRect(x + w * 0.3, by, w * 0.7, ts);
                ctx.strokeStyle = COLORS.wallShadow;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, by);
                ctx.lineTo(x + w, by);
                ctx.stroke();
            }
        }
    },

    _drawDoors(ctx, room) {
        const b = room.getInteriorBounds();
        const ts = CONFIG.TILE_SIZE;
        const doorWidth = ts * 1.6;
        const midX = b.x + b.w / 2;
        const midY = b.y + b.h / 2;

        const drawDoor = (x, y, w, h, isOpen, dir) => {
            if (isOpen) {
                // 开启的门：显示通道地板 + 明亮门框 + 金色光晕
                ctx.fillStyle = COLORS.bgFloor;
                ctx.fillRect(x, y, w, h);

                // 通道地板格子（与房间地板风格一致）
                ctx.fillStyle = COLORS.bgFloorTile;
                if (dir === 'up' || dir === 'down') {
                    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
                } else {
                    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
                }

                // 门框
                ctx.strokeStyle = '#8a7a52';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);

                // 门洞内光效
                const grad = ctx.createRadialGradient(
                    x + w / 2, y + h / 2, 2,
                    x + w / 2, y + h / 2, w / 1.6
                );
                grad.addColorStop(0, 'rgba(232,200,80,0.35)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(x, y, w, h);
            } else {
                // 关闭的门：石头挡板
                ctx.fillStyle = COLORS.doorClosed;
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = COLORS.doorClosedDark;
                ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

                // 锁/铁条纹理
                ctx.strokeStyle = COLORS.wallShadow;
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (dir === 'up' || dir === 'down') {
                    ctx.moveTo(x + w * 0.3, y + h * 0.3);
                    ctx.lineTo(x + w * 0.3, y + h * 0.7);
                    ctx.moveTo(x + w * 0.7, y + h * 0.3);
                    ctx.lineTo(x + w * 0.7, y + h * 0.7);
                } else {
                    ctx.moveTo(x + w * 0.3, y + h * 0.3);
                    ctx.lineTo(x + w * 0.7, y + h * 0.3);
                    ctx.moveTo(x + w * 0.3, y + h * 0.7);
                    ctx.lineTo(x + w * 0.7, y + h * 0.7);
                }
                ctx.stroke();
            }
        };

        // 上门
        if (room.doors.up) {
            const isOpen = room.state === 'cleared';
            drawDoor(midX - doorWidth / 2, b.y - ts, doorWidth, ts, isOpen, 'up');
        }
        // 下门
        if (room.doors.down) {
            const isOpen = room.state === 'cleared';
            drawDoor(midX - doorWidth / 2, b.y + b.h, doorWidth, ts, isOpen, 'down');
        }
        // 左门
        if (room.doors.left) {
            const isOpen = room.state === 'cleared';
            drawDoor(b.x - ts, midY - doorWidth / 2, ts, doorWidth, isOpen, 'left');
        }
        // 右门
        if (room.doors.right) {
            const isOpen = room.state === 'cleared';
            drawDoor(b.x + b.w, midY - doorWidth / 2, ts, doorWidth, isOpen, 'right');
        }
    },

    // ---------- 障碍物（石头） ----------
    drawObstacles(ctx, room) {
        for (const obs of room.obstacles) {
            const pos = room.gridToPixel(obs.gridX, obs.gridY);
            const ts = CONFIG.TILE_SIZE;
            const x = pos.x;
            const y = pos.y;
            const r = ts * 0.38;

            // 阴影
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(x, y + r * 0.3, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // 石头主体
            ctx.fillStyle = '#5a5048';
            ctx.beginPath();
            ctx.ellipse(x, y - 2, r, r * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();

            // 高光
            ctx.fillStyle = '#7a7068';
            ctx.beginPath();
            ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.4, r * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            // 暗部
            ctx.fillStyle = '#3a3528';
            ctx.beginPath();
            ctx.ellipse(x + r * 0.2, y + r * 0.2, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 裂纹
            ctx.strokeStyle = '#2a2520';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - r * 0.2, y - r * 0.3);
            ctx.lineTo(x + r * 0.1, y + r * 0.1);
            ctx.stroke();
        }
    },

    // ---------- 玩家（以撒） ----------
    drawPlayer(ctx, player) {
        const x = player.x;
        const y = player.y;
        const r = player.radius;

        // 受伤闪烁
        if (player.invincible && Math.floor(Date.now() / 80) % 2 === 0) {
            // 闪烁中，半透明
            ctx.globalAlpha = 0.4;
        }

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + r + 2, r * 1.2, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 走路动画偏移
        const bob = player.isMoving ? Math.sin(player.walkAnim) * 1.5 : 0;
        const headY = y - 4 + bob;

        // === 身体 ===
        const bodyW = r * 1.1;
        const bodyH = r * 0.9;
        ctx.fillStyle = COLORS.isaacBody;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.3, bodyW, bodyH, 0, 0, Math.PI * 2);
        ctx.fill();

        // 身体暗部
        ctx.fillStyle = COLORS.isaacBodyShadow;
        ctx.beginPath();
        ctx.ellipse(x + 2, y + r * 0.4, bodyW * 0.8, bodyH * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // === 脚 ===
        const footOffset = player.isMoving ? Math.sin(player.walkAnim) * 2 : 0;
        ctx.fillStyle = COLORS.isaacBody;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.5, y + r * 0.7 + footOffset, r * 0.3, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + r * 0.5, y + r * 0.7 - footOffset, r * 0.3, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // === 头 ===
        const headR = r * 1.1;
        ctx.fillStyle = COLORS.isaacHead;
        ctx.beginPath();
        ctx.arc(x, headY, headR, 0, Math.PI * 2);
        ctx.fill();

        // 头部暗部
        ctx.fillStyle = COLORS.isaacHeadShadow;
        ctx.beginPath();
        ctx.arc(x + 2, headY + 2, headR * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // 头部高光
        ctx.fillStyle = COLORS.isaacHead;
        ctx.beginPath();
        ctx.arc(x - headR * 0.2, headY - headR * 0.2, headR * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // 头部描边
        ctx.strokeStyle = COLORS.isaacOutline;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, headY, headR, 0, Math.PI * 2);
        ctx.stroke();

        // === 眼睛 ===
        const eyeOffsetX = headR * 0.35;
        const eyeY = headY - headR * 0.1;
        const eyeR = headR * 0.18;

        // 根据朝向调整眼睛位置
        let eyeLX = x - eyeOffsetX;
        let eyeRX = x + eyeOffsetX;
        if (player.facingDir === 'left') {
            eyeLX = x - eyeOffsetX - 2;
            eyeRX = x + eyeOffsetX - 2;
        } else if (player.facingDir === 'right') {
            eyeLX = x - eyeOffsetX + 2;
            eyeRX = x + eyeOffsetX + 2;
        }

        // 眼白
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeLX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(eyeRX, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // 瞳孔
        ctx.fillStyle = COLORS.isaacEye;
        let pupilOffsetX = 0, pupilOffsetY = 0;
        if (player.facingDir === 'left') pupilOffsetX = -1;
        if (player.facingDir === 'right') pupilOffsetX = 1;
        if (player.facingDir === 'up') pupilOffsetY = -1;
        if (player.facingDir === 'down') pupilOffsetY = 1;

        ctx.beginPath();
        ctx.arc(eyeLX + pupilOffsetX, eyeY + pupilOffsetY, eyeR * 0.5, 0, Math.PI * 2);
        ctx.arc(eyeRX + pupilOffsetX, eyeY + pupilOffsetY, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // === 嘴 ===
        ctx.strokeStyle = COLORS.isaacMouth;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, headY + headR * 0.35, headR * 0.15, 0, Math.PI);
        ctx.stroke();

        // === 泪痕（射击时） ===
        if (player.shootCooldown > 0 && player.lastShootDir) {
            ctx.fillStyle = COLORS.isaacTear;
            // 眼下泪滴
            const tearY = headY + headR * 0.15;
            ctx.beginPath();
            ctx.ellipse(eyeLX + player.lastShootDir.x * 2, tearY + 2, 2, 3, 0, 0, Math.PI * 2);
            ctx.ellipse(eyeRX + player.lastShootDir.x * 2, tearY + 2, 2, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 道具变形效果（收集越多道具，外观变化越大）
        if (player.transformationLevel >= 3) {
            // 道具光环
            ctx.strokeStyle = 'rgba(232,200,80,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (player.transformationLevel >= 5) {
            // 更强的光环
            ctx.strokeStyle = 'rgba(232,200,80,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    },

    // ---------- 敌人分发 ----------
    drawEnemy(ctx, enemy) {
        // 出生动画
        const scale = enemy.spawnAnim;
        if (scale < 1) {
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.scale(scale, scale);
            ctx.translate(-enemy.x, -enemy.y);
        }

        // 受击闪烁
        if (enemy.hitFlash > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
        }

        switch (enemy.type) {
            case 'fly': this.drawFly(ctx, enemy); break;
            case 'slime': this.drawSlime(ctx, enemy); break;
            case 'spider': this.drawSpider(ctx, enemy); break;
            case 'boss': this.drawBoss(ctx, enemy); break;
        }

        // 受击白色覆盖
        if (enemy.hitFlash > 0) {
            ctx.restore();
            // 再次绘制白色版本
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = enemy.hitFlash * 0.6;
            ctx.fillStyle = '#ffffff';
            const r = enemy.radius + 2;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (scale < 1) {
            ctx.restore();
        }

        // Boss血条
        if (enemy.type === 'boss' && !enemy.dead) {
            this.drawBossHealthBar(ctx, enemy);
        }
    },

    // ---------- 苍蝇 ----------
    drawFly(ctx, e) {
        const x = e.x, y = e.y, r = e.radius;
        const wingFlap = Math.sin(e.animTimer * 20) * 0.5 + 0.5;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + r + 1, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 翅膀
        ctx.fillStyle = COLORS.flyWing;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.6, y - r * 0.3, r * 0.7, r * 0.4 * wingFlap, -0.3, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.6, y - r * 0.3, r * 0.7, r * 0.4 * wingFlap, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 身体
        ctx.fillStyle = COLORS.flyBody;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 红眼
        ctx.fillStyle = COLORS.flyEye;
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.25, 0, Math.PI * 2);
        ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // 眼高光
        ctx.fillStyle = '#ff6060';
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.25, r * 0.1, 0, Math.PI * 2);
        ctx.arc(x + r * 0.3, y - r * 0.25, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
    },

    // ---------- 黏液怪 ----------
    drawSlime(ctx, e) {
        const x = e.x, y = e.y, r = e.radius;
        const wobble = Math.sin(e.animTimer * 5) * 2;
        const squash = Math.sin(e.animTimer * 4) * 0.1;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.8, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 身体（不规则blob）
        ctx.fillStyle = COLORS.slimeBodyDark;
        ctx.beginPath();
        ctx.ellipse(x, y + 2, r * (1 + squash), r * (1 - squash), 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.slimeBody;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.9 + squash), r * (0.9 - squash), 0, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = COLORS.slimeHighlight;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛
        ctx.fillStyle = COLORS.slimeEye;
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.arc(x + r * 0.35, y - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // 瞳孔（朝玩家方向）
        ctx.fillStyle = COLORS.slimePupil;
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.arc(x + r * 0.4, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // 嘴
        ctx.strokeStyle = COLORS.slimeBodyDark;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y + r * 0.25, r * 0.15, 0, Math.PI);
        ctx.stroke();
    },

    // ---------- 蜘蛛 ----------
    drawSpider(ctx, e) {
        const x = e.x, y = e.y, r = e.radius;
        const legWiggle = Math.sin(e.animTimer * 15);

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + r + 1, r * 1, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 8条腿
        ctx.strokeStyle = COLORS.spiderLeg;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI - Math.PI / 2;
            const wiggle = Math.sin(e.animTimer * 15 + i) * 2;
            // 左侧
            ctx.beginPath();
            ctx.moveTo(x - r * 0.4, y);
            ctx.lineTo(x - r * 1.5, y + Math.sin(angle) * r * 0.8 + wiggle);
            ctx.stroke();
            // 右侧
            ctx.beginPath();
            ctx.moveTo(x + r * 0.4, y);
            ctx.lineTo(x + r * 1.5, y + Math.sin(angle) * r * 0.8 + wiggle);
            ctx.stroke();
        }

        // 身体
        ctx.fillStyle = COLORS.spiderBody;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.8, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 红眼
        ctx.fillStyle = COLORS.spiderEye;
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.15, r * 0.18, 0, Math.PI * 2);
        ctx.arc(x + r * 0.25, y - r * 0.15, r * 0.18, 0, Math.PI * 2);
        ctx.fill();

        // 眼高光
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.arc(x - r * 0.28, y - r * 0.2, r * 0.06, 0, Math.PI * 2);
        ctx.arc(x + r * 0.22, y - r * 0.2, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
    },

    // ---------- Boss（Monstro大肉团） ----------
    drawBoss(ctx, e) {
        const x = e.x, y = e.y, r = e.radius;
        const wobble = Math.sin(e.animTimer * 3) * 3;
        const breathe = Math.sin(e.animTimer * 2) * 0.05 + 1;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.8, r * 1.2, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 身体外圈（暗色）
        ctx.fillStyle = COLORS.bossBodyDark;
        ctx.beginPath();
        ctx.ellipse(x, y + 4, r * 1.1 * breathe, r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        // 身体（不规则blob形状）
        ctx.fillStyle = COLORS.bossBody;
        ctx.beginPath();
        // 用多个弧线模拟不规则形状
        ctx.moveTo(x + r, y);
        for (let i = 0; i <= 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const wr = r * (0.9 + Math.sin(a * 3 + e.animTimer) * 0.1) * breathe;
            const px = x + Math.cos(a) * wr;
            const py = y + Math.sin(a) * wr * 0.85;
            ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 高光
        ctx.fillStyle = COLORS.bossBodyLight;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // 大眼睛
        const eyeR = r * 0.2;
        const eyeY = y - r * 0.15;
        ctx.fillStyle = COLORS.bossEye;
        ctx.beginPath();
        ctx.arc(x - r * 0.3, eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(x + r * 0.3, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // 瞳孔
        ctx.fillStyle = COLORS.bossPupil;
        ctx.beginPath();
        ctx.arc(x - r * 0.28, eyeY + 2, eyeR * 0.5, 0, Math.PI * 2);
        ctx.arc(x + r * 0.32, eyeY + 2, eyeR * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // 大嘴
        ctx.fillStyle = COLORS.bossMouth;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.35, r * 0.3, r * 0.15 + Math.abs(wobble) * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 牙齿
        ctx.fillStyle = '#e8d8c0';
        const teethCount = 4;
        for (let i = 0; i < teethCount; i++) {
            const tx = x - r * 0.2 + (i / (teethCount - 1)) * r * 0.4;
            ctx.beginPath();
            ctx.moveTo(tx - 2, y + r * 0.3);
            ctx.lineTo(tx + 2, y + r * 0.3);
            ctx.lineTo(tx, y + r * 0.4 + Math.abs(wobble));
            ctx.closePath();
            ctx.fill();
        }

        // 身体表面纹理（肉团质感）
        ctx.fillStyle = 'rgba(80,30,20,0.3)';
        for (let i = 0; i < 5; i++) {
            const a = rand(0, Math.PI * 2);
            const d = r * 0.5;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawBossHealthBar(ctx, enemy) {
        const barW = 200;
        const barH = 10;
        const barX = (CONFIG.CANVAS_WIDTH - barW) / 2;
        const barY = CONFIG.CANVAS_HEIGHT - 30;

        // 背景
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

        // 空槽
        ctx.fillStyle = COLORS.heartEmpty;
        ctx.fillRect(barX, barY, barW, barH);

        // 血量
        const hpRatio = enemy.hp / enemy.maxHp;
        ctx.fillStyle = COLORS.heartFull;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // 边框
        ctx.strokeStyle = COLORS.uiBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);
    },

    // ---------- 眼泪（玩家子弹） ----------
    drawTear(ctx, bullet) {
        const x = bullet.x, y = bullet.y;
        const r = bullet.radius;
        const wobbleY = Math.sin(bullet.wobble) * 1;

        // 穿透弹用粉紫色区分
        const cBody = bullet.pierce ? '#d8a8d8' : COLORS.tear;
        const cDark = bullet.pierce ? '#9868a8' : COLORS.tearDark;
        const cGlow = bullet.pierce ? '#f0d0f0' : COLORS.tearGlow;

        // 轨迹
        for (let i = 0; i < bullet.trail.length; i++) {
            const t = bullet.trail[i];
            const alpha = (i / bullet.trail.length) * 0.3;
            ctx.fillStyle = bullet.pierce
                ? `rgba(216, 168, 216, ${alpha})`
                : `rgba(168, 200, 224, ${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, r * (i / bullet.trail.length) * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // 眼泪主体（泪滴形状）
        ctx.fillStyle = cDark;
        ctx.beginPath();
        ctx.ellipse(x, y + 1, r, r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = cBody;
        ctx.beginPath();
        ctx.ellipse(x, y + wobbleY, r * 0.85, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = cGlow;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
    },

    // ---------- 敌人子弹 ----------
    drawEnemyBullet(ctx, bullet) {
        const x = bullet.x, y = bullet.y;
        const r = bullet.radius;
        const wobble = Math.sin(bullet.wobble) * 1.5;

        // 主体
        ctx.fillStyle = COLORS.tearEnemyDark;
        ctx.beginPath();
        ctx.arc(x, y + 1, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.tearEnemy;
        ctx.beginPath();
        ctx.arc(x, y + wobble, r * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = '#ff8080';
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
    },

    // ---------- 道具掉落物 ----------
    drawItemDrop(ctx, item) {
        const x = item.x;
        const y = item.y + item.bobOffset;

        // 光晕
        const glowR = 24 + Math.sin(item.glowPhase * 2) * 4;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        grad.addColorStop(0, 'rgba(232,200,80,0.4)');
        grad.addColorStop(0.5, 'rgba(232,200,80,0.15)');
        grad.addColorStop(1, 'rgba(232,200,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 底座
        ctx.fillStyle = COLORS.itemPedestal;
        ctx.beginPath();
        ctx.ellipse(x, y + 8, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.itemPedestalTop;
        ctx.beginPath();
        ctx.ellipse(x, y + 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 道具图标
        this._drawItemIcon(ctx, item.def, x, y, 12);
    },

    _drawItemIcon(ctx, def, x, y, size) {
        ctx.save();
        ctx.translate(x, y);

        // 圆形背景
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a2218';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 根据图标类型绘制不同图案
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        switch (def.icon) {
            case 'onion':
                // 洋葱形状
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.6, size * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = def.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.7);
                ctx.lineTo(0, -size * 0.5);
                ctx.stroke();
                break;
            case 'cricket':
                // 虫子
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'lemon':
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.6, size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'eye':
            case 'eye_big':
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1410';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'blood':
                ctx.fillStyle = '#c04040';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e06060';
                ctx.beginPath();
                ctx.arc(-2, -2, size * 0.2, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'rock':
                ctx.fillStyle = '#7a7068';
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.6, size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'one':
                ctx.fillStyle = '#1a1410';
                ctx.font = `bold ${size}px 'Courier New'`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('1', 0, 1);
                break;
            case 'belt':
                ctx.fillStyle = '#3a2a1a';
                ctx.fillRect(-size * 0.6, -2, size * 1.2, 4);
                ctx.fillStyle = '#8a7a4a';
                ctx.fillRect(-3, -3, 6, 6);
                break;
            case 'hanger':
                ctx.strokeStyle = '#ddd';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-size * 0.6, 0);
                ctx.lineTo(0, -size * 0.4);
                ctx.lineTo(size * 0.6, 0);
                ctx.stroke();
                break;
            case 'cola':
                // 注射瓶/药瓶造型
                ctx.fillStyle = '#e8e8e0';
                ctx.fillRect(-size * 0.25, -size * 0.6, size * 0.5, size * 1.1);
                ctx.fillStyle = def.color;
                ctx.fillRect(-size * 0.25, 0, size * 0.5, size * 0.5);
                ctx.fillStyle = '#606068';
                ctx.fillRect(-size * 0.15, -size * 0.85, size * 0.3, size * 0.25);
                break;
            case 'eye3':
                // 三只小眼（三连发）
                for (let i = -1; i <= 1; i++) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.ellipse(i * size * 0.55, 0, size * 0.28, size * 0.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#1a1410';
                    ctx.beginPath();
                    ctx.arc(i * size * 0.55, 0, size * 0.1, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'shotgun':
                // 扇形三箭头（散弹）
                ctx.fillStyle = '#f0d0d0';
                for (let i = -1; i <= 1; i++) {
                    const a = i * 0.5 - Math.PI / 2;
                    ctx.save();
                    ctx.rotate(a);
                    ctx.beginPath();
                    ctx.moveTo(0, -size * 0.7);
                    ctx.lineTo(-size * 0.18, -size * 0.2);
                    ctx.lineTo(size * 0.18, -size * 0.2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                break;
            case 'arrow':
                // 穿透之箭
                ctx.strokeStyle = '#f0d0f0';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-size * 0.6, size * 0.6);
                ctx.lineTo(size * 0.6, -size * 0.6);
                ctx.stroke();
                ctx.fillStyle = '#f0d0f0';
                ctx.beginPath();
                ctx.moveTo(size * 0.6, -size * 0.6);
                ctx.lineTo(size * 0.2, -size * 0.6);
                ctx.lineTo(size * 0.6, -size * 0.2);
                ctx.closePath();
                ctx.fill();
                // 箭羽
                ctx.beginPath();
                ctx.moveTo(-size * 0.6, size * 0.6);
                ctx.lineTo(-size * 0.6, size * 0.2);
                ctx.lineTo(-size * 0.2, size * 0.6);
                ctx.closePath();
                ctx.fill();
                break;
            default:
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
        }
        ctx.restore();
    },

    // ---------- 拾取物（心、金币） ----------
    drawPickup(ctx, pickup) {
        const x = pickup.x;
        const y = pickup.y + pickup.bobOffset;

        if (pickup.type === 'heart') {
            this._drawHeartIcon(ctx, x, y, 10, true);
        } else if (pickup.type === 'coin') {
            this._drawCoinIcon(ctx, x, y, 8);
        }
    },

    _drawHeartIcon(ctx, x, y, size, full) {
        // 心形
        ctx.fillStyle = full ? COLORS.heartFull : COLORS.heartEmpty;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
        ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size * 0.8, x, y + size);
        ctx.bezierCurveTo(x, y + size * 0.8, x + size, y + size * 0.6, x + size, y + size * 0.3);
        ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
        ctx.fill();

        // 高光
        if (full) {
            ctx.fillStyle = COLORS.heartHighlight;
            ctx.beginPath();
            ctx.ellipse(x - size * 0.4, y + size * 0.2, size * 0.2, size * 0.15, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 描边
        ctx.strokeStyle = '#3a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
        ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size * 0.8, x, y + size);
        ctx.bezierCurveTo(x, y + size * 0.8, x + size, y + size * 0.6, x + size, y + size * 0.3);
        ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
        ctx.stroke();
    },

    _drawCoinIcon(ctx, x, y, size) {
        // 金币
        ctx.fillStyle = COLORS.coinGoldDark;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.coinGold;
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, size * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.coinGoldLight;
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    },

    // ---------- HUD 心心 ----------
    drawHearts(ctx, player) {
        const startX = 12;
    const startY = 12;
        const heartSize = 10;
        const spacing = 24;
        const maxHearts = Math.ceil(player.maxHealth / 2);

        for (let i = 0; i < maxHearts; i++) {
            const hx = startX + i * spacing + heartSize;
            const hy = startY + heartSize;

            // 空心背景
            this._drawHeartIcon(ctx, hx, hy - heartSize, heartSize, false);

            // 填充
            const heartValue = player.health - i * 2;
            if (heartValue >= 2) {
                this._drawHeartIcon(ctx, hx, hy - heartSize, heartSize, true);
            } else if (heartValue === 1) {
                // 半心
                ctx.save();
                ctx.beginPath();
                ctx.rect(hx - heartSize, hy - heartSize * 2, heartSize, heartSize * 2);
                ctx.clip();
                this._drawHeartIcon(ctx, hx, hy - heartSize, heartSize, true);
                ctx.restore();
            }
        }
    },

    // ---------- 小地图 ----------
    drawMinimap(ctx, dungeon) {
        const cellSize = 14;
        const gap = 2;
        const mapW = dungeon.gridW * (cellSize + gap);
        const mapH = dungeon.gridH * (cellSize + gap);
        const mx = CONFIG.CANVAS_WIDTH - mapW - 8;
        const my = 8;

        // 背景
        ctx.fillStyle = 'rgba(13,10,8,0.8)';
        ctx.fillRect(mx - 4, my - 4, mapW + 8, mapH + 8);
        ctx.strokeStyle = COLORS.uiBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 4, my - 4, mapW + 8, mapH + 8);

        // 房间
        for (let gy = 0; gy < dungeon.gridH; gy++) {
            for (let gx = 0; gx < dungeon.gridW; gx++) {
                const key = `${gx},${gy}`;
                const room = dungeon.rooms[key];
                if (!room) continue;

                const px = mx + gx * (cellSize + gap);
                const py = my + gy * (cellSize + gap);

                // 颜色
                let color = COLORS.uiBgPanel;
                if (key === dungeon.currentRoomKey) {
                    color = COLORS.uiAccent; // 当前房
                } else if (room.state === 'cleared') {
                    color = COLORS.bgFloorTile; // 已清
                } else if (room.state === 'active') {
                    color = '#6a4a2a'; // 战斗中
                } else {
                    color = '#3a2a1a'; // 未探索
                }

                ctx.fillStyle = color;
                ctx.fillRect(px, py, cellSize, cellSize);

                // 特殊房间标记
                if (room.type === 'boss' && room.state !== 'cleared') {
                    ctx.fillStyle = COLORS.uiRed;
                    ctx.font = 'bold 10px Courier New';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('B', px + cellSize / 2, py + cellSize / 2);
                } else if (room.type === 'treasure' && room.state !== 'cleared') {
                    ctx.fillStyle = COLORS.uiAccent;
                    ctx.font = 'bold 10px Courier New';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('T', px + cellSize / 2, py + cellSize / 2);
                } else if (room.type === 'start') {
                    ctx.fillStyle = COLORS.uiGreen;
                    ctx.font = 'bold 10px Courier New';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('S', px + cellSize / 2, py + cellSize / 2);
                }
            }
        }

        // 连接线
        ctx.strokeStyle = COLORS.uiBorder;
        ctx.lineWidth = 1;
        for (const [key, room] of Object.entries(dungeon.rooms)) {
            const [gx, gy] = key.split(',').map(Number);
            const px = mx + gx * (cellSize + gap) + cellSize / 2;
            const py = my + gy * (cellSize + gap) + cellSize / 2;
            for (const dir of DIRECTIONS) {
                const { dx, dy } = dirToGrid(dir);
                if (room.doors[dir.name]) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + dx * (cellSize + gap), py + dy * (cellSize + gap));
                    ctx.stroke();
                }
            }
        }
    },

    // ---------- 粒子 ----------
    drawParticles(ctx, particles) {
        for (const p of particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    // ---------- 道具栏HUD ----------
    drawItemBar(ctx, player) {
        const startX = 12;
        const startY = 50;
        const size = 14;
        const gap = 4;

        for (let i = 0; i < player.items.length; i++) {
            const item = player.items[i];
            const x = startX + i * (size * 2 + gap);
            this._drawItemIcon(ctx, item.def || item, x + size, startY + size, size);
        }
    },

    // ---------- 移动端虚拟摇杆 ----------
    drawJoystick(ctx, stick, color) {
        if (!stick.active) return;

        // 游戏画面坐标 → canvas 坐标
        // 用布局坐标（offsetLeft/offsetWidth）而非 getBoundingClientRect，
        // 这样画面被 CSS 强制旋转 90° 时映射依然正确
        const canvas = document.getElementById('gameCanvas');
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;
        const bx = (stick.startX - canvas.offsetLeft) * scaleX;
        const by = (stick.startY - canvas.offsetTop) * scaleY;

        const R = 46 * scaleX;       // 底圈半径
        const maxKnob = R * 0.65;   // 手柄最大偏移

        // 底圈
        ctx.strokeStyle = 'rgba(232, 216, 200, 0.3)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(13, 10, 8, 0.25)';
        ctx.beginPath();
        ctx.arc(bx, by, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 方向刻度
        ctx.strokeStyle = 'rgba(232, 216, 200, 0.15)';
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(a) * R * 0.55, by + Math.sin(a) * R * 0.55);
            ctx.lineTo(bx + Math.cos(a) * R * 0.85, by + Math.sin(a) * R * 0.85);
            ctx.stroke();
        }

        // 手柄（跟随手指，限制在底圈内）
        const len = Math.hypot(stick.dx * scaleX, stick.dy * scaleY);
        const k = len > maxKnob ? maxKnob / len : 1;
        const kx = bx + stick.dx * scaleX * k;
        const ky = by + stick.dy * scaleY * k;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(kx, ky, R * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(232, 216, 200, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },
};
