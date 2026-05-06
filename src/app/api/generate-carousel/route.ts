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
// 4. Template-based generation (fallback when no LLM API is available)

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  chatId?: string;
  userId?: string;
  provider: string;
}

function getAIConfig(): AIConfig | null {
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

  return null;
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
    signal: AbortSignal.timeout(60000), // 60 second timeout
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Chat completion API failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  return await response.json();
}

// ─── Chat completion with fallback chain ───────────────────────────────────
async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; max_tokens?: number }
): Promise<Record<string, unknown> | null> {
  // Try 1: Environment variables
  const config = getAIConfig();
  if (config) {
    try {
      return await chatCompletionDirect(config, messages, options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Carousel] Env var API failed:", msg);
      // Continue to next fallback
    }
  }

  // Try 2: z-ai-web-dev-sdk config file
  const zai = await createZAIFromConfig();
  if (zai) {
    try {
      const completion = await zai.chat.completions.create({
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 4000,
      });
      return completion as unknown as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Carousel] ZAI SDK failed:", msg);
      // Continue to next fallback
    }
  }

  // Try 3: Return null to trigger template-based fallback
  console.log("[Carousel] All AI APIs failed, will use template-based content generation");
  return null;
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
    signal: AbortSignal.timeout(120000), // 2 minute timeout for images
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Image generation API failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  return await response.json();
}

// ─── Image generation with fallback to z-ai-web-dev-sdk ────────────────────
async function imageGeneration(prompt: string, size: string = "768x1344"): Promise<Record<string, unknown> | null> {
  // Try 1: Environment variables
  const config = getAIConfig();
  if (config) {
    try {
      return await imageGenerationDirect(config, prompt, size);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Carousel] Env var image API failed:", msg);
    }
  }

  // Try 2: z-ai-web-dev-sdk config file
  const zai = await createZAIFromConfig();
  if (zai) {
    try {
      return await zai.images.generations.create({ prompt, size }) as unknown as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Carousel] ZAI SDK image generation failed:", msg);
    }
  }

  return null;
}

// ─── Force image prompt to be photorealistic with NO TEXT ────────────────────
const IMAGE_PROMPT_PREFIX = "Photorealistic professional photograph, DSLR camera, natural lighting, realistic candid shot, absolutely NO TEXT NO WORDS NO LETTERS NO TYPOGRAPHY IN IMAGE: ";

