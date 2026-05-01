import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── AI Configuration ──────────────────────────────────────────────────────
// Supports multiple AI backends with automatic fallback:
// 1. ZAI_BASE_URL + ZAI_API_KEY env vars (for z-ai platform or any OpenAI-compatible API)
// 2. OPENAI_API_KEY env var (for OpenAI API)
// 3. z-ai-web-dev-sdk config file (for local development)
// 4. Hardcoded defaults (if available)

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  chatId?: string;
  userId?: string;
  provider: string;
}

function getAIConfig(): AIConfig {
  // Option 1: ZAI environment variables (for any OpenAI-compatible API)
  const zaiBaseUrl = process.env.ZAI_BASE_URL;
  const zaiApiKey = process.env.ZAI_API_KEY;
  if (zaiBaseUrl && zaiApiKey) {
    console.log("[Carousel] Using ZAI config from environment variables");
    return {
      baseUrl: zaiBaseUrl,
      apiKey: zaiApiKey,
      token: process.env.ZAI_TOKEN || undefined,
      chatId: process.env.ZAI_CHAT_ID || undefined,
      userId: process.env.ZAI_USER_ID || undefined,
      provider: "zai",
    };
  }

  // Option 2: OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    console.log("[Carousel] Using OpenAI API");
    return {
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: openaiApiKey,
      provider: "openai",
    };
  }

  // Option 3: Will try z-ai-web-dev-sdk config file later (handled in createZAI())
  // Return null-like to indicate SDK mode should be used
  throw new Error(
    "AI API not configured for carousel generation. Please set either:\n" +
    "- ZAI_BASE_URL + ZAI_API_KEY (for z-ai platform or any OpenAI-compatible API)\n" +
    "- OPENAI_API_KEY (for OpenAI API)\n" +
    "Add these as environment variables on your Railway deployment."
  );
}

// ─── Create ZAI instance from config file (for local development) ──────────
async function createZAIFromConfig() {
  try {
    const zai = await ZAI.create();
    console.log("[Carousel] Using ZAI from .z-ai-config file");
    return zai;
  } catch {
    return null;
  }
}

