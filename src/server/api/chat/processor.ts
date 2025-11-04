import { saveMessage, saveAnalysis } from "../../db/d1";
import { analyzeCostsWithGemini } from "../../ai/optimizer";
import { getRelevantContext, isRelevant } from "../../utils/context";

export async function processChatMessage(
  env: Env,
  userId: string,
  threadId: string,
  message: string,
  fileIds: number[],
  sessionId: string
): Promise<Response> {
  const messageId = crypto.randomUUID();
  let analysisId: number | null = null;

  console.log("🔍 Retrieving files for session...");

  // Get all files for this session
  let filesQuery = "";
  const queryParams: (string | number)[] = [userId, threadId];

  if (fileIds.length > 0) {
    filesQuery = `AND id IN (${fileIds.map(() => "?").join(",")})`;
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

  const files = (
    filesResult as {
      id: number;
      fileName: string;
      fileType: string;
      fileSize: number;
      r2Key: string;
      uploadedAt: string;
    }[]
  ).map((file) => ({
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
      console.log(`📄 Read file: ${file.fileName} (${content.length} chars)`);

      // Add file content to relevance check (first 1000 chars to avoid token limits)
      fileContents += `Content preview: ${content.substring(0, 1000)}\n\n`;

      if (file.fileName.includes("plan") || file.fileName.includes("billing")) {
        planText = content;
        console.log(`📊 Identified as plan/billing file: ${file.fileName}`);
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
    const relevantContext = await getRelevantContext(env, userId, threadId);
    console.log(
      `📚 Retrieved ${relevantContext.length > 0 ? "relevant context" : "no relevant context"}`
    );

    console.log("🤖 Starting AI analysis...");
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
      true,
      analysisId,
      messageId
    );
    await saveMessage(
      env,
      userId,
      threadId,
      "assistant",
      result,
      true,
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
    console.log("❌ Content is irrelevant, saving as non-relevant message...");

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

    await saveMessage(env, userId, threadId, "assistant", reply, false, null);

    console.log("❌ Chat processing completed - content was irrelevant");
    return Response.json({ reply, threadId });
  }
}
