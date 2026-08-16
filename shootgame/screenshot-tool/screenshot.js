const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'D:/WorkBuddy_workspace/以撒的结合风格肉鸽游戏/screenshots';
const GAME_URL = 'http://localhost:8080/index.html';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath });
    console.log(`Screenshot saved: ${filepath}`);
    return filepath;
}

async function getGameState(page) {
    return await page.evaluate(() => {
        const g = window.game;
        if (!g) return { hasGame: false };
        const room = g.currentRoom;
        const dungeon = g.dungeon;
        return {
            hasGame: true,
            state: g.state,
            floor: g.currentFloor,
            kills: g.kills,
            itemsCollected: g.itemsCollected,
            player: g.player ? {
                x: Math.round(g.player.x),
                y: Math.round(g.player.y),
                health: g.player.health,
                maxHealth: g.player.maxHealth,
                invincible: g.player.invincible,
            } : null,
            room: room ? {
                gridX: room.gridX,
                gridY: room.gridY,
                type: room.type,
                state: room.state,
                doors: room.doors,
                enemyCount: room.enemies.filter(e => !e.dead).length,
                enemies: room.enemies.filter(e => !e.dead).map(e => ({
                    type: e.type,
                    x: Math.round(e.x),
                    y: Math.round(e.y),
                    hp: Math.round(e.hp),
                })),
                items: room.items.filter(i => !i.collected).length,
                pickups: room.pickups.filter(p => !p.collected).length,
            } : null,
            dungeon: dungeon ? {
                currentKey: dungeon.currentRoomKey,
                rooms: Object.fromEntries(Object.entries(dungeon.rooms).map(([k, r]) => [k, {
                    gridX: r.gridX,
                    gridY: r.gridY,
                    type: r.type,
                    state: r.state,
                    doors: r.doors,
                }])),
            } : null,
            bullets: g.bullets.length,
            transitioning: g.transitioning,
        };
    });
}

async function pressKey(page, key, ms) {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
}

async function pressKeys(page, keys, ms) {
    for (const key of keys) await page.keyboard.down(key);
    await sleep(ms);
    for (const key of keys) await page.keyboard.up(key);
}

async function moveTowards(page, targetX, targetY, durationMs = 1500) {
    const state = await getGameState(page);
    if (!state.player) return;
    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const keys = [];
    if (Math.abs(dx) > 5) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 5) keys.push(dy > 0 ? 'KeyS' : 'KeyW');
    if (keys.length === 0) return;
    await pressKeys(page, keys, durationMs);
}

