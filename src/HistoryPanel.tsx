import { useState, useEffect } from "react";
import { Button } from "@/components/button/Button";
import { MessageSquare, Trash2, Plus } from "lucide-react";

type Thread = {
  threadId: string;
  title: string;
  createdAt: string;
  msgCount?: number;
};
type ThreadsResponse = { threads?: Thread[] };

interface HistoryPanelProps {
  onNewChat?: () => void;
  onThreadSelect?: (threadId: string) => void;
  currentThreadId?: string | null;
}

export function HistoryPanel({
  onNewChat,
  onThreadSelect,
  currentThreadId
}: HistoryPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);

  async function loadThreads() {
    try {
      const r = await fetch("/api/chat/list");
      if (!r.ok) return;
      const d = (await r.json()) as ThreadsResponse;
      setThreads(d.threads ?? []);
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  }

  useEffect(() => {
    loadThreads();
  }, []);

  async function handleThreadClick(threadId: string) {
    if (onThreadSelect) {
      onThreadSelect(threadId);
    }
  }

  async function handleDelete(threadId: string, event: React.MouseEvent) {
    event.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await fetch(`/api/chat/threads/${threadId}`, { method: "DELETE" });
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));

      if (currentThreadId === threadId && onNewChat) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
      alert("Failed to delete conversation. Please try again.");
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <div className="flex-shrink-0">
        <Button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              No Conversations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Start a new chat to see history
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((t) => (
              <div
                key={t.threadId}
                className={`
                  flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group
                  ${
                    currentThreadId === t.threadId
                      ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  }
                `}
                onClick={() => handleThreadClick(t.threadId)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-900 dark:text-white truncate mb-1">
                    {t.title || "Untitled Conversation"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString()} •{" "}
                    {t.msgCount ?? 0} messages
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleDelete(t.threadId, e)}
                  className="opacity-80 hover:opacity-100 transition-opacity p-2 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
                  title=""
                >
                  <Trash2 className="text-red-600 h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
