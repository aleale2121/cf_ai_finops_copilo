import { routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt } from "agents/schedule";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { google } from "@ai-sdk/google";
import { processToolCalls, cleanupMessages } from "./utils";
import {
  createThread,
  getLatestThread,
  saveMessage,
  saveAnalysis,
  getThreadMessagesWithFiles,
  listThreads,
  getFullThreadText,
  deleteThread
} from "./d1";
import { analyzeCostsWithGemini } from "./optimizer";
import {
  storeFileInR2,
  saveFileMetadata,
  getFileDownloadUrl,
  type UploadedFile
} from "./file-storage";

const model = google("gemini-2.5-flash");

type AiRunOut = { response?: string };

async function getRelevantContext(
  env: Env,
  userId: string,
  threadId: string
): Promise<string> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT role, content FROM messages 
       WHERE userId = ? AND threadId = ? AND relevant = 1
       ORDER BY datetime(createdAt) ASC
       LIMIT 10`
    )
      .bind(userId, threadId)
      .all();

    if (!results || results.length === 0) {
      return "";
    }

    const contextMessages = (results as { role: string; content: string }[])
      .map((msg) => `${msg.role}: ${msg.content.substring(0, 500)}`)
      .join("\n");

    return `Previous relevant context:\n${contextMessages}\n\n`;
  } catch (error) {
    console.error("Error fetching relevant context:", error);
    return "";
  }
}

async function isRelevant(env: Env, text: string): Promise<boolean> {
  console.log("🔍 Starting relevance check...");
  if (!text || !text.trim()) {
    console.log("❌ Relevance check: Empty text, returning false");
    return false;
  }

  const cloudKeywords = [
    "aws",
    "azure",
    "gcp",
    "cloud",
    "billing",
    "invoice",
    "cost",
    "usage",
    "metrics",
    "ec2",
    "s3",
    "lambda",
    "rds",
    "vm",
    "storage",
    "compute",
    "network",
    "bandwidth",
    "spend",
    "plan",
    "pricing",
    "reserved",
    "spot",
    "ondemand",
    "csv",
    "json",
    "xlsx",
    "xls",
    "txt",
    "log",
    "pdf"
  ];

  const lowerText = text.toLowerCase();
  const hasCloudKeywords = cloudKeywords.some((keyword) =>
    lowerText.includes(keyword)
  );

  if (hasCloudKeywords) {
    console.log("✅ Relevance: Found cloud keywords, returning true");
    const foundKeywords = cloudKeywords.filter((keyword) =>
      lowerText.includes(keyword)
    );
    console.log(`📝 Found keywords: ${foundKeywords.join(", ")}`);
    return true;
  }

  console.log("🤖 No obvious keywords found, using AI for relevance check...");

  try {
    const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        {
          role: "system",
          content: `You are a cloud cost optimization expert. Analyze if the provided text is related to CLOUD COST OPTIMIZATION, CLOUD BILLING, or CLOUD INFRASTRUCTURE.
          
          Consider these as RELEVANT:
          - Cloud provider bills (AWS, Azure, GCP, etc.)
          - Usage metrics and cost reports
          - Infrastructure as code files
          - Cloud resource configurations
          - Cost optimization discussions
          - Billing and spending analysis
          - Any file uploads with cloud context
          
          Consider these as IRRELEVANT:
          - Personal documents
          - Code files without cloud context
          - General IT infrastructure not cloud-specific
          - Off-topic conversations
          
          Be PERMISSIVE - if there's any chance it's cloud-related, say YES.
          Respond with only "YES" or "NO".`
        },
        {
          role: "user",
          content: `Is this text about cloud cost optimization, cloud billing, or cloud infrastructure?\n\n${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const answer = (res as AiRunOut)?.response?.trim().toUpperCase() || "";
    console.log(`🤖 AI Relevance check result: "${answer}"`);
    const result = answer.startsWith("Y");
    console.log(
      `📊 Relevance final decision: ${result ? "RELEVANT" : "IRRELEVANT"}`
    );
    return result;
  } catch (error) {
    console.error("❌ Relevance check failed, defaulting to true:", error);
    return true;
  }
}

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    console.log("💬 Chat agent processing message...");
    const tools: ToolSet = {};
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        console.log("🔄 Starting message stream execution...");
        const cleaned = cleanupMessages(this.messages);
        console.log(`📨 Cleaned ${cleaned.length} messages`);

        const processed = await processToolCalls({
          messages: cleaned,
          dataStream: writer,
          tools,
          executions: {}
        });

        console.log("🤖 Starting AI stream text generation...");
        const result = streamText({
          system: `You are a helpful FinOps assistant. ${getSchedulePrompt({ date: new Date() })}`,
          messages: convertToModelMessages(processed),
          model,
          tools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof tools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
        console.log("✅ Message stream execution completed");
      }
    });
    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`🔧 Executing scheduled task: ${description}`);
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          { type: "text", text: `Running scheduled task: ${description}` }
        ],
        metadata: { createdAt: new Date() }
      }
    ]);
    console.log("✅ Scheduled task completed");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = "guest";

    console.log(
      `🌐 ${request.method} ${url.pathname} - Starting request processing`
    );

    if (url.pathname === "/" || url.pathname.startsWith("/assets")) {
      console.log("📁 Serving static assets");
      return env.ASSETS.fetch(request);
    }

    // Create new chat thread
    if (url.pathname === "/api/chat/new" && request.method === "POST") {
      console.log("🆕 New chat request");
      try {
        const userId = "guest";
        const threadId = await createThread(env, userId);

        console.log(`✅ New thread created: ${threadId}`);
        return Response.json({
          threadId,
          success: true
        });
      } catch (error) {
        console.error("❌ Failed to create new thread:", error);
        return Response.json(
          { error: "Failed to create new chat" },
          { status: 500 }
        );
      }
    }

    // File download endpoint
    if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
      try {
        const r2Key = decodeURIComponent(
          url.pathname.replace("/api/files/", "")
        );

        console.log(`📥 File download requested for key: ${r2Key}`);

        const obj = await env.FILES.get(r2Key);
        if (!obj) {
          console.log(`❌ File not found in R2: ${r2Key}`);
          return new Response("File not found", { status: 404 });
        }

        console.log(`✅ Serving file from R2: ${r2Key}`);

        return new Response(obj.body, {
          headers: {
            "Content-Type":
              obj.httpMetadata?.contentType || "application/octet-stream",
            "Content-Disposition":
              obj.httpMetadata?.contentDisposition ||
              `attachment; filename="${r2Key.split("/").pop()}"`,
            "Cache-Control": "private, max-age=3600"
          }
        });
      } catch (error) {
        console.error("File download error:", error);
        return new Response("Download failed", { status: 500 });
      }
    }

    // File upload endpoint
    if (url.pathname === "/api/files/upload" && request.method === "POST") {
      console.log("📤 File upload request received");
      try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const fileType = formData.get("fileType") as string;
        const sessionId = formData.get("sessionId") as string;

        console.log(
          `📄 File upload details - Name: ${file?.name}, Type: ${fileType}, Size: ${file?.size} bytes, Session: ${sessionId}`
        );

        if (!file) {
          console.log("❌ No file provided in upload");
          return Response.json({ error: "No file provided" }, { status: 400 });
        }

        if (!sessionId) {
          console.log("❌ No session ID provided in upload");
          return Response.json(
            { error: "Session ID required" },
            { status: 400 }
          );
        }

        // Check if file is too large (optional: 10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          console.log(
            `❌ File too large: ${file.size} bytes (max: ${maxSize})`
          );
          return Response.json(
            { error: "File too large. Maximum size is 10MB." },
            { status: 400 }
          );
        }

        const userId = "guest";
        const threadId =
          (await getLatestThread(env, userId)) ||
          (await createThread(env, userId));

        console.log(`💾 Storing file in R2 for thread: ${threadId}`);

        // Store file in R2
        let r2Key: string;
        try {
          r2Key = await storeFileInR2(env, file, userId, threadId);
          console.log(`✅ File stored in R2 with key: ${r2Key}`);
        } catch (error) {
          console.error("❌ R2 storage failed:", error);
          return Response.json(
            { error: "File storage failed. Please try again." },
            { status: 500 }
          );
        }

        // Save file metadata with session ID
        console.log("💾 Saving file metadata to database...");
        const fileId = await saveFileMetadata(
          env,
          userId,
          threadId,
          sessionId,
          null,
          file.name,
          file.type,
          file.size,
          r2Key
        );

        console.log(`✅ File metadata saved with ID: ${fileId}`);

        const uploadedFile: UploadedFile = {
          id: fileId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          r2Key: r2Key,
          uploadedAt: new Date().toISOString(),
          downloadUrl: await getFileDownloadUrl(env, r2Key)
        };

        console.log("✅ File upload completed successfully");
        return Response.json({ file: uploadedFile });
      } catch (error) {
        console.error("❌ File upload error:", error);
        return Response.json({ error: "File upload failed" }, { status: 500 });
      }
    }

    // File delete endpoint
    if (url.pathname.startsWith("/api/files/") && request.method === "DELETE") {
      const fileId = url.pathname.split("/").pop();
      console.log(`🗑️ File delete requested for ID: ${fileId}`);

      try {
        const pathParts = url.pathname.split("/");
        const fileId = pathParts[pathParts.length - 1];

        if (!fileId || isNaN(Number(fileId))) {
          return new Response(JSON.stringify({ error: "Invalid file ID" }), {
            status: 400
          });
        }

        console.log(`🗑️ Deleting file with ID: ${fileId}`);

        // Find R2 key for file
        const { results } = await env.DB.prepare(
          `SELECT r2Key FROM uploaded_files WHERE id = ?`
        )
          .bind(fileId)
          .all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: "File not found" }), {
            status: 404
          });
        }

        const { r2Key } = results[0] as { r2Key: string };

        // Delete from R2
        await env.FILES.delete(r2Key);
        console.log(`✅ Deleted from R2: ${r2Key}`);

        // Delete from database
        await env.DB.prepare(`DELETE FROM uploaded_files WHERE id = ?`)
          .bind(fileId)
          .run();
        console.log(`✅ Deleted from database: ${fileId}`);

        return Response.json({ success: true });
      } catch (err) {
        console.error("File delete failed:", err);
        return Response.json(
          { error: "Failed to delete file" },
          { status: 500 }
        );
      }
    }

    // Main chat endpoint with session-based file linking
    if (url.pathname === "/api/chat" && request.method === "POST") {
      console.log("💭 Chat request received");
      try {
        const {
          message = "",
          fileIds = [],
          sessionId = ""
        } = (await request.json()) as {
          message?: string;
          fileIds?: number[];
          sessionId?: string;
        };

        console.log(
          `📨 Chat details - Message: "${message}", File IDs: ${fileIds.length}, Session: ${sessionId}`
        );

        const userId = "guest";
        let threadId = await getLatestThread(env, userId);
        if (!threadId) {
          console.log("🧵 No existing thread, creating new one...");
          threadId = await createThread(env, userId);
        }
        console.log(`🧵 Using thread: ${threadId}`);

        // Generate final message ID for this chat message
        const messageId = crypto.randomUUID();
        let analysisId: number | null = null;

        console.log("🔍 Retrieving files for session...");

        // Get all files for this session
        let filesQuery = "";
        let queryParams: any[] = [userId, threadId];

        if (fileIds.length > 0) {
          filesQuery = "AND id IN (" + fileIds.map(() => "?").join(",") + ")";
          queryParams.push(...fileIds);
        } else if (sessionId) {
          filesQuery = "AND messageId = ?";
          queryParams.push(sessionId);
        } else {
          console.log("❌ Neither fileIds nor sessionId provided");
          return Response.json(
            { error: "Either fileIds or sessionId required" },
            { status: 400 }
          );
        }

        const { results: filesResult } = await env.DB.prepare(
          `SELECT * FROM uploaded_files 
           WHERE userId = ? AND threadId = ? ${filesQuery}
           ORDER BY fileName ASC`
        )
          .bind(...queryParams)
          .all();

        const files: UploadedFile[] = (filesResult as any[]).map((file) => ({
          id: file.id,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          r2Key: file.r2Key,
          uploadedAt: file.uploadedAt
        }));

        console.log(`📁 Found ${files.length} files for session`);

        // Check relevance based on all files in session
        let fileContents = "";
        let planText = "";
        let metricsText = "";

        console.log("📖 Reading file contents for analysis...");
        for (const file of files) {
          fileContents += `File: ${file.fileName}\n`;

          // Read file contents for analysis and relevance check
          const object = await env.FILES.get(file.r2Key);
          if (object) {
            const content = await object.text();
            console.log(
              `📄 Read file: ${file.fileName} (${content.length} chars)`
            );

            // Add file content to relevance check (first 1000 chars to avoid token limits)
            fileContents += `Content preview: ${content.substring(0, 1000)}\n\n`;

            if (
              file.fileName.includes("plan") ||
              file.fileName.includes("billing")
            ) {
              planText = content;
              console.log(
                `📊 Identified as plan/billing file: ${file.fileName}`
              );
            } else {
              metricsText = content;
              console.log(`📈 Identified as metrics file: ${file.fileName}`);
            }
          } else {
            console.log(`❌ Could not read file from R2: ${file.r2Key}`);
          }
        }

        // Also check file names for relevance
        const fileNames = files.map((f) => f.fileName).join(", ");
        const relevanceText = `Files: ${fileNames}\n\n${fileContents}\n\nUser message: ${message}`;

        console.log("🔍 Starting relevance check...");
        console.log(
          `📝 Relevance check input preview: ${relevanceText.substring(0, 500)}`
        );

        const isRelevantAnalysis = await isRelevant(env, relevanceText);

        if (isRelevantAnalysis) {
          console.log("✅ Files are relevant, proceeding with analysis...");

          // Get relevant context from previous messages
          const relevantContext = await getRelevantContext(
            env,
            userId,
            threadId
          );
          console.log(
            `📚 Retrieved ${relevantContext.length > 0 ? "relevant context" : "no relevant context"}`
          );

          console.log("🤖 Starting AI analysis with Gemini...");
          const result = await analyzeCostsWithGemini(
            env,
            planText,
            metricsText,
            message,
            relevantContext
          );
          console.log(`✅ AI analysis completed (${result.length} chars)`);

          analysisId = await saveAnalysis(
            env,
            userId,
            threadId,
            planText,
            metricsText,
            message,
            result
          );
          console.log(`💾 Analysis saved with ID: ${analysisId}`);

          // Update all files in this session with the final messageId and analysisId
          console.log("🔗 Linking files to message and analysis...");
          await env.DB.prepare(
            `UPDATE uploaded_files 
             SET messageId = ?, analysisId = ? 
             WHERE userId = ? AND threadId = ? AND messageId = ?`
          )
            .bind(messageId, analysisId, userId, threadId, sessionId)
            .run();

          console.log(
            `✅ Updated ${files.length} files with messageId: ${messageId}`
          );

          // Save messages as relevant
          console.log("💾 Saving chat messages...");
          await saveMessage(
            env,
            userId,
            threadId,
            "user",
            message ||
              (files.length > 0
                ? `[Uploaded Files: ${files.map((f) => f.fileName).join(", ")}]`
                : ""),
            true, // relevant = true
            analysisId,
            messageId
          );
          await saveMessage(
            env,
            userId,
            threadId,
            "assistant",
            result,
            true, // relevant = true
            analysisId
          );

          console.log("✅ Chat processing completed successfully");
          return Response.json({
            reply: result,
            threadId,
            analysisId,
            messageId
          });
        } else {
          console.log(
            "❌ Content is irrelevant, saving as non-relevant message..."
          );

          // Save the user message as non-relevant
          await saveMessage(
            env,
            userId,
            threadId,
            "user",
            message ||
              (files.length > 0
                ? `[Uploaded Files: ${files.map((f) => f.fileName).join(", ")}]`
                : ""),
            false,
            null,
            messageId
          );

          let reply = "";
          if (files.length > 0 && message.trim()) {
            reply =
              "The uploaded files and message don't appear to be related to cloud cost optimization. Please upload cloud billing files, usage metrics, or ask FinOps-related questions.";
          } else if (files.length > 0) {
            reply =
              "The uploaded files don't appear to be related to cloud cost optimization. Please upload cloud billing files (AWS, Azure, GCP invoices), usage metrics, or infrastructure configuration files.";
          } else {
            reply =
              "I'm specialized in cloud cost optimization and FinOps. Please ask me about cloud billing, cost optimization strategies, usage metrics analysis, or upload relevant cloud infrastructure files.";
          }

          await saveMessage(
            env,
            userId,
            threadId,
            "assistant",
            reply,
            false, // relevant = false
            null
          );

          console.log("❌ Chat processing completed - content was irrelevant");
          return Response.json({ reply, threadId });
        }
      } catch (e) {
        console.error("❌ POST /api/chat failed:", e);
        return Response.json(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }
    }

    // History endpoint with files
    if (url.pathname === "/api/chat/history" && request.method === "GET") {
      console.log("📜 Chat history request");
      const threadId = await getLatestThread(env, "guest");
      if (!threadId) {
        console.log("📜 No thread found, returning empty history");
        return Response.json({ messages: [] });
      }

      console.log(`📜 Loading history for thread: ${threadId}`);
      const messagesWithFiles = await getThreadMessagesWithFiles(
        env,
        "guest",
        threadId
      );

      console.log(`📜 Found ${messagesWithFiles.length} messages with files`);

      // Generate download URLs for files
      const messages = await Promise.all(
        messagesWithFiles.map(async (msg) => {
          const filesWithUrls = await Promise.all(
            msg.files.map(async (file) => ({
              ...file,
              downloadUrl: await getFileDownloadUrl(env, file.r2Key)
            }))
          );

          return {
            role: msg.role,
            text: msg.content,
            files: filesWithUrls,
            messageId: msg.messageId
          };
        })
      );

      console.log("✅ History loaded successfully");
      return Response.json({ messages });
    }

    // List threads
    if (url.pathname === "/api/chat/list" && request.method === "GET") {
      console.log("📋 Thread list request");
      const threads = await listThreads(env, userId);
      console.log(`📋 Found ${threads.length} threads`);
      return Response.json({ threads });
    }

    // Summarize a thread
    if (url.pathname === "/api/chat/summarize" && request.method === "POST") {
      console.log("📝 Thread summarize request");
      const { threadId } = (await request.json()) as { threadId?: string };
      if (!threadId) {
        console.log("❌ No threadId provided for summarization");
        return Response.json(
          { error: "threadId is required" },
          { status: 400 }
        );
      }

      console.log(`📝 Summarizing thread: ${threadId}`);
      const full = await getFullThreadText(env, userId, threadId);
      console.log(`📝 Thread content length: ${full.length} chars`);

      const out = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          {
            role: "system",
            content: "You summarize FinOps chats into crisp bullet points."
          },
          {
            role: "user",
            content: `Summarize key spend drivers and actions:\n${full}`
          }
        ],
        temperature: 0.4,
        max_tokens: 600
      });

      const summary = (out as AiRunOut)?.response ?? "";
      console.log(`✅ Summary generated: ${summary.length} chars`);
      return Response.json({ summary });
    }

    // Get messages for a specific thread
    if (
      url.pathname.startsWith("/api/chat/threads/") &&
      url.pathname.endsWith("/messages") &&
      request.method === "GET"
    ) {
      const pathParts = url.pathname.split("/");
      const threadId = pathParts[pathParts.length - 2];

      console.log(`📜 Loading messages for thread: ${threadId}`);

      if (!threadId) {
        return Response.json({ error: "Thread ID required" }, { status: 400 });
      }

      try {
        const messagesWithFiles = await getThreadMessagesWithFiles(
          env,
          "guest",
          threadId
        );

        // Generate download URLs for files
        const messages = await Promise.all(
          messagesWithFiles.map(async (msg) => {
            const filesWithUrls = await Promise.all(
              msg.files.map(async (file) => ({
                ...file,
                downloadUrl: await getFileDownloadUrl(env, file.r2Key)
              }))
            );

            return {
              role: msg.role,
              text: msg.content,
              files: filesWithUrls,
              messageId: msg.messageId,
              timestamp: msg.createdAt
            };
          })
        );

        console.log(
          `✅ Loaded ${messages.length} messages for thread: ${threadId}`
        );
        return Response.json({ messages });
      } catch (error) {
        console.error("❌ Failed to load thread messages:", error);
        return Response.json(
          { error: "Failed to load messages" },
          { status: 500 }
        );
      }
    }

    // Delete a thread
    if (
      url.pathname.startsWith("/api/chat/threads/") &&
      request.method === "DELETE"
    ) {
      const threadId = url.pathname.split("/").pop()!;
      console.log(`🗑️ Delete thread request: ${threadId}`);
      await deleteThread(env, userId, threadId);
      console.log(`✅ Thread deleted: ${threadId}`);
      return Response.json({ success: true });
    }

    // Debug endpoint to check R2 files
    if (url.pathname === "/api/debug/files" && request.method === "GET") {
      console.log("🐛 Debug files request");
      try {
        const objects = await env.FILES.list();
        const fileList = objects.objects.map((obj) => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded
        }));

        const { results } = await env.DB.prepare(
          "SELECT * FROM uploaded_files ORDER BY uploadedAt DESC LIMIT 10"
        ).all();

        console.log(
          `🐛 R2 Files: ${fileList.length}, DB Files: ${results?.length || 0}`
        );

        return Response.json({
          r2Files: fileList,
          databaseFiles: results || [],
          r2Bucket: "cloud-finops-files",
          totalStorage:
            objects.objects.reduce((sum, obj) => sum + obj.size, 0) + " bytes"
        });
      } catch (error) {
        console.error("❌ Debug failed:", error);
        return Response.json(
          { error: "Debug failed: " + error },
          { status: 500 }
        );
      }
    }

    // Agent routes
    console.log("🤖 Checking agent routes...");
    const maybe = await routeAgentRequest(request, env);
    if (maybe) {
      console.log("✅ Request handled by agent routes");
      return maybe;
    }

    // Fallback to static assets
    console.log("📁 Falling back to static assets");
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
