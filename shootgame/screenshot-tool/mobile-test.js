// 移动端适配测试：手机视口模拟 + 触摸拖动验证移动/射击 + 摇杆渲染截图
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = 'http://localhost:8080/index.html?debug=1';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 在页面内构造并派发触摸事件
async function dispatchTouch(page, type, id, x, y) {
    await page.evaluate((type, id, x, y) => {
        const t = new Touch({ identifier: id, target: document.body, clientX: x, clientY: y });
        const opts = {
            cancelable: true,
            bubbles: true,
            touches: type === 'touchend' ? [] : [t],
            targetTouches: type === 'touchend' ? [] : [t],
            changedTouches: [t],
        };
        document.dispatchEvent(new TouchEvent(type, opts));
    }, type, id, x, y);
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: EDGE,
        headless: true,
        args: ['--touch-events=enabled'],
    });

    const results = [];
    const check = (name, ok, extra = '') => {
        results.push(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ' (' + extra + ')' : ''}`);
    };

    // ========== 1. 竖屏 iPhone 视口 ==========
    let page = await browser.newPage();
    await page.emulate({
        viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(500);

    // 开始界面在手机上可见、按钮可点
    const startVisible = await page.evaluate(() => {
        const el = document.getElementById('start-screen');
        const btn = document.getElementById('start-btn');
        const r = btn.getBoundingClientRect();
        return {
            overlayShown: !el.classList.contains('hidden'),
            btnInViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0,
            isMobileDetected: Input.isMobile,
        };
    });
    check('竖屏开始界面显示', startVisible.overlayShown);
    check('开始按钮在视口内', startVisible.btnInViewport);
    check('移动端检测', startVisible.isMobileDetected);

    await page.tap('#start-btn');
    await sleep(600);
    const playing = await page.evaluate(() => window.game.state === 'playing');
    check('点击开始进入游戏', playing);

    // canvas 占屏情况
    const canvasRect = await page.evaluate(() => {
        const r = document.getElementById('gameCanvas').getBoundingClientRect();
        return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
    });
    check('竖屏 canvas 适配宽度', canvasRect.w <= canvasRect.vw && canvasRect.w > 0,
        `${Math.round(canvasRect.w)}x${Math.round(canvasRect.h)}`);

    // ---------- 触摸移动测试（canvas 外区域也能操控）----------
    const posBefore = await page.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    const rotated0 = await page.evaluate(() => Input.rotated);
    // 旋转模式：物理左下(x小,y大)换算到游戏左半区(移动摇杆)；普通模式：canvas 下方
    const touchY = rotated0 ? 350 : Math.min(canvasRect.h + 150, 844 - 60);
    const touchX = rotated0 ? 100 : 100;
    await dispatchTouch(page, 'touchstart', 1, touchX, touchY);
    await sleep(80);
    await dispatchTouch(page, 'touchmove', 1, touchX, touchY - 120); // 向上拖
    await sleep(400);
    await dispatchTouch(page, 'touchend', 1, touchX, touchY - 120);
    await sleep(100);
    const posAfter = await page.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
    // 竖屏画面强制旋转90°：物理向上拖 = 游戏内向左移动（x 减小）
    const rotated = await page.evaluate(() => Input.rotated);
    const moved = rotated
        ? (posBefore.x - posAfter.x > 5)   // 旋转模式：游戏 x 减小
        : (posAfter.y - posBefore.y < -5); // 普通模式：游戏 y 减小
    check('触摸移动有效(竖屏旋转模式)', moved,
        rotated ? `x ${posBefore.x.toFixed(0)} -> ${posAfter.x.toFixed(0)} (旋转模式)` : `y ${posBefore.y.toFixed(0)} -> ${posAfter.y.toFixed(0)}`);

    // ---------- 触摸射击测试 ----------
    // 旋转模式：游戏右半区 = 物理屏幕下半(y>422)；普通模式：右半屏
    const sX = 300;
    const sY0 = rotated0 ? 600 : touchY;
    const sY1 = rotated0 ? 500 : touchY - 100;
    const bulletsBefore = await page.evaluate(() => window.game.bullets.length);
    await dispatchTouch(page, 'touchstart', 2, sX, sY0);
    await sleep(50);
    await dispatchTouch(page, 'touchmove', 2, sX, sY1); // 向上拖 = 射击
    await sleep(100); // 尽早采样，避免子弹撞墙消散后读到 0
    let fired = await page.evaluate(() => window.game.bullets.length);
    if (fired === 0) {
        await sleep(100);
        fired = await page.evaluate(() => window.game.bullets.length);
    }
    const stickShown = await page.evaluate(() => Input.touchShoot.active);
    await page.screenshot({ path: '../screenshots/mobile_portrait_joystick.png' });
    await dispatchTouch(page, 'touchend', 2, sX, sY1);
    check('触摸射击产生子弹', fired > 0, `bullets ${bulletsBefore} -> ${fired}`);
    check('射击摇杆激活状态', stickShown);

    await page.close();

    // ========== 2. 横屏手机视口 ==========
    page = await browser.newPage();
    await page.emulate({
        viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
        userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(400);
    await page.tap('#start-btn');
    await sleep(600);

    const landRect = await page.evaluate(() => {
        const r = document.getElementById('gameCanvas').getBoundingClientRect();
        return { w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
    });
    check('横屏 canvas 适配', landRect.w <= landRect.vw + 1 && landRect.h <= landRect.vh + 1 && landRect.w > 0,
        `${Math.round(landRect.w)}x${Math.round(landRect.h)} in ${landRect.vw}x${landRect.vh}`);

    // 横屏双摇杆同持：左边移动 + 右边射击
    await dispatchTouch(page, 'touchstart', 10, 150, 200);
    await dispatchTouch(page, 'touchmove', 10, 150, 260); // 向下移动
    await dispatchTouch(page, 'touchstart', 11, 700, 200);
    await sleep(80);
    await dispatchTouch(page, 'touchmove', 11, 700, 140); // 向上射击
    await sleep(400);
    const dual = await page.evaluate(() => ({
        moveActive: Input.touchMove.active,
        shootActive: Input.touchShoot.active,
        bullets: window.game.bullets.length,
    }));
    await page.screenshot({ path: '../screenshots/mobile_landscape_dual.png' });
    await dispatchTouch(page, 'touchend', 10, 150, 260);
    await dispatchTouch(page, 'touchend', 11, 700, 140);
    check('横屏双摇杆同持移动+射击', dual.moveActive && dual.shootActive && dual.bullets > 0);

    // 静音按钮触摸可点（不干扰摇杆）
    const muteOk = await page.evaluate(() => {
        document.getElementById('mute-btn').click();
        const off = !Sfx.enabled;
        document.getElementById('mute-btn').click();
        return off && Sfx.enabled;
    });
    check('静音按钮点击不受触摸处理影响', muteOk);

    await page.close();
    await browser.close();

    console.log('\n===== 移动端测试结果 =====');
    results.forEach(r => console.log(r));
    console.log('JS错误:', errors.length ? errors : '无');
    const pass = results.every(r => r.startsWith('PASS')) && errors.length === 0;
    console.log(pass ? '\nMOBILE TEST PASSED' : '\nMOBILE TEST FAILED');
    process.exit(pass ? 0 : 1);
})();
