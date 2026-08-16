// ==================== 主游戏类 ====================

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.state = 'menu'; // menu, playing, dead, victory
        this.lastTime = 0;

        // 游戏数据
        this.player = null;
        this.dungeon = null;
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];

        // 统计
        this.startTime = 0;
        this.kills = 0;
        this.itemsCollected = 0;
        this.currentFloor = 1;

        // 过渡
        this.transitionAlpha = 0;
        this.transitionDir = null;
        this.transitionPhase = null;
        this.transitioning = false;

        // Toast
        this.roomToastTimeout = null;
        this.itemToastTimeout = null;

        // Boss
        this.bossCleared = false;
        this.trapdoor = null;

        // 震屏
        this.shakeAmount = 0;
    }

    get currentRoom() {
        return this.dungeon ? this.dungeon.currentRoom : null;
    }

    init() {
        Input.init();
        this.setupUI();
        this.loop(0);
    }

    setupUI() {
        // 静音按钮
        const muteBtn = document.getElementById('mute-btn');
        const syncMuteUI = () => {
            muteBtn.textContent = Sfx.enabled ? '🔊' : '🔇';
            muteBtn.classList.toggle('muted', !Sfx.enabled);
        };
        muteBtn.addEventListener('click', () => {
            Sfx.unlock();
            Sfx.toggle();
            syncMuteUI();
            Sfx.click();
        });

        const startHandler = () => {
            Sfx.unlock();
            Sfx.click();
            tryLandscapeFullscreen(); // 移动端：自动全屏并锁定横屏
            this.startGame();
        };
        document.getElementById('start-btn').addEventListener('click', startHandler);
        document.getElementById('restart-btn').addEventListener('click', startHandler);
        document.getElementById('victory-restart-btn').addEventListener('click', startHandler);

        // 退出游戏：回到首页
        const exitHandler = () => {
            Sfx.unlock();
            Sfx.click();
            this.returnToMenu();
        };
        document.getElementById('death-exit-btn').addEventListener('click', exitHandler);
        document.getElementById('victory-exit-btn').addEventListener('click', exitHandler);

        // 全屏/横屏按钮
        const fsBtn = document.getElementById('fs-btn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => {
                Sfx.unlock();
                Sfx.click();
                toggleFullscreen();
            });
        }

        window.addEventListener('keydown', (e) => {
            // M 键切换音效
            if (e.code === 'KeyM') {
                Sfx.unlock();
                Sfx.toggle();
                syncMuteUI();
                return;
            }
            if (e.code === 'Space' || e.code === 'Enter') {
                if (this.state === 'menu' || this.state === 'dead' || this.state === 'victory') {
                    e.preventDefault();
                    Sfx.unlock();
                    this.startGame();
                }
            }
        });
    }

    startGame() {
        this.state = 'playing';
        this.currentFloor = 1;
        this.kills = 0;
        this.itemsCollected = 0;
        this.startTime = Date.now();
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.bossCleared = false;
        this.trapdoor = null;
        this.transitioning = false;
        this.transitionAlpha = 0;

        // 创建地牢
        this.dungeon = new Dungeon(1);

        // 创建玩家（放在起始房中心）
        const b = this.currentRoom.getInteriorBounds();
        this.player = new Player(b.x + b.w / 2, b.y + b.h / 2);

        // 进入起始房
        this.enterRoom(null);

        // 隐藏覆盖层
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');

        this.showRoomToast(`地下层 ${this.currentFloor}`);
    }

    // 回到首页（从失败/通关界面退出）
    returnToMenu() {
        this.state = 'menu';
        this.player = null;
        this.dungeon = null;
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];
        this.bossCleared = false;
        this.trapdoor = null;
        this.transitioning = false;
        this.transitionAlpha = 0;
        this.shakeAmount = 0;

        // 隐藏结算界面，显示开始界面
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');

        // 清空 HUD
        document.getElementById('hud-info').innerHTML = '';
        document.getElementById('room-toast').classList.remove('show');
        document.getElementById('item-toast').classList.remove('show');
    }

    // ==================== 房间管理 ====================

    enterRoom(fromDir) {
        const room = this.currentRoom;
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];

        // 定位玩家
        if (fromDir && this.player) {
            const b = room.getInteriorBounds();
            const r = this.player.radius;
            const margin = 20;
            if (fromDir === DIR.LEFT) {
                this.player.x = b.x + r + margin;
                this.player.y = b.y + b.h / 2;
            } else if (fromDir === DIR.RIGHT) {
                this.player.x = b.x + b.w - r - margin;
                this.player.y = b.y + b.h / 2;
            } else if (fromDir === DIR.UP) {
                this.player.x = b.x + b.w / 2;
                this.player.y = b.y + r + margin;
            } else if (fromDir === DIR.DOWN) {
                this.player.x = b.x + b.w / 2;
                this.player.y = b.y + b.h - r - margin;
            }
        }

        // 激活房间
        if (room.state === 'unvisited') {
            const hasEnemies = room.enemies.some(e => !e.dead);
            if (hasEnemies) {
                room.state = 'active';
            } else {
                room.state = 'cleared';
            }
        }

        // 提示
        if (room.type === 'boss' && room.state === 'active') {
            this.showRoomToast('Boss!');
            Sfx.bossRoar();
        } else if (room.type === 'treasure' && room.state === 'unvisited') {
            this.showRoomToast('宝藏房');
        }
    }

    transitionRoom(dir) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.transitionDir = dir;
        this.transitionPhase = 'out';
    }

    updateTransition(dt) {
        if (!this.transitioning) return;

        if (this.transitionPhase === 'out') {
            this.transitionAlpha += dt * 5;
            if (this.transitionAlpha >= 1) {
                this.transitionAlpha = 1;
                // 切换房间
                Sfx.door();
                this.dungeon.moveToRoom(this.transitionDir);
                this.enterRoom(getOppositeDir(this.transitionDir));
                this.transitionPhase = 'in';
            }
        } else if (this.transitionPhase === 'in') {
            this.transitionAlpha -= dt * 5;
            if (this.transitionAlpha <= 0) {
                this.transitionAlpha = 0;
                this.transitioning = false;
                this.transitionPhase = null;
            }
        }
    }

    nextFloor() {
        this.currentFloor++;
        if (this.currentFloor > CONFIG.TOTAL_FLOORS) {
            this.victory();
            return;
        }

        // 生成新地牢
        Sfx.floorDown();
        this.dungeon = new Dungeon(this.currentFloor);
        this.trapdoor = null;
        this.bossCleared = false;
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = [];

        // 定位玩家
        const b = this.currentRoom.getInteriorBounds();
        this.player.x = b.x + b.w / 2;
        this.player.y = b.y + b.h / 2;

        this.enterRoom(null);
        this.showRoomToast(`地下层 ${this.currentFloor}`);
    }

    // ==================== 状态切换 ====================

    playerDeath() {
        this.state = 'dead';
        this.shakeAmount = 15;
        Sfx.death();

        const elapsed = (Date.now() - this.startTime) / 1000;
        document.getElementById('death-kills').textContent = this.kills;
        document.getElementById('death-items').textContent = this.itemsCollected;
        document.getElementById('death-time').textContent = formatTime(elapsed);
        document.getElementById('death-floor').textContent = this.currentFloor;

        // 道具列表
        const listEl = document.getElementById('death-items-list');
        listEl.innerHTML = '';
        if (this.player.items.length === 0) {
            listEl.innerHTML = '<span class="item-badge">无</span>';
        } else {
            for (const item of this.player.items) {
                const badge = document.createElement('div');
                badge.className = 'item-badge';
                badge.textContent = item.name;
                listEl.appendChild(badge);
            }
        }

        setTimeout(() => {
            document.getElementById('death-screen').classList.remove('hidden');
        }, 800);
    }

    victory() {
        this.state = 'victory';
        Sfx.victory();

        const elapsed = (Date.now() - this.startTime) / 1000;
        document.getElementById('victory-kills').textContent = this.kills;
        document.getElementById('victory-items').textContent = this.itemsCollected;
        document.getElementById('victory-time').textContent = formatTime(elapsed);

        const listEl = document.getElementById('victory-items-list');
        listEl.innerHTML = '';
        if (this.player.items.length === 0) {
            listEl.innerHTML = '<span class="item-badge">无</span>';
        } else {
            for (const item of this.player.items) {
                const badge = document.createElement('div');
                badge.className = 'item-badge';
                badge.textContent = item.name;
                listEl.appendChild(badge);
            }
        }

        document.getElementById('victory-screen').classList.remove('hidden');
    }

    // ==================== 更新 ====================

    update(dt) {
        if (this.transitioning) {
            this.updateTransition(dt);
            // 过渡中仍然更新粒子和敌人子弹
            this.updateParticles(dt);
            return;
        }

        this.updatePlayer(dt);
        this.updateBullets(dt);
        this.updateEnemyBullets(dt);
        this.updateEnemies(dt);
        this.updateParticles(dt);
        this.updateItemsPickups(dt);

        this.checkCollisions();
        this.checkDoorTransition();
        this.checkRoomCleared();
        this.checkTrapdoor();

        if (this.shakeAmount > 0) this.shakeAmount -= dt * 40;

        this.updateHUD();
    }

    updatePlayer(dt) {
        if (!this.player) return;
        this.player.update(dt, this);
    }

    updateBullets(dt) {
        const room = this.currentRoom;
        if (!room) return;
        const b = room.getInteriorBounds();

        for (const bullet of this.bullets) {
            bullet.update(dt);

            // 墙壁碰撞
            if (bullet.x < b.x - 5 || bullet.x > b.x + b.w + 5 ||
                bullet.y < b.y - 5 || bullet.y > b.y + b.h + 5) {
                bullet.dead = true;
                Sfx.splash();
                this.spawnParticles(bullet.x, bullet.y, 3, COLORS.tear, 1.5);
                continue;
            }

            // 障碍物碰撞
            for (const obs of room.obstacles) {
                const pos = room.gridToPixel(obs.gridX, obs.gridY);
                const ox = pos.x - CONFIG.TILE_SIZE / 2;
                const oy = pos.y - CONFIG.TILE_SIZE / 2;
                if (circleRectCollide(bullet.x, bullet.y, bullet.radius, ox, oy, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)) {
                    bullet.dead = true;
                    Sfx.splash();
                    this.spawnParticles(bullet.x, bullet.y, 3, '#5a5048', 2);
                    break;
                }
            }
            if (bullet.dead) continue;

            // 敌人碰撞
            for (const enemy of room.enemies) {
                if (enemy.dead) continue;
                if (circleCollide(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
                    // 穿透弹：每个敌人只结算一次，继续飞行
                    if (bullet.pierce) {
                        if (bullet.hitSet.has(enemy)) continue;
                        bullet.hitSet.add(enemy);
                        enemy.takeDamage(bullet.stats.damage, this);
                        this.spawnParticles(bullet.x, bullet.y, 4, COLORS.tear, 2);
                    } else {
                        enemy.takeDamage(bullet.stats.damage, this);
                        bullet.dead = true;
                        this.spawnParticles(bullet.x, bullet.y, 4, COLORS.tear, 2);
                        break;
                    }
                }
            }
        }

        this.bullets = this.bullets.filter(b => !b.dead);
    }

    updateEnemyBullets(dt) {
        const room = this.currentRoom;
        if (!room) return;
        const b = room.getInteriorBounds();

        for (const bullet of this.enemyBullets) {
            bullet.update(dt);

            // 墙壁
            if (bullet.x < b.x - 5 || bullet.x > b.x + b.w + 5 ||
                bullet.y < b.y - 5 || bullet.y > b.y + b.h + 5) {
                bullet.dead = true;
                continue;
            }

            // 障碍物
            for (const obs of room.obstacles) {
                const pos = room.gridToPixel(obs.gridX, obs.gridY);
                if (circleRectCollide(bullet.x, bullet.y, bullet.radius,
                    pos.x - CONFIG.TILE_SIZE / 2, pos.y - CONFIG.TILE_SIZE / 2,
                    CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)) {
                    bullet.dead = true;
                    break;
                }
            }
            if (bullet.dead) continue;

            // 玩家碰撞
            if (this.player && !this.player.invincible) {
                if (circleCollide(bullet.x, bullet.y, bullet.radius, this.player.x, this.player.y, this.player.radius)) {
                    this.player.takeDamage(bullet.stats.damage, this);
                    bullet.dead = true;
                    this.spawnParticles(bullet.x, bullet.y, 4, COLORS.tearEnemy, 2);
                }
            }
        }

        this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
    }

    updateEnemies(dt) {
        const room = this.currentRoom;
        if (!room) return;

        for (const enemy of room.enemies) {
            if (!enemy.dead) {
                enemy.update(dt, this);
            }
        }
    }

    updateParticles(dt) {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.life -= dt * p.decay;
        }
        this.particles = this.particles.filter(p => p.life > 0);
    }

    updateItemsPickups(dt) {
        const room = this.currentRoom;
        if (!room) return;

        for (const item of room.items) {
            if (!item.collected) item.update(dt);
        }
        for (const pickup of room.pickups) {
            if (!pickup.collected) pickup.update(dt);
        }
    }

    // ==================== 碰撞检测 ====================

    checkCollisions() {
        const room = this.currentRoom;
        if (!room || !this.player) return;

        // 敌人接触伤害
        for (const enemy of room.enemies) {
            if (enemy.dead) continue;
            if (circleCollide(this.player.x, this.player.y, this.player.radius,
                enemy.x, enemy.y, enemy.radius)) {
                this.player.takeDamage(enemy.damage, this);
                this.shakeAmount = Math.max(this.shakeAmount, 5);
            }
        }

        // 道具拾取
        for (const item of room.items) {
            if (item.collected) continue;
            if (circleCollide(this.player.x, this.player.y, this.player.radius, item.x, item.y, item.radius)) {
                item.collected = true;
                this.player.applyItem(item.def);
                this.itemsCollected++;
                this.showItemToast(item.def);
                Sfx.item();
                this.spawnParticles(item.x, item.y, 12, COLORS.itemGlow, 3);
            }
        }

        // 掉落物拾取
        for (const pickup of room.pickups) {
            if (pickup.collected) continue;
            if (circleCollide(this.player.x, this.player.y, this.player.radius, pickup.x, pickup.y, pickup.radius)) {
                pickup.collected = true;
                pickup.apply(this.player);
                if (pickup.type === 'heart') Sfx.heart();
                else if (pickup.type === 'coin') Sfx.coin();
                const color = pickup.type === 'heart' ? COLORS.heartFull : COLORS.coinGold;
                this.spawnParticles(pickup.x, pickup.y, 6, color, 2);
            }
        }

        // 清理已拾取
        room.items = room.items.filter(i => !i.collected);
        room.pickups = room.pickups.filter(p => !p.collected);
    }

    checkDoorTransition() {
        if (this.transitioning || !this.player) return;
        const room = this.currentRoom;
        if (!room || room.state !== 'cleared') return;

        const b = room.getInteriorBounds();
        const p = this.player;
        const threshold = 18;

        if (room.doors.up && p.y < b.y - threshold) {
            this.transitionRoom(DIR.UP);
        } else if (room.doors.down && p.y > b.y + b.h + threshold) {
            this.transitionRoom(DIR.DOWN);
        } else if (room.doors.left && p.x < b.x - threshold) {
            this.transitionRoom(DIR.LEFT);
        } else if (room.doors.right && p.x > b.x + b.w + threshold) {
            this.transitionRoom(DIR.RIGHT);
        }
    }

    checkRoomCleared() {
        const room = this.currentRoom;
        if (!room) return;

        if (room.state === 'active' && room.checkCleared()) {
            room.state = 'cleared';
            if (room.type !== 'boss') {
                this.showRoomToast('清除!');
                Sfx.roomClear();
            }
            const b = room.getInteriorBounds();
            this.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, 15, COLORS.itemGlow, 3);
        }
    }

    checkTrapdoor() {
        if (!this.trapdoor || !this.player) return;
        if (circleCollide(this.player.x, this.player.y, this.player.radius,
            this.trapdoor.x, this.trapdoor.y, 22)) {
            this.nextFloor();
        }
    }

    // ==================== 事件 ====================

    onEnemyDeath(enemy) {
        this.kills++;
        this.shakeAmount = Math.max(this.shakeAmount, enemy.type === 'boss' ? 12 : 3);
        if (enemy.type === 'boss') Sfx.bossDie();
        else Sfx.die(enemy.type);

        // 血液粒子
        this.spawnParticles(enemy.x, enemy.y, enemy.type === 'boss' ? 20 : 8,
            COLORS.bloodParticle, enemy.type === 'boss' ? 5 : 3);

        const room = this.currentRoom;
        if (!room) return;

        if (enemy.type === 'boss') {
            // Boss掉道具
            const def = pick(ITEM_POOL);
            room.items.push(new ItemDrop(def, enemy.x, enemy.y));
            this.bossCleared = true;
            // 出现陷阱门
            const b = room.getInteriorBounds();
            this.trapdoor = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
            this.showRoomToast('层间清除! 找到陷阱门进入下一层');
        } else {
            // 普通敌人随机掉落
            const r = Math.random();
            if (r < CONFIG.DROP_RATES.item) {
                const def = pick(ITEM_POOL);
                room.items.push(new ItemDrop(def, enemy.x, enemy.y));
            } else if (r < CONFIG.DROP_RATES.item + CONFIG.DROP_RATES.heart) {
                room.pickups.push(new Pickup('heart', enemy.x, enemy.y));
            } else if (r < CONFIG.DROP_RATES.item + CONFIG.DROP_RATES.heart + CONFIG.DROP_RATES.coin) {
                room.pickups.push(new Pickup('coin', enemy.x, enemy.y));
            }
        }
    }

    spawnParticles(x, y, count, color, speed) {
        for (let i = 0; i < count; i++) {
            const angle = rand(0, Math.PI * 2);
            const spd = rand(0.5, speed);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                r: rand(2, 4),
                color,
                life: 1,
                decay: rand(1.5, 3),
            });
        }
    }

    // ==================== 渲染 ====================

    render() {
        const ctx = this.ctx;

        ctx.save();

        // 震屏
        if (this.shakeAmount > 0) {
            ctx.translate(rand(-this.shakeAmount, this.shakeAmount), rand(-this.shakeAmount, this.shakeAmount));
        }

        Renderer.drawBackground(ctx);

        if (this.state === 'menu') {
            ctx.restore();
            return;
        }

        const room = this.currentRoom;
        if (!room) {
            ctx.restore();
            return;
        }

        // 房间地板
        Renderer.drawRoomFloor(ctx, room);
        Renderer.drawObstacles(ctx, room);

        // 掉落物和道具
        for (const pickup of room.pickups) {
            if (!pickup.collected) pickup.draw(ctx);
        }
        for (const item of room.items) {
            if (!item.collected) item.draw(ctx);
        }

        // 陷阱门
        if (this.trapdoor) {
            this.drawTrapdoor(ctx);
        }

        // 子弹
        for (const bullet of this.bullets) {
            bullet.draw(ctx);
        }
        for (const bullet of this.enemyBullets) {
            bullet.draw(ctx);
        }

        // 敌人
        for (const enemy of room.enemies) {
            if (!enemy.dead) enemy.draw(ctx);
        }

        // 玩家
        if (this.player) this.player.draw(ctx);

        // 粒子
        Renderer.drawParticles(ctx, this.particles);

        // 墙壁和门（覆盖在上层）
        Renderer.drawRoomWalls(ctx, room);

        ctx.restore();

        // HUD（不受震屏影响）
        if (this.player) {
            Renderer.drawHearts(ctx, this.player);
            Renderer.drawItemBar(ctx, this.player);
        }
        if (this.dungeon) {
            Renderer.drawMinimap(ctx, this.dungeon);
        }

        // 过渡遮罩
        if (this.transitionAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.transitionAlpha})`;
            ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        }

        // 移动端虚拟摇杆（触控激活时显示）
        if (Input.isMobile && this.state === 'playing') {
            Renderer.drawJoystick(ctx, Input.touchMove, 'rgba(120, 180, 220, 0.9)');
            Renderer.drawJoystick(ctx, Input.touchShoot, 'rgba(220, 120, 120, 0.9)');
        }
    }

    drawTrapdoor(ctx) {
        const x = this.trapdoor.x;
        const y = this.trapdoor.y;
        const r = 22;
        const phase = Date.now() / 200;

        // 光晕
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        grad.addColorStop(0, 'rgba(232,200,80,0.4)');
        grad.addColorStop(1, 'rgba(232,200,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // 洞口
        ctx.fillStyle = '#0a0805';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 框
        ctx.strokeStyle = '#6a5a3a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // 向下箭头
        ctx.fillStyle = `rgba(232,200,80,${0.6 + Math.sin(phase) * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 7, y - 4);
        ctx.lineTo(x + 7, y - 4);
        ctx.closePath();
        ctx.fill();
    }

    // ==================== UI ====================

    showRoomToast(text) {
        const toast = document.getElementById('room-toast');
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(this.roomToastTimeout);
        this.roomToastTimeout = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    showItemToast(def) {
        const toast = document.getElementById('item-toast');
        toast.innerHTML = `<div class="item-name">${def.name}</div><div class="item-desc">${def.desc}</div>`;
        toast.classList.add('show');
        clearTimeout(this.itemToastTimeout);
        this.itemToastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    updateHUD() {
        const hud = document.getElementById('hud-info');
        const elapsed = (Date.now() - this.startTime) / 1000;
        hud.innerHTML = `<div class="floor-label">地下层 ${this.currentFloor}</div><div class="timer">${formatTime(elapsed)}</div>`;
    }

    // ==================== 游戏循环 ====================

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        if (this.state === 'playing') {
            this.update(dt);
        }
        this.render();
        Input.update();

        requestAnimationFrame((t) => this.loop(t));
    }
}

// ========== 全屏 + 横屏锁定（移动端） ==========

function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// 请求全屏并锁定横屏（Android Chrome 支持；iOS Safari 会忽略锁定，改用旋转提示）
function tryLandscapeFullscreen() {
    if (!isTouchDevice()) return Promise.resolve(false);
    const el = document.documentElement;
    const reqFull = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (!reqFull) return Promise.resolve(false);
    return reqFull.call(el).then(() => {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            return screen.orientation.lock('landscape').then(() => true).catch(() => false);
        }
        return false;
    }).catch(() => false);
}

// 切换全屏（按钮用）
function toggleFullscreen() {
    const cur = document.fullscreenElement || document.webkitFullscreenElement;
    if (cur) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document).catch(() => {});
    } else {
        tryLandscapeFullscreen();
    }
}

// ==================== 启动 ====================
window.addEventListener('load', () => {
    const game = new Game();
    // 仅在 ?debug=1 时暴露调试接口，正常游玩不挂载
    if (new URLSearchParams(location.search).get('debug') === '1') {
        window.game = game;
    }
    game.init();
});
