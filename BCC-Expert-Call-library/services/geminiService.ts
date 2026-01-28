import { DocRecord, ChatMessage } from "../types";
import { supabase } from "./supabaseClient";

export interface ExtractedContent {
  title: string;
  interviewTime: string;
  keywords: string[];
  abstract: string;
  content: string;
}

/**
 * Converts a File object to a Base64 string suitable for the API.
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Extracts structured data from an image using Gemini via Supabase Edge Function.
 * API Key 安全存储在服务端，前端不会暴露。
 */
export const extractTextFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedContent> => {
  console.log('=== 开始图片提取 ===');
  console.log('📤 调用 Edge Function: gemini-proxy (action: extract)');
  console.log('📎 图片类型:', mimeType);
  console.log('📎 图片大小:', Math.round(base64Image.length / 1024), 'KB (base64)');
  
  try {
    // 调用 Supabase Edge Function
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'extract',
        base64Image: base64Image,
        mimeType: mimeType
      }
    });
    const duration = Date.now() - startTime;

    console.log('⏱️ Edge Function 响应时间:', duration, 'ms');

    if (error) {
      console.error('❌ Edge Function 错误:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ Edge Function 返回成功');
    console.log('📥 返回数据:', JSON.stringify(data, null, 2).substring(0, 500) + '...');

    // Edge Function 返回的数据已经是解析好的对象
    return {
      title: data.title || "标题提取失败",
      interviewTime: data.interviewTime || "",
      keywords: data.keywords || [],
      abstract: data.abstract || "",
      content: data.content || "无法解析文档结构，请重试。"
    };
  } catch (error) {
    console.error("❌ Gemini Extraction Error:", error);
    console.error("错误类型:", typeof error);
    console.error("错误信息:", error instanceof Error ? error.message : String(error));
    // Return a fallback object so the UI doesn't crash completely
    return {
      title: "标题提取失败",
      interviewTime: "",
      keywords: [],
      abstract: "",
      content: "无法解析文档结构，请重试。"
    };
  }
};

/**
 * Queries the knowledge base using the documents provided as context, including chat history.
 * 通过 Supabase Edge Function 调用 Gemini，确保 API Key 安全。
 */
export const queryDocuments = async (query: string, records: DocRecord[], history: ChatMessage[] = []): Promise<string> => {
  console.log('=== 开始知识库问答 ===');
  console.log('❓ 用户问题:', query);
  console.log('📚 文档数量:', records.length);
  console.log('💬 历史记录数:', history.length);

  // 1. Prepare Context (Combine all documents)
  const context = records.map(record => `
<document id="${record.id}">
  <title>${record.title}</title>
  <content>
  ${record.abstract ? `摘要: ${record.abstract}\n` : ''}
  ${record.content}
  </content>
</document>
`).join('\n\n');

  // 2. Prepare History String
  const recentHistory = history.slice(-10);
  const historyText = recentHistory.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n\n');

  console.log('📤 调用 Edge Function: gemini-proxy (action: query)');
  console.log('📎 Context 大小:', Math.round(context.length / 1024), 'KB');

  try {
    // 调用 Supabase Edge Function
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'query',
        prompt: query,
        context: context,
        history: historyText
      }
    });
    const duration = Date.now() - startTime;

    console.log('⏱️ Edge Function 响应时间:', duration, 'ms');

    if (error) {
      console.error('❌ Edge Function 错误:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ 问答成功');
    console.log('📥 回答预览:', data.answer?.substring(0, 200) + '...');

    return data.answer || "Sorry, I could not generate a response.";
  } catch (error) {
    console.error("❌ Chat Error:", error);
    console.error("错误类型:", typeof error);
    console.error("错误信息:", error instanceof Error ? error.message : String(error));
    return "Sorry, I encountered an error while processing your request.";
  }
};
