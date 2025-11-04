export interface UploadedFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  r2Key: string;
  uploadedAt: string;
  downloadUrl?: string;
}

export async function storeFileInR2(
  env: Env,
  file: File,
  userId: string,
  threadId: string
): Promise<string> {
  if (!env.FILES) {
    throw new Error("FILES_BUCKET is not configured");
  }

  const fileId = crypto.randomUUID();
  const fileExtension = file.name.split(".").pop() || "bin";
  const r2Key = `${userId}/${threadId}/${fileId}.${fileExtension}`;

  try {
    await env.FILES.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      }
    });

    return r2Key;
  } catch (error) {
    console.error("R2 put error:", error);
    throw new Error(`Failed to store file in R2: ${error}`);
  }
}

export async function getFileDownloadUrl(
  _env: Env,
  r2Key: string
): Promise<string> {
  return `/api/files/${r2Key}`;
}

export async function saveFileMetadata(
  env: Env,
  userId: string,
  threadId: string,
  sessionId: string,
  analysisId: number | null,
  fileName: string,
  fileType: string,
  fileSize: number,
  r2Key: string
): Promise<number> {
  const { meta } = await env.DB.prepare(
    `INSERT INTO uploaded_files (userId, threadId, messageId, analysisId, fileName, fileType, fileSize, r2Key, uploadedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      userId,
      threadId,
      sessionId,
      analysisId,
      fileName,
      fileType,
      fileSize,
      r2Key
    )
    .run();

  return (meta as { last_row_id?: number }).last_row_id ?? 0;
}

export async function getMessageFiles(
  env: Env,
  messageId: string
): Promise<UploadedFile[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, fileName, fileType, fileSize, r2Key, uploadedAt 
     FROM uploaded_files 
     WHERE messageId = ?
     ORDER BY uploadedAt ASC`
  )
    .bind(messageId)
    .all();

  // Safe type assertion
  const resultsArray = results as unknown as {
    id: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    r2Key: string;
    uploadedAt: string;
  }[];

  return resultsArray.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize: row.fileSize,
    r2Key: row.r2Key,
    uploadedAt: row.uploadedAt
  }));
}
