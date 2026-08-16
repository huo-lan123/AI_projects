// ==================== 玩家类 ====================

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.PLAYER.radius;

        // 基础属性
        const p = CONFIG.PLAYER;
        this.maxHealth = p.maxHealth;
        this.health = p.maxHealth;
        this.baseDamage = p.damage;
        this.baseAttackSpeed = p.attackSpeed;
        this.baseMoveSpeed = p.moveSpeed;
        this.baseRange = p.range;
        this.baseShotSpeed = p.shotSpeed;
        this.baseTearSize = p.tearSize;

        // 射击形态
        this.baseShotCount = 1;  // 同向平行弹数
        this.baseSpread = 0;     // 扇形侧向弹数(每侧)
        this.basePiercing = false;

        // 当前属性（含道具加成）
        this.damage = this.baseDamage;
        this.attackSpeed = this.baseAttackSpeed;
        this.moveSpeed = this.baseMoveSpeed;
        this.range = this.baseRange;
        this.shotSpeed = this.baseShotSpeed;
        this.tearSize = this.baseTearSize;
        this.shotCount = this.baseShotCount;
        this.spread = this.baseSpread;
        this.piercing = this.basePiercing;

        // 射击控制
        this.shootCooldown = 0;
        this.shootTimer = 0;
        this.lastShootDir = { x: 0, y: 1 };

        // 受伤无敌
        this.invincibleTimer = 0;
        this.hitFlash = 0;

        // 外观
        this.facingDir = 'down'; // up/down/left/right
        this.walkAnim = 0;
        this.isMoving = false;

        // 道具
        this.items = [];
        this.itemEffects = {};

        // 统计
        this.kills = 0;
        this.itemsCollected = 0;
    }

    get invincible() {
        return this.invincibleTimer > 0;
    }

    // 应用道具效果
    applyItem(item) {
        this.items.push(item);
        this.itemEffects[item.id] = item;

        // 重新计算属性
        let damage = this.baseDamage;
        let attackSpeed = this.baseAttackSpeed;
        let moveSpeed = this.baseMoveSpeed;
        let range = this.baseRange;
        let shotSpeed = this.baseShotSpeed;
        let tearSize = this.baseTearSize;
        let maxHealth = CONFIG.PLAYER.maxHealth;
        let shotCount = this.baseShotCount;
        let spread = this.baseSpread;
        let piercing = this.basePiercing;

        for (const it of this.items) {
            const e = it.effects;
            if (e.damage) damage *= e.damage;
            if (e.attackSpeed) attackSpeed *= e.attackSpeed;
            if (e.moveSpeed) moveSpeed *= e.moveSpeed;
            if (e.range) range *= e.range;
            if (e.shotSpeed) shotSpeed *= e.shotSpeed;
            if (e.tearSize) tearSize *= e.tearSize;
            if (e.maxHealth) maxHealth += e.maxHealth;
            if (e.shotCount) shotCount += e.shotCount;
            if (e.spread) spread += e.spread;
            if (e.piercing) piercing = true;
        }

        // 上限保护：同向弹最多3发，扇形每侧最多2发
        shotCount = Math.min(shotCount, 3);
        spread = Math.min(spread, 2);

        this.damage = damage;
        this.attackSpeed = attackSpeed;
        this.moveSpeed = moveSpeed;
        this.range = range;
        this.shotSpeed = shotSpeed;
        this.tearSize = tearSize;
        this.shotCount = shotCount;
        this.spread = spread;
        this.piercing = piercing;

        if (maxHealth > this.maxHealth) {
            this.maxHealth = maxHealth;
            this.health = this.maxHealth; // 回满血
        }
    }

    // 获取道具数量（影响外观）
    get transformationLevel() {
        return this.items.length;
    }

    update(dt, game) {
        // 计时器
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt * 5;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // 移动
        const moveVec = Input.getMoveVector();
        const speed = this.moveSpeed;
        const newX = this.x + moveVec.x * speed;
        const newY = this.y + moveVec.y * speed;

        // 碰撞检测（墙壁和障碍物）
        const room = game.currentRoom;
        this.x = room.clampEntityX(this, newX);
        this.y = room.clampEntityY(this, newY);

        this.isMoving = (moveVec.x !== 0 || moveVec.y !== 0);
        if (this.isMoving) {
            this.walkAnim += dt * 8;
        }

        // 射击
        const shootDir = Input.getShootDirection();
        if (shootDir && this.shootCooldown <= 0) {
            this.shoot(shootDir, game);
            this.shootCooldown = 1 / this.attackSpeed;
            this.lastShootDir = shootDir;

            // 设置朝向
            if (Math.abs(shootDir.x) > Math.abs(shootDir.y)) {
                this.facingDir = shootDir.x > 0 ? 'right' : 'left';
            } else {
                this.facingDir = shootDir.y > 0 ? 'down' : 'up';
            }
        }

        // 如果没有射击方向但正在移动，面朝移动方向
        if (!shootDir && this.isMoving) {
            if (Math.abs(moveVec.x) > Math.abs(moveVec.y)) {
                this.facingDir = moveVec.x > 0 ? 'right' : 'left';
            } else {
                this.facingDir = moveVec.y > 0 ? 'down' : 'up';
            }
        }
    }

    shoot(dir, game) {
        Sfx.shoot();
        const tearStats = {
            damage: this.damage,
            speed: this.shotSpeed,
            range: this.range,
            size: this.tearSize,
            pierce: this.piercing,
            type: 'normal',
        };

        // 从角色"眼睛"位置发射
        const offsetX = this.facingDir === 'left' ? -4 : this.facingDir === 'right' ? 4 : 0;
        const offsetY = this.facingDir === 'up' ? -6 : this.facingDir === 'down' ? 2 : -2;
        const ox = this.x + offsetX;
        const oy = this.y + offsetY;

        // 生成发射方向列表：主方向 + 扇形侧向（每侧 spread 发，偏 14° 递增）
        const angles = [];
        const baseAngle = Math.atan2(dir.y, dir.x);
        angles.push(baseAngle);
        for (let s = 1; s <= this.spread; s++) {
            angles.push(baseAngle + s * 0.24);   // 约14°
            angles.push(baseAngle - s * 0.24);
        }

        // 每个方向发射 shotCount 发平行弹（垂直方向偏移 9px 间距）
        const perpX = -dir.y, perpY = dir.x;
        for (const a of angles) {
            const adx = Math.cos(a), ady = Math.sin(a);
            const n = this.shotCount;
            const spacing = 9;
            for (let i = 0; i < n; i++) {
                // n=1 居中；n>1 对称分布
                const off = (i - (n - 1) / 2) * spacing;
                game.bullets.push(new Bullet(
                    ox + perpX * off,
                    oy + perpY * off,
                    adx, ady,
                    'player',
                    tearStats
                ));
            }
        }
    }

    takeDamage(amount, game) {
        if (this.invincible) return;
        this.health -= amount;
        this.invincibleTimer = CONFIG.PLAYER.invincibleTime;
        this.hitFlash = 1;
        Sfx.hurt();

        // 受伤击退效果
        // 闪烁

        if (this.health <= 0) {
            this.health = 0;
            game.playerDeath();
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    draw(ctx) {
        Renderer.drawPlayer(ctx, this);
    }
}
