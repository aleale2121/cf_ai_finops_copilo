type AiRunOut = { response?: string };

export async function getRelevantContext(
  env: Env,
  userId: string,
  threadId: string
): Promise<string> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT role, content FROM messages 
       WHERE userId = ? AND threadId = ? AND relevant = 1
       ORDER BY datetime(createdAt) ASC
       LIMIT 10`
    )
      .bind(userId, threadId)
      .all();

    if (!results || results.length === 0) {
      return "";
    }

    const contextMessages = (results as { role: string; content: string }[])
      .map((msg) => `${msg.role}: ${msg.content.substring(0, 500)}`)
      .join("\n");

    return `Previous relevant context:\n${contextMessages}\n\n`;
  } catch (error) {
    console.error("Error fetching relevant context:", error);
    return "";
  }
}

export async function isRelevant(env: Env, text: string): Promise<boolean> {
  console.log("Starting relevance check...");
  if (!text || !text.trim()) {
    console.log("❌ Relevance check: Empty text, returning false");
    return false;
  }

  const cloudKeywords = [
    "aws",
    "azure",
    "gcp",
    "cloud",
    "billing",
    "invoice",
    "cost",
    "usage",
    "metrics",
    "ec2",
    "s3",
    "lambda",
    "rds",
    "vm",
    "storage",
    "compute",
    "network",
    "bandwidth",
    "spend",
    "plan",
    "pricing",
    "reserved",
    "spot",
    "ondemand",
    "csv",
    "json",
    "xlsx",
    "xls",
    "txt",
    "log",
    "pdf"
  ];

  const lowerText = text.toLowerCase();
  const hasCloudKeywords = cloudKeywords.some((keyword) =>
    lowerText.includes(keyword)
  );

  if (hasCloudKeywords) {
    console.log("✅ Relevance: Found cloud keywords, returning true");
    const foundKeywords = cloudKeywords.filter((keyword) =>
      lowerText.includes(keyword)
    );
    console.log(`Found keywords: ${foundKeywords.join(", ")}`);
    return true;
  }

  console.log("No obvious keywords found, using AI for relevance check...");

  try {
    const res = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        {
          role: "system",
          content: `You are a cloud cost optimization expert. Analyze if the provided text is related to CLOUD COST OPTIMIZATION, CLOUD BILLING, or CLOUD INFRASTRUCTURE.
          
          Consider these as RELEVANT:
          - Cloud provider bills (AWS, Azure, GCP, etc.)
          - Usage metrics and cost reports
          - Infrastructure as code files
          - Cloud resource configurations
          - Cost optimization discussions
          - Billing and spending analysis
          - Any file uploads with cloud context
          
          Consider these as IRRELEVANT:
          - Personal documents
          - Code files without cloud context
          - General IT infrastructure not cloud-specific
          - Off-topic conversations
          
          Be PERMISSIVE - if there's any chance it's cloud-related, say YES.
          Respond with only "YES" or "NO".`
        },
        {
          role: "user",
          content: `Is this text about cloud cost optimization, cloud billing, or cloud infrastructure?\n\n${text.substring(0, 2000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const answer = (res as AiRunOut)?.response?.trim().toUpperCase() || "";
    console.log(`AI Relevance check result: "${answer}"`);
    const result = answer.startsWith("Y");
    console.log(
      `Relevance final decision: ${result ? "RELEVANT" : "IRRELEVANT"}`
    );
    return result;
  } catch (error) {
    console.error("❌ Relevance check failed, defaulting to true:", error);
    return true;
  }
}
