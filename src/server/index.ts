import { routeAgentRequest } from "agents";
import { chatRoutes } from "./api/chat/routes";
import { fileRoutes } from "./api/files/routes";
import { aiRoutes } from "./api/ai/routes";
import { Chat } from "./ai/chat-agent";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = "guest";

    console.log(
      `🌐 ${request.method} ${url.pathname} - Starting request processing`
    );

    // Serve static assets
    if (url.pathname === "/" || url.pathname.startsWith("/assets")) {
      console.log("📁 Serving static assets");
      return env.ASSETS.fetch(request);
    }

    // API Routes
    const chatResponse = await chatRoutes(request, env, userId);
    if (chatResponse) return chatResponse;

    const fileResponse = await fileRoutes(request, env, userId);
    if (fileResponse) return fileResponse;

    const aiResponse = await aiRoutes(request, env, userId);
    if (aiResponse) return aiResponse;

    // Agent routes
    console.log("🤖 Checking agent routes...");
    const maybe = await routeAgentRequest(request, env);
    if (maybe) {
      console.log("✅ Request handled by agent routes");
      return maybe;
    }

    // Fallback to static assets
    console.log("📁 Falling back to static assets");
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;

export { Chat };
