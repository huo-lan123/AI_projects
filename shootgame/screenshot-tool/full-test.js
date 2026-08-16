const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'D:/WorkBuddy_workspace/以撒的结合风格肉鸽游戏/screenshots';
const GAME_URL = 'http://localhost:8080/index.html?debug=1';
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
        if (!g) return { error: 'no game' };
        const room = g.currentRoom;
        return {
            state: g.state,
            floor: g.currentFloor,
            kills: g.kills,
            itemsCollected: g.itemsCollected,
            health: g.player ? g.player.health : 0,
            maxHealth: g.player ? g.player.maxHealth : 0,
            playerItems: g.player ? g.player.items.length : 0,
            roomType: room ? room.type : null,
            roomState: room ? room.state : null,
            roomKey: g.dungeon ? g.dungeon.currentRoomKey : null,
            bossRoomKey: g.dungeon ? g.dungeon.bossRoomKey : null,
            enemyCount: room ? room.enemies.filter(e => !e.dead).length : 0,
            hasTrapdoor: !!g.trapdoor,
            bossCleared: g.bossCleared,
            dungeonRooms: g.dungeon ? Object.keys(g.dungeon.rooms).length : 0,
        };
    });
}

async function killAllEnemies(page) {
    await page.evaluate(() => {
        const g = window.game;
        const room = g.currentRoom;
        if (!room) return;
        for (const enemy of room.enemies) {
            if (!enemy.dead) {
                enemy.takeDamage(99999, g);
            }
        }
    });
}

async function teleportToRoom(page, roomKey) {
    await page.evaluate((key) => {
        const g = window.game;
        if (g.dungeon.rooms[key]) {
            g.dungeon.currentRoomKey = key;
            const room = g.currentRoom;
            if (room.state === 'unvisited') {
                const hasEnemies = room.enemies.some(e => !e.dead);
                room.state = hasEnemies ? 'active' : 'cleared';
            }
            // Position player at center
            const b = room.getInteriorBounds();
            g.player.x = b.x + b.w / 2;
            g.player.y = b.y + b.h / 2;
            g.bullets = [];
            g.enemyBullets = [];
            g.particles = [];
        }
    }, roomKey);
}

async function moveToTrapdoor(page) {
    await page.evaluate(() => {
        const g = window.game;
        if (g.trapdoor && g.player) {
            g.player.x = g.trapdoor.x;
            g.player.y = g.trapdoor.y;
        }
    });
    // Wait for nextFloor to process
    await sleep(500);
}

async function collectItemsInRoom(page) {
    await page.evaluate(() => {
        const g = window.game;
        const room = g.currentRoom;
        if (!room) return;
        for (const item of room.items) {
            if (!item.collected) {
                item.collected = true;
                g.player.applyItem(item.def);
                g.itemsCollected++;
            }
        }
        for (const pickup of room.pickups) {
            if (!pickup.collected) {
                pickup.collected = true;
                pickup.apply(g.player);
            }
        }
        room.items = room.items.filter(i => !i.collected);
        room.pickups = room.pickups.filter(p => !p.collected);
    });
}

