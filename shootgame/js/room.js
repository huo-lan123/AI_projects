// ==================== 房间类 ====================

class Room {
    constructor(gridX, gridY, type) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.type = type; // 'start', 'normal', 'treasure', 'boss'
        this.doors = { up: false, down: false, left: false, right: false };
        this.enemies = [];
        this.items = [];
        this.pickups = [];
        this.obstacles = []; // {gridX, gridY, type: 'rock'}
        this.state = 'unvisited'; // 'unvisited', 'active', 'cleared'
        this.generateLayout();
    }

    generateLayout() {
        // 起始房：无障碍物
        if (this.type === 'start') {
            this.state = 'cleared';
            return;
        }

        // Boss房：开阔竞技场，少量障碍
        if (this.type === 'boss') {
            // 四角各放一个石头
            const cornerOffset = 2;
            this.obstacles.push({ gridX: cornerOffset, gridY: cornerOffset, type: 'rock' });
            this.obstacles.push({ gridX: CONFIG.ROOM_INNER_COLS - 1 - cornerOffset, gridY: cornerOffset, type: 'rock' });
            this.obstacles.push({ gridX: cornerOffset, gridY: CONFIG.ROOM_INNER_ROWS - 1 - cornerOffset, type: 'rock' });
            this.obstacles.push({ gridX: CONFIG.ROOM_INNER_COLS - 1 - cornerOffset, gridY: CONFIG.ROOM_INNER_ROWS - 1 - cornerOffset, type: 'rock' });
            return;
        }

        // 普通房和宝藏房：随机障碍物
        const numRocks = randInt(2, 5);
        const occupied = new Set();

        for (let i = 0; i < numRocks; i++) {
            let gx, gy, key;
            let tries = 0;
            do {
                gx = randInt(1, CONFIG.ROOM_INNER_COLS - 2);
                gy = randInt(1, CONFIG.ROOM_INNER_ROWS - 2);
                key = `${gx},${gy}`;
                tries++;
            } while (occupied.has(key) && tries < 10);

            // 不要放在门口
            if (this.isNearDoor(gx, gy)) continue;
            // 不要放在房间正中央（玩家出生点附近）
            if (Math.abs(gx - Math.floor(CONFIG.ROOM_INNER_COLS / 2)) <= 1 &&
                Math.abs(gy - Math.floor(CONFIG.ROOM_INNER_ROWS / 2)) <= 1) continue;

            occupied.add(key);
            this.obstacles.push({ gridX: gx, gridY: gy, type: 'rock' });
        }
    }

    isNearDoor(gx, gy) {
        const midX = Math.floor(CONFIG.ROOM_INNER_COLS / 2);
        const midY = Math.floor(CONFIG.ROOM_INNER_ROWS / 2);
        // 上下门
        if (this.doors.up && gx === midX && gy === 0) return true;
        if (this.doors.down && gx === midX && gy === CONFIG.ROOM_INNER_ROWS - 1) return true;
        // 左右门
        if (this.doors.left && gy === midY && gx === 0) return true;
        if (this.doors.right && gy === midY && gx === CONFIG.ROOM_INNER_COLS - 1) return true;
        return false;
    }

    // 获取房间内部像素边界（canvas坐标）
    getInteriorBounds() {
        const wallPx = CONFIG.WALL_THICKNESS * CONFIG.TILE_SIZE;
        return {
            x: CONFIG.ROOM_OFFSET_X + wallPx,
            y: CONFIG.ROOM_OFFSET_Y + wallPx,
            w: CONFIG.ROOM_INNER_COLS * CONFIG.TILE_SIZE,
            h: CONFIG.ROOM_INNER_ROWS * CONFIG.TILE_SIZE,
        };
    }

    // 网格坐标转像素中心
    gridToPixel(gx, gy) {
        const b = this.getInteriorBounds();
        return {
            x: b.x + gx * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            y: b.y + gy * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
        };
    }

    // 检查像素位置是否在障碍物上
    isObstacleAt(px, py) {
        const b = this.getInteriorBounds();
        const gx = Math.floor((px - b.x) / CONFIG.TILE_SIZE);
        const gy = Math.floor((py - b.y) / CONFIG.TILE_SIZE);
        for (const obs of this.obstacles) {
            if (obs.gridX === gx && obs.gridY === gy) return true;
        }
        return false;
    }

    // 门通行检查
    _canPassDoor(dir) {
        return this.doors[dir] && this.state === 'cleared';
    }

    // 碰撞约束：墙壁 + 障碍物 + 门通行
    clampEntityX(entity, newX) {
        const b = this.getInteriorBounds();
        const r = entity.radius;
        const midY = b.y + b.h / 2;
        const doorHalfW = CONFIG.TILE_SIZE * 0.7;
        const inDoorZoneY = Math.abs(entity.y - midY) < doorHalfW;

        // 左墙
        let minX = b.x + r;
        if (this._canPassDoor('left') && inDoorZoneY) minX = b.x - 30;
        // 右墙
        let maxX = b.x + b.w - r;
        if (this._canPassDoor('right') && inDoorZoneY) maxX = b.x + b.w + 30;
        newX = clamp(newX, minX, maxX);

        // 障碍物碰撞（不在门口时）
        if (!inDoorZoneY || (!this.doors.left && !this.doors.right)) {
            for (const obs of this.obstacles) {
                const pos = this.gridToPixel(obs.gridX, obs.gridY);
                const ox = pos.x - CONFIG.TILE_SIZE / 2;
                const oy = pos.y - CONFIG.TILE_SIZE / 2;
                if (circleRectCollide(newX, entity.y, r, ox, oy, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)) {
                    if (newX < pos.x) newX = ox - r;
                    else newX = ox + CONFIG.TILE_SIZE + r;
                }
            }
        }

        return newX;
    }

    clampEntityY(entity, newY) {
        const b = this.getInteriorBounds();
        const r = entity.radius;
        const midX = b.x + b.w / 2;
        const doorHalfW = CONFIG.TILE_SIZE * 0.7;
        const inDoorZoneX = Math.abs(entity.x - midX) < doorHalfW;

        // 上墙
        let minY = b.y + r;
        if (this._canPassDoor('up') && inDoorZoneX) minY = b.y - 30;
        // 下墙
        let maxY = b.y + b.h - r;
        if (this._canPassDoor('down') && inDoorZoneX) maxY = b.y + b.h + 30;
        newY = clamp(newY, minY, maxY);

        // 障碍物碰撞（不在门口时）
        if (!inDoorZoneX || (!this.doors.up && !this.doors.down)) {
            for (const obs of this.obstacles) {
                const pos = this.gridToPixel(obs.gridX, obs.gridY);
                const ox = pos.x - CONFIG.TILE_SIZE / 2;
                const oy = pos.y - CONFIG.TILE_SIZE / 2;
                if (circleRectCollide(entity.x, newY, r, ox, oy, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)) {
                    if (newY < pos.y) newY = oy - r;
                    else newY = oy + CONFIG.TILE_SIZE + r;
                }
            }
        }

        return newY;
    }

    // 检查是否所有敌人已清
    checkCleared() {
        return this.enemies.every(e => e.dead);
    }

    // 生成敌人
    spawnEnemies(floorNum) {
        if (this.type === 'start' || this.type === 'treasure') return;

        if (this.type === 'boss') {
            const b = this.getInteriorBounds();
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h / 2 - 40;
            this.enemies.push(new Enemy('boss', cx, cy));
            return;
        }

        // 普通房间：3-6个敌人
        const count = randInt(3, 6);
        const b = this.getInteriorBounds();
        const enemyTypes = ['fly', 'slime', 'spider'];

        for (let i = 0; i < count; i++) {
            let x, y, tries = 0;
            do {
                x = b.x + rand(CONFIG.TILE_SIZE * 1.5, b.w - CONFIG.TILE_SIZE * 1.5);
                y = b.y + rand(CONFIG.TILE_SIZE * 1.5, b.h - CONFIG.TILE_SIZE * 1.5);
                tries++;
            } while (this.isObstacleAt(x, y) && tries < 10);

            const type = pick(enemyTypes);
            this.enemies.push(new Enemy(type, x, y));
        }
    }

    // 生成宝藏房道具
    spawnTreasure() {
        if (this.type !== 'treasure') return;
        const b = this.getInteriorBounds();
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const def = pick(ITEM_POOL);
        this.items.push(new ItemDrop(def, cx, cy));
    }
}
