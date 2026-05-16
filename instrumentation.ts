/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server starts.
 *
 * Creates the .z-ai-config file from environment variables if they are set.
 * This allows the z-ai-web-dev-sdk to work on Railway/production without
 * manually creating the config file.
 */
export async function register() {
  // Only run on the server side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const zaiBaseUrl = process.env.ZAI_BASE_URL;
    const zaiApiKey = process.env.ZAI_API_KEY;

    if (zaiBaseUrl && zaiApiKey) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");

        const configPath = path.join(process.cwd(), ".z-ai-config");

        const config: Record<string, string> = {
          baseUrl: zaiBaseUrl,
          apiKey: zaiApiKey,
        };

        if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
        if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
        if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`[Instrumentation] Created .z-ai-config from environment variables at ${configPath}`);
      } catch (err) {
        console.warn("[Instrumentation] Failed to create .z-ai-config from env vars:", err);
      }
    } else {
      console.log("[Instrumentation] ZAI_BASE_URL/ZAI_API_KEY not set — z-ai-web-dev-sdk will use existing config file if available");
    }
  }
}
