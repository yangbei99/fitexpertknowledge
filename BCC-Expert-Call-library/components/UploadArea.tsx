import React, { useCallback, useState } from 'react';
import { UploadIcon } from './Icon';

interface UploadAreaProps {
  onFilesSelected: (files: File[]) => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((file: File) => 
        file.type.startsWith('image/')
      );
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  }, [onFilesSelected]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = Array.from(e.target.files).filter((file: File) => 
        file.type.startsWith('image/')
      );
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer group
        ${isDragging 
          ? 'border-[#2d6ad1] bg-[#e5efff]/50 scale-[1.01]' 
          : 'border-[#b4c6e6] hover:border-[#2d6ad1] hover:bg-[#e5efff]/30'
        }
      `}
    >
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className="flex flex-col items-center justify-center space-y-5">
        <div className={`
          p-5 rounded-full transition-all duration-300 shadow-sm
          ${isDragging ? 'bg-[#e5efff] text-[#2d6ad1] scale-110' : 'bg-white text-[#b4c6e6] group-hover:text-[#2d6ad1] group-hover:shadow-md'}
        `}>
          <UploadIcon className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-semibold text-[#0048d6] tracking-tight">
            请将专家访谈纪要拖拽至此
          </p>
          <p className="text-sm text-zinc-500">
            支持 JPG, PNG 批量上传 • 自动提取与归档
          </p>
        </div>
        <div className="pt-2">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-[#2d6ad1] bg-[#e5efff] group-hover:bg-[#d0e1fd] transition-colors">
            浏览文件
            </span>
        </div>
      </div>
    </div>
  );
};