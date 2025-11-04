export interface UploadedFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  r2Key: string;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: "uploading" | "completed" | "error";
  uploadedFile?: UploadedFile;
  fileType: "plan" | "metrics";
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  files?: UploadedFile[];
  messageId?: string;
  timestamp: Date;
}

export interface ChatResponse {
  reply: string;
  threadId?: string;
  analysisId?: number;
  messageId?: string;
}

export interface HistoryResponse {
  messages: ChatMessage[];
}

export interface NewChatResponse {
  threadId: string;
  success: boolean;
}

export interface ChatRequest {
  message?: string;
  fileIds?: number[];
  sessionId: string;
  threadId?: string;
}
