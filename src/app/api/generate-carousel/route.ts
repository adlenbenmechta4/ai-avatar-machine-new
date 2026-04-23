import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// ─── Generate a single carousel slide image ────────────────────────────────
async function generateSlideImage(
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
    throw new Error("Image API returned non-JSON: " + submitText.slice(0, 200));
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

  console.log(`[Carousel] Slide ${slideIndex + 1}/${totalSlides}: task ${taskId} submitted, polling...`);
  const imageUrl = await pollKieImage(taskId, apiKey);
  console.log(`[Carousel] Slide ${slideIndex + 1}/${totalSlides}: image ready!`);
  return imageUrl;
}

// ─── Generate carousel slide content with AI ───────────────────────────────
async function generateSlideContent(
  idea: string,
  numSlides: number,
  language: string
): Promise<Array<{ slideNumber: number; title: string; body: string; imagePrompt: string }>> {
  const zai = await ZAI.create();

  const langInstruction = language === "ar"
    ? "Write ALL slide content in Arabic. Titles, body text, and image prompts should be in Arabic."
    : language === "fr"
    ? "Write ALL slide content in French."
    : "Write ALL slide content in English.";

  const completion = await zai.chat.completions.create({
    messages: [
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
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = completion.choices[0]?.message?.content || "";
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI failed to generate valid carousel content");
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
    const finalApiKey = (kieApiKey && kieApiKey.length >= 10) ? kieApiKey : process.env.KIE_API_KEY;

    if (!finalApiKey || finalApiKey.length < 10) {
      return NextResponse.json(
        { error: "Image generation API key is not configured. Please contact support." },
        { status: 400 }
      );
    }

    const slidesCount = Math.max(3, Math.min(10, parseInt(numSlides) || 5));

    // Step 1: Generate slide content with AI
    console.log(`[Carousel] Generating ${slidesCount} slides for idea: "${idea.slice(0, 50)}..."`);

    const slides = await generateSlideContent(idea.trim(), slidesCount, language || "en");

    // Step 2: Generate images for each slide using kie.ai nano-banana-2
    const slidesWithImages = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      try {
        const imageUrl = await generateSlideImage(
          slide.imagePrompt,
          finalApiKey,
          i,
          slides.length
        );
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
