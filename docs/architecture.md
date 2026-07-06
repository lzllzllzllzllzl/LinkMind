# LinkMind — 系统架构文档

> 版本：v1.0 · 最后更新：2026-07-06

## 1. 系统总览

LinkMind 是基于 Next.js 16 的全栈应用，部署在 Vercel 平台。

```
┌─────────────────────────────────────────────────────┐
│                  用户浏览器                          │
│  ┌─────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │  首页    │  │  详情页    │  │  历史页           │ │
│  │  page   │  │ detail/[id]│  │  history          │ │
│  └────┬────┘  └─────┬──────┘  └────────┬─────────┘ │
│       └──────────────┼──────────────────┘           │
│              AuthProvider (Context)                  │
└──────────────────────┼──────────────────────────────┘
                       │ HTTP (Fetch API)
┌──────────────────────┼──────────────────────────────┐
│  Vercel Serverless   │                               │
│  ┌───────────────────┼────────────────────────────┐  │
│  │  /api/process     │   /api/save   /api/chat    │  │
│  └───────────────────┼────────────────────────────┘  │
└──────────────────────┼──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
   │DeepSeek/│   │ Supabase  │  │ External│
   │OpenAI   │   │(DB+Auth)  │  │ 网页    │
   └─────────┘   └───────────┘  └─────────┘
```

## 2. 技术分层

### 2.1 表现层（Presentation）

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| 首页 | `app/page.tsx` | URL 输入、触发解析、展示结果、保存、追问 |
| 详情页 | `app/detail/[id]/page.tsx` | 展示收藏详情 + AI 对话面板 |
| 历史页 | `app/history/page.tsx` | 展示所有收藏的卡片列表 |
| 认证页 | `app/auth/page.tsx` | 登录 / 注册表单 |
| 布局 | `app/layout.tsx` | HTML 骨架、全局 Provider |

### 2.2 API 层（Serverless Functions）

| 路由 | 方法 | 输入 | 输出 | 依赖 |
| --- | --- | --- | --- | --- |
| `/api/process` | POST | `{ url }` | `ProcessResult` | `content-extractor`, `ai` |
| `/api/save` | POST | `SaveBookmarkInput` | `BookmarkRecord` | `bookmark-store` |
| `/api/bookmarks` | GET | `?id=` (可选) | `BookmarkRecord[]` | `bookmark-store` |
| `/api/chat` | POST | `{ bookmarkId, question }` | `{ answer }` | `auth`, `ai` |

### 2.3 业务逻辑层（lib/）

| 文件 | 职责 | 关键函数 |
| --- | --- | --- |
| `lib/ai.ts` | AI 调用适配 | `generateStructuredContent()`, `answerQuestionAboutContent()` |
| `lib/bookmark-store.ts` | 书签 CRUD | `saveBookmark()`, `getAllBookmarks()`, `getBookmarkById()` |
| `lib/content-extractor.ts` | 网页正文提取 | `extractMainContent()` |
| `lib/supabase.ts` | 客户端工厂 | `getSupabaseAdmin()`, `hasSupabaseConfig()` |

### 2.4 数据层

| 存储 | 用途 | 访问方式 |
| --- | --- | --- |
| Supabase (PostgreSQL) | 持久化书签数据 | `getSupabaseAdmin()` -- service_role 客户端 |
| Memory Array | 开发降级存储 | 模块级 `memoryBookmarks` 数组 |
| Cookie (Session) | 用户认证状态 | `next/headers` -> Supabase SSR 客户端 |

## 3. 关键流程时序

### 3.1 内容解析流程