// ─── Direct OpenAI-compatible chat completion ──────────────────────────────
async function chatCompletionDirect(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; max_tokens?: number }
) {
  const url = `${config.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };

  // Add z-ai specific headers if using z-ai provider
  if (config.provider === "zai") {
    headers["X-Z-AI-From"] = "Z";
    if (config.chatId) headers["X-Chat-Id"] = config.chatId;
    if (config.userId) headers["X-User-Id"] = config.userId;
    if (config.token) headers["X-Token"] = config.token;
  }

  const body: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4000,
  };

  // Add thinking disabled for z-ai
  if (config.provider === "zai") {
    body.thinking = { type: "disabled" };
  }

  console.log(`[Carousel] Calling chat completion at ${url}`);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Chat completion API failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  return await response.json();
}

// ─── Chat completion with fallback to z-ai-web-dev-sdk ─────────────────────
async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; max_tokens?: number }
) {
  // Try environment variables first
  try {
    const config = getAIConfig();
    return await chatCompletionDirect(config, messages, options);
  } catch {
    // Environment variables not set, try z-ai-web-dev-sdk config file
  }

  // Fallback to z-ai-web-dev-sdk
  const zai = await createZAIFromConfig();
  if (zai) {
    const completion = await zai.chat.completions.create({
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4000,
    });
    return completion;
  }

  throw new Error(
    "AI API not configured. Please set ZAI_BASE_URL + ZAI_API_KEY or OPENAI_API_KEY environment variables on your deployment."
  );
}

// ─── Direct OpenAI-compatible image generation ─────────────────────────────
async function imageGenerationDirect(config: AIConfig, prompt: string, size: string = "768x1344") {
  const url = `${config.baseUrl}/images/generations`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };

  if (config.provider === "zai") {
    headers["X-Z-AI-From"] = "Z";
    if (config.chatId) headers["X-Chat-Id"] = config.chatId;
    if (config.userId) headers["X-User-Id"] = config.userId;
    if (config.token) headers["X-Token"] = config.token;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Image generation API failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  return await response.json();
}

// ─── Image generation with fallback to z-ai-web-dev-sdk ────────────────────
async function imageGeneration(prompt: string, size: string = "768x1344") {
  // Try environment variables first
  try {
    const config = getAIConfig();
    return await imageGenerationDirect(config, prompt, size);
  } catch {
    // Environment variables not set, try z-ai-web-dev-sdk config file
  }

  // Fallback to z-ai-web-dev-sdk
  const zai = await createZAIFromConfig();
  if (zai) {
    return await zai.images.generations.create({ prompt, size });
  }

  throw new Error(
    "AI API not configured for image generation. Please set ZAI_BASE_URL + ZAI_API_KEY environment variables."
  );
}

// ─── Poll for kie.ai image result ──────────────────────────────────────────
async function pollKieImage(taskId: string, apiKey: string): Promise<string> {
  const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;

  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollText = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(pollText);
      } catch {
        await sleep(3000);
        continue;
      }

      if (json.code === 200) {
        const d = json.data;
        if (d?.state === "success") {
          let result;
          if (typeof d.resultJson === "string") {
            try {
              result = JSON.parse(d.resultJson);
            } catch {
              result = d.resultJson;
            }
          } else {
            result = d.resultJson;
          }
          const imageUrl = result?.resultUrls?.[0] || result?.result_url || result?.url;
          if (imageUrl) return imageUrl;
          throw new Error("Image ready but no URL found");
        }
        if (d?.state === "fail") {
          throw new Error("Image generation failed: " + (d?.failMsg || "unknown error"));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Image generation failed") || msg.includes("no URL")) throw err;
    }
    await sleep(3000);
  }
  throw new Error("Image generation timed out after 6 minutes");
}

// ─── Generate a single carousel slide image via kie.ai ─────────────────────
async function generateSlideImageKie(
  imagePrompt: string,
  apiKey: string,
  slideIndex: number,
  totalSlides: number
): Promise<string> {
  const submitRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana-2",
      input: {
        prompt: imagePrompt,
        image_size: "1024x1792",
      },
    }),
  });

  const submitText = await submitRes.text();
  let submitJson: Record<string, unknown>;
  try {
    submitJson = JSON.parse(submitText);
  } catch {
    throw new Error("kie.ai API returned non-JSON: " + submitText.slice(0, 200));
  }

  if (submitJson.code !== 200) {
    throw new Error(
      "Failed to submit image for slide " + (slideIndex + 1) + ": " + (submitJson.msg || submitText.slice(0, 200))
    );
  }

  const taskId = submitJson.data?.taskId;
  if (!taskId) {
    throw new Error("No taskId returned for slide " + (slideIndex + 1));
  }

  console.log(`[Carousel] Slide ${slideIndex + 1}/${totalSlides}: kie.ai task ${taskId} submitted, polling...`);
  const imageUrl = await pollKieImage(taskId, apiKey);
  console.log(`[Carousel] Slide ${slideIndex + 1}/${totalSlides}: kie.ai image ready!`);
  return imageUrl;
}

// ─── Generate carousel slide content with AI ───────────────────────────────
async function generateSlideContent(
  idea: string,
  numSlides: number,
  language: string
): Promise<Array<{ slideNumber: number; title: string; body: string; imagePrompt: string }>> {
  const langInstruction = language === "ar"
    ? "Write ALL slide content in Arabic. Titles, body text, and image prompts should be in Arabic."
    : language === "fr"
    ? "Write ALL slide content in French."
    : "Write ALL slide content in English.";

  const completion = await chatCompletion([
    {
      role: "system",
      content: `You are an expert social media carousel creator. You create viral, engaging carousel posts for Instagram and LinkedIn.
${langInstruction}

Your output MUST be a valid JSON array. Each element represents one slide with this exact structure:
[
  {
    "slideNumber": 1,
    "title": "Short catchy title (max 8 words)",
    "body": "Main text content for this slide (2-3 short sentences, max 120 characters)",
    "imagePrompt": "Detailed image generation prompt describing a visually stunning image that represents this slide's topic. Be specific about style, colors, mood, and composition."
  }
]

Rules:
- First slide MUST be a bold hook/cover slide
- Middle slides deliver the main content/tips/value
- Last slide MUST be a strong CTA (call to action)
- Image prompts should describe professional social media graphics with modern design
- Keep titles punchy and memorable
- Body text should be concise and impactful
- Each slide should work as a standalone visual on social media

Return ONLY the JSON array, no extra text.`,
    },
    {
      role: "user",
      content: `Create a ${numSlides}-slide carousel about: "${idea}"`,
    },
  ], {
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = completion.choices?.[0]?.message?.content || "";
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI failed to generate valid carousel content. Response: " + content.slice(0, 300));
  }

  const slides = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("AI returned empty carousel content");
  }

  // Ensure slides have the correct fields
  return slides.map((slide: Record<string, unknown>, i: number) => ({
    slideNumber: (slide.slideNumber as number) || i + 1,
    title: (slide.title as string) || `Slide ${i + 1}`,
    body: (slide.body as string) || "",
    imagePrompt: (slide.imagePrompt as string) || `Professional social media carousel slide about ${idea}`,
  }));
}

// ─── Generate slide image using built-in AI API ──────────────────────────
async function generateSlideImageBuiltIn(prompt: string, slideIdx: number, total: number): Promise<string> {
  const response = await imageGeneration(prompt, "768x1344");
  const base64 = response.data?.[0]?.base64;
  if (!base64) {
    // Some APIs return a URL instead of base64
    const imageUrl = response.data?.[0]?.url;
    if (imageUrl) return imageUrl;
    throw new Error("No image data returned from AI API");
  }
  // Convert base64 to data URL
  return `data:image/png;base64,${base64}`;
}

// ─── POST /api/generate-carousel ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { idea, kieApiKey, numSlides = 5, language = "en" } = body;

    if (!idea || idea.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a carousel idea (at least 5 characters)" },
        { status: 400 }
      );
    }

    // Use admin-provided key from client (if admin), or fall back to server env variable
    const finalKieApiKey = (kieApiKey && kieApiKey.length >= 10) ? kieApiKey : process.env.KIE_API_KEY;

    // Determine image generation method: kie.ai if key available, otherwise built-in AI API
    const useKieAi = !!(finalKieApiKey && finalKieApiKey.length >= 10);
    console.log(`[Carousel] Image generation method: ${useKieAi ? 'kie.ai (nano-banana-2)' : 'built-in AI API'}`);

    const slidesCount = Math.max(3, Math.min(10, parseInt(numSlides) || 5));

    // Step 1: Generate slide content with AI
    console.log(`[Carousel] Generating ${slidesCount} slides for idea: "${idea.slice(0, 50)}..."`);

    const slides = await generateSlideContent(idea.trim(), slidesCount, language || "en");

    // Step 2: Generate images for each slide
    const slidesWithImages = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      try {
        let imageUrl: string;
        if (useKieAi) {
          imageUrl = await generateSlideImageKie(
            slide.imagePrompt,
            finalKieApiKey!,
            i,
            slides.length
          );
        } else {
          console.log(`[Carousel] Slide ${i + 1}/${slides.length}: generating with built-in AI API...`);
          imageUrl = await generateSlideImageBuiltIn(slide.imagePrompt, i, slides.length);
          console.log(`[Carousel] Slide ${i + 1}/${slides.length}: image ready!`);
        }
        slidesWithImages.push({
          ...slide,
          imageUrl,
          status: "done" as const,
        });
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        console.error(`[Carousel] Slide ${i + 1} image failed:`, msg);
        slidesWithImages.push({
          ...slide,
          imageUrl: null,
          status: "image_failed" as const,
          error: msg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      slides: slidesWithImages,
      idea: idea.trim(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/generate-carousel error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