async function shootAt(page, targetX, targetY, durationMs = 1000) {
    const state = await getGameState(page);
    if (!state.player) return;
    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const keys = [];
    if (Math.abs(dx) > Math.abs(dy)) {
        keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
        keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    await pressKeys(page, keys, durationMs);
}

async function findAndUseDoor(page, visitedKeys) {
    const state = await getGameState(page);
    if (!state.room || state.room.state !== 'cleared') return false;

    const doors = state.room.doors;
    const dirs = [];
    if (doors.up) dirs.push('up');
    if (doors.down) dirs.push('down');
    if (doors.left) dirs.push('left');
    if (doors.right) dirs.push('right');
    if (dirs.length === 0) return false;

    // 优先选择通往未访问房间的门，优先靠近Boss或宝藏房
    let dir = dirs[0];
    const { gridX, gridY } = state.room;
    const deltas = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    // 找到Boss和宝藏房坐标
    let bossPos = null;
    let treasurePos = null;
    for (const [key, r] of Object.entries(state.dungeon.rooms)) {
        if (r.type === 'boss') bossPos = { x: r.gridX, y: r.gridY };
        if (r.type === 'treasure') treasurePos = { x: r.gridX, y: r.gridY };
    }

    const candidates = dirs.map(d => {
        const [dx, dy] = deltas[d];
        const nx = gridX + dx;
        const ny = gridY + dy;
        const key = `${nx},${ny}`;
        const neighbor = state.dungeon.rooms[key];
        return {
            dir: d,
            neighbor,
            unvisited: neighbor && neighbor.state === 'unvisited',
            distToBoss: bossPos ? Math.abs(nx - bossPos.x) + Math.abs(ny - bossPos.y) : 999,
            distToTreasure: treasurePos ? Math.abs(nx - treasurePos.x) + Math.abs(ny - treasurePos.y) : 999,
            isTreasure: neighbor && neighbor.type === 'treasure',
        };
    });

    // 优先未访问的宝藏房，然后未访问且靠近Boss的，然后未访问的，最后任意
    const unvisitedList = candidates.filter(c => c.unvisited);
    const treasureUnvisited = unvisitedList.find(c => c.isTreasure);
    let chosen = treasureUnvisited
        || unvisitedList.sort((a, b) => a.distToBoss - b.distToBoss)[0]
        || candidates[0];

    // 如果宝藏房还没访问过，也优先朝宝藏方向走（即使不是直接相邻）
    if (treasurePos && !visitedKeys.has(`${state.floor}-${treasurePos.x},${treasurePos.y}`)) {
        const towardTreasure = candidates.filter(c => c.unvisited).sort((a, b) => a.distToTreasure - b.distToTreasure)[0];
        if (towardTreasure && towardTreasure.distToTreasure < (chosen.distToTreasure || 999)) {
            chosen = towardTreasure;
        }
    }
    dir = chosen.dir;
    console.log(`Moving through door: ${dir}`);

    const b = await page.evaluate(() => {
        const room = window.game.currentRoom;
        return room.getInteriorBounds();
    });

    const startKey = state.dungeon.currentKey;
    const [dx, dy] = deltas[dir];
    const targetKey = `${gridX + dx},${gridY + dy}`;
    const targetRoom = state.dungeon.rooms[targetKey];
    if (!targetRoom) return false;

    const midX = b.x + b.w / 2;
    const midY = b.y + b.h / 2;
    const threshold = 35;

    // 第一步：对齐到门中心（在房间内）
    let alignX = state.player.x;
    let alignY = state.player.y;
    if (dir === 'up') {
        alignX = midX;
        alignY = b.y + 20;
    } else if (dir === 'down') {
        alignX = midX;
        alignY = b.y + b.h - 20;
    } else if (dir === 'left') {
        alignX = b.x + 20;
        alignY = midY;
    } else if (dir === 'right') {
        alignX = b.x + b.w - 20;
        alignY = midY;
    }
    await moveTowards(page, alignX, alignY, 1200);

    // 第二步：穿过门
    let targetX = state.player.x;
    let targetY = state.player.y;
    if (dir === 'up') {
        targetX = midX;
        targetY = b.y - threshold;
    } else if (dir === 'down') {
        targetX = midX;
        targetY = b.y + b.h + threshold;
    } else if (dir === 'left') {
        targetX = b.x - threshold;
        targetY = midY;
    } else if (dir === 'right') {
        targetX = b.x + b.w + threshold;
        targetY = midY;
    }

    const moveKey = dir === 'up' ? 'KeyW' : dir === 'down' ? 'KeyS' : dir === 'left' ? 'KeyA' : 'KeyD';
    await page.keyboard.down(moveKey);

    let transitioned = false;
    for (let i = 0; i < 40; i++) {
        await sleep(100);
        const s = await getGameState(page);
        if (s.dungeon && s.dungeon.currentKey !== startKey) {
            transitioned = true;
            break;
        }
    }
    await page.keyboard.up(moveKey);

    if (!transitioned) {
        console.log(`Failed to transition through ${dir} door`);
        return false;
    }

    console.log(`Transitioned to ${targetRoom.type} room`);
    await sleep(400);
    return true;
}

async function clearRoom(page) {
    let lastState = null;
    let stallCounter = 0;
    const SAFE_DIST = 150;
    const MIN_DIST = 100;

    const bounds = await page.evaluate(() => window.game.currentRoom.getInteriorBounds());
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;

    for (let i = 0; i < 120; i++) {
        const state = await getGameState(page);
        if (!state.room) break;

        if (state.room.state === 'cleared') {
            console.log('Room cleared');
            break;
        }

        const enemies = state.room.enemies;
        if (enemies.length === 0) break;

        // 低血时优先捡心
        if (state.player.health <= 3 && state.room.pickups > 0) {
            await collectNearestPickup(page, 'heart');
            continue;
        }

        // 找到最近敌人
        let nearest = enemies[0];
        let nearestDist = Infinity;
        for (const e of enemies) {
            const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = e;
            }
        }

        const dx = nearest.x - state.player.x;
        const dy = nearest.y - state.player.y;
        const dist = Math.hypot(dx, dy);

        // 离墙距离
        const margin = 70;
        const nearLeft = state.player.x < bounds.x + margin;
        const nearRight = state.player.x > bounds.x + bounds.w - margin;
        const nearTop = state.player.y < bounds.y + margin;
        const nearBottom = state.player.y > bounds.y + bounds.h - margin;
        const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom);

        let moveX = 0;
        let moveY = 0;

        // 对弱敌或低血敌人：主动靠近并直线对齐射击
        const isWeakEnemy = nearest.type === 'fly' || nearest.hp <= 4;
        const lastEnemy = enemies.length === 1;

        if (lastEnemy && dist > 60) {
            // 只剩一个敌人：直接追杀
            moveX = dx > 0 ? 1 : -1;
            moveY = dy > 0 ? 1 : -1;
        } else if (inCorner) {
            // 被困角落：向房间中心移动
            moveX = centerX > state.player.x ? 1 : -1;
            moveY = centerY > state.player.y ? 1 : -1;
        } else if (isWeakEnemy) {
            // 弱敌：快速接近到射程内，然后对齐射击
            if (dist > 80) {
                moveX = dx > 0 ? 1 : -1;
                moveY = dy > 0 ? 1 : -1;
            } else {
                // 对齐敌人以便射击
                if (Math.abs(dx) > Math.abs(dy)) {
                    moveY = dy > 0 ? 1 : -1;
                    moveX = 0;
                } else {
                    moveX = dx > 0 ? 1 : -1;
                    moveY = 0;
                }
            }
        } else if (dist < MIN_DIST) {
            // 敌人太近：撤退，但避免撞墙
            moveX = dx > 0 ? -1 : 1;
            moveY = dy > 0 ? -1 : 1;
            if (nearLeft && moveX < 0) moveX = 0;
            if (nearRight && moveX > 0) moveX = 0;
            if (nearTop && moveY < 0) moveY = 0;
            if (nearBottom && moveY > 0) moveY = 0;
            // 如果无法继续后退，改为横向移动
            if (moveX === 0 && moveY === 0) {
                moveX = dy > 0 ? 1 : -1;
                moveY = dx > 0 ? 1 : -1;
            }
        } else if (dist > SAFE_DIST) {
            // 敌人太远：靠近
            moveX = dx > 0 ? 1 : -1;
            moveY = dy > 0 ? 1 : -1;
        } else {
            // 理想距离：横向走位，同时稍微远离墙壁
            if (Math.abs(dx) > Math.abs(dy)) {
                moveY = dy > 0 ? -1 : 1;
                if (nearTop && moveY < 0) moveY = 1;
                if (nearBottom && moveY > 0) moveY = -1;
            } else {
                moveX = dx > 0 ? -1 : 1;
                if (nearLeft && moveX < 0) moveX = 1;
                if (nearRight && moveX > 0) moveX = -1;
            }
        }

        const moveKeys = [];
        if (moveX > 0) moveKeys.push('KeyD');
        else if (moveX < 0) moveKeys.push('KeyA');
        if (moveY > 0) moveKeys.push('KeyS');
        else if (moveY < 0) moveKeys.push('KeyW');

        // 射击方向：朝向最近敌人，考虑一点点预判
        const shootKeys = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            shootKeys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        } else {
            shootKeys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
        }

        await pressKeys(page, [...moveKeys, ...shootKeys], 180);

        // 卡死检测
        const stateKey = `${Math.round(state.player.x)},${Math.round(state.player.y)}|${enemies.map(e => `${Math.round(e.x)},${Math.round(e.y)}`).join(';')}`;
        if (stateKey === lastState) {
            stallCounter++;
            if (stallCounter > 8) {
                console.log('Stuck, trying random movement');
                await moveTowards(page, centerX, centerY, 500);
                stallCounter = 0;
            }
        } else {
            stallCounter = 0;
            lastState = stateKey;
        }
    }
}

