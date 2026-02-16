# PromptStash

跨平台 Prompt 管理工具，支持 Electron 桌面应用、Chrome 扩展和 Alfred Workflow，共享本地 SQLite 数据库。

## 架构

```
promptstash/
├── packages/
│   ├── core/                  # 核心包：数据模型、SQLite、仓储、分类器
│   ├── electron/              # Electron 桌面应用（主进程 + React 渲染器）
│   ├── chrome-extension/      # Chrome 扩展（Manifest V3）
│   └── alfred-workflow/       # Alfred Workflow（搜索 + 保存）
├── package.json               # pnpm monorepo 根配置
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**工作原理：** Electron 应用作为中心枢纽，管理 SQLite 数据库并在 `127.0.0.1:9877` 运行本地 Fastify HTTP 服务器。Chrome 扩展和 Alfred Workflow 作为轻量客户端，通过 HTTP API 通信。

## 技术栈

- **核心：** TypeScript, better-sqlite3 (WAL + FTS5), Vitest
- **桌面应用：** Electron, React 19, Tailwind CSS 4, Vite, Fastify
- **Chrome 扩展：** Manifest V3, Vite 构建
- **Alfred Workflow：** TypeScript 脚本, pbpaste
- **Monorepo：** pnpm workspaces

## 功能

- **全文搜索：** SQLite FTS5 支持中英文 Prompt 搜索
- **自动分类：** 基于关键词的分类器，自动识别编程/写作/翻译/分析/创意类 Prompt
- **标签管理：** 自动提取和管理标签
- **多入口保存：**
  - Chrome 扩展右键菜单 "Save to PromptStash"
  - 全局快捷键 `Cmd+Shift+S` 保存剪贴板
  - Alfred `ps {title}` 保存剪贴板
- **快速调用：**
  - 全局快捷键 `Cmd+Shift+P` 打开浮动搜索窗口
  - Chrome 内容脚本输入 `/p ` 或 `;p ` 触发内联搜索
  - Alfred `pp {query}` 搜索并复制
- **数据导入导出：** JSON 格式，支持完整数据迁移

## 开发

```bash
# 安装依赖
pnpm install

# 运行核心包测试
pnpm test:core

# 仅启动 API 服务器（不依赖 Electron，用于调试 API）
pnpm dev:server

# 启动完整 Electron 开发模式（主进程 + 渲染器 + HTTP 服务器）
pnpm dev:electron

# 构建核心包
pnpm --filter @promptstash/core build

# 构建 Chrome 扩展
pnpm build:extension
```

## 构建

```bash
# 构建 Electron 应用（core tsc → esbuild 主进程 → Vite 渲染器）
pnpm build:electron

# 启动已构建的 Electron 应用
pnpm --filter @promptstash/electron start

# 构建 Alfred Workflow
pnpm build:alfred
```

主进程通过 esbuild 打包为单个 CJS bundle（`dist/main/index.js`），将 core ESM 代码和主进程代码合并，`better-sqlite3` 和 `electron` 作为 external 保留。渲染器由 Vite 构建到 `dist/renderer/`。

## Alfred Workflow 安装

**前提条件：** 已安装 [Alfred](https://www.alfredapp.com/) 并激活 Powerpack。

```bash
# 一键编译 + 安装（symlink 到 Alfred workflows 目录）
pnpm install:alfred

# 卸载
pnpm uninstall:alfred
```

安装脚本会将 `packages/alfred-workflow` 以 symlink 方式链接到 Alfred 的 workflows 目录，修改源码后只需 `pnpm build:alfred` 重新编译即可生效，无需重新安装。

**搜索提示词：**
- 关键词 `pp` 触发，如 `pp python debug`
- 通过本地 HTTP API 搜索
- 回车 — 复制到剪贴板
- `Cmd+回车` — 复制并粘贴到当前应用

**快速保存：**
- 关键词 `ps` 触发
- `ps 标题` — 将剪贴板内容保存为提示词
- 自动分类 + 保存完成后弹出通知

**快速唤起桌面端：**
- 关键词 `po` 触发
- 如果 PromptStash 正在运行，激活并聚焦窗口
- 如果未运行，尝试启动应用

**注意：** 搜索（`pp`）和保存（`ps`）功能需先启动 PromptStash 桌面应用（HTTP API 运行在 `127.0.0.1:9877`）。唤起（`po`）可在未运行时启动应用。

## API 端点

本地服务器运行在 `http://127.0.0.1:9877`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取所有分类 |
| GET | `/api/tags` | 获取所有标签 |
| GET | `/api/prompts/search?q=&categoryId=&tag=` | 搜索 Prompt |
| GET | `/api/prompts/:id` | 获取单个 Prompt |
| POST | `/api/prompts` | 创建 Prompt |
| POST | `/api/prompts/:id/use` | 增加使用次数 |
| POST | `/api/prompts/:id/favorite` | 切换收藏 |
| DELETE | `/api/prompts/:id` | 删除 Prompt |
| POST | `/api/prompts/classify` | 自动分类内容 |

## 默认分类

| 分类 | 图标 |
|------|------|
| 编程 | 💻 |
| 写作 | ✍️ |
| 翻译 | 🌐 |
| 分析 | 📊 |
| 创意 | 💡 |
| 其他 | 📁 |

## 打包分发

所有打包脚本位于 `scripts/` 目录，一键构建 + 打包。

### Electron 桌面应用

```bash
# 当前平台（自动构建 + 打包）
pnpm dist:electron

# 指定平台
pnpm dist:electron -- --mac
pnpm dist:electron -- --win
pnpm dist:electron -- --linux

# 仅打包为目录（本地测试，不生成安装包）
pnpm dist:electron -- --dir
```

产物：`packages/electron/release/`（dmg / nsis / AppImage）

> 前置：需安装 `electron-builder`（`pnpm add -D electron-builder --filter @promptstash/electron`），并在 `packages/electron/package.json` 中配置 `build` 字段。

### Chrome 扩展

```bash
pnpm dist:extension
```

产物：`packages/chrome-extension/release/promptstash-extension-<version>.zip`

上传到 [Chrome Web Store](https://chrome.google.com/webstore/devconsole) 或本地加载解压目录。

### Alfred Workflow

```bash
pnpm dist:alfred
```

产物：`packages/alfred-workflow/release/PromptStash-<version>.alfredworkflow`

双击 `.alfredworkflow` 文件即可安装到 Alfred。

### 注意事项

- **better-sqlite3** 是原生模块，electron-builder 会自动用 `@electron/rebuild` 重新编译
- **macOS 签名/公证** 需要 Apple Developer 证书，设置 `CSC_LINK` 和 `CSC_KEY_PASSWORD` 环境变量；跳过签名：`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm dist:electron`
- **Windows** 可在 macOS 上交叉编译（需要 wine），或直接在 Windows 上打包
- **自定义图标** 将 `icon.icns`（mac）/ `icon.ico`（win）/ `icon.png`（linux）放入 `packages/electron/build/` 目录
