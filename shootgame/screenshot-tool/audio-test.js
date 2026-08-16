// 音效系统专项测试：验证 AudioContext 解锁 + 全部音效调用无异常
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GAME_URL = 'http://localhost:8080/index.html?debug=1';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        executablePath: EDGE,
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--mute-audio'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });

    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
    });

    await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
    await sleep(500);

    // 模拟用户手势解锁音频（点击开始按钮）
    await page.click('#start-btn');
    await sleep(500);

    const ctxInfo = await page.evaluate(() => {
        Sfx.unlock();
        return {
            hasCtx: !!Sfx.ctx,
            state: Sfx.ctx ? Sfx.ctx.state : 'none',
            unlocked: Sfx.unlocked,
            enabled: Sfx.enabled,
        };
    });
    console.log('AudioContext:', JSON.stringify(ctxInfo));

    // 逐一触发所有音效，确认无异常
    const sfxList = ['shoot', 'splash', 'hit', 'die', 'bossHurt', 'bossDie', 'bossRoar',
        'hurt', 'item', 'heart', 'coin', 'roomClear', 'door', 'floorDown', 'death', 'victory', 'click'];
    await page.evaluate((list) => {
        for (const name of list) {
            try {
                if (name === 'die') Sfx.die('fly');
                else Sfx[name]();
            } catch (e) {
                window.__sfxError = (window.__sfxError || '') + name + ': ' + e.message + '; ';
            }
        }
    }, sfxList);
    await sleep(1000);

    const sfxError = await page.evaluate(() => window.__sfxError || null);
    console.log('Sfx calls error:', sfxError);

    // 测试静音开关
    await page.click('#mute-btn');
    const mutedState = await page.evaluate(() => ({ enabled: Sfx.enabled, btnText: document.getElementById('mute-btn').textContent }));
    console.log('After mute:', JSON.stringify(mutedState));
    await page.click('#mute-btn');
    const unmutedState = await page.evaluate(() => ({ enabled: Sfx.enabled, btnText: document.getElementById('mute-btn').textContent }));
    console.log('After unmute:', JSON.stringify(unmutedState));

    // 实际射击验证（按键触发射击音效路径）
    await page.keyboard.down('ArrowRight');
    await sleep(300);
    await page.keyboard.up('ArrowRight');

    // M 键切换
    await page.keyboard.press('KeyM');
    const mState = await page.evaluate(() => ({ enabled: Sfx.enabled }));
    console.log('After M key:', JSON.stringify(mState));
    await page.keyboard.press('KeyM');

    console.log('Page errors:', errors.length ? errors : 'none');
    await browser.close();

    const pass = ctxInfo.hasCtx && !sfxError && errors.length === 0;
    console.log(pass ? 'AUDIO TEST PASSED' : 'AUDIO TEST FAILED');
    process.exit(pass ? 0 : 1);
})();
