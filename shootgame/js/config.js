// ==================== 游戏配置 ====================

const CONFIG = {
    // 画布
    CANVAS_WIDTH: 960,
    CANVAS_HEIGHT: 540,

    // 瓦片
    TILE_SIZE: 40,
    ROOM_INNER_COLS: 15,
    ROOM_INNER_ROWS: 9,
    WALL_THICKNESS: 1,

    // 房间尺寸计算
    get ROOM_TOTAL_COLS() { return this.ROOM_INNER_COLS + this.WALL_THICKNESS * 2; },
    get ROOM_TOTAL_ROWS() { return this.ROOM_INNER_ROWS + this.WALL_THICKNESS * 2; },
    get ROOM_PIXEL_WIDTH() { return this.ROOM_TOTAL_COLS * this.TILE_SIZE; },
    get ROOM_PIXEL_HEIGHT() { return this.ROOM_TOTAL_ROWS * this.TILE_SIZE; },
    get ROOM_OFFSET_X() { return Math.floor((this.CANVAS_WIDTH - this.ROOM_PIXEL_WIDTH) / 2); },
    get ROOM_OFFSET_Y() { return Math.floor((this.CANVAS_HEIGHT - this.ROOM_PIXEL_HEIGHT) / 2); },

    // 地牢
    DUNGEON_GRID_W: 9,
    DUNGEON_GRID_H: 8,
    ROOMS_PER_FLOOR_MIN: 5,
    ROOMS_PER_FLOOR_MAX: 8,
    TOTAL_FLOORS: 3,

    // 玩家
    PLAYER: {
        maxHealth: 6,        // 3颗心 = 6半心
        damage: 3.5,         // 眼泪伤害
        attackSpeed: 2.5,    // 每秒射击次数
        moveSpeed: 3.2,      // 每帧移动像素
        range: 350,          // 眼泪飞行距离(像素)
        shotSpeed: 7,        // 眼泪飞行速度
        tearSize: 1,         // 眼泪大小倍率
        invincibleTime: 1.2, // 受伤无敌时间(秒)
        radius: 14,          // 碰撞半径
    },

    // 眼泪
    TEAR: {
        radius: 5,
        lifetime: 1.5,       // 最大存活时间(秒)
    },

    // 敌人
    ENEMIES: {
        fly: { hp: 4, damage: 0.5, speed: 1.5, radius: 10, scoreValue: 1 },
        slime: { hp: 12, damage: 1, speed: 1.0, radius: 16, scoreValue: 2 },
        spider: { hp: 6, damage: 0.5, speed: 2.8, radius: 12, scoreValue: 2 },
        boss: { hp: 120, damage: 1, speed: 0.3, radius: 40, scoreValue: 20 },
    },

    // 掉落
    DROP_RATES: {
        item: 0.15,      // 道具掉落率
        heart: 0.25,     // 心掉落率
        coin: 0.4,       // 金币掉落率
    },

    // FPS
    TARGET_FPS: 60,
};

// ==================== 颜色（暗黑卡通风调色板） ====================

const COLORS = {
    // 背景
    bgDark: '#0d0a08',
    bgFloor: '#3d342a',
    bgFloorDark: '#332b22',
    bgFloorTile: '#42382e',
    bgFloorTileLine: '#2a2218',

    // 墙壁
    wall: '#1a1510',
    wallTop: '#2a2218',
    wallShadow: '#0d0a06',
    wallHighlight: '#3a3022',

    // 门
    doorClosed: '#5a4228',
    doorClosedDark: '#3a2a18',
    doorOpen: '#1a1510',
    doorFrame: '#4a3a22',

    // 玩家（以撒）
    isaacBody: '#f2ead8',
    isaacBodyShadow: '#d0c4a8',
    isaacHead: '#f8f0e0',
    isaacHeadShadow: '#d8c8b0',
    isaacEye: '#1a1410',
    isaacTear: '#a8c8e0',
    isaacMouth: '#8a4030',
    isaacOutline: '#3a2a1a',

    // 眼泪
    tear: '#b8d4e8',
    tearDark: '#7894b0',
    tearGlow: '#d8e8f8',
    tearEnemy: '#c04040',
    tearEnemyDark: '#802020',

    // 敌人 - 苍蝇
    flyBody: '#1a1a1a',
    flyWing: '#4a3a2a',
    flyEye: '#c04040',

    // 敌人 - 黏液怪
    slimeBody: '#4a6a32',
    slimeBodyDark: '#2a4a1a',
    slimeEye: '#f0e8d0',
    slimePupil: '#1a1410',
    slimeHighlight: '#6a8a4a',

    // 敌人 - 蜘蛛
    spiderBody: '#2a1a14',
    spiderLeg: '#1a1008',
    spiderEye: '#c02020',

    // Boss - Monstro（大肉团）
    bossBody: '#b06050',
    bossBodyDark: '#803028',
    bossBodyLight: '#c87860',
    bossEye: '#f0e8d0',
    bossPupil: '#1a1410',
    bossMouth: '#4a1a10',

    // 道具
    itemGlow: '#e8c850',
    itemPedestal: '#3a3022',
    itemPedestalTop: '#5a4a32',

    // 心
    heartFull: '#d04040',
    heartEmpty: '#3a2222',
    heartHighlight: '#f06060',
    soulHeart: '#6080d0',

    // 金币
    coinGold: '#e8b830',
    coinGoldDark: '#a08020',
    coinGoldLight: '#f8d850',

    // UI
    uiText: '#e8d8c8',
    uiTextDim: '#988878',
    uiBg: '#0d0a08',
    uiBgPanel: '#1a1410',
    uiBorder: '#3a2a1a',
    uiAccent: '#c8a850',
    uiRed: '#c04040',
    uiGreen: '#5a8a3a',

    // 效果
    bloodParticle: '#8b2020',
    hitFlash: '#ffffff',
    damageNumber: '#f0c020',
    doorLight: '#e8c850',
};

