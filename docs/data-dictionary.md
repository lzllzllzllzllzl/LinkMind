# LinkMind — 数据字典

> 版本：v2.0 · 最后更新：2026-10-03

本文档定义 LinkMind 项目中所有数据模型、字段含义、约束和关系。

---

## 1. 数据库表

### 1.1 `public.bookmarks`

用户收藏的书签记录表。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` | 唯一标识 |
| `user_id` | `uuid` | NULLABLE, FK → `users.id` | `NULL` | 所属用户（未登录为 NULL） |
| `title` | `text` | NOT NULL | -- | 文章标题 |
| `url` | `text` | NOT NULL | -- | 原始链接 |
| `content` | `text` | NOT NULL | -- | 网页正文（纯文本） |
| `summary` | `text` | NOT NULL | `''` | AI 生成摘要（120-220字） |
| `outline` | `jsonb` | NOT NULL | `'[]'` | 文章大纲（字符串数组） |
| `tags` | `jsonb` | NOT NULL | `'[]'` | 标签数组（3-6个中文关键词） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 创建时间 |

**索引：**
- `idx_bookmarks_created_at` — `created_at DESC`，优化列表排序
- `bookmarks_user_url_key` — `(user_id, url)` 唯一索引，应用层依赖其做 URL 去重（`ON CONFLICT`）

### 1.2 `public.users`（自建认证）

用户账号表，替代原 Supabase Auth。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` | 用户唯一标识 |
| `email` | `text` | NOT NULL, UNIQUE | -- | 用户邮箱（小写归一） |
| `password_hash` | `text` | NOT NULL | -- | scrypt 加盐哈希（`scrypt:salt:hash`） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 注册时间 |

### 1.3 `public.sessions`

登录会话表，Cookie 中的 token 指向此表。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `token` | `text` | PRIMARY KEY | -- | 随机 64 位十六进制会话令牌 |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | -- | 所属用户 |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 创建时间 |
| `expires_at` | `timestamptz` | NOT NULL | -- | 过期时间（创建后 30 天） |

---

## 2. TypeScript 接口

### 2.1 `ProcessResult`

AI 内容解析结果。

```typescript
interface ProcessResult {
  title: string;     // 文章标题
  summary: string;   // AI 生成摘要
  outline: string[]; // 文章大纲（4-8条）
  tags: string[];    // 标签（3-6个）
  content: string;   // 原始正文
  url: string;       // 原始链接
}
```

**文件位置：** `types/bookmark.ts`

### 2.2 `SaveBookmarkInput`

保存收藏时的输入数据。

```typescript
interface SaveBookmarkInput {
  user_id?: string | null; // 可选
  title: string;           // 必填
  url: string;             // 必填
  content: string;         // 必填
  summary: string;         // 必填
  outline: string[];       // 必填
  tags: string[];          // 必填
}
```

### 2.3 `BookmarkRecord`

完整的书签记录（数据库行 + 元数据）。

```typescript
interface BookmarkRecord {
  id: string;            // UUID，服务端生成
  user_id: string | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  outline: string[];
  tags: string[];
  created_at: string;    // ISO 8601 时间戳
}
```

### 2.4 `AuthUser`

当前登录用户（客户端与 API 之间传递的最小用户信息）。

```typescript
interface AuthUser {
  id: string;    // UUID
  email: string;
}
```

**文件位置：** `types/auth.ts`

---

## 3. API 请求/响应格式

### 3.0a POST `/api/auth/signup`

**请求体：**
```json
{ "email": "user@example.com", "password": "至少6位" }
```

**成功响应 (201)：** `{ "user": { "id": "uuid", "email": "..." } }`，同时 Set-Cookie 写入会话

**错误响应：** 400 格式错误 / 409 邮箱已注册 / 503 数据库未配置

### 3.0b POST `/api/auth/login`

**请求体：** 同 signup

**成功响应 (200)：** 同 signup

**错误响应：** 400 / 401 邮箱或密码不正确 / 503

### 3.0c POST `/api/auth/logout`

**成功响应 (200)：** `{ "ok": true }`，清除会话 Cookie（服务端删除 sessions 记录）

### 3.0d GET `/api/auth/me`

