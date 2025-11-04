-- Conversations (threads)
CREATE TABLE IF NOT EXISTS conversations (
  threadId TEXT PRIMARY KEY,
  userId   TEXT NOT NULL,
  title    TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages in a thread
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  userId     TEXT NOT NULL,
  threadId   TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  relevant   INTEGER NOT NULL DEFAULT 0,
  analysisId INTEGER,
  messageId  TEXT NOT NULL,
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (threadId) REFERENCES conversations(threadId)
);

-- Persisted cost analyses (final result blob)
CREATE TABLE IF NOT EXISTS analyses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  userId    TEXT NOT NULL,
  threadId  TEXT,
  plan      TEXT NOT NULL,
  metrics   TEXT NOT NULL,
  comment   TEXT,
  result    TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (threadId) REFERENCES conversations(threadId)
);

-- File storage table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  sessionId TEXT NOT NULL, 
  messageId TEXT NOT NULL, 
  analysisId INTEGER,
  fileName TEXT NOT NULL,
  fileType TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  r2Key TEXT NOT NULL UNIQUE,
  uploadedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (threadId) REFERENCES conversations(threadId),
  FOREIGN KEY (analysisId) REFERENCES analyses(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conv_user_created ON conversations (userId, datetime(createdAt) DESC);
CREATE INDEX IF NOT EXISTS idx_msg_thread_created ON messages (threadId, datetime(createdAt) ASC);
CREATE INDEX IF NOT EXISTS idx_msg_messageId ON messages (messageId);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses (userId, datetime(createdAt) DESC);
CREATE INDEX IF NOT EXISTS idx_files_user_thread ON uploaded_files(userId, threadId);
CREATE INDEX IF NOT EXISTS idx_files_message ON uploaded_files(messageId);
CREATE INDEX IF NOT EXISTS idx_files_analysis ON uploaded_files(analysisId);
CREATE INDEX IF NOT EXISTS idx_files_session ON uploaded_files(sessionId); 