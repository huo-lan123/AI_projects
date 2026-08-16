// ==================== 输入系统 ====================

const Input = {
    keys: {},
    prevKeys: {},

    // 移动端虚拟摇杆
    touchMove: { active: false, startX: 0, startY: 0, dx: 0, dy: 0, id: null },
    touchShoot: { active: false, startX: 0, startY: 0, dx: 0, dy: 0, id: null },

    isMobile: false,
    rotated: false, // 竖屏时画面强制旋转90°，触摸坐标需转换

    init() {
        this.isMobile = this.detectMobile();

        // 键盘
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // 防止页面滚动
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // 触摸
        if (this.isMobile) {
            this.initTouch();
        }

        // 竖屏时把整个游戏旋转90°（手机浏览器大多不允许网页锁定横屏）
        this.updateOrientation();
        window.addEventListener('resize', () => this.updateOrientation());
        window.addEventListener('orientationchange', () => setTimeout(() => this.updateOrientation(), 100));

        // 失焦时清除按键
        window.addEventListener('blur', () => {
            this.keys = {};
            this.touchMove.active = false;
            this.touchShoot.active = false;
        });
    },

    // 竖屏(触屏设备) → 给游戏容器加强制旋转类
    updateOrientation() {
        const container = document.getElementById('game-container');
        if (!container) return;
        const portrait = window.innerHeight > window.innerWidth;
        this.rotated = this.isMobile && portrait;
        container.classList.toggle('force-rotate', this.rotated);
    },

    // 物理触摸坐标 → 游戏画面坐标（画面旋转90°后需换算）
    toGameCoord(clientX, clientY) {
        if (this.rotated) {
            // 画面顺时针转90°：游戏x = 物理y，游戏y = 屏幕宽 - 物理x
            return { x: clientY, y: window.innerWidth - clientX };
        }
        return { x: clientX, y: clientY };
    },

    detectMobile() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    },

    initTouch() {
        // 监听挂在整个文档上：竖屏时 canvas 只占屏幕一小条，
        // 全屏分区（左=移动 / 右=射击）才能保证任何位置都能操控
        const handler = (e) => {
            // 忽略界面元素上的触摸（按钮、可见的覆盖层），放行原生点击
            if (e.target && e.target.closest && e.target.closest('button, .overlay:not(.hidden)')) {
                return;
            }
            e.preventDefault();

            // 游戏画面的宽度（旋转时 = 屏幕高度）
            const gameW = this.rotated ? window.innerHeight : window.innerWidth;

            if (e.type === 'touchstart') {
                for (const touch of e.changedTouches) {
                    const p = this.toGameCoord(touch.clientX, touch.clientY);
                    // 左半屏 = 移动摇杆
                    if (p.x < gameW / 2 && !this.touchMove.active) {
                        this.touchMove.active = true;
                        this.touchMove.startX = p.x;
                        this.touchMove.startY = p.y;
                        this.touchMove.dx = 0;
                        this.touchMove.dy = 0;
                        this.touchMove.id = touch.identifier;
                    }
                    // 右半屏 = 射击摇杆
                    else if (p.x >= gameW / 2 && !this.touchShoot.active) {
                        this.touchShoot.active = true;
                        this.touchShoot.startX = p.x;
                        this.touchShoot.startY = p.y;
                        this.touchShoot.dx = 0;
                        this.touchShoot.dy = 0;
                        this.touchShoot.id = touch.identifier;
                    }
                }
            } else if (e.type === 'touchmove') {
                for (const touch of e.changedTouches) {
                    const p = this.toGameCoord(touch.clientX, touch.clientY);
                    if (touch.identifier === this.touchMove.id) {
                        this.touchMove.dx = p.x - this.touchMove.startX;
                        this.touchMove.dy = p.y - this.touchMove.startY;
                    } else if (touch.identifier === this.touchShoot.id) {
                        this.touchShoot.dx = p.x - this.touchShoot.startX;
                        this.touchShoot.dy = p.y - this.touchShoot.startY;
                    }
                }
            } else if (e.type === 'touchend' || e.type === 'touchcancel') {
                for (const touch of e.changedTouches) {
                    if (touch.identifier === this.touchMove.id) {
                        this.touchMove.active = false;
                        this.touchMove.id = null;
                        this.touchMove.dx = 0;
                        this.touchMove.dy = 0;
                    } else if (touch.identifier === this.touchShoot.id) {
                        this.touchShoot.active = false;
                        this.touchShoot.id = null;
                        this.touchShoot.dx = 0;
                        this.touchShoot.dy = 0;
                    }
                }
            }
        };

        ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => {
            document.addEventListener(type, handler, { passive: false });
        });
    },

    // 获取移动向量 (归一化)
    getMoveVector() {
        let x = 0, y = 0;

        // 键盘 WASD
        if (this.keys['KeyW']) y -= 1;
        if (this.keys['KeyS']) y += 1;
        if (this.keys['KeyA']) x -= 1;
        if (this.keys['KeyD']) x += 1;

        // 触摸摇杆
        if (this.touchMove.active) {
            const deadzone = 15;
            const len = Math.sqrt(this.touchMove.dx ** 2 + this.touchMove.dy ** 2);
            if (len > deadzone) {
                x = this.touchMove.dx / len;
                y = this.touchMove.dy / len;
            }
        }

        return normalize(x, y);
    },

    // 获取射击方向 (归一化或null)
    getShootDirection() {
        let x = 0, y = 0;

        // 方向键
        if (this.keys['ArrowUp']) y -= 1;
        if (this.keys['ArrowDown']) y += 1;
        if (this.keys['ArrowLeft']) x -= 1;
        if (this.keys['ArrowRight']) x += 1;

        // 触摸射击摇杆
        if (this.touchShoot.active) {
            const deadzone = 15;
            const len = Math.sqrt(this.touchShoot.dx ** 2 + this.touchShoot.dy ** 2);
            if (len > deadzone) {
                x = this.touchShoot.dx / len;
                y = this.touchShoot.dy / len;
            }
        }

        if (x === 0 && y === 0) return null;
        const n = normalize(x, y);
        return n;
    },

    // 单次按键检测
    isPressed(code) {
        return this.keys[code] && !this.prevKeys[code];
    },

    // 持续按住检测
    isDown(code) {
        return this.keys[code] || false;
    },

    update() {
        this.prevKeys = { ...this.keys };
    },
};
