const puppeteer = require('puppeteer-core');
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1100, height: 650 },
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        console.log('CONSOLE:', msg.type(), msg.text());
    });
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
    });

    await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 2000));

    const state = await page.evaluate(() => {
        const game = window.game; // try to find game object
        // Search for the Game instance
        let found = null;
        for (const key in window) {
            const obj = window[key];
            if (obj && obj.constructor && obj.constructor.name === 'Game') {
                found = obj;
                break;
            }
        }

        if (!found) return { error: 'No Game instance found' };

        return {
            playerExists: !!found.player,
            playerPos: found.player ? { x: found.player.x, y: found.player.y, radius: found.player.radius } : null,
            playerHealth: found.player ? found.player.health : null,
            bullets: found.bullets.length,
            enemyBullets: found.enemyBullets.length,
            currentRoom: found.currentRoom ? {
                type: found.currentRoom.type,
                state: found.currentRoom.state,
                enemies: found.currentRoom.enemies.length,
                items: found.currentRoom.items.length,
                pickups: found.currentRoom.pickups.length,
                bounds: found.currentRoom.getInteriorBounds(),
            } : null,
            state: found.state,
        };
    });

    console.log('Game state:', JSON.stringify(state, null, 2));

    // Try to manually draw a test circle on canvas
    await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(400, 230, 30, 0, Math.PI * 2);
        ctx.fill();
    });

    await page.screenshot({ path: 'D:/WorkBuddy_workspace/以撒的结合风格肉鸽游戏/screenshots/debug_test_circle.png' });

    await browser.close();
})();