// ==================== 道具定义 ====================
// 效果字段:
//   damage/attackSpeed/moveSpeed/range/shotSpeed/tearSize: 乘法倍率
//   maxHealth: 加法
//   shotCount: 同向平行弹数加成(加法,上限3)
//   spread:   扇形侧向弹数加成(加法,每侧1发,上限2)
//   piercing: 眼泪穿透敌人

const ITEM_POOL = [
    {
        id: 'sad_onion',
        name: '悲伤洋葱',
        desc: '射击速度提升',
        effects: { attackSpeed: 1.4 },
        color: '#9a8050',
        icon: 'onion',
    },
    {
        id: 'speed_cola',
        name: '兴奋剂',
        desc: '射击速度大幅提升',
        effects: { attackSpeed: 1.6 },
        color: '#40a080',
        icon: 'cola',
    },
    {
        id: 'inner_eye',
        name: '内心之眼',
        desc: '一次射出三发眼泪，射速略降',
        effects: { shotCount: 2, attackSpeed: 0.85 },
        color: '#8070c0',
        icon: 'eye3',
    },
    {
        id: 'blood_eye',
        name: '血色散弹',
        desc: '扇形散弹，伤害略降',
        effects: { spread: 2, damage: 0.85 },
        color: '#c05050',
        icon: 'shotgun',
    },
    {
        id: 'cupid_arrow',
        name: '丘比特之箭',
        desc: '眼泪可以穿透敌人',
        effects: { piercing: true, damage: 1.15 },
        color: '#d070a0',
        icon: 'arrow',
    },
    {
        id: 'crickets_head',
        name: '蟋蟀的头',
        desc: '伤害提升50%',
        effects: { damage: 1.5 },
        color: '#6a5a3a',
        icon: 'cricket',
    },
    {
        id: 'lemon_mishap',
        name: '柠檬意外',
        desc: '伤害与射速提升',
        effects: { damage: 1.5, attackSpeed: 1.2 },
        color: '#d4c040',
        icon: 'lemon',
    },
    {
        id: 'belt',
        name: '皮带',
        desc: '移动速度提升',
        effects: { moveSpeed: 1.3 },
        color: '#6a4a2a',
        icon: 'belt',
    },
    {
        id: 'pinky_eye',
        name: '粉红眼',
        desc: '射程提升',
        effects: { range: 1.5 },
        color: '#d08080',
        icon: 'eye',
    },
    {
        id: 'number_one',
        name: '第一号',
        desc: '射速+伤害提升，射程降低',
        effects: { damage: 1.35, attackSpeed: 1.6, range: 0.7 },
        color: '#e8a040',
        icon: 'one',
    },
    {
        id: 'wire_hanger',
        name: '衣架',
        desc: '眼泪飞行速度提升',
        effects: { shotSpeed: 1.5, range: 1.2 },
        color: '#888888',
        icon: 'hanger',
    },
    {
        id: 'blood_bag',
        name: '血袋',
        desc: '最大生命值+1心，回满血',
        effects: { maxHealth: 2 },
        color: '#c04040',
        icon: 'blood',
    },
    {
        id: 'polyphemus',
        name: '独眼巨人',
        desc: '巨量伤害大眼泪，射击很慢',
        effects: { damage: 2.5, attackSpeed: 0.6, tearSize: 1.5, range: 1.3 },
        color: '#a06040',
        icon: 'eye_big',
    },
    {
        id: 'lucky_rock',
        name: '幸运石',
        desc: '全面属性小幅提升',
        effects: { damage: 1.1, moveSpeed: 1.1, attackSpeed: 1.1, range: 1.1 },
        color: '#5a8a4a',
        icon: 'rock',
    },
];
