import OpenAI from "openai";

function buildPrompt(plan: string, metrics: string, comment: string) {
  return `You are a cloud cost optimization expert.

PLAN / BILLING DATA:
${plan}

USAGE METRICS:
${metrics}

COMMENT:
${comment}

TASKS:
1) Identify inefficiencies and expensive resources.
2) Suggest optimizations in the current provider (AWS/GCP/DO/etc.).
3) Propose Cloudflare alternatives (Workers, R2, KV, D1, Queues, CDN) when suitable.
4) Return:
   (A) Plain-English summary
   (B) JSON array in triple backticks. Each item: { "Area", "Resource", "Issue", "Optimization", "Cloudflare_Alternative", "Estimated_Savings" }.

Use concise, practical recommendations.
`;
}

export async function analyzeCostsWithLLM(
  env: Env,
  plan: string,
  metrics: string,
  comment: string
): Promise<string> {
  const prompt = buildPrompt(plan, metrics, comment);

  // ✅ Try Workers AI first (recommended by Cloudflare)
  try {
    const aiResp = await env.AI.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      {
        messages: [{ role: "user", content: prompt }]
      }
    );

    // env.AI.run can return string or object; normalize to string
    if (typeof aiResp === "string") return aiResp;
    if ((aiResp as any)?.response) return (aiResp as any).response;
    return JSON.stringify(aiResp);
  } catch (e) {
    console.warn("Workers AI failed, falling back to Gemini:", e);
  }

  // 🔁 Fallback to Gemini (OpenAI-compatible endpoint)
  const client = new OpenAI({
    apiKey: env.GOOGLE_GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
  });

  const resp = await client.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant for cloud cost optimization."
      },
      { role: "user", content: prompt }
    ]
  });

  const out = resp.choices?.[0]?.message?.content;
  if (!out) throw new Error("No response from Gemini");
  return out;
}

// import OpenAI from "openai";

// export async function analyzeCostsWithGemini(
//   env: Env,
//   plan: string,
//   metrics: string,
//   comment: string
// ): Promise<string> {
//   const ai = new OpenAI({
//     apiKey: env.GOOGLE_GEMINI_API_KEY,
//     baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
//   });

//   const prompt = `
// You are a cloud cost optimization expert.

// PLAN / BILLING DATA:
// ${plan}

// USAGE METRICS:
// ${metrics}

// COMMENT:
// ${comment}

// TASKS:
// 1. Identify inefficiencies and expensive resources.
// 2. Suggest optimizations in the current provider.
// 3. Propose Cloudflare alternatives (Workers, R2, KV, D1).
// 4. Return (A) plain-English summary and (B) JSON array in triple backticks.
// `;
//   console.log(prompt);

//   try {
//     const response = await ai.chat.completions.create({
//       model: "gemini-2.0-flash",
//       messages: [
//         { role: "system", content: "You are a helpful assistant..." },
//         { role: "user", content: prompt }
//       ]
//     });

//     console.log(response);

//     // Extract the content safely
//     const messageContent = response.choices[0]?.message?.content;

//     if (!messageContent) {
//       throw new Error("No response content from Gemini");
//     }

//     return messageContent;
//   } catch (error) {
//     console.error("Error calling Gemini:", error);
//     throw new Error(`Failed to analyze costs: ${error instanceof Error ? error.message : 'Unknown error'}`);
//   }
// }
