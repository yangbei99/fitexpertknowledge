# FitExpertKnowledge 部署方案

## 项目概述

将 BCC 专家访谈文库应用部署到 GitHub Pages，并使用 Supabase 作为后端服务。

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Pages (前端)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React + Vite 静态站点                                    │   │
│  │  - 用户界面                                               │   │
│  │  - Gemini AI 集成                                         │   │
│  │  - Supabase Client SDK                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (后端服务)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Database   │  │     Auth     │  │       Storage        │  │
│  │  PostgreSQL  │  │   用户认证    │  │    文件存储服务       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Edge Func   │  │   Realtime   │  │    Row Level Sec     │  │
│  │   边缘函数    │  │   实时订阅    │  │     行级安全策略      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈选型

### 前端 (已有)
- **React 19** - UI 框架
- **Vite 6** - 构建工具
- **TypeScript** - 类型安全
- **@google/genai** - Gemini AI 集成

### 后端 (Supabase)
- **PostgreSQL** - 关系型数据库
- **Supabase Auth** - 用户认证
- **Supabase Storage** - 文件存储
- **Edge Functions** - 服务端逻辑（可选）

### 部署
- **GitHub Pages** - 静态站点托管（免费）
- **GitHub Actions** - CI/CD 自动化部署

---

## 三、Supabase 后端设计

### 3.1 数据库表结构建议

```sql
-- 用户表 (由 Supabase Auth 自动管理)
-- auth.users

-- 专家访谈记录表
CREATE TABLE expert_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expert_name TEXT,
  call_date DATE,
  summary TEXT,
  transcript TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 知识点/笔记表
CREATE TABLE knowledge_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES expert_calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 文件附件表
CREATE TABLE attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES expert_calls(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 Row Level Security
ALTER TABLE expert_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view own calls" ON expert_calls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calls" ON expert_calls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calls" ON expert_calls
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calls" ON expert_calls
  FOR DELETE USING (auth.uid() = user_id);
```

### 3.2 Supabase 功能使用

| 功能 | 用途 | 说明 |
|------|------|------|
| **Database** | 存储访谈记录、笔记 | PostgreSQL，支持全文搜索 |
| **Auth** | 用户登录注册 | 支持邮箱、GitHub、Google 登录 |
| **Storage** | 存储上传的文件 | 音频、文档等附件 |
| **Realtime** | 实时同步 | 多设备数据同步（可选） |
| **Edge Functions** | 服务端逻辑 | API 密钥保护、复杂处理（可选） |

---

## 四、GitHub Pages 部署方案

### 4.1 Vite 配置修改

修改 `vite.config.ts` 以支持 GitHub Pages：

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // GitHub Pages 部署路径（仓库名）
      base: mode === 'production' ? '/fitexpertknowledge/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

### 4.2 GitHub Actions 自动部署

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: BCC-Expert-Call-library/package-lock.json

      - name: Install dependencies
        working-directory: BCC-Expert-Call-library
        run: npm ci

      - name: Build
        working-directory: BCC-Expert-Call-library
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: BCC-Expert-Call-library/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 4.3 部署步骤

1. **初始化 Git 仓库**
   ```bash
   cd fitexpertknowledge
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **创建 GitHub 仓库并推送**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fitexpertknowledge.git
   git branch -M main
   git push -u origin main
   ```

3. **配置 GitHub Secrets**
   - 进入仓库 Settings > Secrets and variables > Actions
   - 添加以下 secrets：
     - `GEMINI_API_KEY`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`

4. **启用 GitHub Pages**
   - Settings > Pages
   - Source 选择 "GitHub Actions"

5. **访问网站**
   - 部署完成后访问：`https://YOUR_USERNAME.github.io/fitexpertknowledge/`

---

## 五、Supabase 集成步骤

### 5.1 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com) 并注册/登录
2. 点击 "New Project" 创建新项目
3. 记录以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5.2 安装 Supabase 客户端

```bash
cd BCC-Expert-Call-library
npm install @supabase/supabase-js
```

### 5.3 创建 Supabase 客户端配置

