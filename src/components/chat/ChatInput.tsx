import { FileUpload } from "@/components/file-upload/file-upload";
import { Textarea } from "@/components/textarea/Textarea";
import { Button } from "@/components/button/Button";
import { Loader2, X } from "lucide-react";
import { type FileUploadProgress } from "@/types/chat";

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  fileUploads: FileUploadProgress[];
  onFileSelect: (file: File | null, type: "plan" | "metrics") => void;
  onRemoveFile: (fileType: "plan" | "metrics") => void;
  onSend: () => void;
  loading: boolean;
  isSendEnabled: boolean;
}

export function ChatInput({
  message,
  setMessage,
  fileUploads,
  onFileSelect,
  onRemoveFile,
  onSend,
  loading,
  isSendEnabled
}: ChatInputProps) {
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* File Upload Progress */}
      {fileUploads.length > 0 && (
        <FileUploadProgress
          fileUploads={fileUploads}
          onRemoveFile={onRemoveFile}
        />
      )}

      {/* File Uploads */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex gap-3">
          <div className="flex-1">
            <FileUpload
              onFileSelect={(file) => onFileSelect(file, "plan")}
              accept=".csv,.json,.txt,.xlsx,.xls,.xml,.yaml,.yml"
              label="Upload Plan File"
              compact={true}
            />
          </div>
          <div className="flex-1">
            <FileUpload
              onFileSelect={(file) => onFileSelect(file, "metrics")}
              accept=".csv,.json,.txt,.xlsx,.xls,.xml,.yaml,.yml,.log"
              label="Upload Metrics File"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Input Controls */}
      <div className="p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about cloud costs, optimization strategies, or analyze uploaded files..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm p-3 border border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 rounded-lg bg-white dark:bg-slate-800 transition-colors duration-200"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            onClick={onSend}
            disabled={!isSendEnabled || loading}
            className={`
              w-16 px-3 text-base shrink-0 rounded-lg border-2 
              font-medium flex items-center justify-center h-[60px]
              transition-colors duration-200
              ${
                !isSendEnabled || loading
                  ? "bg-slate-300 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400"
                  : "!bg-blue-600 !border-blue-600 text-white hover:!bg-blue-700 hover:!border-blue-700"
              }
            `}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>Send</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileUploadProgress({
  fileUploads,
  onRemoveFile
}: {
  fileUploads: FileUploadProgress[];
  onRemoveFile: (fileType: "plan" | "metrics") => void;
}) {
  return (
    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Uploading (
          {fileUploads.filter((f) => f.status === "completed").length}/
          {fileUploads.length})
        </span>
      </div>
      <div className="space-y-2">
        {fileUploads.map((upload) => (
          <div
            key={upload.fileType}
            className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
          >
            <div className="flex-shrink-0">
              {upload.status === "uploading" && (
                <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              )}
              {upload.status === "completed" && (
                <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              )}
              {upload.status === "error" && (
                <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <X className="h-2 w-2 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                {upload.file.name}
              </p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 mt-1">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    upload.status === "uploading"
                      ? "bg-blue-500"
                      : upload.status === "completed"
                        ? "bg-green-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFile(upload.fileType)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
              title="Remove file"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
