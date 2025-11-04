export async function saveAnalysis(
  env: Env,
  params: {
    userId: string;
    plan: string;
    metrics: string;
    comment?: string;
    result: string;
  }
) {
  const { userId, plan, metrics, comment, result } = params;
  await env.DB.prepare(
    `INSERT INTO analyses (userId, plan, metrics, comment, result)
       VALUES (?, ?, ?, ?, ?)`
  )
    .bind(userId, plan, metrics, comment ?? null, result)
    .run();
}

export async function listAnalyses(env: Env, userId: string, limit = 10) {
  const { results } = await env.DB.prepare(
    `SELECT id, plan, metrics, comment, result, createdAt
       FROM analyses
       WHERE userId = ?
       ORDER BY datetime(createdAt) DESC
       LIMIT ?`
  )
    .bind(userId, limit)
    .all();

  return results as Array<{
    id: number;
    plan: string;
    metrics: string;
    comment: string | null;
    result: string;
    createdAt: string;
  }>;
}

export async function latestAnalysis(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, plan, metrics, comment, result, createdAt
       FROM analyses
       WHERE userId = ?
       ORDER BY datetime(createdAt) DESC
       LIMIT 1`
  )
    .bind(userId)
    .all();

  return results?.[0] ?? null;
}
