# PromptStash — 提示词管理工具设计文档

## 概述

PromptStash 是一款跨平台提示词管理工具，帮助用户在不同 AI 工具（ChatGPT、Claude、Gemini 等）之间快速保存和复用提示词。支持浏览器插件、Electron 桌面应用和 Alfred Workflow 三端集成。

## 核心需求

- **存储**：本地 SQLite 存储 + 借助现有云盘（iCloud/Dropbox）同步
- **组织**：分类 + 标签双维度管理
- **保存**：浏览器插件一键保存 + 全局快捷键保存 + 自动分类建议
- **调用**：浏览器内关键词触发直接插入 + 全局快捷键唤起浮动搜索窗口
- **平台**：网页 AI 工具 + 桌面应用全局调用 + Alfred 集成

## 架构设计

采用 Electron 中心化架构：Electron 桌面应用作为数据中心和主控，浏览器插件和 Alfred Workflow 作为轻量客户端通过本地 HTTP API 通信。

```
┌─────────────────────────────────────────────────────┐
│              Electron 桌面应用（常驻后台）              │
│                                                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ SQLite   │  │ 本地HTTP   │  │ 全局快捷键管理     │  │
│  │ 数据层    │  │ Server    │  │ + 浮动搜索窗口     │  │
│  │          │  │ (端口9877) │  │                  │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│       │              ▲  ▲            │              │
│  iCloud/Dropbox      │  │       系统托盘常驻          │
│  目录自动同步          │  │                           │
└──────────────────────│──│───────────────────────────┘
                       │  │
           ┌───────────┘  └─────────────┐
           │                            │
    ┌──────┴──────┐             ┌───────┴───────┐
    │  Chrome 插件  │             │ Alfred        │
    │ - 一键保存   │             │ Workflow      │
    │ - /p 触发    │             │ - 搜索/插入   │
    │   行内搜索    │             │               │
    └─────────────┘             └───────────────┘
```

### 通信机制

```
Chrome 插件 ──HTTP──→ Electron (localhost:9877) ──→ SQLite
Alfred      ──HTTP──→ Electron (localhost:9877) ──→ SQLite
全局快捷键   ──IPC───→ Electron 浮动窗口         ──→ SQLite
```

## 数据模型

```typescript
interface Prompt {
  id: string;            // UUID
  title: string;         // 提示词标题
  content: string;       // 提示词内容
  categoryId: string;    // 所属分类
  tags: string[];        // 标签列表
  source?: string;       // 来源（如 "chatgpt.com"）
  isFavorite: boolean;   // 是否收藏
  usageCount: number;    // 使用次数
  createdAt: string;     // 创建时间
  updatedAt: string;     // 更新时间
}

interface Category {
  id: string;
  name: string;          // 如 "编程"、"写作"、"翻译"
  icon?: string;
  sortOrder: number;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}
```

### 数据存储

- SQLite 数据库，默认路径：`~/Library/Application Support/PromptStash/data.db`
- 云同步模式：用户可将路径指向 iCloud Drive 或 Dropbox 目录
- 使用 SQLite WAL 模式提升并发读写性能
- 使用 SQLite FTS5 实现全文搜索

## 各端交互设计

### 1. Electron 桌面应用

**系统托盘常驻**：启动后最小化到 menubar，不占用 Dock。

**全局快捷键**：
- `Cmd+Shift+P` — 唤起浮动搜索窗口（Spotlight 风格）
- `Cmd+Shift+S` — 快速保存剪贴板内容为新提示词

**浮动搜索窗口**：
- Spotlight 风格搜索框，模糊搜索标题/内容/标签
- 搜索结果实时展示，回车选中后自动复制到剪贴板
- 支持分类筛选和标签过滤
- 常用提示词按使用频次排序

**管理界面**（点击托盘图标打开）：
- 左侧分类树 + 右侧提示词列表 + 详情/编辑面板
- 拖拽排序、批量标签管理
- 数据存储路径设置
- 导入/导出（JSON 格式）

**本地 HTTP Server**（端口 9877）：
```
GET  /api/prompts/search?q=关键词&category=编程&tag=python
GET  /api/prompts/:id
POST /api/prompts
GET  /api/categories
GET  /api/tags
POST /api/prompts/classify   # 自动分类建议
```

