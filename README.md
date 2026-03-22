# LinkMind

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

> AI 驱动的跨平台内容收藏与知识整理工具，让碎片信息变结构化知识

## ✨ 特性

- **智能解析** - 粘贴任意链接（知乎、B站、小红书、公众号等），AI 自动提取正文、生成结构化摘要
- **知识结构化** - 自动生成文章大纲、提取关键词标签
- **AI 追问** - 保存后可基于原文继续提问，AI 从原文出发回答
- **跨端同步** - 数据存储在 Supabase，不同设备保持一致
- **响应式设计** - 完美适配桌面端和移动端

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| 样式方案 | CSS Modules |
| 后端服务 | Supabase (PostgreSQL + Auth) |
| AI 能力 | 豆包 API / OpenAI API |
| 部署平台 | Vercel |

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm / yarn / pnpm

### 1. 克隆项目

```bash
git clone https://github.com/your-username/linkmind.git
cd linkmind/linkmind-mvp
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

#### Supabase（必需）

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名访问 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端管理 Key |

> 前往 [Supabase Dashboard](https://supabase.com/dashboard) 创建项目并获取以上凭证

#### AI API（选择一种）

**方案 A: 豆包 API（推荐）**

| 变量名 | 说明 |
|--------|------|
| `ARK_API_KEY` | 豆包 API Key |
| `ARK_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` |
| `ARK_MODEL` | `doubao-1-5-lite-32k-250115` |

**方案 B: OpenAI API**

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | `gpt-4o-mini` |

### 4. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql` 创建数据表。

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

## 📖 使用流程

1. **登录/注册** - 使用邮箱注册或登录
2. **粘贴链接** - 在首页输入任意文章链接
3. **AI 解析** - 系统自动抓取内容并调用 AI 生成摘要、大纲、标签
4. **保存知识** - 一键保存到个人知识库
5. **追问 AI** - 进入详情页可基于原文继续提问

## 🌐 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入仓库
3. 在 Project Settings 中配置环境变量
4. 部署完成，自动生成访问域名

## 📁 项目结构

```
linkmind-mvp/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── process/       # AI 内容处理
│   │   └── chat/          # AI 问答
│   ├── detail/[id]/       # 详情页
│   ├── history/          # 知识库页
│   └── auth/             # 登录/注册
├── lib/
│   ├── ai.ts             # AI 调用逻辑
│   └── supabase.ts       # Supabase 客户端
├── types/
│   └── bookmark.ts       # 类型定义
└── supabase/
    └── schema.sql        # 数据库 Schema
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License - 查看 [LICENSE](LICENSE) 了解更多
