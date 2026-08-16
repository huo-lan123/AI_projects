// 移动端强制旋转（竖屏画面自动转90°）测试
const puppeteer = require('puppeteer-core');

const GAME_URL = 'http://localhost:8080/index.html?debug=1';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 模拟触摸事件（带 identifier）
async function dispatchTouch(page, type, id, x, y) {
    await page.evaluate((t, i, x, y) => {
        const target = document.elementFromPoint(x, y) || document.body;
        const touch = new Touch({ identifier: i, target, clientX: x, clientY: y });
        target.dispatchEvent(new TouchEvent(t, {
            bubbles: true, cancelable: true,
            changedTouches: [touch], touches: [touch],
        }));
    }, type, id, x, y);
}

(async () => {
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' });
    let pass = 0, fail = 0;
    const check = (name, cond) => {
        console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
        cond ? pass++ : fail++;
    };

    // ---------- 竖屏 iPhone ----------
    let page = await browser.newPage();
    await page.emulate({
        viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(500);

    // 1. 竖屏 → 游戏容器强制旋转
    let st = await page.evaluate(() => ({
        rotated: Input.rotated,
        cls: document.getElementById('game-container').classList.contains('force-rotate'),
        transform: getComputedStyle(document.getElementById('game-container')).transform,
    }));
    check('竖屏时容器加 force-rotate 类', st.rotated && st.cls);
    check('竖屏时容器有 rotate(90deg) 变换', st.transform !== 'none' && st.transform.includes('0, 1') || st.transform.includes('1, 0'));

    // 2. 开始游戏
    await page.tap('#start-btn');
    await sleep(400);

    // 3. 触摸坐标换算：物理(100, 400) → 游戏(400, 290)，游戏宽=844，400 < 422 → 移动摇杆
    await dispatchTouch(page, 'touchstart', 1, 100, 400);
    await sleep(50);
    let tm = await page.evaluate(() => ({ active: Input.touchMove.active, sx: Input.touchMove.startX, sy: Input.touchMove.startY }));
    check('竖屏触摸落在移动摇杆（坐标已换算）', tm.active && Math.abs(tm.sx - 400) < 2 && Math.abs(tm.sy - 290) < 2);

    // 4. 物理向下拖(y 400→600) = 游戏向右拖(dx=200)
    await dispatchTouch(page, 'touchmove', 1, 100, 600);
    await sleep(50);
    tm = await page.evaluate(() => ({ dx: Input.touchMove.dx, dy: Input.touchMove.dy }));
    check('旋转后拖动方向换算正确 (dx≈200, dy≈0)', Math.abs(tm.dx - 200) < 2 && Math.abs(tm.dy) < 2);

    await page.screenshot({ path: '../screenshots/mobile_forcerotate_play.png' });
    await dispatchTouch(page, 'touchend', 1, 100, 600);

    // 5. 射击摇杆：物理(50, 700) → 游戏(700, 340)，700 >= 422 → 射击
    await dispatchTouch(page, 'touchstart', 2, 50, 700);
    await sleep(50);
    const ts = await page.evaluate(() => Input.touchShoot.active);
    check('右半区触摸落到射击摇杆', ts);
    await dispatchTouch(page, 'touchend', 2, 50, 700);

    // 6. 模拟手机转到横屏（resize 到 844x390）→ 取消强制旋转
    await page.setViewport({ width: 844, height: 390 });
    await sleep(300);
    st = await page.evaluate(() => ({
        rotated: Input.rotated,
        cls: document.getElementById('game-container').classList.contains('force-rotate'),
    }));
    check('转横屏后取消强制旋转', !st.rotated && !st.cls);

    await page.close();

    // ---------- 桌面端 ----------
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(400);
    st = await page.evaluate(() => document.getElementById('game-container').classList.contains('force-rotate'));
    check('桌面端不旋转', !st);
    await page.close();

    console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
    if (errors.length) console.log('JS错误:', errors.join('\n'));
    await browser.close();
    process.exit(fail > 0 ? 1 : 0);
})();