async function run() {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1100, height: 650 },
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('CONSOLE ERROR:', msg.text());
        }
    });
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
    });

    console.log('Loading game...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // ===== 1. Start Screen =====
    console.log('\n=== 1. Start Screen ===');
    await takeScreenshot(page, '01_start_screen');
    let state = await getGameState(page);
    console.log('State:', JSON.stringify(state));

    // ===== 2. Start Game =====
    console.log('\n=== 2. Start Game ===');
    await page.click('#start-btn');
    await sleep(1500);
    await takeScreenshot(page, '02_start_room');
    state = await getGameState(page);
    console.log('State:', JSON.stringify(state));

    // ===== 3. Find dungeon layout =====
    const dungeonInfo = await page.evaluate(() => {
        const g = window.game;
        const rooms = {};
        for (const [key, room] of Object.entries(g.dungeon.rooms)) {
            rooms[key] = {
                type: room.type,
                state: room.state,
                doors: { ...room.doors },
                enemyCount: room.enemies.filter(e => !e.dead).length,
            };
        }
        return {
            startKey: g.dungeon.startRoomKey,
            bossKey: g.dungeon.bossRoomKey,
            rooms: rooms,
        };
    });
    console.log('Dungeon layout:', JSON.stringify(dungeonInfo, null, 2));

    // ===== 4. Navigate to a normal room and clear it =====
    console.log('\n=== 3. Normal Room Combat ===');
    // Find a normal room adjacent to start
    const startKey = dungeonInfo.startKey;
    const startRoom = dungeonInfo.rooms[startKey];
    let normalRoomKey = null;
    for (const [key, info] of Object.entries(dungeonInfo.rooms)) {
        if (info.type === 'normal') {
            normalRoomKey = key;
            break;
        }
    }
    if (normalRoomKey) {
        await teleportToRoom(page, normalRoomKey);
        await sleep(500);
        await takeScreenshot(page, '03_normal_room_enemies');
        state = await getGameState(page);
        console.log('Before clear:', JSON.stringify(state));

        // Kill all enemies
        await killAllEnemies(page);
        await sleep(800);
        await takeScreenshot(page, '04_normal_room_cleared');
        state = await getGameState(page);
        console.log('After clear:', JSON.stringify(state));
    }

    // ===== 5. Collect drops =====
    console.log('\n=== 4. Item Drops ===');
    await collectItemsInRoom(page);
    await sleep(300);
    state = await getGameState(page);
    console.log('After collecting:', JSON.stringify(state));

    // ===== 6. Treasure Room =====
    console.log('\n=== 5. Treasure Room ===');
    let treasureKey = null;
    for (const [key, info] of Object.entries(dungeonInfo.rooms)) {
        if (info.type === 'treasure') {
            treasureKey = key;
            break;
        }
    }
    if (treasureKey) {
        await teleportToRoom(page, treasureKey);
        await sleep(500);
        await takeScreenshot(page, '05_treasure_room');
        state = await getGameState(page);
        console.log('Treasure room:', JSON.stringify(state));

        // Collect treasure
        await collectItemsInRoom(page);
        await sleep(300);
        await takeScreenshot(page, '06_treasure_collected');
        state = await getGameState(page);
        console.log('After treasure:', JSON.stringify(state));
    }

    // ===== 7. Boss Room =====
    console.log('\n=== 6. Boss Fight ===');
    const bossKey = dungeonInfo.bossKey;
    if (bossKey) {
        await teleportToRoom(page, bossKey);
        await sleep(500);
        await takeScreenshot(page, '07_boss_room');
        state = await getGameState(page);
        console.log('Boss room:', JSON.stringify(state));

        // Shoot some tears at boss for visual
        await page.keyboard.down('ArrowUp');
        await sleep(1500);
        await page.keyboard.up('ArrowUp');
        await takeScreenshot(page, '08_boss_combat');
        state = await getGameState(page);
        console.log('During combat:', JSON.stringify(state));

        // Move player away from center so trapdoor doesn't get instantly consumed
        await page.evaluate(() => {
            const g = window.game;
            const b = g.currentRoom.getInteriorBounds();
            g.player.x = b.x + b.w * 0.25;
            g.player.y = b.y + b.h * 0.75;
        });
        await sleep(300);

        // Kill boss with debug
        await killAllEnemies(page);
        await sleep(1000);
        await takeScreenshot(page, '09_boss_defeated');
        state = await getGameState(page);
        console.log('After boss kill:', JSON.stringify(state));

        // ===== 8. Trapdoor =====
        console.log('\n=== 7. Trapdoor ===');
        // Collect boss drop first
        await collectItemsInRoom(page);
        await sleep(300);
        await takeScreenshot(page, '10_trapdoor_visible');
        state = await getGameState(page);
        console.log('With trapdoor:', JSON.stringify(state));

        // Move to trapdoor -> next floor
        await moveToTrapdoor(page);
        await sleep(1000);
        await takeScreenshot(page, '11_floor2_start');
        state = await getGameState(page);
        console.log('Floor 2:', JSON.stringify(state));

        // ===== 9. Floor 2 Boss =====
        if (state.floor === 2) {
            console.log('\n=== 8. Floor 2 Boss ===');
            const floor2Info = await page.evaluate(() => {
                const g = window.game;
                return { bossKey: g.dungeon.bossRoomKey };
            });
            await teleportToRoom(page, floor2Info.bossKey);
            await sleep(500);
            await takeScreenshot(page, '12_floor2_boss');

            // Move player away from center
            await page.evaluate(() => {
                const g = window.game;
                const b = g.currentRoom.getInteriorBounds();
                g.player.x = b.x + b.w * 0.25;
                g.player.y = b.y + b.h * 0.75;
            });
            await sleep(300);

            await killAllEnemies(page);
            await sleep(800);
            await collectItemsInRoom(page);
            await sleep(300);
            await takeScreenshot(page, '12b_floor2_trapdoor');

            // Move to trapdoor
            state = await getGameState(page);
            if (state.hasTrapdoor) {
                await moveToTrapdoor(page);
                await sleep(1000);
                await takeScreenshot(page, '13_floor3_start');
                state = await getGameState(page);
                console.log('Floor 3:', JSON.stringify(state));
            }
        }

        // ===== 10. Floor 3 Boss -> Victory =====
        if (state.floor === 3) {
            console.log('\n=== 9. Floor 3 Boss -> Victory ===');
            const floor3Info = await page.evaluate(() => {
                const g = window.game;
                return { bossKey: g.dungeon.bossRoomKey };
            });
            await teleportToRoom(page, floor3Info.bossKey);
            await sleep(500);
            await takeScreenshot(page, '14_floor3_boss');

            // Move player away from center
            await page.evaluate(() => {
                const g = window.game;
                const b = g.currentRoom.getInteriorBounds();
                g.player.x = b.x + b.w * 0.25;
                g.player.y = b.y + b.h * 0.75;
            });
            await sleep(300);

            await killAllEnemies(page);
            await sleep(800);
            await collectItemsInRoom(page);
            await sleep(300);
            await takeScreenshot(page, '14b_floor3_trapdoor');

            state = await getGameState(page);
            if (state.hasTrapdoor) {
                await moveToTrapdoor(page);
                await sleep(1500);
                await takeScreenshot(page, '15_victory_screen');
                state = await getGameState(page);
                console.log('Victory state:', JSON.stringify(state));
            }
        }
    }

    // ===== 11. Test Death Screen =====
    console.log('\n=== 10. Death Screen ===');
    // Start a new game
    await page.evaluate(() => {
        window.game.startGame();
    });
    await sleep(1000);

    // Clear a normal room to get some kills and items first
    const firstNormalKey = await page.evaluate(() => {
        const g = window.game;
        for (const [key, room] of Object.entries(g.dungeon.rooms)) {
            if (room.type === 'normal' && room.enemies.length > 0) {
                return key;
            }
        }
        return null;
    });
    if (firstNormalKey) {
        await teleportToRoom(page, firstNormalKey);
        await sleep(300);
        await killAllEnemies(page);
        await sleep(500);
        await collectItemsInRoom(page);
        await sleep(300);
        await takeScreenshot(page, '16_before_death');

        // Set player health to 0.5 so one hit kills, remove invincibility
        await page.evaluate(() => {
            window.game.player.health = 0.5;
            window.game.player.invincibleTimer = 0;
        });
        await sleep(200);

        // Teleport to another normal room and put enemy on player
        const secondNormalKey = await page.evaluate((firstKey) => {
            const g = window.game;
            for (const [key, room] of Object.entries(g.dungeon.rooms)) {
                if (room.type === 'normal' && room.enemies.length > 0 && key !== firstKey) {
                    return key;
                }
            }
            return firstKey;
        }, firstNormalKey);

        await teleportToRoom(page, secondNormalKey);
        await sleep(300);
        await page.evaluate(() => {
            const g = window.game;
            const room = g.currentRoom;
            const enemy = room.enemies.find(e => !e.dead);
            if (enemy) {
                enemy.x = g.player.x;
                enemy.y = g.player.y;
            }
        });
        await sleep(1200);
        await takeScreenshot(page, '17_death_screen');
        state = await getGameState(page);
        console.log('Death state:', JSON.stringify(state));

        // Check death screen DOM
        const deathScreenVisible = await page.evaluate(() => {
            const el = document.getElementById('death-screen');
            return !el.classList.contains('hidden');
        });
        console.log('Death screen visible:', deathScreenVisible);

        const deathStats = await page.evaluate(() => {
            return {
                kills: document.getElementById('death-kills').textContent,
                items: document.getElementById('death-items').textContent,
                time: document.getElementById('death-time').textContent,
                floor: document.getElementById('death-floor').textContent,
            };
        });
        console.log('Death stats:', JSON.stringify(deathStats));
    }

    // ===== 12. Test shooting in 4 directions =====
    console.log('\n=== 11. Shooting Direction Test ===');
    await page.evaluate(() => {
        window.game.startGame();
    });
    await sleep(1000);

    // Shoot right
    await page.keyboard.down('ArrowRight');
    await sleep(500);
    await takeScreenshot(page, '18_shoot_right');
    await page.keyboard.up('ArrowRight');
    await sleep(300);

    // Shoot down
    await page.keyboard.down('ArrowDown');
    await sleep(500);
    await takeScreenshot(page, '19_shoot_down');
    await page.keyboard.up('ArrowDown');
    await sleep(300);

    // Shoot left
    await page.keyboard.down('ArrowLeft');
    await sleep(500);
    await takeScreenshot(page, '20_shoot_left');
    await page.keyboard.up('ArrowLeft');
    await sleep(300);

    // Shoot up
    await page.keyboard.down('ArrowUp');
    await sleep(500);
    await takeScreenshot(page, '21_shoot_up');
    await page.keyboard.up('ArrowUp');
    await sleep(300);

    // ===== 13. Test movement =====
    console.log('\n=== 12. Movement Test ===');
    await page.keyboard.down('KeyD');
    await sleep(500);
    await takeScreenshot(page, '22_move_right');
    await page.keyboard.up('KeyD');

    await page.keyboard.down('KeyS');
    await sleep(500);
    await takeScreenshot(page, '23_move_down');
    await page.keyboard.up('KeyS');

    console.log('\n=== All tests complete! ===');
    await browser.close();
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
