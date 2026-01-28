import React, { useState } from 'react';
import { DocRecord } from '../types';
import { ArrowLeftIcon, CopyIcon, CheckCircleIcon } from './Icon';
import { Button } from './Button';

interface DetailViewProps {
  record: DocRecord;
  onBack: () => void;
}

export const DetailView: React.FC<DetailViewProps> = ({ record, onBack }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Construct a comprehensive text block for clipboard
    const parts = [
      `标题: ${record.title}`,
      record.interviewTime ? `访谈时间: ${record.interviewTime}` : null,
      (record.keywords && record.keywords.length > 0) ? `关键词: ${record.keywords.join(' ')}` : null,
      record.abstract ? `摘要: ${record.abstract}` : null,
      '', // Empty line separator
      record.content
    ];

    // Filter out nulls and join with newlines
    const copyText = parts.filter(part => part !== null).join('\n');
    
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Glassmorphism */}
      <div className="border-b border-[#b4c6e6]/30 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-zinc-400 hover:text-[#2d6ad1] hover:bg-[#e5efff] rounded-full transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-[#0048d6] truncate max-w-xs">
              {record.title || record.fileName}
            </h2>
            <p className="text-xs text-zinc-400">
               {record.interviewTime ? `访谈时间: ${record.interviewTime}` : '无日期'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="text-[#2d6ad1]">
                {copied ? (
                    <>
                        <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500" />
                        <span className="text-green-600">已复制</span>
                    </>
                ) : (
                    <>
                        <CopyIcon className="w-4 h-4 mr-2" />
                        复制全文
                    </>
                )}
            </Button>
        </div>
      </div>

      {/* Content Split */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left: Image Viewer */}
        <div className="w-full md:w-[45%] bg-[#f8fafc] p-6 overflow-auto flex items-start justify-center border-r border-[#b4c6e6]/30">
          <div className="relative shadow-xl shadow-zinc-200/50 rounded-2xl overflow-hidden bg-white ring-1 ring-black/5">
            <img 
              src={record.fullImage} 
              alt="Source" 
              className="max-w-full h-auto object-contain block"
            />
          </div>
        </div>

        {/* Right: Text Content */}
        <div className="w-full md:w-[55%] flex flex-col bg-white h-full relative">
            <div className="flex-1 overflow-auto p-8 md:p-10">
                <div className="max-w-3xl mx-auto space-y-8">
                    
                    {/* Title Section */}
                    <div>
                        <h1 className="text-3xl font-bold text-[#0048d6] tracking-tight leading-tight mb-3">
                            {record.title || "未命名访谈"}
                        </h1>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                            {record.interviewTime && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#f0f4fa] text-zinc-600">
                                    时间: {record.interviewTime}
                                </span>
                            )}
                            {record.keywords && record.keywords.map((kw, i) => (
                                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#e5efff] text-[#2d6ad1]">
                                    #{kw}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Abstract Section */}
                    {record.abstract && (
                        <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#b4c6e6]/30">
                            <h3 className="text-xs font-semibold text-[#b4c6e6] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="w-1 h-1 bg-[#2d6ad1] rounded-full"></span>
                                摘要
                            </h3>
                            <p className="text-zinc-700 leading-relaxed text-sm font-medium whitespace-pre-wrap">
                                {record.abstract}
                            </p>
                        </div>
                    )}

                    {/* Main Content */}
                    <div>
                        <h3 className="text-xs font-semibold text-[#b4c6e6] uppercase tracking-wider mb-4 flex items-center gap-2">
                             <span className="w-1 h-1 bg-[#2d6ad1] rounded-full"></span>
                             纪要正文
                        </h3>
                        <div className="prose prose-zinc max-w-none">
                            <p className="whitespace-pre-wrap text-zinc-800 leading-7 text-base font-normal">
                                {record.content}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};