async function fightBoss(page) {
    const bounds = await page.evaluate(() => window.game.currentRoom.getInteriorBounds());
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    let lastState = null;
    let stallCounter = 0;

    for (let i = 0; i < 160; i++) {
        const state = await getGameState(page);
        if (!state.room || state.room.state === 'cleared') {
            console.log('Boss defeated!');
            break;
        }
        if (state.state === 'dead') {
            console.log('Player died fighting boss');
            break;
        }

        const boss = state.room.enemies.find(e => e.type === 'boss');
        if (!boss) break;

        const dx = boss.x - state.player.x;
        const dy = boss.y - state.player.y;
        const dist = Math.hypot(dx, dy);

        // 躲避boss子弹：检测离玩家很近的敌方子弹
        const enemyBullets = await page.evaluate(() => {
            return window.game.enemyBullets.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy }));
        });

        let dodgeX = 0;
        let dodgeY = 0;
        for (const b of enemyBullets) {
            const d = Math.hypot(b.x - state.player.x, b.y - state.player.y);
            if (d < 70) {
                // 垂直于子弹方向躲避
                const bvx = b.vx || 0.1;
                const bvy = b.vy || 0.1;
                dodgeX = bvy;
                dodgeY = -bvx;
                const len = Math.hypot(dodgeX, dodgeY);
                if (len > 0) {
                    dodgeX /= len;
                    dodgeY /= len;
                }
                break;
            }
        }

        let moveX = dodgeX;
        let moveY = dodgeY;

        // 基础走位：保持中距离
        if (dist < 130) {
            moveX += dx > 0 ? -1 : 1;
            moveY += dy > 0 ? -1 : 1;
        } else if (dist > 220) {
            moveX += dx > 0 ? 1 : -1;
            moveY += dy > 0 ? 1 : -1;
        } else {
            // 绕圈
            const clockwise = i % 8 < 4;
            moveX += clockwise ? (dy > 0 ? 1 : -1) : (dy > 0 ? -1 : 1);
            moveY += clockwise ? (dx > 0 ? -1 : 1) : (dx > 0 ? 1 : -1);
        }

        // 避免贴墙
        const margin = 75;
        if (state.player.x < bounds.x + margin && moveX < 0) moveX = 0.5;
        if (state.player.x > bounds.x + bounds.w - margin && moveX > 0) moveX = -0.5;
        if (state.player.y < bounds.y + margin && moveY < 0) moveY = 0.5;
        if (state.player.y > bounds.y + bounds.h - margin && moveY > 0) moveY = -0.5;

        // 标准化移动方向
        const len = Math.hypot(moveX, moveY);
        if (len > 0) {
            moveX /= len;
            moveY /= len;
        }

        const moveKeys = [];
        if (moveX > 0.3) moveKeys.push('KeyD');
        else if (moveX < -0.3) moveKeys.push('KeyA');
        if (moveY > 0.3) moveKeys.push('KeyS');
        else if (moveY < -0.3) moveKeys.push('KeyW');

        // 持续射击boss
        const shootKeys = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            shootKeys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        } else {
            shootKeys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
        }

        await pressKeys(page, [...moveKeys, ...shootKeys], 150);

        // 卡死检测
        const stateKey = `${Math.round(state.player.x)},${Math.round(state.player.y)}|${Math.round(boss.x)},${Math.round(boss.y)}`;
        if (stateKey === lastState) {
            stallCounter++;
            if (stallCounter > 6) {
                await moveTowards(page, centerX + (Math.random() - 0.5) * 120, centerY + (Math.random() - 0.5) * 120, 400);
                stallCounter = 0;
            }
        } else {
            stallCounter = 0;
            lastState = stateKey;
        }
    }
}

