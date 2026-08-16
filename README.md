# 2048 小游戏（粉色主题 · 单文件版）

一个零依赖、纯前端的 2048 游戏，整个游戏就是**一个 `2048.html` 文件**，双击即可在浏览器里玩，无需安装任何环境。

## 功能特性

- **经典玩法**：4×4 网格，方向键 / 触屏滑动合并相同数字，目标合成 2048（达成后可继续挑战更高分）。
- **分数系统**：当前分数 + 历史最高分（用 `localStorage` 本地保存）。
- **音效**：移动、合并（金币声）、胜利、失败均有音效，右上角可一键开关。
- **实用小工具**：
  - 撤回上一步
  - 消除任意一个数字
  - 把所选数字变成指定数值
- **移动端适配**：支持触屏滑动、动态视口，手机上也能玩。
- **少女粉主题**：柔和粉色配色，数字块按数值分级区分。

## 本地运行

直接用浏览器打开 `2048.html` 即可：

```bash
# 方式一：文件管理器里双击 2048.html
# 方式二：命令行打开（Windows）
start 2048.html
```

无需构建、无需服务器。

## 项目结构

```
2048游戏/
├── 2048.html      # 游戏本体（HTML + 内联 CSS + JS，零依赖）
├── README.md      # 本说明文档
└── .workbuddy/    # 本地工作记忆目录（已通过 .gitignore 排除，不参与上传）
```

## 上传到 GitHub

以下步骤使用 **HTTPS + Personal Access Token** 方式推送。

### 1. 生成 GitHub Token

1. GitHub 右上角头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**。
2. 点 **Generate new token (classic)**。
3. Note 随便填（如 `2048-push`），Expiration 按需选择。
4. 勾选 `repo`（完整仓库权限），其余不勾。
5. 点 Generate，**立即复制 `ghp_xxx` 这串 token 并妥善保存**（只显示一次）。

### 2. 本地初始化并提交

```bash
cd "D:/WorkBuddy_workspace/2048游戏"

# 初始化仓库
git init

# 排除本地数据目录，避免上传无关内容
printf '.workbuddy/\n' > .gitignore

# 提交游戏文件
git add 2048.html .gitignore
git commit -m "feat: 添加 2048 单文件游戏（粉色主题 + 音效 + 工具）"
```

### 3. 关联远程仓库

本项目的实际仓库地址为 `https://github.com/huo-lan123/AI_projects.git`（仓库需在 GitHub 网页端先建好）：

```bash
git remote add origin https://github.com/huo-lan123/AI_projects.git
git remote -v        # 确认关联成功
```

> 若已存在 remote 或要换地址：`git remote set-url origin https://github.com/huo-lan123/AI_projects.git`

### 4. 推送到 GitHub

```bash
git branch -M main
git push -u origin main
```

`git push` 提示输入账号密码时：
- **Username**：填 GitHub 用户名
- **Password**：填第 1 步生成的 **Token**（不是登录密码，输入时屏幕不显示属正常）

### 5. 免去重复输入 Token（可选）

```bash
git config --global credential.helper wincred
```
首次输入 token 后，Windows 会记住凭证，后续 push 不再提示。

### 后续更新代码

```bash
git add 2048.html
git commit -m "更新说明"
git push
```

### 仓库非空时的处理

若 GitHub 仓库已含 README 等文件，先拉取再推送：

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```