### 2. Chrome 浏览器插件

**保存提示词**：
- 在 AI 对话页面选中文本后，右键菜单出现「保存到 PromptStash」
- 弹出保存窗口，系统自动推荐分类和标签
- 标题自动取前20字，用户可修改
- 自动识别来源网站

**自动分类建议流程**：
```
选中文本 → 点击保存 → 弹窗自动填入：
  - 标题：自动取前20字或由用户修改
  - 分类：[编程 ▾]  ← 系统自动推荐，可切换
  - 标签：[python] [debug] [+添加]  ← 自动推荐的标签
  - 确认保存
```

**调用提示词**：
- 输入框中输入 `/p ` 或 `;p ` 触发行内搜索
- 下拉搜索面板，输入关键词模糊匹配
- 选中后自动替换触发词并插入提示词内容

**Content Script 注入**：
- 匹配 `chat.openai.com`、`claude.ai`、`gemini.google.com` 等域名
- 监听输入框 `input` 事件检测触发词
- 支持 `contenteditable` 和 `textarea` 两种输入框

### 3. Alfred Workflow

**搜索提示词**：
- 关键词 `pp` 触发，如 `pp python debug`
- 通过本地 HTTP API 搜索
- 回车 — 复制到剪贴板
- `Cmd+回车` — 复制并粘贴到当前应用

**快速保存**：
- 关键词 `ps` 触发
- `ps 标题` — 将剪贴板内容保存为提示词

## 自动分类建议

**实现方式**：
1. **关键词规则匹配**：预设规则引擎，根据内容关键词自动匹配分类
2. **TF-IDF 相似度**：基于已有提示词数据，用 TF-IDF 计算相似度推荐分类
3. **用户确认**：建议预填到保存表单，用户可直接接受或修改

## 技术选型

| 模块 | 技术 |
|------|------|
| Monorepo | pnpm workspace |
| 桌面应用 | Electron + React + Tailwind CSS |
| 数据库 | better-sqlite3 |
| 本地 HTTP Server | Fastify |
| 浏览器插件 | Chrome Extension Manifest V3 + React |
| Alfred Workflow | Node.js 脚本 |
| 构建工具 | Vite |
| 搜索 | SQLite FTS5 全文搜索 |
| 自动分类 | 关键词规则 + TF-IDF 相似度匹配 |

## 项目结构

```
promptstash/
├── packages/
│   ├── core/                  # 共享核心逻辑
│   │   ├── src/
│   │   │   ├── db.ts          # SQLite 数据访问层
│   │   │   ├── models.ts      # 数据模型定义
│   │   │   ├── search.ts      # 搜索引擎（模糊匹配）
│   │   │   └── classifier.ts  # 自动分类建议
│   │   └── package.json
│   ├── electron/              # Electron 桌面应用
│   │   ├── src/
│   │   │   ├── main/          # 主进程
│   │   │   │   ├── index.ts
│   │   │   │   ├── tray.ts    # 系统托盘
│   │   │   │   ├── server.ts  # 本地 HTTP Server
│   │   │   │   └── shortcuts.ts # 全局快捷键
│   │   │   └── renderer/      # 渲染进程（UI）
│   │   │       ├── App.tsx
│   │   │       ├── SearchWindow.tsx  # 浮动搜索窗口
│   │   │       └── Manager.tsx       # 管理界面
│   │   └── package.json
│   ├── chrome-extension/      # Chrome 浏览器插件
│   │   ├── manifest.json      # Manifest V3
│   │   ├── background.ts      # Service Worker
│   │   ├── content.ts         # Content Script
│   │   ├── popup.tsx          # 保存弹窗
│   │   └── package.json
│   └── alfred-workflow/       # Alfred Workflow
│       ├── search.ts          # 搜索脚本
│       ├── save.ts            # 保存脚本
│       ├── info.plist
│       └── package.json
├── package.json               # Monorepo 根配置
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 云盘同步策略

- SQLite 数据库文件放在用户指定的云盘目录下
- 应用设置中支持修改数据库路径
- 使用 SQLite WAL 模式
- 建议同一时间只在一台设备使用（云盘同步延迟可接受）
