const puppeteer = require('puppeteer-core');
const path = require('path');

const GAME_URL = 'http://localhost:8080/index.html?debug=1';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log('Launching browser for smoke test...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1100, height: 650 },
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // Check start screen visible
    const startVisible = await page.evaluate(() => {
        const el = document.getElementById('start-screen');
        return !el.classList.contains('hidden');
    });
    console.log('Start screen visible:', startVisible);

    // Click start
    await page.click('#start-btn');
    await sleep(1500);

    // Check canvas has content
    const canvasState = await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonBlackPixels = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 10 || imgData.data[i+1] > 10 || imgData.data[i+2] > 10) {
                nonBlackPixels++;
            }
        }
        return {
            width: canvas.width,
            height: canvas.height,
            nonBlackPixels,
            totalPixels: canvas.width * canvas.height,
        };
    });
    console.log('Canvas state:', JSON.stringify(canvasState));

    // Check game state via DOM
    const hudVisible = await page.evaluate(() => {
        const hud = document.getElementById('hud-info');
        return hud && hud.textContent.includes('地下层');
    });
    console.log('HUD visible:', hudVisible);

    await page.screenshot({ path: 'D:/WorkBuddy_workspace/以撒的结合风格肉鸽游戏/screenshots/smoke_test_result.png' });
    console.log('Smoke test screenshot saved.');

    await browser.close();
    console.log('Smoke test passed!');
}

run().catch(err => {
    console.error('Smoke test failed:', err);
    process.exit(1);
});
