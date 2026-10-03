# LinkMind — AI Agent 协作规则

> 本文件定义 LinkMind 项目的开发规范、架构约定和 Agent 协作指令。
> 所有 AI Agent（Codex / Claude / Cursor 等）在修改本项目前必须遵守以下规则。

---

## 1. 项目概述

LinkMind 是 AI 驱动的内容收藏与知识整理工具，技术栈：
- **框架**：Next.js 16 App Router + React 19 + TypeScript 严格模式
- **样式**：CSS Modules（项目级 `app/globals.css` + 模块级 `*.module.css`）
- **后端**：Neon（Serverless PostgreSQL）+ 自建会话认证
- **AI**：DeepSeek API（优先） / OpenAI 兼容接口（备选）
- **部署**：Vercel

完整产品需求见 [PRD.md](./PRD.md)，架构见 [docs/architecture.md](./docs/architecture.md)。

---

## 2. 代码规范

### 2.1 TypeScript

- 启用 `strict: true`，禁止 `any`（确需时使用 `unknown` + 类型守卫）
- 路径别名 `@/*` 映射项目根目录（见 `tsconfig.json`）
- Server Component 默认，Client Component 需显式声明 `"use client"`

### 2.2 命名约定

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 文件（组件） | kebab-case | `ai-chat-panel.tsx` |
| 文件（Lib） | kebab-case | `bookmark-store.ts` |
| 类型接口 | PascalCase | `BookmarkRecord` |
| 变量/函数 | camelCase | `getAllBookmarks` |
| 常量 | SCREAMING_SNAKE_CASE | `FETCH_TIMEOUT_MS` |
| CSS Modules | `*.module.css` | `page.module.css` |

### 2.3 导入顺序

1. Next.js / React
2. 第三方库
3. 别名导入（`@/...`）
4. 相对导入（`./...`）

### 2.4 样式

- **仅使用 CSS Modules**，不引入 Tailwind / styled-components / 其他 CSS 框架
- 全局样式写在 `app/globals.css`
- CSS 变量定义在 `:root` 伪类下
- 卡片圆角 ≤ 8px

---

## 3. 架构约定

### 3.1 目录结构

```
app/                    # Next.js App Router
├── api/               # API 路由（Serverless Functions）
│   ├── auth/          # 注册 / 登录 / 登出 / 会话
│   ├── process/       # POST — 抓取 + AI 解析
│   ├── save/          # POST — 保存收藏
│   ├── bookmarks/     # GET — 列表 / 详情
│   └── chat/          # POST — AI 追问
├── detail/[id]/       # 详情页 + AI 对话面板
├── history/           # 收藏列表页
├── auth/              # 登录 / 注册
├── providers/         # React Context Providers
├── layout.tsx         # 根布局
└── page.tsx           # 首页

lib/                   # 核心业务逻辑（框架无关）
├── ai.ts              # AI 调用（多后端适配）
├── bookmark-store.ts  # 书签 CRUD（Neon + 内存降级）
├── content-extractor.ts # 网页正文提取
├── auth.ts            # 认证核心（scrypt 哈希 / 会话）
└── db.ts              # Neon 客户端工厂

components/            # 可复用 UI 组件
types/                 # TypeScript 类型定义
utils/auth.ts          # 服务端会话辅助（getCurrentUser）
db/schema.sql          # 数据库 Schema
scripts/               # apply-schema.ts / db-smoke.ts
```

### 3.2 数据流

```
用户输入 URL
    ↓
POST /api/process
    ↓                   ↓
content-extractor.ts   lib/ai.ts
（抓取网页正文）       （调用 AI 生成结构化内容）
    ↓
返回 ProcessResult { title, summary, outline, tags, content, url }
    ↓
POST /api/save
    ↓
lib/bookmark-store.ts → Neon Postgres INSERT（ON CONFLICT 去重）
    ↓
返回 BookmarkRecord（含 id）
```

### 3.3 认证流程

- 认证为自建会话方案：注册/登录写入 `users` 表并创建 `sessions` 记录（`lib/auth.ts`）
- 客户端持有 httpOnly Cookie（`lm_session`），不直接访问数据库
- 服务端通过 `utils/auth.ts` 的 `getCurrentUser()` 从 Cookie 还原当前用户
- 用户状态通过 `AuthProvider`（Context，经 `/api/auth/me`）全局共享
- 受保护接口（如 `/api/chat`）必须验证 `user`，所有查询按 `user_id` 过滤

### 3.4 多后端 AI 策略

- 环境变量检测顺序：`DEEPSEEK_API_KEY` → `OPENAI_API_KEY`
- DeepSeek 默认模型：`deepseek-v4-flash`
- OpenAI 默认模型：`gpt-4o-mini`
- 所有 AI 调用走通用 `chatCompletion()` 函数，不直接暴露 provider 细节

---

## 4. 环境变量

| 变量名 | 用途 | 必需 | 客户端可见 |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串（建议 pooled） | ✅ | ❌ |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 二选一 | ❌ |
| `DEEPSEEK_BASE_URL` | DeepSeek 端点 | ❌ | ❌ |
| `DEEPSEEK_MODEL` | DeepSeek 模型 | ❌ | ❌ |
| `OPENAI_API_KEY` | OpenAI API Key | 二选一 | ❌ |
| `OPENAI_BASE_URL` | OpenAI 端点 | ❌ | ❌ |
| `OPENAI_MODEL` | OpenAI 模型 | ❌ | ❌ |

---

## 5. 命令速查

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run lint         # ESLint 检查
```

---

## 6. Agent 行为准则

### 6.1 修改代码前

- [ ] 阅读本文件和相关架构文档
- [ ] 确认修改不影响 Vercel 部署（构建命令 `next build`）
- [ ] 遵循现有命名约定和目录结构

### 6.2 修改代码时

- [ ] 优先使用项目现有工具函数和模式
- [ ] 不引入新的 CSS 框架
- [ ] 服务端代码不暴露敏感 Key
- [ ] API 路由返回正确的 HTTP 状态码
- [ ] 保持 `lib/` 目录框架独立（可脱离 Next.js 测试）

### 6.3 新增功能时

- 在 `types/bookmark.ts` 添加或扩展类型
- API 路由在 `app/api/<feature>/route.ts` 中创建
- 页面在 `app/<feature>/page.tsx` 中创建
- 业务逻辑提取到 `lib/<feature>.ts`
- 必要时在 `docs/` 补充架构文档

### 6.4 禁止事项

- ❌ 不将 API Key 或 DATABASE_URL 提交到 Git
- ❌ 不在客户端组件直连数据库（所有查询走服务端 API）
- ❌ 不使用 `any` 类型（除非有显式注释说明原因）
- ❌ 不绕过 user_id 隔离访问其他用户数据
- ❌ 不在 `lib/` 中导入 Next.js 特有模块

---

## 7. 测试要求

```bash
# 类型检查
npx tsc --noEmit

# 构建验证
npm run build

# Lint
npm run lint
```

测试文件位于 `tests/` 目录，运行 `npx tsx tests/<file>.ts` 执行。

---

## 8. 参考文档

- [PRD.md](./PRD.md) — 产品需求文档
- [docs/architecture.md](./docs/architecture.md) — 系统架构
- [docs/data-dictionary.md](./docs/data-dictionary.md) — 数据字典
- [README.md](./README.md) — 快速开始与部署指南
