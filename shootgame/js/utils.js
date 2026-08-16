// ==================== 工具函数 ====================

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
}

function chance(p) {
    return Math.random() < p;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
}

function dist2(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
}

function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

function circleCollide(ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return dist2(ax, ay, bx, by) < r * r;
}

function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

// 方向常量
const DIR = {
    UP:    { x: 0, y: -1, name: 'up' },
    DOWN:  { x: 0, y: 1, name: 'down' },
    LEFT:  { x: -1, y: 0, name: 'left' },
    RIGHT: { x: 1, y: 0, name: 'right' },
};

const DIRECTIONS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];

function getOppositeDir(dir) {
    if (dir === DIR.UP) return DIR.DOWN;
    if (dir === DIR.DOWN) return DIR.UP;
    if (dir === DIR.LEFT) return DIR.RIGHT;
    return DIR.LEFT;
}

function dirToGrid(dir) {
    if (dir === DIR.UP) return { dx: 0, dy: -1 };
    if (dir === DIR.DOWN) return { dx: 0, dy: 1 };
    if (dir === DIR.LEFT) return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
}

function gridToDir(dx, dy) {
    if (dy === -1) return DIR.UP;
    if (dy === 1) return DIR.DOWN;
    if (dx === -1) return DIR.LEFT;
    return DIR.RIGHT;
}

// 格式化时间
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