function enforcePhotorealisticPrompt(prompt: string): string {
  // Remove any text/typography-related keywords that might cause the AI to generate text
  const cleaned = prompt
    .replace(/\b(text|typography|lettering|words|font|headline|title|caption|quote)\b/gi, "")
    .replace(/\b(infographic|illustration|graphic design|cartoon|vector|clip.?art)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If the prompt already has photorealistic keywords, just ensure NO TEXT is there
  if (cleaned.toLowerCase().includes("no text") && cleaned.toLowerCase().includes("photorealistic")) {
    return cleaned;
  }

  // Otherwise, prepend the forced prefix
  return IMAGE_PROMPT_PREFIX + cleaned;
}

// ─── Template-based carousel content generation (fallback) ─────────────────
function generateTemplateContent(
  idea: string,
  numSlides: number,
  language: string
): Array<{ slideNumber: number; title: string; body: string; imagePrompt: string }> {
  const isAr = language === "ar";
  const isFr = language === "fr";

  const slides: Array<{ slideNumber: number; title: string; body: string; imagePrompt: string }> = [];

  // Realistic photo scene descriptions (not text/infographic)
  const photoScenes = [
    `A stunning close-up portrait of a confident person looking directly at camera, warm golden hour lighting, shallow depth of field, professional DSLR photography related to ${idea}`,
    `A beautifully composed overhead shot of a workspace with natural elements, morning sunlight streaming through window, realistic and authentic, professional photography related to ${idea}`,
    `An authentic candid moment of someone experiencing success and joy, natural lighting, lifestyle photography, warm tones related to ${idea}`,
    `A dramatic professional photograph with rich colors and natural textures, moody atmospheric lighting, cinematic composition related to ${idea}`,
    `A serene and inspiring landscape or environment that evokes ambition, natural lighting, wide angle, professional nature photography related to ${idea}`,
    `A close-up detail shot with beautiful bokeh, soft natural lighting, tactile and real textures, macro photography related to ${idea}`,
    `An authentic lifestyle scene with real people in a moment of discovery or realization, natural candid photography, warm color palette related to ${idea}`,
    `A powerful cinematic photograph with dramatic lighting, real human emotion, professional composition related to ${idea}`,
  ];

  // Cover slide — realistic photo
  slides.push({
    slideNumber: 1,
    title: isAr ? idea : isFr ? idea : idea,
    body: isAr ? "اكتشف الأسرار التي ستغير طريقة تفكيرك" : isFr ? "Découvrez les secrets qui changeront votre perspective" : "Discover the secrets that will change your perspective",
    imagePrompt: enforcePhotorealisticPrompt(`Eye-catching professional photograph that represents ${idea}, dramatic lighting, compelling composition, photorealistic, DSLR quality`),
  });

  // Content slides
  const tips = isAr
    ? ["النقطة الأولى المهمة", "النقطة الثانية الأساسية", "النقطة الثالثة الجوهرية", "النقطة الرابعة", "النقطة الخامسة", "النقطة السادسة", "النقطة السابعة", "النقطة الثامنة"]
    : isFr
    ? ["Premier point essentiel", "Deuxième point fondamental", "Troisième point clé", "Quatrième point important", "Cinquième point crucial", "Sixième point", "Septième point", "Huitième point"]
    : ["The first key insight", "The second fundamental principle", "The third crucial strategy", "The fourth important lesson", "The fifth essential tip", "The sixth powerful method", "The seventh vital point", "The eighth game-changer"];

  const bodies = isAr
    ? ["هذه النقطة ستساعدك على فهم الموضوع بشكل أعمق وتطبيقه في حياتك اليومية", "عندما تطبق هذا المبدأ، ستلاحظ فرقاً كبيراً في نتائجك", "النجاح يبدأ بفهم هذه الاستراتيجية وتطبيقها بشكل صحيح", "هذا الدرس تعلمته من تجارب كثيرة وهو مهم جداً للتقدم", "التطبيق العملي لهذه النصيحة سيغير نظرتك تماماً", "الكثيرون يتجاهلون هذه النقطة لكنها الأهم", "هذا السر يفرق بين الناجحين والآخرين", "التغيير يبدأ بخطوة واحدة وهذه هي خطوتك"]
    : isFr
    ? ["Ce point vous aidera à comprendre le sujet plus profondément et à l'appliquer quotidiennement", "Quand vous appliquez ce principe, vous remarquerez une grande différence dans vos résultats", "Le succès commence par la compréhension de cette stratégie et son application correcte", "Cette leçon vient de nombreuses expériences et est cruciale pour progresser", "L'application pratique de ce conseil changera complètement votre perspective", "Beaucoup ignorent ce point mais il est le plus important", "Ce secret fait la différence entre ceux qui réussissent et les autres", "Le changement commence par un seul pas et c'est le vôtre"]
    : ["This insight will help you understand the topic more deeply and apply it to your daily life", "When you apply this principle, you'll notice a significant difference in your results", "Success starts with understanding this strategy and applying it correctly", "This lesson comes from extensive experience and is crucial for progress", "The practical application of this tip will completely change your perspective", "Many overlook this point but it's the most important one", "This secret separates those who succeed from everyone else", "Change starts with a single step and this is yours"];

  const contentCount = Math.max(1, numSlides - 2); // minus cover and CTA
  for (let i = 0; i < contentCount && i < tips.length; i++) {
    slides.push({
      slideNumber: i + 2,
      title: tips[i],
      body: bodies[i] || tips[i],
      imagePrompt: enforcePhotorealisticPrompt(photoScenes[i % photoScenes.length]),
    });
  }

  // CTA slide — realistic photo
  slides.push({
    slideNumber: numSlides,
    title: isAr ? "ابدأ الآن!" : isFr ? "Commencez maintenant!" : "Start Now!",
    body: isAr ? "شارك هذا المحتوى مع أصدقائك وابدأ رحلتك اليوم" : isFr ? "Partagez ce contenu avec vos amis et commencez votre voyage aujourd'hui" : "Share this with your friends and start your journey today",
    imagePrompt: enforcePhotorealisticPrompt(`Inspiring professional photograph of someone taking action or reaching a goal, powerful energy, warm lighting, cinematic, photorealistic, related to ${idea}`),
  });

  return slides;
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
        image_size: "768x1344",
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

// ─── BOFU Carousel Prompt ───────────────────────────────────────────────────
const BOFU_CAROUSEL_PROMPT = `أنت خبير في تصميم محتوى كاروسيلات تسويقية متخصصة في Bottom of Funnel (BOFU).

عندما يكتب المستخدم وصفاً، قم بتوليد خطة كاروسيل كاملة بالشكل التالي:

## القواعد الأساسية
- عدد الشرائح: من 6 إلى 8 شرائح
- الكاروسيل تستهدف جمهور دافئ وجاهز للشراء
- الهدف المباشر: دفع المستخدم لاتخاذ قرار الشراء

## هيكل الكاروسيل

الشريحة 1 — HOOK (جذب انتباه)
- جملة قوية تتحدث عن رغبته وليس مشكلته
- يمكن أن تكون الصورة فقط بدون نص إذا كانت قوية جداً

الشريحة 2 و 3 — القيمة (VALUE)
- ميزة محددة → فائدة محددة → نتيجة محددة
- أرقام وتفاصيل حقيقية لا كلام عام

الشريحة 4 و 5 — كسر الاعتراضات (OBJECTION CRUSHER)
- عالج أكبر اعتراضين يمنعان الشراء
- أعد صياغة المعلومة بطريقة مقنعة

الشريحة 6 — إثبات اجتماعي (SOCIAL PROOF)
- شهادة أو أرقام أو نتائج حقيقية

الشريحة 7 — استعجال (URGENCY)
- سبب حقيقي للشراء الآن وليس لاحقاً

الشريحة 8 — دعوة للعمل (CTA)
- أمر واضح ومباشر واحد فقط

## ⛔ قواعد الصور (الأهم — إلزامي جداً)
- image_prompt يجب أن يصف صورة فوتوغرافية واقعية 100% — NOT illustration, NOT graphic design, NOT infographic, NOT cartoon
- يجب أن تبدو الصورة كأنها التقطت بكاميرا حقيقية (DSLR quality, professional photography)
- ⛔ ممنوع تماماً أي نص أو حروف أو كلمات داخل الصورة — NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY في الصورة
- النص يُعرض كطبقة منفصلة فوق الصورة وليس داخلها
- وصف الصورة يجب أن يتضمن كلمات مثل: "photorealistic, professional photography, DSLR, realistic, candid, natural lighting"
- وصف الصورة يجب أن يتضمن: "NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY IN IMAGE"

## قواعد النص فوق الصورة
- النص فوق الصورة اختياري وليس إلزامياً
- بعض الشرائح يمكن أن تكون صورة فقط بدون أي نص (header_text = null و body_text = null)
- إذا كان هناك نص: عنوان максимум 8 كلمات، نص فرعي最大限度 15 كلمة

## لغة المحتوى
- إذا كتب المستخدم بالعربية → كل النصوص بالعربية
- إذا كتب المستخدم بالإنجليزية → كل النصوص بالإنجليزية

## المطلوب كإنتاج
أرجع JSON فقط بهذا الشكل:
{
  "carousel_title": "string",
  "slides": [
    {
      "slide_number": 1,
      "slide_type": "hook",
      "image_prompt": "Realistic professional photograph of [scene description], photorealistic, DSLR, natural lighting, candid, NO TEXT NO WORDS NO LETTERS IN IMAGE",
      "header_text": "string أو null",
      "body_text": "string أو null",
      "text_position": "top أو center أو bottom"
    }
  ]
}

ملاحظات مهمة:
- image_prompt تكتبها دائماً بالإنجليزية حتى لو المحتوى عربي
- image_prompt يجب أن يصف مشهد واقعي قابل للتصوير بكاميرا حقيقية
- header_text و body_text ممكن تكون null إذا الشريحة صورة فقط
- لا تكرر نفس النوع من الشرائح`;

// ─── Generate carousel slide content with AI (BOFU) ──────────────────────────
async function generateSlideContent(
  idea: string,
  numSlides: number,
  language: string
): Promise<{ carouselTitle: string; slides: Array<{ slideNumber: number; slideType: string; title: string; body: string; imagePrompt: string; headerText: string | null; bodyText: string | null; textPosition: string }> }> {
  const completion = await chatCompletion([
    {
      role: "system",
      content: BOFU_CAROUSEL_PROMPT,
    },
    {
      role: "user",
      content: idea.trim(),
    },
  ], {
    temperature: 0.8,
    max_tokens: 4000,
  });

  // If AI chat completion worked, parse the response
  if (completion) {
    const content = (completion as Record<string, unknown>)?.choices?.[0]?.message?.content || "";
    // Try to extract JSON from the response
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch { /* continue */ }
      }
      // Try to find JSON object
      if (!parsed) {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          try { parsed = JSON.parse(objectMatch[0]); } catch { /* continue */ }
        }
      }
    }

    if (parsed) {
      const carouselTitle = (parsed.carousel_title as string) || idea.slice(0, 50);
      const rawSlides = parsed.slides;
      if (Array.isArray(rawSlides) && rawSlides.length > 0) {
        const slides = rawSlides.map((slide: Record<string, unknown>, i: number) => ({
          slideNumber: (slide.slide_number as number) || i + 1,
          slideType: (slide.slide_type as string) || "value",
          title: (slide.header_text as string) || (slide.title as string) || `Slide ${i + 1}`,
          body: (slide.body_text as string) || (slide.body as string) || "",
          imagePrompt: enforcePhotorealisticPrompt((slide.image_prompt as string) || `Professional photograph of ${idea}, realistic, natural lighting`),
          headerText: (slide.header_text as string | null) ?? null,
          bodyText: (slide.body_text as string | null) ?? null,
          textPosition: (slide.text_position as string) || "bottom",
        }));
        return { carouselTitle, slides };
      }
    }
  }

  // Fallback: Template-based content generation
  console.log("[Carousel] Using template-based content generation for idea:", idea.slice(0, 50));
  const templateSlides = generateTemplateContent(idea, numSlides, language);
  return {
    carouselTitle: idea.slice(0, 50),
    slides: templateSlides.map((s, i) => ({
      ...s,
      slideType: i === 0 ? "hook" : i === templateSlides.length - 1 ? "cta" : "value",
      headerText: s.title,
      bodyText: s.body || null,
      textPosition: "bottom",
    })),
  };
}

