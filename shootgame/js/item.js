// ==================== 道具类 ====================

class ItemDrop {
    constructor(def, x, y) {
        this.def = def;
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.bobOffset = 0;
        this.glowPhase = rand(0, Math.PI * 2);
        this.collected = false;
    }

    update(dt) {
        this.bobOffset = Math.sin(Date.now() / 300 + this.glowPhase) * 4;
        this.glowPhase += dt * 3;
    }

    draw(ctx) {
        Renderer.drawItemDrop(ctx, this);
    }
}

// 掉落物（心、金币）
class Pickup {
    constructor(type, x, y) {
        this.type = type; // 'heart', 'coin'
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.bobOffset = 0;
        this.phase = rand(0, Math.PI * 2);
        this.collected = false;
    }

    update(dt) {
        this.bobOffset = Math.sin(Date.now() / 250 + this.phase) * 3;
        this.phase += dt * 4;
    }

    draw(ctx) {
        Renderer.drawPickup(ctx, this);
    }

    // 应用到玩家
    apply(player) {
        if (this.type === 'heart') {
            player.heal(1); // 半心
            return 'half_heart';
        } else if (this.type === 'coin') {
            // 金币暂时只用于统计
            return 'coin';
        }
        return null;
    }
}

// 生成随机掉落
function spawnDrop(x, y, game, isBossKill = false) {
    const r = Math.random();
    if (isBossKill) {
        // Boss必定掉道具
        const def = pick(ITEM_POOL);
        game.items.push(new ItemDrop(def, x, y));
        return;
    }

    if (r < CONFIG.DROP_RATES.item) {
        // 道具
        const def = pick(ITEM_POOL);
        game.items.push(new ItemDrop(def, x, y));
    } else if (r < CONFIG.DROP_RATES.item + CONFIG.DROP_RATES.heart) {
        // 心
        game.pickups.push(new Pickup('heart', x, y));
    } else if (r < CONFIG.DROP_RATES.item + CONFIG.DROP_RATES.heart + CONFIG.DROP_RATES.coin) {
        // 金币
        game.pickups.push(new Pickup('coin', x, y));
    }
    // 否则无掉落
}