async function collectNearestPickup(page, type) {
    const drops = await page.evaluate((t) => {
        const room = window.game.currentRoom;
        const result = [];
        for (const p of room.pickups) {
            if (!p.collected && (!t || p.type === t)) result.push({ x: p.x, y: p.y, type: p.type });
        }
        return result;
    }, type);
    if (drops.length === 0) return;
    const target = drops[0];
    await moveTowards(page, target.x, target.y, 350);
}

async function collectDrops(page) {
    for (let i = 0; i < 30; i++) {
        const state = await getGameState(page);
        if (!state.room) break;
        if (state.room.items === 0 && state.room.pickups === 0) break;

        const drops = await page.evaluate(() => {
            const room = window.game.currentRoom;
            const result = [];
            for (const item of room.items) if (!item.collected) result.push({ x: item.x, y: item.y });
            for (const p of room.pickups) if (!p.collected) result.push({ x: p.x, y: p.y });
            return result;
        });

        if (drops.length === 0) break;
        const target = drops[0];
        await moveTowards(page, target.x, target.y, 300);
    }
}

async function run() {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    console.log('Launching Edge...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-gpu'],
        defaultViewport: { width: 1100, height: 650 },
    });

    const page = await browser.newPage();

    // 捕获控制台错误
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
            console.log('CONSOLE ERROR:', msg.text());
        }
    });
    page.on('pageerror', err => {
        errors.push(err.message);
        console.log('PAGE ERROR:', err.message);
    });

    console.log('Loading game...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(1500);

    // 截图：开始界面
    await takeScreenshot(page, '01_start_screen');

    // 点击开始按钮
    console.log('Clicking start button...');
    await page.click('#start-btn');
    await sleep(2000);

    // 截图：初始房间
    await takeScreenshot(page, '02_initial_room');

    let state = await getGameState(page);
    console.log('Initial game state:', JSON.stringify(state, null, 2));

    // 射击测试
    console.log('Testing shooting...');
    await pressKey(page, 'ArrowRight', 800);
    await pressKey(page, 'ArrowDown', 600);
    await takeScreenshot(page, '03_shooting');

    // 探索并战斗：尝试遍历多个房间
    const visitedKeys = new Set();
    let roomCounter = 0;

    for (let step = 0; step < 20; step++) {
        state = await getGameState(page);
        if (!state.room) break;

        const roomKey = `${state.floor}-${state.room.gridX},${state.room.gridY}`;
        const isFirstVisit = !visitedKeys.has(roomKey);
        if (isFirstVisit) {
            visitedKeys.add(roomKey);
            roomCounter++;
            console.log(`Room #${roomCounter}: ${state.room.type} (${state.room.state}), enemies: ${state.room.enemyCount}`);

            // 首次进入boss房时截图
            if (state.room.type === 'boss') {
                await takeScreenshot(page, `05_boss_room_enter`);
            }
        }

        // 清理当前房间
        if (state.room.state === 'active') {
            console.log('Clearing room...');
            if (state.room.type === 'boss') {
                await fightBoss(page);
            } else {
                await clearRoom(page);
            }
            await sleep(500);
            if (isFirstVisit) {
                await takeScreenshot(page, `04_room_cleared_${roomCounter}`);
            }
        }

        // 收集掉落（宝藏房直接捡）
        if (state.room.items > 0 || state.room.pickups > 0) {
            console.log('Collecting drops...');
            await collectDrops(page);
            await sleep(300);
        }

        // 尝试去下一个房间
        const moved = await findAndUseDoor(page, visitedKeys);
        if (!moved) {
            console.log('No more doors available');
            break;
        }

        // 等待过渡完成
        await sleep(700);
    }

    // 最终状态截图
    state = await getGameState(page);
    console.log('Final game state:', JSON.stringify(state, null, 2));
    await takeScreenshot(page, '08_final_state');

    // 如果死亡或通关，截图
    if (state.state === 'dead') {
        await sleep(1000);
        await takeScreenshot(page, '09_death_screen');
    } else if (state.state === 'victory') {
        await sleep(500);
        await takeScreenshot(page, '09_victory_screen');
    }

    // 输出错误汇总
    if (errors.length > 0) {
        console.log('\n=== ERRORS FOUND ===');
        errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    } else {
        console.log('\nNo JavaScript errors detected!');
    }

    console.log('\nAll screenshots taken!');
    await browser.close();
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
