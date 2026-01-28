# BCC专家访谈文库 - 功能梳理与改动方案

## 一、当前已实现功能

### 1. 导入与处理模块 (Upload View)
| 功能 | 描述 | 当前实现 |
|------|------|----------|
| 图片上传 | 支持拖拽/点击上传访谈截图 | 本地处理 |
| 批量处理队列 | 支持暂停/继续/删除 | React State |
| AI 内容提取 | 使用 Gemini 提取标题、时间、关键词、摘要、正文 | **前端直接调用 Gemini API** |
| 数据持久化 | 提取后保存记录 | **IndexedDB (浏览器本地)** |

### 2. 知识库模块 (Library View)
| 功能 | 描述 | 当前实现 |
|------|------|----------|
| 卡片展示 | 显示所有访谈记录 | 从 IndexedDB 读取 |
| 搜索过滤 | 按标题、关键词、正文搜索 | 前端过滤 |
| 批量选择 | 多选管理 | React State |
| 批量导出 | 导出为 Word (ZIP) | 前端生成 |
| 删除记录 | 单个删除 | IndexedDB |

### 3. 文档详情模块 (Detail View)
| 功能 | 描述 | 当前实现 |
|------|------|----------|
| 原图查看 | 左侧显示上传的原始图片 | Base64 存储在 IndexedDB |
| 结构化展示 | 右侧显示提取的内容 | 从 State 读取 |
| 复制全文 | 一键复制所有内容 | 前端处理 |

### 4. 智能问答模块 (Chat View)
| 功能 | 描述 | 当前实现 |
|------|------|----------|
| 知识库问答 | 基于文档回答问题 | **前端直接调用 Gemini API** |
| 多轮对话 | 保留上下文 | 内存 + localStorage |
| 会话管理 | 新建/删除对话 | localStorage |
| 引用标注 | 标注答案来源 | 前端解析 |
| 跳转原文 | 点击引用跳转详情 | 前端路由 |

---

## 二、当前数据模型

```typescript
// types.ts
interface DocRecord {
  id: string;
  fileName: string;
  title: string;
  interviewTime?: string;
  keywords: string[];
  abstract?: string;
  content: string;
  thumbnail: string;    // Base64 缩略图
  fullImage: string;    // Base64 原图
  createdAt: number;
  tags: string[];
}
```

---

## 三、需要改动的部分

### 问题 1：数据存储不持久
- **现状**：使用 IndexedDB，数据只存在当前浏览器
- **问题**：换浏览器/设备数据丢失
- **解决**：迁移到 Supabase PostgreSQL + Storage

### 问题 2：API Key 暴露
- **现状**：Gemini API Key 直接在前端代码中
- **问题**：安全风险，Key 可被恶意使用
- **解决**：通过 Supabase Edge Functions 中转调用

### 问题 3：图片存储
- **现状**：图片以 Base64 存储在 IndexedDB
- **问题**：数据库膨胀，无法跨设备
- **解决**：使用 Supabase Storage 存储图片

---

## 四、改动方案

### Phase 1: 数据库设计

#### 表结构：`expert_calls`

```sql
CREATE TABLE expert_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  title TEXT NOT NULL,
  interview_time TEXT,
  keywords TEXT[] DEFAULT '{}',
  abstract TEXT,
  content TEXT,
  thumbnail_url TEXT,        -- Supabase Storage URL
  full_image_url TEXT,       -- Supabase Storage URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 公开只读访问
ALTER TABLE expert_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON expert_calls
  FOR SELECT USING (true);

CREATE POLICY "Allow insert via service role" ON expert_calls
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete via service role" ON expert_calls
  FOR DELETE USING (true);
```

#### Storage Bucket：`expert-images`
- 存储上传的原始图片和缩略图
- 公开读取，服务端写入

### Phase 2: Edge Function 设计

#### `gemini-proxy` 函数

```
前端 → Supabase Edge Function → Gemini API
         (携带服务端 Key)
```

功能：
1. **图片内容提取**：接收 Base64 图片，调用 Gemini 提取结构化内容
2. **知识库问答**：接收问题和上下文，调用 Gemini 生成回答

### Phase 3: 前端代码改动

| 文件 | 改动 |
|------|------|
| `services/supabaseClient.ts` | **新增** - Supabase 客户端初始化 |
| `services/storage.ts` | **重写** - 使用 Supabase 替代 IndexedDB |
| `services/geminiService.ts` | **重写** - 使用 Edge Function 替代直接调用 |
| `vite.config.ts` | **修改** - 添加 Supabase 环境变量 |
| `.env.local` | **修改** - 添加 Supabase 配置 |

### Phase 4: 数据迁移策略

由于是新部署，不需要迁移。IndexedDB 中的旧数据可以：
1. 用户重新上传
2. 或实现一次性迁移脚本（可选）

---

## 五、文件变更清单

### 新增文件
```
BCC-Expert-Call-library/
├── services/
│   └── supabaseClient.ts     # Supabase 客户端
├── supabase/
│   └── functions/
│       └── gemini-proxy/
│           └── index.ts      # Edge Function
└── .env.local                # 环境变量（本地开发）
```

### 修改文件
```
BCC-Expert-Call-library/
├── services/
│   ├── storage.ts            # IndexedDB → Supabase
│   └── geminiService.ts      # 直接调用 → Edge Function
├── vite.config.ts            # 添加环境变量
└── package.json              # 添加 @supabase/supabase-js
```

---

## 六、执行步骤

1. ✅ 功能梳理完成
2. ⏳ 使用 Supabase MCP 创建数据库表和 Storage Bucket
3. ⏳ 创建 Supabase 客户端配置
4. ⏳ 创建 Edge Function 代码
5. ⏳ 重写 storage.ts
6. ⏳ 重写 geminiService.ts
7. ⏳ 更新环境变量配置
8. ⏳ 测试验证

---

## 七、预期效果

改动完成后：
- ✅ 访谈数据持久化在云端，跨设备可用
- ✅ Gemini API Key 安全存储在服务端
- ✅ 图片存储在 Supabase Storage，加载更快
- ✅ 支持部署到 GitHub Pages
- ✅ 免费额度足够个人/小团队使用
