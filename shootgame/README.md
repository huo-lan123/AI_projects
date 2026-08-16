# 勇者的试炼 - 逃出地牢

一款复刻《以撒的结合》核心玩法的俯视角肉鸽地牢网页游戏。纯代码绘制所有素材，无任何外部图片资源，开箱即玩。

## 在线试玩

直接用浏览器打开 `index.html` 即可游玩，无需安装任何依赖。

## 技术栈

- **渲染**：HTML5 Canvas 2D
- **逻辑**：原生 JavaScript（无游戏引擎、无外部库）
- **音效**：Web Audio API 纯代码合成（OscillatorNode + GainNode 包络）
- **架构**：多文件按依赖顺序通过 `<script>` 标签加载，共享全局作用域
- **测试**：puppeteer-core + Microsoft Edge 自动化截图验证

## 玩法

逃入随机生成的地下室，用眼泪击败怪物，收集道具不断变强，击败 Boss 逃出生天。

- 共 **3 层**地牢，每层随机生成 5-8 个房间 + 1 个 Boss 房
- **14 种道具**：三连发、散弹、穿透弹、射速提升、伤害提升、移动加速等
- **4 种敌人**：苍蝇、黏液怪、蜘蛛、Boss Monstro
- 房间类型：普通战斗房、宝藏房、Boss 房
- 击败 Boss 后出现陷阱门，进入下一层

## 操作方式

### PC

| 按键 | 功能 |
|------|------|
| `W` `A` `S` `D` | 移动 |
| `↑` `↓` `←` `→` | 四方向射击 |
| `空格` / `Enter` | 确认 / 开始游戏 |
| `M` | 音效开关 |

### 移动端

- 左半屏拖动：移动
- 右半屏拖动：射击
- 竖屏自动旋转画面，横握手机即可游玩
- 点击 `⛶` 按钮可请求全屏

## 项目结构

```
├── index.html              # 页面结构与 UI 覆盖层
├── css/
│   └── style.css           # 暗黑卡通风格 UI 样式
├── js/
│   ├── config.js           # 常量、颜色、道具池
│   ├── utils.js            # 工具函数与方向常量
│   ├── audio.js            # Web Audio API 合成音效系统
│   ├── input.js            # 键盘 + 移动端虚拟摇杆输入
│   ├── bullet.js           # 玩家眼泪 / 敌人弹幕（支持穿透）
│   ├── player.js           # 玩家属性与道具系统
│   ├── enemy.js            # 敌人 AI（苍蝇、黏液怪、蜘蛛、Boss）
│   ├── item.js             # 道具掉落与拾取物
│   ├── room.js             # 房间生成、碰撞、门通行
│   ├── dungeon.js          # 随机地牢生成（BFS + 强制扩展）
│   ├── renderer.js         # 所有 Canvas 绘制函数
│   └── game.js             # 主游戏循环与状态机
└── screenshot-tool/        # puppeteer 自动化测试脚本
    ├── smoke-test.js       # 冒烟测试
    ├── full-test.js        # 完整流程测试
    ├── bullet-test.js      # 子弹系统测试
    ├── audio-test.js       # 音效系统测试
    ├── mobile-test.js      # 移动端测试
    ├── landscape-test.js   # 横屏旋转测试
    └── exit-test.js        # 退出按钮测试
```

## 核心特性

- **随机地牢生成**：BFS 算法生成房间布局，含强制扩展兜底防止房间过少
- **道具系统**：射击形态变化（三连发、扇形散弹、穿透弹）、属性增强（伤害/射速/移速/射程/生命）
- **合成音效**：17 种纯代码合成音效（射击、击杀、受击、Boss咆哮、道具拾取、通关等），支持静音
- **移动端适配**：虚拟摇杆、竖屏强制旋转、触摸坐标换算、全屏 API
- **暗黑卡通风格**：纯代码绘制角色、敌人、道具图标、UI 界面

## 游戏画面

- 开始界面 → 普通房清怪 → 宝藏房 → Boss 房 → 陷阱门 → 下一层 → 通关
- 死亡/通关界面含击杀数、拾取道具、存活时间、到达层数统计
- 支持从失败/通关界面退出回首页

## 开发与测试

```bash
# 本地启动（任选一种）
python -m http.server 8080
# 然后访问 http://localhost:8080

# 运行自动化测试（需要 puppeteer-core + Microsoft Edge）
cd screenshot-tool
npm install
node smoke-test.js     # 冒烟测试
node full-test.js      # 完整流程测试
node exit-test.js      # 退出按钮测试
```

调试模式：在 URL 后加 `?debug=1` 可暴露 `window.game` 对象用于调试。
