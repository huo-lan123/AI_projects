// ==================== 眼泪/子弹 ====================

class Bullet {
    constructor(x, y, dirX, dirY, owner, stats) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.dirX = dirX;
        this.dirY = dirY;
        this.owner = owner; // 'player' | 'enemy'
        this.stats = stats; // { damage, speed, range, size, type }

        this.radius = CONFIG.TEAR.radius * (stats.size || 1);
        this.vx = dirX * stats.speed;
        this.vy = dirY * stats.speed;
        this.dead = false;
        this.lifetime = 0;
        this.maxLifetime = CONFIG.TEAR.lifetime;

        // 视觉
        this.wobble = rand(0, Math.PI * 2);
        this.trail = [];
        this.type = stats.type || 'normal'; // normal, big, homing, etc.

        // 穿透：记录已命中的敌人，避免重复伤害
        this.pierce = !!stats.pierce;
        this.hitSet = this.pierce ? new Set() : null;
    }

    update(dt) {
        this.lifetime += dt;

        // 记录轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) this.trail.shift();

        // 移动
        this.x += this.vx;
        this.y += this.vy;

        this.wobble += dt * 10;

        // 距离检查
        const traveled = dist(this.startX, this.startY, this.x, this.y);
        if (traveled > this.stats.range) {
            this.dead = true;
        }

        // 时间检查
        if (this.lifetime > this.maxLifetime) {
            this.dead = true;
        }
    }

    draw(ctx) {
        Renderer.drawTear(ctx, this);
    }
}

// 敌人子弹（不同视觉效果）
class EnemyBullet {
    constructor(x, y, dirX, dirY, stats) {
        this.x = x;
        this.y = y;
        this.dirX = dirX;
        this.dirY = dirY;
        this.stats = stats; // { damage, speed, size }
        this.radius = (stats.size || 6);
        this.vx = dirX * stats.speed;
        this.vy = dirY * stats.speed;
        this.dead = false;
        this.lifetime = 0;
        this.maxLifetime = 5;
        this.wobble = rand(0, Math.PI * 2);
    }

    update(dt) {
        this.lifetime += dt;
        this.x += this.vx;
        this.y += this.vy;
        this.wobble += dt * 8;

        if (this.lifetime > this.maxLifetime) {
            this.dead = true;
        }
    }

    draw(ctx) {
        Renderer.drawEnemyBullet(ctx, this);
    }
}
