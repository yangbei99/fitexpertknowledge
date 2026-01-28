import React, { useState, useRef, useEffect } from 'react';
import { DocRecord, ChatMessage, ChatSession } from '../types';
import { queryDocuments } from '../services/geminiService';
import { SendIcon, BotIcon, UserIcon, TrashIcon, FileTextIcon, PlusIcon, MessageSquareIcon } from './Icon';
// @ts-ignore
import { marked } from 'marked';

interface ChatViewProps {
  records: DocRecord[];
  onNavigateToRecord: (id: string) => void;
}

const STORAGE_KEY_SESSIONS = 'documind_chat_sessions';
const STORAGE_KEY_LEGACY = 'documind_chat_history'; // For migration

export const ChatView: React.FC<ChatViewProps> = ({ records, onNavigateToRecord }) => {
  // --- STATE ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      // 1. Try load sessions
      const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        // Sort by updatedAt desc
        return parsed.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);
      }
      
      // 2. Migration: If no sessions but legacy history exists, convert it
      const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (legacy) {
        const legacyMessages = JSON.parse(legacy);
        if (legacyMessages.length > 0 && legacyMessages[0].id !== 'welcome') {
            const migratedSession: ChatSession = {
                id: Date.now().toString(),
                title: "历史对话 (已迁移)",
                messages: legacyMessages,
                updatedAt: Date.now()
            };
            return [migratedSession];
        }
      }
    } catch (e) {
      console.error("Failed to parse chat sessions", e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS ---

  // Initialize: Select the most recent session or create a "welcome" state visually
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, []); // Run once on mount

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);


  // --- HELPERS ---

  const getActiveMessages = (): ChatMessage[] => {
    if (!activeSessionId) return [];
    const session = sessions.find(s => s.id === activeSessionId);
    return session ? session.messages : [];
  };

  const createNewSession = () => {
    setActiveSessionId(null); // Null ID means "Drafting new session"
    setInput('');
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if(window.confirm('确定删除这段对话历史吗？')) {
        const newSessions = sessions.filter(s => s.id !== sessionId);
        setSessions(newSessions);
        if (activeSessionId === sessionId) {
            setActiveSessionId(newSessions.length > 0 ? newSessions[0].id : null);
        }
    }
  };

  // --- ACTIONS ---

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (records.length === 0) {
        alert("请先上传一些文档到知识库，我才能回答问题。");
        return;
    }

    const content = input.trim();
    setInput('');
    setIsLoading(true);

    let currentSessionId = activeSessionId;
    let newSessionCreated = false;

    // 1. Create Session if needed
    if (!currentSessionId) {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: content.length > 15 ? content.substring(0, 15) + "..." : content, // Auto title
            messages: [],
            updatedAt: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        currentSessionId = newSession.id;
        setActiveSessionId(currentSessionId);
        newSessionCreated = true;
    }

    // 2. Construct User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: Date.now()
    };

    // 3. Optimistic Update
    setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
            return {
                ...s,
                messages: [...s.messages, userMsg],
                updatedAt: Date.now()
            };
        }
        return s;
    }));

    try {
      // 4. Get Context (History + Docs)
      // Retrieve fresh session state for history
      const currentSession = newSessionCreated 
        ? { messages: [userMsg] } // If just created, history is just this msg
        : sessions.find(s => s.id === currentSessionId); 
      
      const history = currentSession ? [...currentSession.messages] : [userMsg];
      
      // 5. Call API
      const answer = await queryDocuments(userMsg.content, records, history);
      
      // 6. Add Bot Response
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        timestamp: Date.now()
      };

      setSessions(prev => {
          const updated = prev.map(s => {
            if (s.id === currentSessionId) {
                return {
                    ...s,
                    messages: [...s.messages, botMsg],
                    updatedAt: Date.now()
                };
            }
            return s;
          });
          // Move current session to top
          return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      });

    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "抱歉，处理请求时遇到错误，请稍后重试。",
        timestamp: Date.now(),
        isError: true
      };
      
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
            return { ...s, messages: [...s.messages, errorMsg] };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- RENDERERS ---

  const renderFormattedContent = (content: string) => {
    // Map to track unique documents cited in this message to assign sequential numbers (1, 2, 3...)
    const citationMap = new Map<string, number>();
    let nextIndex = 1;

    const processedText = content.replace(/\[\[(.*?)\]\]/g, (match, docId) => {
        // Assign number if first time seeing this docId in this message
        if (!citationMap.has(docId)) {
            citationMap.set(docId, nextIndex++);
        }
        const index = citationMap.get(docId);
        
        const doc = records.find(r => r.id === docId);
        const title = doc ? doc.title : '未知来源';
        
        // Minimalist Badge Style
        return `<span class="citation-badge inline-flex items-center justify-center h-4 min-w-[16px] px-0.5 text-[9px] font-bold text-[#2d6ad1] bg-[#e5efff] hover:bg-[#2d6ad1] hover:text-white rounded-[4px] cursor-pointer transition-colors select-none transform -translate-y-0.5 mx-0.5 border border-[#b4c6e6]/50" data-id="${docId}" title="点击跳转: ${title}">${index}</span>`;
    });

    try {
        return marked.parse(processedText, { breaks: true });
    } catch (e) {
        return processedText;
    }
  };

  const handleMessageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Look for the new badge class
    const target = (e.target as HTMLElement).closest('.citation-badge');
    if (target) {
        const docId = target.getAttribute('data-id');
        if (docId) onNavigateToRecord(docId);
    }
  };

  const activeMessages = getActiveMessages();

  return (
    <div className="flex h-full bg-[#f8fafc]">
      
      {/* SIDEBAR: History List */}
      <div className="w-72 flex-shrink-0 border-r border-[#b4c6e6]/30 bg-white flex flex-col hidden md:flex">
        {/* New Chat Button */}
        <div className="p-4">
            <button 
                onClick={createNewSession}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#f0f4fa] hover:bg-[#e5efff] text-[#2d6ad1] rounded-xl transition-colors text-sm font-medium"
            >
                <PlusIcon className="w-5 h-5" />
                <span>开始新对话</span>
            </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            <h3 className="px-3 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">最近对话</h3>
            {sessions.length === 0 ? (
                 <div className="px-4 py-4 text-center text-zinc-400 text-xs">暂无历史记录</div>
            ) : (
                sessions.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        className={`
                            group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all text-sm
                            ${activeSessionId === session.id ? 'bg-[#e5efff] text-[#0048d6]' : 'text-zinc-600 hover:bg-zinc-50'}
                        `}
                    >
                        <MessageSquareIcon className={`w-4 h-4 flex-shrink-0 ${activeSessionId === session.id ? 'text-[#2d6ad1]' : 'text-zinc-400'}`} />
                        <span className="truncate flex-1 font-medium">{session.title}</span>
                        <button 
                            onClick={(e) => deleteSession(e, session.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                            title="删除"
                        >
                            <TrashIcon className="w-3 h-3" />
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* MAIN: Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative">
        
        {/* Header (Visual only) */}
        <div className="px-6 md:px-10 py-4 border-b border-[#b4c6e6]/30 bg-white/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {/* Mobile sidebar toggle could go here */}
                <div>
                    <h2 className="text-xl font-bold text-[#0048d6] tracking-tight">
                        {activeSessionId 
                            ? (sessions.find(s => s.id === activeSessionId)?.title || '对话')
                            : '新对话'
                        }
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        基于 {records.length} 篇文档
                    </p>
                </div>
            </div>
            {/* New Chat Icon for Mobile */}
             <button 
                onClick={createNewSession}
                className="md:hidden p-2 text-[#2d6ad1] bg-[#e5efff] rounded-lg"
            >
                <PlusIcon className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6">
            {!activeSessionId && activeMessages.length === 0 ? (
                // Empty State / Welcome
                <div className="h-full flex flex-col items-center justify-center text-center opacity-80 pb-20">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 text-[#2d6ad1]">
                        <BotIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-800 mb-2">有什么可以帮您？</h3>
                    <p className="text-zinc-500 max-w-md">
                        您可以询问关于已上传访谈纪要的任何问题，我会整合所有文档内容为您解答，并提供原文引用。
                    </p>
                </div>
            ) : (
                activeMessages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`flex items-start gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`
                        w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                        ${msg.role === 'assistant' ? 'bg-[#2d6ad1] text-white' : 'bg-white text-zinc-600 border border-zinc-200'}
                        `}>
                        {msg.role === 'assistant' ? <BotIcon className="w-5 h-5 md:w-6 md:h-6" /> : <UserIcon className="w-5 h-5 md:w-6 md:h-6" />}
                        </div>

                        <div 
                            className={`
                            flex-1 rounded-2xl p-4 md:p-5 shadow-sm markdown-body text-sm leading-relaxed max-w-[85%] md:max-w-none
                            ${msg.role === 'assistant' 
                                ? 'bg-white border border-zinc-100 text-zinc-800' 
                                : 'bg-[#2d6ad1] text-white border border-[#2d6ad1]'}
                            ${msg.isError ? 'bg-red-50 border-red-200 text-red-600' : ''}
                            `}
                            onClick={handleMessageClick}
                            dangerouslySetInnerHTML={{ __html: renderFormattedContent(msg.content) }}
                        />
                    </div>
                ))
            )}
            
            {isLoading && (
                <div className="flex items-start gap-4 max-w-4xl mx-auto">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#2d6ad1] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <BotIcon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-[#2d6ad1]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-[#2d6ad1]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-[#2d6ad1]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 bg-white border-t border-[#b4c6e6]/30">
            <div className="max-w-4xl mx-auto relative">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问问关于文档的问题... (Enter 发送, Shift+Enter 换行)"
                className="w-full bg-zinc-100 text-zinc-900 placeholder-zinc-400 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-[#2d6ad1]/20 focus:bg-white transition-all shadow-inner resize-none h-[70px] md:h-[80px]"
                disabled={isLoading}
            />
            <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`
                absolute right-3 bottom-3 p-2 rounded-xl transition-all
                ${!input.trim() || isLoading 
                    ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' 
                    : 'bg-[#2d6ad1] text-white hover:bg-[#2358b5] shadow-lg shadow-[#2d6ad1]/20'}
                `}
            >
                <SendIcon className="w-5 h-5" />
            </button>
            </div>
            <p className="text-center text-xs text-zinc-400 mt-2 md:mt-3">
            AI 可能产生错误信息，请核对重要事实。
            </p>
        </div>
      </div>
    </div>
  );
};