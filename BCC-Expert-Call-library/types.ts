export interface DocRecord {
  id: string;
  fileName: string;
  // Extracted Metadata
  title: string;
  interviewTime?: string;
  keywords: string[];
  abstract?: string;
  content: string;
  
  // Media
  thumbnail: string; // Base64 or URL
  fullImage: string; // Base64
  
  // System
  createdAt: number;
  tags: string[]; // User defined tags (separate from extracted keywords for now, or merged)
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  PAUSED = 'PAUSED',
}

export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ProcessingStatus;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type ViewMode = 'upload' | 'library' | 'details' | 'chat';
