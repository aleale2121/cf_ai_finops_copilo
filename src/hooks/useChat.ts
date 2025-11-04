import { useEffect, useState, useCallback } from "react";
import type {
  ChatMessage,
  ChatResponse,
  FileUploadProgress,
  HistoryResponse,
  UploadedFile
} from "@/types/chat";

export function useChat() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileUploads, setFileUploads] = useState<FileUploadProgress[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState<string>(
    crypto.randomUUID()
  );
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  // Wrap in useCallback to stabilize the function reference
  const generateNewSessionId = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    setUploadSessionId(newSessionId);
    return newSessionId;
  }, []);

  const loadThread = async (threadId: string) => {
    try {
      const response = await fetch(`/api/chat/threads/${threadId}/messages`);
      if (response.ok) {
        const data = (await response.json()) as { messages: ChatMessage[] };
        setChat(
          data.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        );
        setCurrentThreadId(threadId);
        setMessage("");
        setFileUploads([]);
        generateNewSessionId();
      }
    } catch (error) {
      console.error("Failed to load thread:", error);
    }
  };

  const handleThreadSelect = async (threadId: string) => {
    await loadThread(threadId);
    if (window.innerWidth < 1024) {
      return true;
    }
    return false;
  };

  const handleFileSelect = async (
    file: File | null,
    type: "plan" | "metrics"
  ) => {
    if (!file) {
      setFileUploads((prev) => prev.filter((f) => f.fileType !== type));
      return;
    }

    const uploadProgress: FileUploadProgress = {
      file: file,
      progress: 0,
      status: "uploading",
      fileType: type
    };

    setFileUploads((prev) => [
      ...prev.filter((f) => f.fileType !== type),
      uploadProgress
    ]);

    try {
      const currentSessionId = uploadSessionId || generateNewSessionId();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", type);
      formData.append("sessionId", currentSessionId);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setFileUploads((prev) =>
            prev.map((f) =>
              f.fileType === type ? { ...f, progress: Math.round(progress) } : f
            )
          );
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          const response: { file: UploadedFile } = await JSON.parse(
            xhr.responseText
          );
          setFileUploads((prev) =>
            prev.map((f) =>
              f.fileType === type
                ? {
                    ...f,
                    status: "completed",
                    progress: 100,
                    uploadedFile: response.file
                  }
                : f
            )
          );
        } else {
          setFileUploads((prev) =>
            prev.map((f) =>
              f.fileType === type ? { ...f, status: "error", progress: 0 } : f
            )
          );
        }
      });

      xhr.addEventListener("error", () => {
        setFileUploads((prev) =>
          prev.map((f) =>
            f.fileType === type ? { ...f, status: "error", progress: 0 } : f
          )
        );
      });

      xhr.open("POST", "/api/files/upload");
      xhr.send(formData);
    } catch (error) {
      console.error("File upload error:", error);
      setFileUploads((prev) =>
        prev.map((f) =>
          f.fileType === type ? { ...f, status: "error", progress: 0 } : f
        )
      );
    }
  };

  const handleRemoveFile = (fileType: "plan" | "metrics") => {
    const upload = fileUploads.find((f) => f.fileType === fileType);

    if (upload?.status === "completed" && upload.uploadedFile) {
      fetch(`/api/files/${upload.uploadedFile.id}`, { method: "DELETE" }).catch(
        console.error
      );
    }

    setFileUploads((prev) => prev.filter((f) => f.fileType !== fileType));
  };

  const handleNewChat = async () => {
    setChat([]);
    setMessage("");
    setFileUploads([]);
    setCurrentThreadId(null);
    generateNewSessionId();

    console.log(
      "🆕 Preparing new chat - thread will be created with first message"
    );
  };

  const handleSend = async () => {
    const uploadedFiles = fileUploads
      .filter((f) => f.status === "completed")
      .map((f) => f.uploadedFile!);
    const hasCompletedUploads = uploadedFiles.length > 0;
    const isSendEnabled = message.trim().length > 0 || hasCompletedUploads;

    if (!isSendEnabled) return;

    setLoading(true);
    const fileIds = uploadedFiles.map((f) => f.id);

    const userMessage: ChatMessage = {
      role: "user",
      text: message || (hasCompletedUploads ? "[Uploaded Files]" : ""),
      timestamp: new Date(),
      files: uploadedFiles
    };
    setChat((c) => [...c, userMessage]);

    try {
      const currentSessionId = uploadSessionId || generateNewSessionId();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          fileIds,
          sessionId: currentSessionId
        })
      });

      const data: ChatResponse = await res.json();
      if (data.reply) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          text: data.reply,
          timestamp: new Date()
        };
        setChat((c) => [...c, assistantMessage]);
        setMessage("");
        setFileUploads([]);

        if (data.threadId) {
          setCurrentThreadId(data.threadId);
        }

        await loadChatHistory();
      }
    } catch (error) {
      console.error(error);
      setChat((c) => [
        ...c,
        {
          role: "assistant",
          text: "❌ Error: failed to reach server.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const r = await fetch("/api/chat/history");
      const d: HistoryResponse = await r.json();
      if (d.messages) {
        setChat(
          d.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        );
      }
    } catch {
      console.warn("No history found or endpoint missing.");
    }
  };

  useEffect(() => {
    if (fileUploads.length === 0 && !uploadSessionId) {
      generateNewSessionId();
    }
  }, [fileUploads.length, uploadSessionId, generateNewSessionId]);

  return {
    // State
    message,
    setMessage,
    chat,
    loading,
    fileUploads,
    currentThreadId,

    // Actions
    handleNewChat,
    handleThreadSelect,
    handleFileSelect,
    handleRemoveFile,
    handleSend,
    loadChatHistory,

    // Computed
    isSendEnabled:
      message.trim().length > 0 ||
      fileUploads.filter((f) => f.status === "completed").length > 0
  };
}
