import { type UploadedFile } from "../storage/file-storage";
export interface Thread {
  threadId: string;
  title: string;
  createdAt: string;
  msgCount?: number;
}

export interface MessageWithFiles {
  role: string;
  content: string;
  relevant: boolean;
  messageId: string;
  files: UploadedFile[];
  createdAt: string;
}

export async function createThread(env: Env, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO conversations (threadId, userId, title, createdAt)
     VALUES (?, ?, ?, datetime('now'))`
  )
    .bind(id, userId, "New Conversation")
    .run();
  return id;
}

export async function getLatestThread(
  env: Env,
  userId: string
): Promise<string | null> {
  const { results } = await env.DB.prepare(
    `SELECT threadId FROM conversations
     WHERE userId = ?
     ORDER BY datetime(createdAt) DESC
     LIMIT 1`
  )
    .bind(userId)
    .all();

  const row = results?.[0] as { threadId?: string } | undefined;
  return row?.threadId ?? null;
}

export async function saveMessage(
  env: Env,
  userId: string,
  threadId: string,
  role: "user" | "assistant",
  content: string,
  relevant: boolean,
  analysisId?: number | null,
  messageId?: string
): Promise<string> {
  const msgId = messageId || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO messages (userId, threadId, role, content, relevant, analysisId, messageId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      userId,
      threadId,
      role,
      content,
      relevant ? 1 : 0,
      analysisId ?? null,
      msgId
    )
    .run();

  return msgId;
}

export async function getThreadMessagesWithFiles(
  env: Env,
  userId: string,
  threadId: string
): Promise<MessageWithFiles[]> {
  const { results: messages } = await env.DB.prepare(
    `SELECT role, content, relevant, messageId, createdAt FROM messages
     WHERE userId = ? AND threadId = ?
     ORDER BY datetime(createdAt) ASC`
  )
    .bind(userId, threadId)
    .all();

  const { results: files } = await env.DB.prepare(
    `SELECT id, fileName, fileType, fileSize, r2Key, uploadedAt, messageId 
     FROM uploaded_files 
     WHERE userId = ? AND threadId = ?
     ORDER BY uploadedAt ASC`
  )
    .bind(userId, threadId)
    .all();

  const filesByMessage = (files as any[]).reduce((acc, file) => {
    if (file.messageId) {
      if (!acc[file.messageId]) {
        acc[file.messageId] = [];
      }
      acc[file.messageId].push({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        r2Key: file.r2Key,
        uploadedAt: file.uploadedAt
      });
    }
    return acc;
  }, {});

  return (messages as any[]).map((msg) => ({
    role: msg.role,
    content: msg.content,
    relevant: !!msg.relevant,
    messageId: msg.messageId,
    createdAt: msg.createdAt,
    files: filesByMessage[msg.messageId] || []
  }));
}

export async function saveAnalysis(
  env: Env,
  userId: string,
  threadId: string | null,
  plan: string,
  metrics: string,
  comment: string,
  result: string
): Promise<number> {
  const { meta } = await env.DB.prepare(
    `INSERT INTO analyses (userId, threadId, plan, metrics, comment, result, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(userId, threadId, plan, metrics, comment, result)
    .run();

  const insertedId = (meta as { last_row_id?: number }).last_row_id ?? 0;
  return insertedId;
}

export async function listThreads(env: Env, userId: string): Promise<Thread[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.threadId, c.title, c.createdAt,
       (SELECT COUNT(*) FROM messages m WHERE m.threadId = c.threadId) AS msgCount
     FROM conversations c
     WHERE c.userId = ? 
     AND EXISTS (SELECT 1 FROM messages m WHERE m.threadId = c.threadId)
     ORDER BY datetime(c.createdAt) DESC`
  )
    .bind(userId)
    .all();

  return ((results as any[]) ?? []).map((r) => ({
    threadId: r.threadId,
    title: r.title,
    createdAt: r.createdAt,
    msgCount: Number(r.msgCount ?? 0)
  }));
}

export async function getLatestAnalysis(
  env: Env,
  userId: string,
  threadId: string
) {
  const { results } = await env.DB.prepare(
    `SELECT id, result, createdAt FROM analyses
     WHERE userId = ? AND threadId = ?
     ORDER BY datetime(createdAt) DESC
     LIMIT 1`
  )
    .bind(userId, threadId)
    .all();

  return (
    (results?.[0] as { id: number; result: string; createdAt: string }) || null
  );
}

export async function getFullThreadText(
  env: Env,
  userId: string,
  threadId: string
): Promise<string> {
  const { results } = await env.DB.prepare(
    `SELECT role, content FROM messages
     WHERE userId = ? AND threadId = ?
     ORDER BY datetime(createdAt) ASC`
  )
    .bind(userId, threadId)
    .all();

  const rows =
    (results as { role: string; content: string }[] | undefined) ?? [];
  if (!rows.length) return "No messages.";
  return rows.map((r) => `${r.role}: ${r.content}`).join("\n");
}

export async function deleteThread(
  env: Env,
  userId: string,
  threadId: string
): Promise<void> {
  await env.DB.prepare(`DELETE FROM uploaded_files WHERE threadId = ?`)
    .bind(threadId)
    .run();
  await env.DB.prepare(`DELETE FROM messages WHERE threadId = ?`)
    .bind(threadId)
    .run();
  await env.DB.prepare(`DELETE FROM analyses WHERE threadId = ?`)
    .bind(threadId)
    .run();
  await env.DB.prepare(
    `DELETE FROM conversations WHERE threadId = ? AND userId = ?`
  )
    .bind(threadId, userId)
    .run();
}
