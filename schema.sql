-- Persisted memory of analyses
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  plan TEXT NOT NULL,
  metrics TEXT NOT NULL,
  comment TEXT,
  result TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple index for recency queries
CREATE INDEX IF NOT EXISTS idx_analyses_user_created
ON analyses (userId, createdAt DESC);
