import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "../../ai/chat-agent";
import { getCurrentAgent } from "agents";
import { analyzeCostsWithGemini } from "../../ai/optimizer";

const analyzeCosts = tool({
  description: "Analyze a cloud plan + usage metrics and suggest optimizations",
  inputSchema: z.object({
    plan: z.string(),
    metrics: z.string(),
    comment: z.string().optional()
  }),
  execute: async ({ plan, metrics, comment }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = (agent as any).env as Env;
    return await analyzeCostsWithGemini(env, plan, metrics, comment ?? "");
  }
});

export const tools = { analyzeCosts } satisfies ToolSet;
export const executions = {};
