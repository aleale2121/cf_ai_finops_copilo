import { Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type FileUploadProps = {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

export function FileUpload({
  onFileSelect,
  accept,
  label,
  className,
  compact = false
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onFileSelect(file);
    // Reset input to allow selecting same file again
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  if (compact) {
    return (
      <div className={cn("w-full", className)}>
        <label
          className={cn(
            "flex items-center justify-center w-full px-3 py-2 border border-dashed rounded-md cursor-pointer transition-colors text-xs",
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleChange}
          />
          <Upload className="h-3 w-3 text-slate-400 mr-2" />
          <span className="text-slate-600 dark:text-slate-400 truncate">
            {label || "Upload File"}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <p className="mb-3 font-semibold text-lg text-slate-700 dark:text-slate-300">
          {label}
        </p>
      )}

      <label
        className={cn(
          "flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
        />
        <Upload className="h-8 w-8 text-slate-400 mb-3" />
        <span className="text-base text-slate-600 dark:text-slate-400 text-center">
          Click to upload or drag a file here
        </span>
        {accept && (
          <span className="text-sm text-slate-500 dark:text-slate-500 mt-2">
            Supported: {accept}
          </span>
        )}
      </label>
    </div>
  );
}
