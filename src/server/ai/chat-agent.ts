import { google } from "@ai-sdk/google";
import type { Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { getSchedulePrompt } from "agents/schedule";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type StreamTextOnFinishCallback,
  stepCountIs,
  streamText,
  type ToolSet
} from "ai";
import { cleanupMessages, processToolCalls } from "../utils/message-utils";

const model = google("gemini-2.5-flash");

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    console.log("Chat agent processing message...");
    const tools: ToolSet = {};
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        console.log("Starting message stream execution...");
        const cleaned = cleanupMessages(this.messages);
        console.log(`Cleaned ${cleaned.length} messages`);

        const processed = await processToolCalls({
          messages: cleaned,
          dataStream: writer,
          tools,
          executions: {}
        });

        console.log("Starting AI stream text generation...");
        const result = streamText({
          system: `You are a helpful FinOps assistant. ${getSchedulePrompt({ date: new Date() })}`,
          messages: convertToModelMessages(processed),
          model,
          tools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof tools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
        console.log("✅ Message stream execution completed");
      }
    });
    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string, _task: Schedule<string>) {
    console.log(`Executing scheduled task: ${description}`);
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
    console.log("✅ Scheduled task completed");
  }
}
