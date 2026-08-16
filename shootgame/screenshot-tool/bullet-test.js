// 子弹系统专项测试：验证基础弹、三连发、散弹、穿透、射速道具的视觉效果
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8080/index.html?debug=1';
const SHOT_DIR = path.join(__dirname, '..', 'screenshots');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 模拟按键
async function pressKey(page, code, ms) {
    await page.keyboard.down(code);
    await sleep(ms);
    await page.keyboard.up(code);
}

async function screenshot(page, name) {
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
    console.log(`  [shot] ${name}.png`);
}

// 应用道具并朝右射击，截图
async function testItem(page, itemId, name) {
    await page.evaluate((id) => {
        const g = window.game;
        g.startGame();
        // 清掉房间敌人，专注看弹幕
        const room = g.currentRoom;
        room.enemies = [];
        room.state = 'cleared';
        // 把玩家放到房间中央
        const b = room.getInteriorBounds();
        g.player.x = b.x + b.w / 2;
        g.player.y = b.y + b.h / 2;
        if (id) {
            const def = ITEM_POOL.find(i => i.id === id);
            g.player.applyItem(def);
        }
    }, itemId);
    await sleep(300);
    // 朝右射击
    await pressKey(page, 'ArrowRight', 350);
    await sleep(150);
    await screenshot(page, name);
    // 再朝上射一发散弹
    await pressKey(page, 'ArrowUp', 350);
    await sleep(150);
    await screenshot(page, name + '_up');
}

(async () => {
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--window-size=1000,600'],
        defaultViewport: { width: 960, height: 540 },
    });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await sleep(800);

    await pressKey(page, 'Enter', 100);
    await sleep(500);

    console.log('=== 基础弹（应比之前更小） ===');
    await testItem(page, null, 'bullet_base');

    console.log('=== 内心之眼：三连发 ===');
    await testItem(page, 'inner_eye', 'bullet_triple');

    console.log('=== 血色散弹：扇形 ===');
    await testItem(page, 'blood_eye', 'bullet_spread');

    console.log('=== 丘比特之箭：穿透（粉紫色弹体） ===');
    await testItem(page, 'cupid_arrow', 'bullet_pierce');

    console.log('=== 散弹+三连发叠加（最多弹幕） ===');
    await testItem(page, 'blood_eye', 'bullet_stack1');
    await page.evaluate(() => {
        const g = window.game;
        g.player.applyItem(ITEM_POOL.find(i => i.id === 'inner_eye'));
    });
    await sleep(200);
    await pressKey(page, 'ArrowRight', 350);
    await sleep(150);
    await screenshot(page, 'bullet_stack2');

    console.log('=== 独眼巨人：大弹但可控（1.5倍） ===');
    await testItem(page, 'polyphemus', 'bullet_poly');

    // 穿透功能验证：子弹应穿过敌人继续飞行
    console.log('=== 穿透功能验证 ===');
    await page.evaluate(() => {
        const g = window.game;
        g.startGame();
        const room = g.currentRoom;
        room.enemies = [];
        room.state = 'cleared';
        const b = room.getInteriorBounds();
        g.player.x = b.x + 80;
        g.player.y = b.y + b.h / 2;
        g.player.applyItem(ITEM_POOL.find(i => i.id === 'cupid_arrow'));
        g.player.damage = 50; // 一击必杀验证穿透
        // 放两个敌人在射击路径上
        const EnemyClass = Enemy;
        const e1 = new EnemyClass('fly', g.player.x + 150, g.player.y);
        const e2 = new EnemyClass('fly', g.player.x + 280, g.player.y);
        e1.hp = 1; e2.hp = 1;
        room.enemies = [e1, e2];
    });
    await sleep(200);
    await pressKey(page, 'ArrowRight', 200);
    await sleep(600);
    const pierceResult = await page.evaluate(() => {
        const g = window.game;
        return {
            kills: g.player.kills,
            remainingBullets: g.bullets.filter(b => !b.dead).length,
            deadEnemies: g.currentRoom.enemies.filter(e => e.dead).length,
        };
    });
    console.log('穿透结果:', JSON.stringify(pierceResult));
    await screenshot(page, 'bullet_pierce_verify');

    await browser.close();
    console.log('\n完成');
})().catch(e => { console.error(e); process.exit(1); });
