// ==================== 敌人类 ====================

class Enemy {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.dead = false;
        this.hitFlash = 0;
        this.spawnAnim = 0;
        this.animTimer = rand(0, Math.PI * 2);

        const cfg = CONFIG.ENEMIES[type];
        this.maxHp = cfg.hp;
        this.hp = cfg.hp;
        this.damage = cfg.damage;
        this.speed = cfg.speed;
        this.radius = cfg.radius;
        this.scoreValue = cfg.scoreValue;

        // AI 状态
        this.aiState = 'idle';
        this.aiTimer = 0;
        this.targetX = x;
        this.targetY = y;
        this.vx = 0;
        this.vy = 0;
    }

    update(dt, game) {
        if (this.dead) return;

        this.animTimer += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt * 5;
        this.spawnAnim = Math.min(1, this.spawnAnim + dt * 2);

        // 不同敌人不同AI
        switch (this.type) {
            case 'fly': this.updateFly(dt, game); break;
            case 'slime': this.updateSlime(dt, game); break;
            case 'spider': this.updateSpider(dt, game); break;
            case 'boss': this.updateBoss(dt, game); break;
        }

        // 碰撞墙壁
        const room = game.currentRoom;
        this.x = room.clampEntityX(this, this.x);
        this.y = room.clampEntityY(this, this.y);
    }

    // 苍蝇：随机游荡，偶尔追踪玩家
    updateFly(dt, game) {
        this.aiTimer -= dt;

        if (this.aiTimer <= 0) {
            // 70%随机方向，30%追玩家
            if (chance(0.3)) {
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const n = normalize(dx, dy);
                this.vx = n.x * this.speed * 0.8;
                this.vy = n.y * this.speed * 0.8;
            } else {
                const angle = rand(0, Math.PI * 2);
                this.vx = Math.cos(angle) * this.speed * 0.6;
                this.vy = Math.sin(angle) * this.speed * 0.6;
            }
            this.aiTimer = rand(0.3, 0.8);
        }

        // 平滑移动
        this.x += this.vx;
        this.y += this.vy;

        // 碰墙反弹
        const room = game.currentRoom;
        const bounds = room.getInteriorBounds();
        if (this.x - this.radius < bounds.x) { this.x = bounds.x + this.radius; this.vx *= -0.5; }
        if (this.x + this.radius > bounds.x + bounds.w) { this.x = bounds.x + bounds.w - this.radius; this.vx *= -0.5; }
        if (this.y - this.radius < bounds.y) { this.y = bounds.y + this.radius; this.vy *= -0.5; }
        if (this.y + this.radius > bounds.y + bounds.h) { this.y = bounds.y + bounds.h - this.radius; this.vy *= -0.5; }
    }

    // 黏液怪：朝玩家方向慢速移动，偶尔跳跃
    updateSlime(dt, game) {
        this.aiTimer -= dt;

        if (this.aiTimer <= 0) {
            // 朝玩家方向设定目标
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const n = normalize(dx, dy);

            if (chance(0.4)) {
                // 跳跃冲刺
                this.vx = n.x * this.speed * 2.5;
                this.vy = n.y * this.speed * 2.5;
                this.aiTimer = rand(0.4, 0.8);
            } else {
                // 慢速移动
                this.vx = n.x * this.speed * 0.6;
                this.vy = n.y * this.speed * 0.6;
                this.aiTimer = rand(0.6, 1.2);
            }
        }

        // 衰减速度
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx;
        this.y += this.vy;
    }

    // 蜘蛛：快速冲刺后停顿，反复
    updateSpider(dt, game) {
        this.aiTimer -= dt;

        if (this.aiTimer <= 0) {
            if (this.aiState === 'idle') {
                // 冲刺
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const n = normalize(dx, dy);
                // 加一点随机偏移
                const angle = Math.atan2(n.y, n.x) + rand(-0.3, 0.3);
                this.vx = Math.cos(angle) * this.speed * 2.5;
                this.vy = Math.sin(angle) * this.speed * 2.5;
                this.aiState = 'dash';
                this.aiTimer = rand(0.15, 0.25);
            } else {
                // 停顿
                this.vx = 0;
                this.vy = 0;
                this.aiState = 'idle';
                this.aiTimer = rand(0.4, 0.8);
            }
        }

        // dash时快速衰减
        if (this.aiState === 'dash') {
            this.vx *= 0.92;
            this.vy *= 0.92;
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    // Boss Monstro：站桩，发射扇形弹幕，偶尔跳跃
    updateBoss(dt, game) {
        this.aiTimer -= dt;

        if (this.aiTimer <= 0) {
            // 随机选择攻击模式
            const pattern = randInt(1, 3);

            if (pattern === 1) {
                // 扇形弹幕
                const count = 8;
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
                    const bullet = new EnemyBullet(
                        this.x, this.y,
                        Math.cos(angle), Math.sin(angle),
                        { damage: 1, speed: 3, size: 7 }
                    );
                    game.enemyBullets.push(bullet);
                }
                this.aiTimer = rand(1.5, 2.5);
            } else if (pattern === 2) {
                // 朝玩家连发3发
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (this.dead) return;
                        const dx = game.player.x - this.x;
                        const dy = game.player.y - this.y;
                        const n = normalize(dx, dy);
                        const bullet = new EnemyBullet(
                            this.x, this.y,
                            n.x, n.y,
                            { damage: 1, speed: 4, size: 8 }
                        );
                        game.enemyBullets.push(bullet);
                    }, i * 200);
                }
                this.aiTimer = rand(2, 3);
            } else {
                // 跳跃攻击 - 朝玩家方向移动
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const n = normalize(dx, dy);
                this.vx = n.x * this.speed * 8;
                this.vy = n.y * this.speed * 8;
                this.aiTimer = rand(1, 1.5);
            }
        }

        // 衰减
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.x += this.vx;
        this.y += this.vy;

        // 碰墙
        const room = game.currentRoom;
        const bounds = room.getInteriorBounds();
        if (this.x - this.radius < bounds.x) { this.x = bounds.x + this.radius; }
        if (this.x + this.radius > bounds.x + bounds.w) { this.x = bounds.x + bounds.w - this.radius; }
        if (this.y - this.radius < bounds.y) { this.y = bounds.y + this.radius; }
        if (this.y + this.radius > bounds.y + bounds.h) { this.y = bounds.y + bounds.h - this.radius; }
    }

    takeDamage(amount, game) {
        this.hp -= amount;
        this.hitFlash = 1;

        if (this.hp <= 0) {
            this.dead = true;
            game.onEnemyDeath(this);
        } else {
            // 存活时播放受击音（死亡音由 onEnemyDeath 播放）
            if (this.type === 'boss') Sfx.bossHurt();
            else Sfx.hit();
        }
    }

    draw(ctx) {
        Renderer.drawEnemy(ctx, this);
    }
}
