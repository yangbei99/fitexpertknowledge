import { DocRecord } from '../types';
import { supabase, ExpertCallRow, ExpertCallInsert, STORAGE_BUCKET } from './supabaseClient';

/**
 * 将 Base64 图片上传到 Supabase Storage
 */
const uploadImage = async (base64Data: string, fileName: string, folder: string): Promise<string | null> => {
  try {
    // 从 Base64 创建 Blob
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const mimeMatch = base64Data.match(/data:(.*?);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // 生成唯一文件名
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${timestamp}_${safeName}`;

    // 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Image upload failed:', error);
    return null;
  }
};

/**
 * 将 DocRecord 转换为数据库行格式
 */
const docRecordToRow = (record: DocRecord): ExpertCallInsert => ({
  file_name: record.fileName,
  title: record.title,
  interview_time: record.interviewTime || null,
  keywords: record.keywords || [],
  abstract: record.abstract || null,
  content: record.content || null,
  thumbnail_url: record.thumbnail || null,
  full_image_url: record.fullImage || null,
});

/**
 * 将数据库行转换为 DocRecord 格式
 */
const rowToDocRecord = (row: ExpertCallRow): DocRecord => ({
  id: row.id,
  fileName: row.file_name,
  title: row.title,
  interviewTime: row.interview_time || undefined,
  keywords: row.keywords || [],
  abstract: row.abstract || undefined,
  content: row.content || '',
  thumbnail: row.thumbnail_url || '',
  fullImage: row.full_image_url || '',
  createdAt: new Date(row.created_at).getTime(),
  tags: [],
});

/**
 * 保存记录到数据库
 * 如果包含 Base64 图片，先上传到 Storage
 */
export const saveRecordToDB = async (record: DocRecord): Promise<void> => {
  console.log('=== 保存记录到数据库 ===');
  console.log('📝 记录 ID:', record.id);
  console.log('📝 标题:', record.title);
  
  try {
    let thumbnailUrl = record.thumbnail;
    let fullImageUrl = record.fullImage;

    // 如果是 Base64 图片，上传到 Storage
    if (record.fullImage && record.fullImage.startsWith('data:')) {
      console.log('📤 上传原图到 Storage...');
      const uploadedUrl = await uploadImage(record.fullImage, record.fileName, 'full');
      if (uploadedUrl) {
        fullImageUrl = uploadedUrl;
        console.log('✅ 原图上传成功:', uploadedUrl.substring(0, 80) + '...');
      } else {
        console.log('⚠️ 原图上传失败，使用 base64');
      }
    }

    if (record.thumbnail && record.thumbnail.startsWith('data:')) {
      console.log('📤 上传缩略图到 Storage...');
      const uploadedUrl = await uploadImage(record.thumbnail, record.fileName, 'thumbnails');
      if (uploadedUrl) {
        thumbnailUrl = uploadedUrl;
        console.log('✅ 缩略图上传成功');
      } else {
        console.log('⚠️ 缩略图上传失败，使用 base64');
      }
    }

    // 准备插入数据
    const insertData: ExpertCallInsert = {
      ...docRecordToRow(record),
      thumbnail_url: thumbnailUrl,
      full_image_url: fullImageUrl,
    };

    console.log('📤 插入数据库...');
    // 插入到数据库（使用 record.id 作为 UUID）
    const { error } = await supabase
      .from('expert_calls')
      .insert({ id: record.id, ...insertData });

    if (error) {
      console.error('❌ Database insert error:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log('✅ 数据库插入成功');
  } catch (error) {
    console.error('❌ Error saving to DB:', error);
    throw error;
  }
};

/**
 * 获取所有记录
 */
export const getAllRecordsFromDB = async (): Promise<DocRecord[]> => {
  console.log('=== 从数据库获取记录 ===');
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('expert_calls')
      .select('*')
      .order('created_at', { ascending: false });
    const duration = Date.now() - startTime;

    console.log('⏱️ 数据库查询时间:', duration, 'ms');

    if (error) {
      console.error('❌ Database query error:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log('✅ 查询成功，记录数:', data?.length || 0);
    return (data as ExpertCallRow[]).map(rowToDocRecord);
  } catch (error) {
    console.error('❌ Error getting from DB:', error);
    return [];
  }
};

/**
 * 删除记录
 */
export const deleteRecordFromDB = async (id: string): Promise<void> => {
  try {
    // 先获取记录以删除关联的图片
    const { data: record } = await supabase
      .from('expert_calls')
      .select('thumbnail_url, full_image_url')
      .eq('id', id)
      .single();

    // 删除 Storage 中的图片
    if (record) {
      const filesToDelete: string[] = [];
      
      if (record.thumbnail_url && record.thumbnail_url.includes(STORAGE_BUCKET)) {
        const path = extractStoragePath(record.thumbnail_url);
        if (path) filesToDelete.push(path);
      }
      
      if (record.full_image_url && record.full_image_url.includes(STORAGE_BUCKET)) {
        const path = extractStoragePath(record.full_image_url);
        if (path) filesToDelete.push(path);
      }

      if (filesToDelete.length > 0) {
        await supabase.storage.from(STORAGE_BUCKET).remove(filesToDelete);
      }
    }

    // 删除数据库记录
    const { error } = await supabase
      .from('expert_calls')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database delete error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting from DB:', error);
    throw error;
  }
};

/**
 * 从 Storage URL 提取路径
 */
const extractStoragePath = (url: string): string | null => {
  try {
    const match = url.match(new RegExp(`${STORAGE_BUCKET}/(.+)$`));
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// ============================================
// 保留 IndexedDB 作为备用/离线方案
// ============================================

const DB_NAME = 'DocuMindDB';
const STORE_NAME = 'records';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// 备用：保存到 IndexedDB（离线时使用）
export const saveRecordToIndexedDB = async (record: DocRecord): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error saving to IndexedDB:", error);
    throw error;
  }
};

// 备用：从 IndexedDB 获取（离线时使用）
export const getAllRecordsFromIndexedDB = async (): Promise<DocRecord[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as DocRecord[];
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting from IndexedDB:", error);
    return [];
  }
};
