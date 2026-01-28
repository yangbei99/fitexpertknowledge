// Supabase Edge Function: gemini-proxy
// 用于安全地中转 Gemini API 调用，API Key 存储在服务端

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 从环境变量获取 Gemini API Key
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExtractRequest {
  action: 'extract';
  base64Image: string;
  mimeType: string;
}

interface QueryRequest {
  action: 'query';
  prompt: string;
  context: string;
  history?: string;
}

type RequestBody = ExtractRequest | QueryRequest;

serve(async (req: Request) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 检查 API Key
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RequestBody = await req.json();

    if (body.action === 'extract') {
      // 图片内容提取
      return await handleExtract(body as ExtractRequest);
    } else if (body.action === 'query') {
      // 知识库问答
      return await handleQuery(body as QueryRequest);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// 处理图片内容提取
async function handleExtract(body: ExtractRequest): Promise<Response> {
  const { base64Image, mimeType } = body;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: `Analyze the provided image of an expert interview note/record. 
            Extract the content into the following structured fields:
            
            1. title: The main headline or title of the document.
            2. interviewTime: The interview date/time (e.g., "2025-09").
            3. keywords: A list of key terms found in the "Keywords" or "关键词" section.
            4. abstract: The text found in the "Abstract" or "摘要" section.
            5. content: The main body text ("正文").
            
            CRITICAL FORMATTING INSTRUCTIONS FOR 'content':
            - You MUST strictly preserve all line breaks, paragraph separations, and formatting exactly as they appear in the original image.
            - Do NOT merge paragraphs.
            - Do NOT remove empty lines between sections.
            - If the text in the image starts on a new line, your extracted text must start on a new line.
            
            If a specific field is not explicitly labeled, infer it from the layout logic.
            Do not include the label names (e.g., "摘要：") in the extracted value, just the content.
            
            Return ONLY valid JSON with keys: title, interviewTime, keywords (array), abstract, content`
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          interviewTime: { type: "string" },
          keywords: { 
            type: "array",
            items: { type: "string" }
          },
          abstract: { type: "string" },
          content: { type: "string" },
        },
        required: ["title", "content"],
      }
    }
  };

  const response = await fetch(
    `${GEMINI_BASE_URL}/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  
  // 提取生成的文本
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    throw new Error('No text response from Gemini');
  }

  // 解析 JSON 响应
  const extracted = JSON.parse(generatedText);

  return new Response(
    JSON.stringify(extracted),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// 处理知识库问答
async function handleQuery(body: QueryRequest): Promise<Response> {
  const { prompt, context, history } = body;

  const systemPrompt = `
You are a knowledgeable assistant for the "DocuMind" expert interview library.
Your goal is to answer the user's question based ONLY on the provided Context Documents below.

RULES:
1.  **Strictly Based on Context**: Do not use outside knowledge. If the answer is not in the documents, say "I cannot find the answer in the current knowledge base."
2.  **Citation is MANDATORY**: Whenever you use information from a specific document, you MUST append a citation immediately after the sentence or paragraph.
3.  **Citation Format**: The citation must be exactly in this format: [[doc_id]]
    - Do NOT use Markdown links like [Title](id).
    - ONLY use double brackets with the ID: [[id]].
4.  **Formatting**: Use Markdown to make your answer readable.
    - Use **bold** for key concepts.
    - Use lists (1. 2. 3. or - ) for multiple points.
    - Use headings (###) for sections if the answer is long.
5.  **Language**: Answer in the same language as the User's Question (likely Chinese).
6.  **Tone**: Professional, analytical, and concise.

CONTEXT DOCUMENTS:
${context}

${history ? `CHAT HISTORY:\n${history}` : ''}
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: `User Question: ${prompt}` }
        ]
      }
    ]
  };

  const response = await fetch(
    `${GEMINI_BASE_URL}/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  return new Response(
    JSON.stringify({ answer: generatedText || 'Sorry, I could not generate a response.' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
