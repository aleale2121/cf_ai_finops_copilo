import { Plus, X } from "lucide-react";
import { Button } from "@/components/button/Button";
import { HistoryPanel } from "./HistoryPanel";

interface SidebarProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onThreadSelect: (threadId: string) => void;
  currentThreadId: string | null;
}

export function Sidebar({
  showSidebar,
  onToggleSidebar,
  onNewChat,
  onThreadSelect,
  currentThreadId
}: SidebarProps) {
  return (
    <aside
      className={`
        w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 
        bg-white dark:bg-slate-900 flex flex-col
        lg:static lg:transform-none lg:translate-x-0
        ${
          showSidebar
            ? "fixed inset-0 z-50 translate-x-0"
            : "fixed -translate-x-full lg:translate-x-0"
        }
        transition-transform duration-300 ease-in-out
      `}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 className="font-semibold text-xl text-slate-900 dark:text-white">
            History
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewChat}
              className="flex items-center gap-1 border-slate-300 dark:border-slate-600"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onToggleSidebar}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <HistoryPanel
            onNewChat={onNewChat}
            onThreadSelect={onThreadSelect}
            currentThreadId={currentThreadId}
          />
        </div>
      </div>
    </aside>
  );
}