**成功响应 (200)：** `{ "user": { "id": "uuid", "email": "..." } }` 或 `{ "user": null }`

### 3.1 POST `/api/process`

**请求体：**
```json
{ "url": "https://example.com/article" }
```

**成功响应 (200)：**
```json
{
  "title": "文章标题",
  "summary": "摘要内容...",
  "outline": ["节点1", "节点2", "节点3"],
  "tags": ["标签1", "标签2"],
  "content": "原始正文...",
  "url": "https://example.com/article"
}
```

**错误响应 (400/500)：**
```json
{ "error": "错误描述" }
```

### 3.2 POST `/api/save`

**请求头：** 需携带会话 Cookie（未登录返回 401）

**请求体：**
```json
{
  "title": "string",
  "url": "string",
  "content": "string",
  "summary": "string",
  "outline": ["string"],
  "tags": ["string"]
}
```

> `user_id` 由服务端从会话取得，不接受客户端传入。

**成功响应 (200)：** `BookmarkRecord` + `duplicated` 标记（同用户同 URL 重复保存时 `duplicated: true`，返回已有记录）

### 3.3 GET `/api/bookmarks`

**请求头：** 需携带会话 Cookie（未登录返回 401）

**查询参数：**
- `id` (可选) — 指定则返回单条，否则返回当前用户列表

**成功响应 (200)：** `BookmarkRecord[]` 或 `BookmarkRecord`

### 3.4 POST `/api/chat`

**请求头：** 需携带认证 Cookie

**请求体：**
```json
{
  "bookmarkId": "uuid",
  "question": "string"
}
```

**成功响应 (200)：**
```json
{ "answer": "AI 回答内容..." }
```

**错误响应：**
- 401 — 未登录
- 404 — 找不到对应收藏

---

## 4. AI Prompt 规范

### 4.1 结构化生成 Prompt

```
你是一个知识结构化助手。请先总结文章，再给出结构图节点。
必须只输出 JSON，不要输出任何额外文字或 Markdown 代码块。
字段必须严格为：
{
  "summary": "中文摘要，120-220字，先给结论再给依据",
  "outline": ["结构图节点1：解释", "结构图节点2：解释", "结构图节点3：解释", "结构图节点4：解释"],
  "tags": ["关键词1", "关键词2", "关键词3"]
}

要求：
1) summary 必须可直接给用户阅读；
2) outline 用于页面展示"结构图"，建议 4-8 条；
3) 每条 outline 尽量是"节点名：简要说明"格式；
4) tags 返回 3-6 个中文关键词。

文章标题：
{title}

文章正文：
{content}
```

### 4.2 追问 Prompt

基于 `summary`、`outline`、`tags`、`content` 上下文回答用户问题。

### 4.3 参数配置

| 参数 | 值 |
| --- | --- |
| temperature | 0.2 |
| response_format | `{ type: "json_object" }` |

---

## 5. 环境变量

| 变量名 | 类型 | 必需 | 可见范围 | 说明 |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | string | 是 | 服务端 | Neon Postgres 连接串（建议 pooled） |
| `DEEPSEEK_API_KEY` | string | 二选一 | 服务端 | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | string | 否 | 服务端 | 默认 Beijing 端点 |
| `DEEPSEEK_MODEL` | string | 否 | 服务端 | 默认 deepseek-v4-flash |
| `OPENAI_API_KEY` | string | 二选一 | 服务端 | OpenAI API Key |
| `OPENAI_BASE_URL` | string | 否 | 服务端 | 默认 OpenAI 端点 |
| `OPENAI_MODEL` | string | 否 | 服务端 | 默认 gpt-4o-mini |

---

## 6. 状态码约定

| 状态码 | 场景 |
| --- | --- |
| 200 | 成功 |
| 201 | 注册成功 |
| 400 | 必填字段缺失或格式错误 |
| 401 | 未登录或认证失效（含登录密码错误） |
| 404 | 记录不存在 |
| 409 | 注册邮箱已存在 |
| 500 | 服务端错误（AI 调用失败、数据库异常等） |
| 503 | 数据库未配置（缺少 DATABASE_URL） |

---

> 维护者：LinkMind 团队 · 编辑日期：2026-10-03
