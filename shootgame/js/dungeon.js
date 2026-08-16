// ==================== 地牢生成 ====================

class Dungeon {
    constructor(floorNum) {
        this.floorNum = floorNum;
        this.gridW = CONFIG.DUNGEON_GRID_W;
        this.gridH = CONFIG.DUNGEON_GRID_H;
        this.rooms = {}; // "x,y" -> Room
        this.startRoomKey = null;
        this.bossRoomKey = null;
        this.currentRoomKey = null;
        this.generate();
    }

    key(x, y) {
        return `${x},${y}`;
    }

    generate() {
        let placed = new Set();
        let attempts = 0;

        do {
            placed.clear();
            this.generateAttempt(placed);
            attempts++;
        } while (placed.size < CONFIG.ROOMS_PER_FLOOR_MIN && attempts < 10);

        // 如果还是太少，强制扩展
        if (placed.size < CONFIG.ROOMS_PER_FLOOR_MIN) {
            console.warn('Dungeon generation failed to reach minimum rooms, forcing expansion');
            this.forceExpand(placed);
        }

        this.createRoomsAndConnect(placed);
    }

    generateAttempt(placed) {
        const startX = Math.floor(this.gridW / 2);
        const startY = Math.floor(this.gridH / 2);
        this.startRoomKey = this.key(startX, startY);

        const numRooms = randInt(CONFIG.ROOMS_PER_FLOOR_MIN, CONFIG.ROOMS_PER_FLOOR_MAX);
        placed.add(this.startRoomKey);

        // BFS 扩展
        const queue = [{ x: startX, y: startY }];
        let startConnected = false;

        while (queue.length > 0 && placed.size < numRooms) {
            const cell = queue.shift();
            const isStart = cell.x === startX && cell.y === startY;

            // 尝试4个方向
            const shuffledDirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);

            for (const dir of shuffledDirs) {
                if (placed.size >= numRooms) break;
                const { dx, dy } = dirToGrid(dir);
                const nx = cell.x + dx;
                const ny = cell.y + dy;
                const nKey = this.key(nx, ny);

                // 边界检查
                if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
                if (placed.has(nKey)) continue;

                // 防止环：邻居数 >= 2 则不添加
                if (this.countNeighbors(nx, ny, placed) >= 2) continue;

                // 起始房必须至少有一个连接
                const forceAdd = isStart && !startConnected;

                // 50%概率跳过（模拟原版），但起始房第一次强制连接
                if (!forceAdd && chance(0.5)) continue;

                placed.add(nKey);
                queue.push({ x: nx, y: ny });
                if (isStart) startConnected = true;
            }
        }
    }

    forceExpand(placed) {
        const startX = Math.floor(this.gridW / 2);
        const startY = Math.floor(this.gridH / 2);
        while (placed.size < CONFIG.ROOMS_PER_FLOOR_MIN) {
            // 从已有房间随机找一个，强制添加一个邻居
            const keys = Array.from(placed);
            const k = keys[Math.floor(Math.random() * keys.length)];
            const [x, y] = k.split(',').map(Number);
            const dirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);
            let added = false;
            for (const dir of dirs) {
                const { dx, dy } = dirToGrid(dir);
                const nx = x + dx;
                const ny = y + dy;
                const nKey = this.key(nx, ny);
                if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
                if (placed.has(nKey)) continue;
                if (this.countNeighbors(nx, ny, placed) >= 3) continue;
                placed.add(nKey);
                added = true;
                break;
            }
            if (!added) break;
        }
    }

    createRoomsAndConnect(placed) {
        this.rooms = {};

        // 创建房间对象
        for (const k of placed) {
            const [x, y] = k.split(',').map(Number);
            this.rooms[k] = new Room(x, y, 'normal');
        }

        // 连接门
        for (const k of placed) {
            const [x, y] = k.split(',').map(Number);
            const room = this.rooms[k];
            for (const dir of DIRECTIONS) {
                const { dx, dy } = dirToGrid(dir);
                const nKey = this.key(x + dx, y + dy);
                if (placed.has(nKey)) {
                    room.doors[dir.name] = true;
                }
            }
        }

        // 找死胡同
        const deadEnds = [];
        for (const k of placed) {
            const room = this.rooms[k];
            const doorCount = Object.values(room.doors).filter(d => d).length;
            if (doorCount === 1) deadEnds.push(k);
        }

        // 计算每个房间到起点的距离（BFS）
        const distances = this.bfsDistances(this.startRoomKey, placed);

        // Boss房 = 距起点最远的死胡同
        let maxDist = -1;
        this.bossRoomKey = null;
        for (const k of deadEnds) {
            if (distances[k] > maxDist) {
                maxDist = distances[k];
                this.bossRoomKey = k;
            }
        }
        if (!this.bossRoomKey && deadEnds.length > 0) {
            this.bossRoomKey = deadEnds[0];
        }
        if (this.bossRoomKey) {
            this.rooms[this.bossRoomKey].type = 'boss';
        }

        // 宝藏房 = 另一个死胡同（非boss、非起点）
        const otherDeadEnds = deadEnds.filter(k => k !== this.bossRoomKey && k !== this.startRoomKey);
        if (otherDeadEnds.length > 0) {
            const treasureKey = pick(otherDeadEnds);
            this.rooms[treasureKey].type = 'treasure';
            this.rooms[treasureKey].spawnTreasure();
        }

        // 设置起点房
        if (this.rooms[this.startRoomKey]) {
            this.rooms[this.startRoomKey].type = 'start';
            this.rooms[this.startRoomKey].state = 'cleared';
        }

        // 为每个房间生成敌人
        for (const k of placed) {
            const room = this.rooms[k];
            if (room.type === 'normal' || room.type === 'boss') {
                room.spawnEnemies(this.floorNum);
            }
        }

        this.currentRoomKey = this.startRoomKey;
    }

    countNeighbors(x, y, placed) {
        let count = 0;
        for (const dir of DIRECTIONS) {
            const { dx, dy } = dirToGrid(dir);
            if (placed.has(this.key(x + dx, y + dy))) count++;
        }
        return count;
    }

    bfsDistances(startKey, placed) {
        const distances = {};
        distances[startKey] = 0;
        const queue = [startKey];
        while (queue.length > 0) {
            const k = queue.shift();
            const [x, y] = k.split(',').map(Number);
            for (const dir of DIRECTIONS) {
                const { dx, dy } = dirToGrid(dir);
                const nKey = this.key(x + dx, y + dy);
                if (placed.has(nKey) && !(nKey in distances)) {
                    distances[nKey] = distances[k] + 1;
                    queue.push(nKey);
                }
            }
        }
        return distances;
    }

    get currentRoom() {
        return this.rooms[this.currentRoomKey];
    }

    // 切换到相邻房间
    moveToRoom(dir) {
        const { dx, dy } = dirToGrid(dir);
        const [x, y] = this.currentRoomKey.split(',').map(Number);
        const nKey = this.key(x + dx, y + dy);
        if (this.rooms[nKey]) {
            this.currentRoomKey = nKey;
            return true;
        }
        return false;
    }

    // 获取房间在地图上的位置（小地图用）
    getRoomMap() {
        const map = {};
        for (const [k, room] of Object.entries(this.rooms)) {
            map[k] = {
                type: room.type,
                state: room.state,
                doors: { ...room.doors },
            };
        }
        return map;
    }
}
