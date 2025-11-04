import { MessageCircle } from "lucide-react";
import { FileIcon } from "@/components/file-icon/FileIcon";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import type { ChatMessage } from "@/types/chat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  loading: boolean;
}

export function ChatMessages({ messages, loading }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Start a new conversation
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-4">
          Upload cloud billing files or ask questions about cost optimization to
          begin.
        </p>
      </div>
    );
  }

  return (
    <>
      {messages.map((m, i) => (
        <div
          key={m.messageId || i}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] lg:max-w-[75%] rounded-lg p-3 lg:p-4 ${
              m.role === "user"
                ? "bg-blue-500 text-gray-100"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {m.role === "user" && m.files && m.files.length > 0 && (
              <div className="mb-2 space-y-1">
                <p className="text-xs opacity-80 mb-1">📎 Uploaded Files:</p>
                {m.files.map((file) => (
                  <FileIcon
                    key={file.id}
                    fileName={file.fileName}
                    fileType={file.fileType}
                    fileSize={file.fileSize}
                    onDownload={() => window.open(file.downloadUrl, "_blank")}
                  />
                ))}
              </div>
            )}

            <div className="whitespace-pre-wrap break-words text-sm lg:text-base leading-relaxed">
              <MemoizedMarkdown
                content={m.text}
                id={m.messageId || `msg-${i}`}
              />
            </div>

            <div
              className={`text-xs mt-1 ${
                m.role === "user" ? "text-blue-100" : "text-slate-500"
              }`}
            >
              {m.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </div>
          </div>
        </div>
      ))}
      {loading && <LoadingIndicator />}
    </>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] lg:max-w-[75%] rounded-lg p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></div>
            <div
              className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
          <div className="italic text-slate-500 dark:text-slate-400 text-sm">
            Analyzing your cloud costs...
          </div>
        </div>
      </div>
    </div>
  );
}