创建 `services/supabaseClient.ts`：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 类型定义（可选，推荐）
export type Database = {
  public: {
    Tables: {
      expert_calls: {
        Row: {
          id: string
          user_id: string
          title: string
          expert_name: string | null
          call_date: string | null
          summary: string | null
          transcript: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expert_calls']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expert_calls']['Insert']>
      }
      // ... 其他表
    }
  }
}
```

### 5.4 环境变量配置

创建 `.env.local`（本地开发）：

```env
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 六、Supabase MCP 接入指引

### 6.1 什么是 Supabase MCP

Supabase MCP (Model Context Protocol) 允许 AI 工具（如 Cursor）直接与您的 Supabase 项目交互，支持：
- 查询和修改数据库
- 管理表结构
- 执行 SQL 查询
- 管理存储和认证

### 6.2 在 Cursor 中配置 Supabase MCP

**方式一：一键安装（推荐）**

点击此链接直接安装：
[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=supabase&config=eyJ1cmwiOiJodHRwczovL21jcC5zdXBhYmFzZS5jb20vbWNwIn0=)

**方式二：手动配置**

1. 创建或编辑 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

2. 重启 Cursor

3. 在 Cursor 设置中验证：
   - 进入 Settings > Cursor Settings > Tools & MCP
   - 确认 Supabase MCP 已连接

### 6.3 限定项目范围（推荐）

为了安全，建议限定 MCP 只能访问特定项目：

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF"
    }
  }
}
```

`YOUR_PROJECT_REF` 可以在 Supabase Dashboard URL 中找到：
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### 6.4 只读模式（生产环境推荐）

如果需要连接生产数据，使用只读模式：

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF&read_only=true"
    }
  }
}
```

### 6.5 使用 Supabase MCP

配置完成后，可以在 Cursor 中使用自然语言与 Supabase 交互：

- "查看数据库中有哪些表"
- "创建一个用于存储专家访谈的表"
- "查询最近10条访谈记录"
- "为 expert_calls 表添加 RLS 策略"

### 6.6 安全最佳实践

1. **不要连接生产环境** - MCP 仅用于开发和测试
2. **使用项目范围限定** - 避免暴露其他项目
3. **启用只读模式** - 如必须连接真实数据
4. **手动审批工具调用** - 始终在 Cursor 中保持手动确认
5. **使用开发分支** - 利用 Supabase Branching 功能

---

## 七、实施时间线建议

### 阶段 1：环境准备
- [ ] 创建 Supabase 项目
- [ ] 配置 Supabase MCP
- [ ] 设计数据库表结构

### 阶段 2：后端开发
- [ ] 创建数据库表
- [ ] 配置 RLS 策略
- [ ] 设置认证（可选）

### 阶段 3：前端集成
- [ ] 安装 Supabase 客户端
- [ ] 集成认证功能
- [ ] 实现数据 CRUD

### 阶段 4：部署
- [ ] 初始化 Git 仓库
- [ ] 配置 GitHub Actions
- [ ] 设置 GitHub Secrets
- [ ] 完成首次部署

### 阶段 5：优化
- [ ] 性能优化
- [ ] 错误处理
- [ ] 用户体验改进

---

## 八、常见问题

### Q: GitHub Pages 是否支持后端 API？
**A:** 不支持。GitHub Pages 只能托管静态文件。所有后端逻辑需要通过 Supabase（或其他 BaaS）处理。

### Q: API 密钥如何保护？
**A:** 
- Supabase Anon Key 是可以公开的（受 RLS 保护）
- Gemini API Key 应该通过 Edge Functions 调用，或使用环境变量在构建时注入

### Q: 免费额度够用吗？
**A:** 
- GitHub Pages：完全免费
- Supabase Free Tier：
  - 500MB 数据库存储
  - 1GB 文件存储
  - 2GB 带宽/月
  - 50,000 月活用户

### Q: 如何处理 CORS？
**A:** Supabase 默认允许所有来源。如需限制，可在 Supabase Dashboard > Settings > API 中配置。

---

## 九、参考资源

- [Supabase 官方文档](https://supabase.com/docs)
- [Supabase MCP 指南](https://supabase.com/docs/guides/getting-started/mcp)
- [Vite 静态部署指南](https://vite.dev/guide/static-deploy)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Supabase JavaScript 客户端](https://supabase.com/docs/reference/javascript)
