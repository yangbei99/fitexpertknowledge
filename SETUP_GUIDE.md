# BCC专家访谈文库 - Supabase 设置指南

## 代码改动已完成

所有前端代码改动已完成，现在需要配置 Supabase 后端。

---

## 一、Supabase 项目配置

### 步骤 1：创建数据库表

在 Supabase Dashboard 中执行以下 SQL：

1. 进入 **SQL Editor**
2. 点击 **New Query**
3. 复制粘贴以下 SQL 并执行：

```sql
-- 创建专家访谈记录表
CREATE TABLE IF NOT EXISTS expert_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  title TEXT NOT NULL,
  interview_time TEXT,
  keywords TEXT[] DEFAULT '{}',
  abstract TEXT,
  content TEXT,
  thumbnail_url TEXT,
  full_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 Row Level Security
ALTER TABLE expert_calls ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY "Public read access" ON expert_calls
  FOR SELECT USING (true);

-- 公开写入策略
CREATE POLICY "Public insert access" ON expert_calls
  FOR INSERT WITH CHECK (true);

-- 公开更新策略
CREATE POLICY "Public update access" ON expert_calls
  FOR UPDATE USING (true);

-- 公开删除策略
CREATE POLICY "Public delete access" ON expert_calls
  FOR DELETE USING (true);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_expert_calls_created_at ON expert_calls (created_at DESC);
```

### 步骤 2：创建 Storage Bucket

1. 进入 **Storage** 页面
2. 点击 **New Bucket**
3. 名称填写：`expert-images`
4. 勾选 **Public bucket**（公开访问）
5. 点击 **Create bucket**

### 步骤 3：配置 Storage 策略

在 Storage > Policies 中，为 `expert-images` bucket 添加策略：

```sql
-- 允许所有人读取
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'expert-images');

-- 允许所有人上传
CREATE POLICY "Public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'expert-images');

-- 允许删除
CREATE POLICY "Public delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'expert-images');
```

---

## 二、部署 Edge Function

### 步骤 1：安装 Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# 或使用 npm
npm install -g supabase
```

### 步骤 2：登录 Supabase

```bash
supabase login
```

### 步骤 3：链接项目

```bash
cd BCC-Expert-Call-library
supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` 可以在 Supabase Dashboard URL 中找到：
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### 步骤 4：设置 Gemini API Key

```bash
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key
```

### 步骤 5：部署函数

```bash
supabase functions deploy gemini-proxy
```

---

## 三、本地开发配置

### 步骤 1：创建环境变量文件

在 `BCC-Expert-Call-library` 目录下创建 `.env.local`：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

这些值可以在 Supabase Dashboard > Settings > API 中找到：
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 步骤 2：安装依赖

```bash
cd BCC-Expert-Call-library
npm install
```

### 步骤 3：启动开发服务器

```bash
npm run dev
```

---

## 四、GitHub 部署配置

### 步骤 1：创建 GitHub 仓库

```bash
cd fitexpertknowledge
git init
git add .
git commit -m "Initial commit with Supabase integration"
git remote add origin https://github.com/YOUR_USERNAME/fitexpertknowledge.git
git branch -M main
git push -u origin main
```

### 步骤 2：配置 GitHub Secrets

进入 GitHub 仓库 > Settings > Secrets and variables > Actions

添加以下 secrets：
- `SUPABASE_URL` = 你的 Supabase Project URL
- `SUPABASE_ANON_KEY` = 你的 Supabase Anon Key

### 步骤 3：启用 GitHub Pages

1. 进入 Settings > Pages
2. Source 选择 **GitHub Actions**

### 步骤 4：触发部署

推送代码到 main 分支即可自动部署：
```bash
git push origin main
```

部署完成后访问：`https://YOUR_USERNAME.github.io/fitexpertknowledge/`

---

## 五、获取 Supabase 配置信息

### Project URL 和 API Keys

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** > **API**
4. 复制以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIs...`

### Project Reference ID

在项目 URL 中可以找到：
`https://supabase.com/dashboard/project/` **YOUR_PROJECT_REF**

---

## 六、验证配置

### 检查数据库表

在 SQL Editor 中运行：
```sql
SELECT * FROM expert_calls LIMIT 5;
```

### 检查 Storage Bucket

在 Storage 页面确认 `expert-images` bucket 存在。

### 检查 Edge Function

在 Edge Functions 页面确认 `gemini-proxy` 函数已部署且状态为 Active。

### 测试 Edge Function

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/gemini-proxy' \
  -H 'Content-Type: application/json' \
  -d '{"action": "query", "prompt": "Hello", "context": "Test"}'
```

---

## 七、常见问题

### Q: Edge Function 调用失败
**A:** 检查 Gemini API Key 是否正确设置：
```bash
supabase secrets list
```

### Q: Storage 上传失败
**A:** 确认 bucket 策略已正确配置，且 bucket 名称为 `expert-images`。

### Q: 本地开发无法连接 Supabase
**A:** 检查 `.env.local` 文件是否存在且配置正确。

### Q: GitHub Pages 部署失败
**A:** 检查 GitHub Secrets 是否正确配置。

---

## 八、文件变更清单

### 新增文件
```
BCC-Expert-Call-library/
├── services/
│   └── supabaseClient.ts          # Supabase 客户端
├── supabase/
│   ├── migrations/
│   │   └── 001_create_tables.sql  # 数据库迁移 SQL
│   └── functions/
│       └── gemini-proxy/
│           └── index.ts           # Edge Function
└── .env.local.example             # 环境变量示例

.github/
└── workflows/
    └── deploy.yml                 # GitHub Actions 部署
```

### 修改文件
```
BCC-Expert-Call-library/
├── services/
│   ├── storage.ts                 # IndexedDB → Supabase
│   └── geminiService.ts           # 直接调用 → Edge Function
├── vite.config.ts                 # 添加 GitHub Pages base
└── package.json                   # 添加 Supabase 依赖
```

---

## 完成！

按照以上步骤完成配置后，你的应用将：
- ✅ 数据持久化存储在 Supabase 云端
- ✅ Gemini API Key 安全存储在服务端
- ✅ 图片存储在 Supabase Storage
- ✅ 自动部署到 GitHub Pages
