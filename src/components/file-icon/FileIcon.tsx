import { BarChart3, Download, FileText, X } from "lucide-react";
import { Button } from "@/components/button/Button";
import { cn } from "@/lib/utils";

interface FileIconProps {
  fileName: string;
  fileType: string;
  fileSize: number;
  onDownload?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  className?: string;
}

export function FileIcon({
  fileName,
  fileType,
  fileSize,
  onDownload,
  onRemove,
  showRemove = false,
  className
}: FileIconProps) {
  const isCSV = fileType.includes("csv") || fileName.endsWith(".csv");
  const isJSON = fileType.includes("json") || fileName.endsWith(".json");
  const isTXT = fileType.includes("text") || fileName.endsWith(".txt");
  const isXML = fileType.includes("xml") || fileName.endsWith(".xml");
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = () => {
    if (isCSV || isExcel) {
      return <BarChart3 className="h-5 w-5 text-green-600" />;
    }
    if (isJSON) {
      return <FileText className="h-5 w-5 text-yellow-600" />;
    }
    if (isXML) {
      return <FileText className="h-5 w-5 text-orange-600" />;
    }
    return <FileText className="h-5 w-5 text-blue-600" />;
  };

  const getFileTypeName = (): string => {
    if (isCSV) return "CSV";
    if (isExcel) return "Excel";
    if (isJSON) return "JSON";
    if (isXML) return "XML";
    if (isTXT) return "Text";
    return "File";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm",
        className
      )}
    >
      <div className="flex-shrink-0">{getFileIcon()}</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {fileName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatFileSize(fileSize)} • {getFileTypeName()}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        {showRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
