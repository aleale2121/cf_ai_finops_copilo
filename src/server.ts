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
import { tools, executions } from "./tools";
import { analyzeCostsWithLLM } from "./optimizer";
import { saveAnalysis, listAnalyses, latestAnalysis } from "./memory";

const model = google("gemini-2.5-flash");

// (Optional) DO Chat agent remains for orchestration / workflows
export class Chat extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    const allTools = { ...tools, ...this.mcp.getAITools() };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleaned = cleanupMessages(this.messages);
        const processed = await processToolCalls({
          messages: cleaned,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful assistant that can do various tasks...

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool.`,
          messages: convertToModelMessages(processed),
          model,
          tools: allTools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string, _task: Schedule<string>) {
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
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    const method = request.method;
    const userId = "default-user"; // replace with auth/session if you add it

    // ✅ UI (built assets)
    if (url.pathname === "/" || url.pathname.startsWith("/assets")) {
      return env.ASSETS.fetch(request);
    }

    // ✅ Analyze (POST): run LLM + save to D1
    if (url.pathname === "/api/tools/analyzeCosts" && method === "POST") {
      try {
        const body = (await request.json()) as {
          plan: string;
          metrics: string;
          comment?: string;
        };
        const { plan, metrics, comment = "" } = body;

        if (!plan || !metrics) {
          return Response.json(
            { error: "plan and metrics are required" },
            { status: 400 }
          );
        }

        const suggestion = await analyzeCostsWithLLM(
          env,
          plan,
          metrics,
          comment
        );

        // ✅ persist
        await saveAnalysis(env, {
          userId,
          plan,
          metrics,
          comment,
          result: suggestion
        });

        return Response.json({ suggestion });
      } catch (err) {
        console.error("analyzeCosts error:", err);
        return Response.json({ error: "Analysis failed" }, { status: 500 });
      }
    }

    // ✅ History (list last N)
    if (url.pathname === "/api/history" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "10");
      const rows = await listAnalyses(
        env,
        userId,
        Math.max(1, Math.min(limit, 50))
      );
      return Response.json({ rows });
    }

    // ✅ Latest
    if (url.pathname === "/api/history/latest" && method === "GET") {
      const row = await latestAnalysis(env, userId);
      return Response.json({ row });
    }

    // Health
    if (url.pathname === "/check-gemini-key") {
      return Response.json({ success: !!env.GOOGLE_GEMINI_API_KEY });
    }

    // Fallback: route agent or serve UI
    return (
      (await routeAgentRequest(request, env)) ||
      env.ASSETS.fetch(request) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
