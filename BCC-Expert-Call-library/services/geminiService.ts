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
  try {
    // 调用 Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'extract',
        base64Image: base64Image,
        mimeType: mimeType
      }
    });

    if (error) {
      console.error('Edge Function Error:', error);
      throw error;
    }

    // Edge Function 返回的数据已经是解析好的对象
    return {
      title: data.title || "标题提取失败",
      interviewTime: data.interviewTime || "",
      keywords: data.keywords || [],
      abstract: data.abstract || "",
      content: data.content || "无法解析文档结构，请重试。"
    };
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
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

  try {
    // 调用 Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'query',
        prompt: query,
        context: context,
        history: historyText
      }
    });

    if (error) {
      console.error('Edge Function Error:', error);
      throw error;
    }

    return data.answer || "Sorry, I could not generate a response.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
};
