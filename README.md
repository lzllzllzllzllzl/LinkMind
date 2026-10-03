# LinkMind

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon" alt="Neon">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

> AI 驱动的跨平台内容收藏与知识整理工具，让碎片信息变结构化知识

## ✨ 特性

- **智能解析** - 粘贴任意链接（知乎、B站、小红书、公众号等），AI 自动提取正文、生成结构化摘要
- **知识结构化** - 自动生成文章大纲、提取关键词标签
- **AI 追问** - 保存后可基于原文继续提问，AI 从原文出发回答
- **跨端同步** - 数据存储在 Neon Postgres，不同设备保持一致
- **响应式设计** - 完美适配桌面端和移动端

## 🛠 技术栈

| 类别    | 技术                                        |
| ----- | ----------------------------------------- |
| 前端框架  | Next.js 16 (App Router) + React 19        |
| 样式方案  | CSS Modules                               |
| 数据库   | Neon (Serverless PostgreSQL)              |
| 认证    | 自建会话认证（scrypt 加盐哈希 + httpOnly Cookie）     |
| AI 能力 | DeepSeek API / OpenAI 兼容接口                |
| 部署平台  | Vercel                                    |

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm / yarn / pnpm

### 1. 克隆项目

```bash
git clone https://github.com/lzllzllzllzllzl/LinkMind.git
cd LinkMind
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填入配置：

```bash
cp .env.example .env.local
```

需要配置以下环境变量：

#### Neon 数据库（必需）

| 变量名           | 说明                              |
| -------------- | --------------------------------- |
| `DATABASE_URL` | Neon Postgres 连接串（建议用 pooled） |

> 前往 [Neon Console](https://console.neon.tech) 创建项目并获取连接串，
> 或通过 CLI：`neonctl auth` 登录后执行 `neonctl connection-string <project-id> --pooled`

#### AI API（选择一种）

**方案 A: DeepSeek API（推荐）**

| 变量名               | 说明                            |
| ------------------ | ------------------------------- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key                |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com`（可选） |
| `DEEPSEEK_MODEL`   | 模型名（可选）                      |

**方案 B: OpenAI 兼容 API**

| 变量名               | 说明                          |
| ----------------- | ----------------------------- |
| `OPENAI_API_KEY`  | OpenAI API Key              |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `OPENAI_MODEL`    | `gpt-4o-mini`               |

### 4. 初始化数据库

将 `db/schema.sql` 应用到 Neon 数据库（无需本地安装 psql）：

```bash
DATABASE_URL=postgres://... npx tsx scripts/apply-schema.ts
```

可通过冒烟测试验证数据库连通性（会创建并清理临时测试数据）：

```bash
DATABASE_URL=postgres://... npx tsx scripts/db-smoke.ts
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 <http://localhost:3000> 查看效果。

## 📖 使用流程

1. **登录/注册** - 使用邮箱注册或登录
2. **粘贴链接** - 在首页输入任意文章链接
3. **AI 解析** - 系统自动抓取内容并调用 AI 生成摘要、大纲、标签
4. **保存知识** - 一键保存到个人知识库
5. **追问 AI** - 进入详情页可基于原文继续提问

## 🔌 Neon 数据读写机制

### 1. Neon 简介

Neon 是 Serverless PostgreSQL 平台，提供：

- **标准 PostgreSQL** - 存储计算分离，按需扩缩
- **分支数据库** - 每个分支是数据的完整副本，适合开发/预览环境
- **HTTP 查询协议** - 配合 Serverless 驱动，无需维护连接池

### 2. 数据表结构

```sql
create table public.users (      -- 自建认证用户表
  id uuid primary key,
  email text unique,
  password_hash text,            -- scrypt 加盐哈希
  created_at timestamptz
);

create table public.sessions (   -- 登录会话
  token text primary key,
  user_id uuid references users(id) on delete cascade,
  expires_at timestamptz
);

create table public.bookmarks (
  id uuid primary key,           -- 唯一标识
  user_id uuid,                  -- 所属用户
  title text,                    -- 标题
  url text,                      -- 原始链接
  content text,                  -- 网页正文内容
  summary text,                  -- AI 生成的摘要
  outline jsonb,                 -- 文章大纲（JSON 数组）
  tags jsonb,                    -- 标签数组
  created_at timestamptz
);
```

### 3. 本项目的数据读写流程

#### 连接 Neon

项目通过 [lib/db.ts](lib/db.ts) 创建 Serverless 驱动客户端（HTTP 协议，无需连接池）：

```typescript
// lib/db.ts
import { neon } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}
```

#### 写入数据（保存收藏）

```
用户点击保存 → /api/save/route.ts → bookmark-store.ts → INSERT ... ON CONFLICT
```

核心代码在 [lib/bookmark-store.ts](lib/bookmark-store.ts)：

```typescript
export async function saveBookmark(input: SaveBookmarkInput) {
  const inserted = await db`
    insert into bookmarks (user_id, title, url, content, summary, outline, tags)
    values (...)
    on conflict (user_id, url) do nothing
    returning *
  `;
  // 冲突时回查已有记录，返回 { record, duplicated }
}
```

#### 读取数据（查询收藏）

```
用户访问历史页 → /api/bookmarks/route.ts → bookmark-store.ts → SELECT
```

#### 认证与用户数据隔离

认证为自建会话方案：注册/登录写入 `users` 表并创建 `sessions` 记录，
客户端持有 httpOnly Cookie，服务端通过 [utils/auth.ts](utils/auth.ts) 还原当前用户：

```typescript
// utils/auth.ts
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? getSessionUser(token) : null;
}
```

所有查询都在服务端按 `user_id` 过滤，保证用户隔离：

```typescript
// app/api/chat/route.ts
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

const record = await getBookmarkById(bookmarkId, user.id); // 仅查当前用户数据
```

### 4. 环境变量配置

| 变量名           | 说明                   | 获取方式                       |
| -------------- | ---------------------- | ------------------------------ |
| `DATABASE_URL` | Neon 连接串（服务端用）  | Neon Console 或 neonctl CLI     |

### 5. 本地无配置时的降级机制

项目支持在没有数据库时使用内存存储（仅开发调试用）：

```typescript
// lib/bookmark-store.ts
if (!hasDbConfig()) {
  // 使用内存数组存储
  memoryBookmarks.unshift(record);
  return { record, duplicated: false };
}
```

## 🌐 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入仓库
3. 在 Project Settings 中配置环境变量（`DATABASE_URL` 必需，AI Key 按需）
4. 部署完成，自动生成访问域名

## 📁 项目结构

```
linkmind-mvp/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # 注册/登录/登出/会话
│   │   ├── process/       # AI 内容处理
│   │   └── chat/          # AI 问答
│   ├── detail/[id]/       # 详情页
│   ├── history/          # 知识库页
│   └── auth/             # 登录/注册
├── db/
│   └── schema.sql        # 数据库 Schema
├── lib/
│   ├── ai.ts             # AI 调用逻辑
│   ├── auth.ts           # 认证核心（哈希/会话）
│   ├── db.ts             # Neon 客户端
│   └── bookmark-store.ts # 收藏 CRUD
├── scripts/
│   ├── apply-schema.ts   # 应用数据库 Schema
│   └── db-smoke.ts       # 数据库冒烟测试
└── types/                # 类型定义
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License - 查看 [LICENSE](LICENSE) 了解更多
