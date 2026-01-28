import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocRecord, ProcessingStatus, UploadQueueItem, ViewMode } from './types';
import { extractTextFromImage, fileToGenerativePart } from './services/geminiService';
import { getAllRecordsFromDB, saveRecordToDB, deleteRecordFromDB } from './services/storage';
import { UploadArea } from './components/UploadArea';
import { Button } from './components/Button';
import { DetailView } from './components/DetailView';
import { ChatView } from './components/ChatView';
import { 
  FileTextIcon, 
  SearchIcon, 
  CheckCircleIcon, 
  AlertCircleIcon, 
  UploadIcon,
  TrashIcon,
  DownloadIcon,
  CheckSquareIcon,
  PlayIcon,
  PauseIcon,
  MessageSquareIcon,
  LogOutIcon
} from './components/Icon';

const App: React.FC = () => {
  // State
  const [records, setRecords] = useState<DocRecord[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Ref to track the latest upload queue state for async cancellation checks
  const uploadQueueRef = useRef(uploadQueue);

  // Selection / Batch Action State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  // Load from DB on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const dbRecords = await getAllRecordsFromDB();
        setRecords(dbRecords);
      } catch (e) {
        console.error("Failed to load records from DB", e);
      }
    };
    initData();
  }, []);

  // Sync ref with state
  useEffect(() => {
    uploadQueueRef.current = uploadQueue;
  }, [uploadQueue]);

  // Handle files selected from UploadArea
  const handleFilesSelected = async (files: File[]) => {
    const newQueueItems: UploadQueueItem[] = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(), // 生成标准 UUID 格式
        file,
        previewUrl: URL.createObjectURL(file), 
        status: ProcessingStatus.PENDING,
      }))
    );

    setUploadQueue(prev => [...prev, ...newQueueItems]);
    setViewMode('upload');
  };

  // Process the next item in the queue (Reactive Loop)
  const processNextItem = useCallback(async () => {
    if (isProcessing) return;
    
    // Find the first item that is PENDING. Skips PAUSED items.
    // Use the ref to ensure we aren't starting on a stale state, though dependency array handles this mostly.
    const nextItem = uploadQueueRef.current.find(item => item.status === ProcessingStatus.PENDING);
    
    if (!nextItem) return;

    setIsProcessing(true);

    try {
      // Mark as PROCESSING
      setUploadQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: ProcessingStatus.PROCESSING } : q));

      const base64Data = await fileToGenerativePart(nextItem.file);
      
      // --- CANCELLATION CHECK 1 ---
      // Check if item was deleted or paused while we were reading the file
      const check1 = uploadQueueRef.current.find(item => item.id === nextItem.id);
      if (!check1 || check1.status === ProcessingStatus.PAUSED) {
          console.log("Processing aborted (deleted or paused):", nextItem.file.name);
          setIsProcessing(false);
          return;
      }

      // Extract structured data
      const extractedData = await extractTextFromImage(base64Data, nextItem.file.type);

      // --- CANCELLATION CHECK 2 ---
      // Check if item was deleted or paused while Gemini was processing (most likely scenario)
      const check2 = uploadQueueRef.current.find(item => item.id === nextItem.id);
      if (!check2 || check2.status === ProcessingStatus.PAUSED) {
          console.log("Processing aborted after API call (deleted or paused):", nextItem.file.name);
          setIsProcessing(false);
          return;
      }

      const newRecord: DocRecord = {
        id: nextItem.id,
        fileName: nextItem.file.name,
        title: extractedData.title && extractedData.title !== "标题提取失败" 
          ? extractedData.title 
          : nextItem.file.name.replace(/\.[^/.]+$/, ""),
        interviewTime: extractedData.interviewTime,
        keywords: extractedData.keywords || [],
        abstract: extractedData.abstract,
        content: extractedData.content || "",
        
        thumbnail: nextItem.previewUrl,
        fullImage: `data:${nextItem.file.type};base64,${base64Data}`,
        createdAt: Date.now(),
        tags: []
      };
      
      // Save to State
      setRecords(prev => [newRecord, ...prev]);
      
      // Save to DB (Persistence)
      await saveRecordToDB(newRecord);

      // Mark as COMPLETED
      setUploadQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: ProcessingStatus.COMPLETED } : q));

    } catch (error) {
      console.error(`Error processing ${nextItem.file.name}:`, error);
      
      // Only set error if it still exists
      const exists = uploadQueueRef.current.find(item => item.id === nextItem.id);
      if (exists) {
        setUploadQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: ProcessingStatus.ERROR, error: "Processing failed" } : q));
      }
    } finally {
      setIsProcessing(false);
      // Processing finished for this item. 
      // The useEffect below will detect that isProcessing is false and there might be more PENDING items, triggering the next loop.
    }
  }, [isProcessing]); // Dependency on uploadQueue removed to rely on effect triggering, but actually standard pattern suggests keeping it or relying on the useEffect trigger.
                      // NOTE: We depend on `isProcessing` to lock. The trigger comes from the separate useEffect below.

  // Auto-trigger processing whenever queue changes or processing finishes
  useEffect(() => {
    const hasPending = uploadQueue.some(item => item.status === ProcessingStatus.PENDING);
    if (hasPending && !isProcessing) {
      processNextItem();
    }
  }, [uploadQueue, isProcessing, processNextItem]);

  const removeFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const togglePauseItem = (id: string) => {
    setUploadQueue(prev => prev.map(item => {
        if (item.id !== id) return item;
        
        if (item.status === ProcessingStatus.PENDING) {
            return { ...item, status: ProcessingStatus.PAUSED };
        } else if (item.status === ProcessingStatus.PAUSED) {
            return { ...item, status: ProcessingStatus.PENDING };
        }
        return item;
    }));
  };

  const deleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm('确定要删除这条记录吗？')) {
        setRecords(prev => prev.filter(r => r.id !== id));
        await deleteRecordFromDB(id);
        
        // Remove from selection if it was selected
        if (selectedIds.has(id)) {
            const next = new Set(selectedIds);
            next.delete(id);
            setSelectedIds(next);
        }

        if (selectedRecordId === id) {
            setSelectedRecordId(null);
            setViewMode('library');
        }
    }
  };

  // Filtering
  const filteredRecords = records.filter(record => {
    const q = searchQuery.toLowerCase();
    return (
      record.title.toLowerCase().includes(q) ||
      record.content.toLowerCase().includes(q) ||
      (record.keywords && record.keywords.some(k => k.toLowerCase().includes(q)))
    );
  });

  const openRecord = (id: string) => {
    if (isSelectionMode) {
        toggleSelection(id);
    } else {
        setSelectedRecordId(id);
        setViewMode('details');
    }
  };

  const goBackToLibrary = () => {
    setSelectedRecordId(null);
    setViewMode('library');
  };

  const handleNavigateFromChat = (id: string) => {
    setSelectedRecordId(id);
    setViewMode('details');
  };

  // -- BATCH SELECTION & DOWNLOAD LOGIC --

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set()); // Clear selection when toggling
  };

  const toggleSelection = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
          next.delete(id);
      } else {
          next.add(id);
      }
      setSelectedIds(next);
  };

  const selectAll = () => {
      if (selectedIds.size === filteredRecords.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredRecords.map(r => r.id)));
      }
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    setIsDownloading(true);

    try {
        // Dynamic imports to avoid initial load crash
        // @ts-ignore
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
        // @ts-ignore
        const { default: JSZip } = await import('jszip');
        // @ts-ignore
        const fileSaverModule = await import('file-saver');
        const saveAs = fileSaverModule.saveAs || fileSaverModule.default;

        const zip = new JSZip();
        const folder = zip.folder("专家访谈纪要");
        
        const recordsToDownload = records.filter(r => selectedIds.has(r.id));
        
        for (const record of recordsToDownload) {
            // Generate Docx Blob logic inside loop
            const paragraphs = record.content.split('\n').map((line: string) => {
                if (!line.trim()) return new Paragraph({ text: "" });
                return new Paragraph({
                    children: [new TextRun({ text: line, size: 24 })],
                    spacing: { after: 200 }
                });
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            text: record.title,
                            heading: HeadingLevel.HEADING_1,
                            spacing: { after: 300 }
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: `访谈时间: ${record.interviewTime || '未知'}`, bold: true }),
                            ],
                            spacing: { after: 200 }
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: `关键词: ${record.keywords.join(', ')}`, italics: true, color: "666666" }),
                            ],
                            spacing: { after: 400 }
                        }),
                        ...(record.abstract ? [
                            new Paragraph({
                                children: [new TextRun({ text: "摘要", bold: true, size: 28 })],
                                spacing: { after: 200 }
                            }),
                            new Paragraph({
                                children: [new TextRun({ text: record.abstract, size: 24 })],
                                spacing: { after: 400 }
                            }),
                            new Paragraph({ text: "" }) 
                        ] : []),
                        new Paragraph({
                            children: [new TextRun({ text: "正文内容", bold: true, size: 28 })],
                            spacing: { after: 200 }
                        }),
                        ...paragraphs
                    ]
                }]
            });

            const blob = await Packer.toBlob(doc);
            
            // Sanitize filename
            const safeTitle = (record.title || record.fileName).replace(/[/\\?%*:|"<>]/g, '-');
            folder.file(`${safeTitle}.docx`, blob);
        }

        const content = await zip.generateAsync({ type: "blob" });
        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(content, `DocuMind_Export_${dateStr}.zip`);
        
    } catch (error) {
        console.error("Download failed", error);
        alert("下载生成失败，可能是网络问题导致库加载失败，请重试");
    } finally {
        setIsDownloading(false);
    }
  };

  // -- RENDER HELPERS --

  const renderSidebar = () => (
    <div className="w-64 bg-zinc-50 border-r border-[#b4c6e6]/30 flex flex-col h-full flex-shrink-0">
      <div className="p-8">
        <h1 className="text-xl font-bold text-[#0048d6] flex items-center gap-2 tracking-tight">
          <div className="w-8 h-8 bg-[#2d6ad1] rounded-lg flex items-center justify-center shadow-lg shadow-[#2d6ad1]/20">
            <span className="text-lg text-white font-serif italic">D</span>
          </div>
          DocuMind
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <button 
          onClick={() => setViewMode('upload')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
            ${viewMode === 'upload' 
              ? 'bg-[#2d6ad1] text-white shadow-md shadow-[#2d6ad1]/20' 
              : 'text-zinc-500 hover:bg-[#e5efff] hover:text-[#2d6ad1]'}`}
        >
          <UploadIcon className="w-5 h-5" />
          <span>导入与处理</span>
        </button>
        <button 
          onClick={() => setViewMode('library')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
            ${viewMode === 'library' 
              ? 'bg-[#2d6ad1] text-white shadow-md shadow-[#2d6ad1]/20' 
              : 'text-zinc-500 hover:bg-[#e5efff] hover:text-[#2d6ad1]'}`}
        >
          <FileTextIcon className="w-5 h-5" />
          <span>知识库</span>
          <span className={`ml-auto text-[10px] font-bold py-0.5 px-2 rounded-full min-w-[1.5rem] ${viewMode === 'library' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-600'}`}>{records.length}</span>
        </button>
        <button 
          onClick={() => setViewMode('chat')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
            ${viewMode === 'chat' 
              ? 'bg-[#2d6ad1] text-white shadow-md shadow-[#2d6ad1]/20' 
              : 'text-zinc-500 hover:bg-[#e5efff] hover:text-[#2d6ad1]'}`}
        >
          <MessageSquareIcon className="w-5 h-5" />
          <span>智能问答</span>
        </button>
      </nav>
      {/* 退出按钮 */}
      <div className="px-4 pb-6">
        <button 
          onClick={() => {
            localStorage.removeItem('documind_auth');
            window.location.reload();
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-zinc-400 hover:bg-red-50 hover:text-red-500"
        >
          <LogOutIcon className="w-5 h-5" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );

  const renderUploadView = () => (
    <div className="max-w-4xl mx-auto w-full p-10 overflow-y-auto">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-[#0048d6] mb-3 tracking-tight">导入访谈纪要</h2>
        <p className="text-zinc-500 text-lg">上传访谈截图，自动数字化并建立索引。</p>
      </div>

      <UploadArea onFilesSelected={handleFilesSelected} />

      {/* Queue List */}
      {uploadQueue.length > 0 && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
          <h3 className="text-sm font-semibold text-[#b4c6e6] uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>处理队列</span>
            {isProcessing && <span className="text-xs font-medium text-[#2d6ad1] bg-[#e5efff] px-2 py-1 rounded-full animate-pulse">正在处理中...</span>}
          </h3>
          <div className="bg-white border border-[#b4c6e6]/50 rounded-2xl divide-y divide-zinc-50 shadow-sm overflow-hidden">
            {uploadQueue.map(item => (
              <div key={item.id} className="p-4 flex items-center gap-5 hover:bg-[#e5efff]/20 transition-colors">
                <div className="w-14 h-14 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0 border border-zinc-100 shadow-sm">
                  <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 truncate text-sm">{item.file.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{(item.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Status Indicators */}
                    {item.status === ProcessingStatus.PENDING && (
                        <div className="h-2 w-2 bg-zinc-300 rounded-full" title="等待中"></div>
                    )}
                    {item.status === ProcessingStatus.PROCESSING && (
                         <div className="h-4 w-4 border-2 border-[#2d6ad1] border-t-transparent rounded-full animate-spin" title="处理中"></div>
                    )}
                    {item.status === ProcessingStatus.COMPLETED && (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" title="完成" />
                    )}
                    {item.status === ProcessingStatus.ERROR && (
                        <AlertCircleIcon className="w-5 h-5 text-red-500" title="失败" />
                    )}
                    {item.status === ProcessingStatus.PAUSED && (
                        <div className="h-2 w-2 bg-amber-400 rounded-full" title="已暂停"></div>
                    )}
                    
                    {/* Action Buttons */}
                    {(item.status === ProcessingStatus.PENDING || item.status === ProcessingStatus.PAUSED) && (
                        <button 
                            onClick={() => togglePauseItem(item.id)}
                            className={`p-2 rounded-full transition-colors ${item.status === ProcessingStatus.PAUSED ? 'text-green-500 hover:bg-green-50' : 'text-amber-500 hover:bg-amber-50'}`}
                            title={item.status === ProcessingStatus.PAUSED ? "继续" : "暂停"}
                        >
                            {item.status === ProcessingStatus.PAUSED ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                        </button>
                    )}

                    <button 
                        onClick={() => removeFromQueue(item.id)}
                        className="text-zinc-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                        title="删除"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Button 
                variant="ghost" 
                onClick={() => setUploadQueue([])}
                disabled={uploadQueue.some(i => i.status === ProcessingStatus.PROCESSING)}
            >
                清空列表
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLibraryView = () => (
    <div className="w-full h-full flex flex-col bg-white">
        {/* Library Header */}
        <div className="px-10 py-6 border-b border-[#b4c6e6]/30 bg-white/80 backdrop-blur-xl sticky top-0 z-10 transition-all">
            <div className="flex flex-col gap-4">
                {/* Title Row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-[#0048d6] tracking-tight">专家知识库</h2>
                    </div>
                    <div className="flex items-center gap-3">
                         {isSelectionMode ? (
                             <>
                                <span className="text-sm text-zinc-500 mr-2">已选 {selectedIds.size} 项</span>
                                {selectedIds.size > 0 && (
                                    <Button 
                                        size="sm" 
                                        onClick={handleBatchDownload} 
                                        isLoading={isDownloading}
                                        className="bg-green-600 hover:bg-green-700 shadow-green-600/20"
                                    >
                                        <DownloadIcon className="w-4 h-4 mr-2" />
                                        批量下载 Word
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={toggleSelectionMode}>
                                    取消选择
                                </Button>
                             </>
                         ) : (
                             <Button size="sm" variant="secondary" onClick={toggleSelectionMode}>
                                <CheckSquareIcon className="w-4 h-4 mr-2" />
                                批量管理
                             </Button>
                         )}
                    </div>
                </div>

                {/* Search Row */}
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="搜索标题、关键词、正文内容..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 bg-zinc-100 border-none rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d6ad1]/20 focus:bg-white transition-all shadow-inner"
                    />
                </div>
                
                {isSelectionMode && (
                    <div className="flex items-center gap-2 text-sm">
                        <button onClick={selectAll} className="text-[#2d6ad1] hover:underline">
                            全选当前结果
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Library Grid - Text Focused Cards */}
        <div className="flex-1 overflow-auto p-10 bg-[#f8fafc]">
            {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-zinc-400">
                    <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <SearchIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-lg font-medium text-zinc-600">未找到相关文档</p>
                    <p className="text-sm mt-1">尝试其他关键词或上传新文件。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredRecords.map(record => {
                        const isSelected = selectedIds.has(record.id);
                        
                        // Fallback text logic
                        const summaryText = record.abstract || record.content || "暂无文字内容";

                        return (
                            <div 
                                key={record.id} 
                                onClick={() => openRecord(record.id)}
                                className={`
                                    bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] 
                                    border border-zinc-100
                                    transition-all duration-300 cursor-pointer flex flex-col h-[22rem] p-6 relative group
                                    ${isSelectionMode && isSelected 
                                        ? 'ring-2 ring-[#2d6ad1] transform scale-[0.98]' 
                                        : 'hover:shadow-[0_12px_24px_rgba(45,106,209,0.1)] hover:-translate-y-1 hover:border-[#2d6ad1]/30'
                                    }
                                `}
                            >
                                {/* Selection Overlay */}
                                {isSelectionMode && (
                                    <div className={`absolute top-4 right-4 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'bg-[#2d6ad1] border-[#2d6ad1]' : 'bg-white border-zinc-300'}`}>
                                        {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                    </div>
                                )}

                                {/* Header: Title */}
                                <div className="mb-2 pr-4">
                                    <h3 className="text-xl font-bold text-[#0048d6] leading-snug line-clamp-2" title={record.title}>
                                        {record.title}
                                    </h3>
                                </div>

                                {/* Metadata: Date */}
                                <div className="flex items-center gap-2 mb-4 text-xs font-medium text-zinc-400">
                                    {record.interviewTime && (
                                        <span className="bg-[#f1f5f9] text-zinc-600 px-2 py-0.5 rounded-md">
                                            {record.interviewTime}
                                        </span>
                                    )}
                                    <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                                </div>

                                {/* Keywords */}
                                <div className="flex flex-wrap gap-1.5 mb-4 max-h-[3.5rem] overflow-hidden content-start">
                                    {record.keywords && record.keywords.slice(0, 6).map((kw, i) => (
                                        <span key={i} className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#e5efff] text-[#2d6ad1] border border-[#b4c6e6]/30 whitespace-nowrap">
                                            {kw}
                                        </span>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-zinc-100 mb-4 w-full"></div>

                                {/* Abstract/Summary */}
                                <div className="flex-1 overflow-hidden relative">
                                    <p className="text-zinc-600 text-sm leading-relaxed text-justify break-all font-normal">
                                        {summaryText}
                                    </p>
                                    {/* Fade effect for truncated text */}
                                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                                </div>

                                {/* Hover Action (Delete) */}
                                {!isSelectionMode && (
                                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => deleteRecord(record.id, e)}
                                            className="text-zinc-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                                            title="删除文档"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );

  // -- MAIN RENDER --
  
  if (viewMode === 'details' && selectedRecordId) {
    const record = records.find(r => r.id === selectedRecordId);
    if (!record) return <div>记录未找到</div>;
    return <DetailView record={record} onBack={goBackToLibrary} />;
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-zinc-900 font-sans selection:bg-[#e5efff] selection:text-[#0048d6]">
      {renderSidebar()}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative shadow-2xl z-10 rounded-l-[2rem] bg-white border border-[#b4c6e6]/30 ml-[-1px]">
        {viewMode === 'upload' && renderUploadView()}
        {viewMode === 'library' && renderLibraryView()}
        {viewMode === 'chat' && <ChatView records={records} onNavigateToRecord={handleNavigateFromChat} />}
      </main>
    </div>
  );
};

export default App;