// ─── Generate slide image using built-in AI API ──────────────────────────
async function generateSlideImageBuiltIn(prompt: string, slideIdx: number, total: number): Promise<string> {
  const response = await imageGeneration(prompt, "768x1344");

  if (response) {
    const data = (response as Record<string, unknown>)?.data;
    if (Array.isArray(data) && data.length > 0) {
      const base64 = data[0]?.base64;
      if (base64) return `data:image/png;base64,${base64}`;
      const imageUrl = data[0]?.url;
      if (imageUrl) return imageUrl as string;
    }
  }

  throw new Error("Image generation failed - no AI image API available. Set KIE_API_KEY, ZAI_BASE_URL+ZAI_API_KEY, or OPENAI_API_KEY for image generation.");
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

    // Step 1: Generate slide content with AI (with template fallback)
    console.log(`[Carousel] Generating ${slidesCount} slides for idea: "${idea.slice(0, 50)}..."`);

    const { carouselTitle, slides } = await generateSlideContent(idea.trim(), slidesCount, language || "en");

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
      carouselTitle,
      slides: slidesWithImages.map(s => ({
        ...s,
        slideType: s.slideType || "value",
        headerText: s.headerText ?? null,
        bodyText: s.bodyText ?? null,
        textPosition: s.textPosition || "bottom",
      })),
      idea: idea.trim(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/generate-carousel error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
