// 退出游戏按钮测试：验证失败/通关界面的"退出游戏"按钮能回到首页
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = 'http://localhost:8188/index.html?debug=1';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { pass++; console.log('  PASS ' + name); }
    else { fail++; console.log('  FAIL ' + name); }
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: EDGE,
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });

    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
    });

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(400);

    // ========== 场景1：死亡界面退出 ==========
    console.log('[1] 死亡界面 → 退出游戏');
    await page.click('#start-btn');
    await sleep(300);
    await page.evaluate(() => game.playerDeath());
    await sleep(1000); // 等待 800ms 延迟显示

    let r = await page.evaluate(() => ({
        deathVisible: !document.getElementById('death-screen').classList.contains('hidden'),
        exitBtn: !!document.getElementById('death-exit-btn'),
        exitVisible: document.getElementById('death-exit-btn').offsetParent !== null,
        restartVisible: document.getElementById('restart-btn').offsetParent !== null,
    }));
    check('死亡界面已显示', r.deathVisible);
    check('退出按钮存在且可见', r.exitBtn && r.exitVisible);
    check('重新开始按钮可见', r.restartVisible);
    await page.screenshot({ path: '../screenshot-tool/exit-death.png' });

    await page.click('#death-exit-btn');
    await sleep(300);
    r = await page.evaluate(() => ({
        state: game.state,
        startVisible: !document.getElementById('start-screen').classList.contains('hidden'),
        deathHidden: document.getElementById('death-screen').classList.contains('hidden'),
        hudEmpty: document.getElementById('hud-info').innerHTML.trim() === '',
    }));
    check('状态回到 menu', r.state === 'menu');
    check('首页已显示', r.startVisible);
    check('死亡界面已隐藏', r.deathHidden);
    check('HUD 已清空', r.hudEmpty);
    await page.screenshot({ path: '../screenshot-tool/exit-back-menu.png' });

    // ========== 场景2：从首页重新开始 → 正常游玩 ==========
    console.log('[2] 退出后再开始游戏');
    await page.click('#start-btn');
    await sleep(300);
    r = await page.evaluate(() => ({
        state: game.state,
        floor: game.currentFloor,
        hasPlayer: !!game.player,
        hasDungeon: !!game.dungeon,
    }));
    check('重新开始成功（playing）', r.state === 'playing');
    check('层数重置为 1', r.floor === 1);
    check('玩家与地牢已重建', r.hasPlayer && r.hasDungeon);

    // ========== 场景3：通关界面退出 ==========
    console.log('[3] 通关界面 → 退出游戏');
    await page.evaluate(() => game.victory());
    await sleep(200);
    r = await page.evaluate(() => ({
        victoryVisible: !document.getElementById('victory-screen').classList.contains('hidden'),
        exitVisible: document.getElementById('victory-exit-btn').offsetParent !== null,
    }));
    check('通关界面已显示', r.victoryVisible);
    check('退出按钮存在且可见', r.exitVisible);
    await page.screenshot({ path: '../screenshot-tool/exit-victory.png' });

    await page.click('#victory-exit-btn');
    await sleep(300);
    r = await page.evaluate(() => ({
        state: game.state,
        startVisible: !document.getElementById('start-screen').classList.contains('hidden'),
        victoryHidden: document.getElementById('victory-screen').classList.contains('hidden'),
    }));
    check('状态回到 menu', r.state === 'menu');
    check('首页已显示', r.startVisible);
    check('通关界面已隐藏', r.victoryHidden);

    // ========== 场景4：移动端视口下按钮可见 ==========
    console.log('[4] 移动端视口');
    await page.setViewport({ width: 400, height: 800, hasTouch: true, isMobile: true });
    await sleep(400);
    await page.click('#start-btn'); // 回到 menu 后需先开始游戏才能触发死亡
    await sleep(300);
    await page.evaluate(() => game.playerDeath());
    await sleep(1000);
    r = await page.evaluate(() => ({
        exitVisible: document.getElementById('death-exit-btn').offsetParent !== null,
        restartVisible: document.getElementById('restart-btn').offsetParent !== null,
    }));
    check('移动端死亡界面退出按钮可见', r.exitVisible);
    check('移动端重新开始按钮可见', r.restartVisible);
    await page.screenshot({ path: '../screenshot-tool/exit-mobile-death.png' });

    console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
    if (errors.length) console.log('页面错误:', errors.join('\n'));
    await browser.close();
    process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
})();
