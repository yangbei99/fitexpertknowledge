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

-- 公开读取策略（所有人可查看）
CREATE POLICY "Public read access" ON expert_calls
  FOR SELECT USING (true);

-- 公开写入策略（简化版，实际生产应限制）
CREATE POLICY "Public insert access" ON expert_calls
  FOR INSERT WITH CHECK (true);

-- 公开更新策略
CREATE POLICY "Public update access" ON expert_calls
  FOR UPDATE USING (true);

-- 公开删除策略
CREATE POLICY "Public delete access" ON expert_calls
  FOR DELETE USING (true);

-- 创建索引优化搜索
CREATE INDEX IF NOT EXISTS idx_expert_calls_title ON expert_calls USING gin(to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_expert_calls_content ON expert_calls USING gin(to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_expert_calls_created_at ON expert_calls (created_at DESC);
