import { createThread, getLatestThread } from "../../db/d1";
import {
  getFileDownloadUrl,
  saveFileMetadata,
  storeFileInR2
} from "../../storage/file-storage";

export async function fileRoutes(
  request: Request,
  env: Env,
  userId: string
): Promise<Response | null> {
  const url = new URL(request.url);

  // File download endpoint
  if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
    return await handleFileDownload(request, env);
  }

  // File upload endpoint
  if (url.pathname === "/api/files/upload" && request.method === "POST") {
    return await handleFileUpload(request, env, userId);
  }

  // File delete endpoint
  if (url.pathname.startsWith("/api/files/") && request.method === "DELETE") {
    return await handleFileDelete(request, env);
  }

  return null;
}

async function handleFileDownload(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const r2Key = decodeURIComponent(url.pathname.replace("/api/files/", ""));
    console.log(`File download requested for key: ${r2Key}`);

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

async function handleFileUpload(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  console.log("File upload request received");
  try {
    const url = new URL(request.url);
    const threadIdFromQuery = url.searchParams.get("threadId");
    const threadId =
      threadIdFromQuery ||
      (await getLatestThread(env, userId)) ||
      (await createThread(env, userId));

    console.log(`Storing file in R2 for thread: ${threadId}`);

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("fileType") as string;
    const sessionId = formData.get("sessionId") as string;

    console.log(
      `File upload details - Name: ${file?.name}, Type: ${fileType}, Size: ${file?.size} bytes, Session: ${sessionId}`
    );

    if (!file) {
      console.log("❌ No file provided in upload");
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!sessionId) {
      console.log("❌ No session ID provided in upload");
      return Response.json({ error: "Session ID required" }, { status: 400 });
    }

    // Check if file is too large (optional: 10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log(`❌ File too large: ${file.size} bytes (max: ${maxSize})`);
      return Response.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

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
    console.log("Saving file metadata to database...");
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

    const uploadedFile = {
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

async function handleFileDelete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const fileId = url.pathname.split("/").pop();
  console.log(`File delete requested for ID: ${fileId}`);

  try {
    const pathParts = url.pathname.split("/");
    const fileId = pathParts[pathParts.length - 1];

    if (!fileId || Number.isNaN(Number(fileId))) {
      return new Response(JSON.stringify({ error: "Invalid file ID" }), {
        status: 400
      });
    }

    console.log(`Deleting file with ID: ${fileId}`);

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
    return Response.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
