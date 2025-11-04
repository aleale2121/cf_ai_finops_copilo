import { Button } from "@/components/button/Button";
import { History, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface HeaderProps {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  showSidebar: boolean;
  isMobile?: boolean;
}

export function Header({
  onNewChat,
  onToggleSidebar,
  showSidebar,
  isMobile = false
}: HeaderProps) {
  if (isMobile) {
    return (
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">☁️</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Cloud FinOps
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onNewChat}
            className="flex items-center gap-1 border-slate-300 dark:border-slate-600"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSidebar}
            className="flex items-center gap-2 border-slate-300 dark:border-slate-600"
          >
            {showSidebar ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
            History
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">☁️</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Cloud FinOps Copilot
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            AI-powered cloud cost optimization
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          className="flex items-center gap-1 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          onClick={onToggleSidebar}
        >
          <History className="h-4 w-4" />
          {showSidebar ? "Hide" : "History"}
        </Button>
      </div>
    </div>
  );
}
