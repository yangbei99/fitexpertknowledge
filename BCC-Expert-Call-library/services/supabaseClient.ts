import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 从环境变量读取 Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// 创建 Supabase 客户端
export const supabase: SupabaseClient = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// 数据库表类型定义
export interface ExpertCallRow {
  id: string;
  file_name: string;
  title: string;
  interview_time: string | null;
  keywords: string[];
  abstract: string | null;
  content: string | null;
  thumbnail_url: string | null;
  full_image_url: string | null;
  created_at: string;
}

// 插入时的类型（不包含自动生成的字段）
export interface ExpertCallInsert {
  file_name: string;
  title: string;
  interview_time?: string | null;
  keywords?: string[];
  abstract?: string | null;
  content?: string | null;
  thumbnail_url?: string | null;
  full_image_url?: string | null;
}

// Storage bucket 名称
export const STORAGE_BUCKET = 'expert-images';

// Edge Function URL
export const GEMINI_PROXY_URL = `${supabaseUrl}/functions/v1/gemini-proxy`;
