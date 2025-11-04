import { getFullThreadText } from "../../db/d1";

type AiRunOut = { response?: string };

export async function aiRoutes(
  request: Request,
  env: Env,
  userId: string
): Promise<Response | null> {
  const url = new URL(request.url);

  // Summarize a thread
  if (url.pathname === "/api/chat/summarize" && request.method === "POST") {
    return await handleThreadSummarize(request, env, userId);
  }

  // Debug endpoint to check R2 files
  if (url.pathname === "/api/debug/files" && request.method === "GET") {
    return await handleDebugFiles(request, env);
  }

  return null;
}

async function handleThreadSummarize(request: Request, env: Env, userId: string): Promise<Response> {
  console.log("📝 Thread summarize request");
  const { threadId } = (await request.json()) as { threadId?: string };
  if (!threadId) {
    console.log("❌ No threadId provided for summarization");
    return Response.json({ error: "threadId is required" }, { status: 400 });
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

async function handleDebugFiles(request: Request, env: Env): Promise<Response> {
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

    console.log(`🐛 R2 Files: ${fileList.length}, DB Files: ${results?.length || 0}`);

    return Response.json({
      r2Files: fileList,
      databaseFiles: results || [],
      r2Bucket: "cloud-finops-files",
      totalStorage: objects.objects.reduce((sum, obj) => sum + obj.size, 0) + " bytes"
    });
  } catch (error) {
    console.error("❌ Debug failed:", error);
    return Response.json({ error: "Debug failed: " + error }, { status: 500 });
  }
}