```
Browser              /api/process                  External
  │                      │                            │
  │ -- POST {url} ------>│                            │
  │                      │ -- extractMainContent()    │
  │                      │   |-- fetch HTML --------->│
  │                      │   |-- cheerio parse        │
  │                      │   |-- fallback title       │
  │                      │ <- {title, content} -------│
  │                      │                            │
  │                      │ -- generateStructuredContent()
  │                      │   |-- buildPrompt()        │
  │                      │   |-- fetch AI API ------->│
  │                      │   |-- parse JSON           │
  │                      │ <- {summary, outline, tags}│
  │ <- ProcessResult ----│                            │
```

### 3.2 收藏保存流程

```
Browser              /api/save                Supabase
  │                      │                        │
  │ -- POST {bookmark} ->│                        │
  │                      │ -- validate fields     │
  │                      │ -- getSupabaseAdmin()  │
  │                      │ -- INSERT ----------->│
  │                      │ <- BookmarkRecord -----│
  │ <- saved record -----│                        │
```

如果 `hasSupabaseConfig()` 返回 false，`bookmark-store` 降级为内存存储。

### 3.3 AI 追问流程

```
Browser (已登录)      /api/chat              Supabase    AI API
  │                      │                      │          │
  │ -- POST {id, q} ---->│                      │          │
  │                      │ -- getUser() ------->│          │
  │                      │ <- user --------------│          │
  │                      │                      │          │
  │                      │ -- SELECT bookmark -->│         │
  │                      │   (WHERE user_id =)  │          │
  │                      │ <- bookmark ----------│          │
  │                      │                      │          │
  │                      │ -- answerQuestionAboutContent()  │
  │                      │   |-- buildPrompt() │  ------->│
  │                      │   |-- parse answer  │  <-------│
  │ <- {answer} ---------│                      │          │
```

## 4. 模块依赖关系

```
app/page.tsx ---------> lib/ai.ts ---------> DeepSeek / OpenAI
       │                    ^
       +---> lib/bookmark-store.ts -----> lib/supabase.ts --> Supabase
                    ^
app/api/save/route.ts ---+

app/api/process/route.ts --> lib/content-extractor.ts --> cheerio + fetch
                      +--> lib/ai.ts

app/api/chat/route.ts --> lib/ai.ts
                  +--> utils/supabase/server.ts

app/providers/auth-provider.tsx --> utils/supabase/client.ts
```

## 5. 安全架构

| 层面 | 措施 |
| --- | --- |
| API Key | 仅存服务端环境变量，永不暴露给客户端 |
| 用户隔离 | 所有数据查询带 `user_id` 过滤 |
| Auth | Supabase Auth + JWT，服务端验证 |
| Cookie | HttpOnly + SameSite，getAll/setAll 通过 SSR 客户端管理 |
| Input | URL 格式校验；bookmark 字段类型校验 |

## 6. 部署架构

```
GitHub (main branch)
    |
    | Push trigger
    v
Vercel Build
    |-- npm install
    |-- next build (SSG + SSR)
    |-- Deploy to Edge Network
    |
    v
Production URL
    |-- Static assets -> CDN
    |-- API routes -> Serverless Functions
    |-- Dynamic pages -> SSR on demand
```

## 7. 监控与可观测性

| 工具 | 用途 |
| --- | --- |
| Vercel Analytics | 页面性能、访问量 |
| Vercel Logs | Serverless Function 日志 |
| GitHub Actions | CI：类型检查 + 构建 + Lint |
| scripts/health-check.py | API 健康检查 |

## 8. 技术债务与改进方向

| 项目 | 当前状态 | 改进方案 |
| --- | --- | --- |
| 测试覆盖 | 无自动化测试 | 添加 Vitest + 关键路径覆盖 |
| 错误边界 | API 500 直接暴露 | 客户端统一 Error Boundary |
| 内容提取 | 仅 cheerio 静态解析 | 支持更多平台、SSR 渲染页面 |
| 缓存 | 无 | Redis / Vercel KV 缓存高频请求 |
| AI 调用 | 同步阻塞 | 流式输出 (SSE) |

---

> 维护者：LinkMind 团队 · 编辑日期：2026-07-06
