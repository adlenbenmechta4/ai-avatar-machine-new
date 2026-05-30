import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const previousTopics = new Set<string>();

async function fetchProductInfo(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const priceMatch = html.match(/["']?price["']?\s*[:=]\s*["']?([^"'<,}\s]+)/i) || html.match(/\$[\d,.]+/);
    
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    
    let productInfo = "Product Page Analysis:\n";
    if (ogTitle?.[1]) productInfo += `Product Name: ${stripTags(ogTitle[1])}\n`;
    else if (titleMatch?.[1]) productInfo += `Product Name: ${stripTags(titleMatch[1])}\n`;
    if (ogDesc?.[1]) productInfo += `Description: ${stripTags(ogDesc[1])}\n`;
    else if (metaDesc?.[1]) productInfo += `Description: ${stripTags(metaDesc[1])}\n`;
    if (priceMatch) productInfo += `Price: ${priceMatch[0]}\n`;
    
    const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,50000})<\/body>/i);
    if (bodyMatch) {
      const bodyText = stripTags(bodyMatch[1]).slice(0, 3000);
      productInfo += `Page Content (excerpt): ${bodyText}\n`;
    }
    
    return productInfo.slice(0, 5000);
  } catch (err) {
    console.warn("Product fetch failed:", err instanceof Error ? err.message : String(err));
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      const rawText = await req.text();
      if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { topic, duration, numScenes, singleScript, aiApiKey, aiApiUrl, aiModel, useFreeAi, productUrl, hasProductImage, scriptVariation, scriptFormat } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "topic or product URL is required" }, { status: 400 });
    }

    const dur = typeof duration === "number" ? duration : 30;
    const userNumScenes = typeof numScenes === "number" ? numScenes : 0;
    const sceneCount = userNumScenes > 0 ? Math.max(1, userNumScenes) : Math.max(1, Math.ceil(dur / 8));
    const isSingleScript = singleScript === true;
    const isFree = useFreeAi === true;
    const isProductHook = scriptFormat === "product_hook";
    const variation = typeof scriptVariation === "number" ? scriptVariation : 0;

    if (!isFree && (!aiApiKey || typeof aiApiKey !== "string" || aiApiKey.trim().length < 10)) {
      return NextResponse.json({ error: "AI API key is required for script generation" }, { status: 400 });
    }

    let productInfo = "";
    if (isProductHook && productUrl && typeof productUrl === "string" && productUrl.trim().startsWith("http")) {
      productInfo = await fetchProductInfo(productUrl.trim());
    }

    const marketingAngles = [
      "surprise and curiosity (first-time user reaction style)",
      "skepticism turned into belief (doubter converted style)", 
      "excitement and enthusiasm (fan/user advocate style)",
      "comparison and superiority (better than alternatives style)",
      "storytelling and personal journey (transformation style)",
      "urgency and FOMO (limited time/offer style)",
    ];
    const selectedAngle = marketingAngles[variation % marketingAngles.length];

    let systemPrompt: string;
    let userPrompt: string;

    if (isProductHook) {
      systemPrompt = 
        `You are an expert TikTok/Reels video scriptwriter specializing in product marketing videos.` +
        `\n\nYou create scripts that follow this EXACT 4-part structure:` +
        `\n[HOOK]: Attention-grabbing first line that makes viewers stop scrolling. Must be surprising, shocking, or curiosity-inducing.` +
        `\n[PAIN + DISCOVERY]: Relatable problem the viewer has, then introducing the product as the unexpected solution.` +
        `\n[PROOF]: Demonstration or evidence that the product actually works. Show, don't just tell.` +
        `\n[CTA]: Strong call to action telling the viewer exactly what to do next.` +
        `\n\nRules:` +
        `\n- Create EXACTLY 4 scenes (HOOK, PAIN+DISCOVERY, PROOF, CTA)` +
        `\n- Each script line should be 15-30 words — short, punchy, conversational` +
        `\n- Use casual, relatable language (like a real person talking to their phone camera)` +
        `\n- The HOOK must be the most attention-grabbing line — think viral TikTok hooks` +
        `\n- NO hashtags, NO "link in bio", NO generic marketing speak` +
        `\n- Marketing angle for this variation: ${selectedAngle}` +
        (variation > 0 ? `\n- This is a REGENERATION — create a COMPLETELY DIFFERENT script from before with a new marketing angle but same structure` : "") +
        (previousTopics.size > 0 ? `\n- IMPORTANT: Avoid these previously used angles: ${Array.from(previousTopics).slice(-3).join(", ")}` : "") +
        `\n\nFor EACH scene, also create a detailed IMAGE PROMPT that describes what the person should be doing in that scene.` +
        `\nThe image prompts should describe the person's appearance, pose, expression, and what they're doing with the product.` +
        (hasProductImage ? `\nIMPORTANT: The user has provided a product image. The product should appear naturally in the scenes where it makes sense (especially PROOF scene).` : "") +
        `\n\nRespond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):` +
        `\n{"scenes": [{"label": "HOOK", "script": "the spoken line", "framePrompt": "detailed image prompt describing the person, their pose, expression, clothing, and setting for this scene. Fixed tripod shot, NO selfie. Looking directly into camera.", "description": "brief visual setting description"}, {"label": "PAIN + DISCOVERY", "script": "...", "framePrompt": "...", "description": "..."}, {"label": "PROOF", "script": "...", "framePrompt": "...", "description": "..."}, {"label": "CTA", "script": "...", "framePrompt": "...", "description": "..."}]}`;

      userPrompt = productInfo 
        ? `Product URL: ${productUrl}\n\n${productInfo}\n\nCreate a viral product marketing video script for this product:`
        : `Product/Topic: "${topic.trim()}"\n\nCreate a viral product marketing video script:`;

    } else if (isSingleScript) {
      systemPrompt = 
        `You are an expert video scriptwriter. You create engaging, natural-sounding scripts for AI avatar talking-head videos.` +
        `\n\nRules:` +
        `\n- Create ONE continuous script (not separate scenes)` +
        `\n- The script should be approximately ${dur} seconds when spoken at normal pace (~2.5 words/second = ~${Math.round(dur * 2.5)} words)` +
        `\n- Use clear, conversational language` +
        `\n- Avoid jargon unless the topic requires it` +
        `\n- Make it engaging and compelling from start to finish` +
        `\n- It should feel like a single, natural monologue or speech` +
        `\n- Vary your vocabulary — do not repeat similar phrases` +
        (previousTopics.size > 0 ? `\n- IMPORTANT: Avoid these previously used topics/themes: ${Array.from(previousTopics).slice(-5).join(", ")}` : "") +
        `\n\nRespond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):` +
        `\n{"script": "your complete script here"}`;

      userPrompt = `Topic: "${topic.trim()}"\nDuration: ${dur} seconds (one continuous script)\n\nCreate the script:`;

    } else {
      systemPrompt = 
        `You are an expert video scriptwriter. You create engaging, natural-sounding scripts for AI avatar talking-head videos.` +
        `\n\nRules:` +
        `\n- Create exactly ${sceneCount} scenes` +
        `\n- Each scene should be 18-25 words (2-3 short sentences, ~8 seconds when spoken naturally)` +
        `\n- Each scene should flow naturally into the next` +
        `\n- Use clear, conversational language` +
        `\n- Avoid jargon unless the topic requires it` +
        `\n- Make it engaging and compelling` +
        `\n- Each scene is a single continuous speaking segment` +
        `\n- Vary your vocabulary — do not repeat similar phrases across scenes` +
        (previousTopics.size > 0 ? `\n- IMPORTANT: Avoid these previously used topics/themes: ${Array.from(previousTopics).slice(-5).join(", ")}` : "") +
        `\n\nRespond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):` +
        `\n{"scenes": [{"description": "visual setting for this scene", "script": "the spoken dialogue for this scene (18-25 words)"}]}`;

      userPrompt = `Topic: "${topic.trim()}"\nDuration: ${dur} seconds (${sceneCount} scenes)\n\nCreate the script:`;
    }

    let content = "";

    if (isFree) {
      const freeResponse = await fetch("https://text.pollinations.ai/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
        }),
      });

      if (!freeResponse.ok) {
        const errText = await freeResponse.text().catch(() => "Unknown error");
        return NextResponse.json({ error: `Free AI service error (${freeResponse.status}): ${errText.slice(0, 300)}` }, { status: 502 });
      }

      const freeCompletion = await freeResponse.json();
      const freeChoices = freeCompletion?.choices as Array<{ message?: { content?: string } }> | undefined;
      if (freeChoices && freeChoices.length > 0) {
        content = freeChoices[0]?.message?.content || "";
      }
    } else {
      const apiUrl = (typeof aiApiUrl === "string" && aiApiUrl.trim())
        ? aiApiUrl.trim()
        : "https://api.openai.com/v1/chat/completions";
      const model = (typeof aiModel === "string" && aiModel.trim())
        ? aiModel.trim()
        : "gpt-4o-mini";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        const errJson = (() => { try { return JSON.parse(errText); } catch { return null; } })();
        const errMsg = errJson?.error?.message || errText.slice(0, 300);
        return NextResponse.json({ error: `AI API error (${response.status}): ${errMsg}` }, { status: 502 });
      }

      const completion = await response.json();
      const choices = completion?.choices as Array<{ message?: { content?: string } }> | undefined;
      if (choices && choices.length > 0) {
        content = choices[0]?.message?.content || "";
      }
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
    }

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const braceStart = jsonStr.indexOf("{");
    const braceEnd = jsonStr.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI script response", rawContent: content.slice(0, 500) },
        { status: 500 }
      );
    }

    if (isSingleScript) {
      const script = parsed.script as string | undefined;
      if (!script || typeof script !== "string" || script.trim().length === 0) {
        const scenes = parsed.scenes as Array<{ script: string }> | undefined;
        if (scenes && scenes.length > 0) {
          const combined = scenes.map(s => s.script).join(" ");
          previousTopics.add(topic.trim().toLowerCase());
          return NextResponse.json({ script: combined, wordCount: combined.split(/\s+/).length, topic: topic.trim(), estimatedDuration: dur });
        }
        return NextResponse.json({ error: "AI did not return a valid script", rawContent: content.slice(0, 500) }, { status: 500 });
      }
      previousTopics.add(topic.trim().toLowerCase());
      return NextResponse.json({ script: script.trim(), wordCount: script.trim().split(/\s+/).length, topic: topic.trim(), estimatedDuration: dur });
    }

    const scenes = parsed.scenes as Array<{ description?: string; script: string; framePrompt?: string; label?: string }> | undefined;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      const script = parsed.script as string | undefined;
      if (script && script.trim().length > 0) {
        previousTopics.add(topic.trim().toLowerCase());
        return NextResponse.json({ scenes: [{ description: "", script: script.trim() }], sceneCount: 1, topic: topic.trim(), estimatedDuration: dur });
      }
      return NextResponse.json({ error: "AI did not return valid scenes", rawContent: content.slice(0, 500) }, { status: 500 });
    }

    previousTopics.add(topic.trim().toLowerCase());
    if (previousTopics.size > 20) {
      const arr = Array.from(previousTopics);
      previousTopics.clear();
      arr.slice(-10).forEach((t) => previousTopics.add(t));
    }

    return NextResponse.json({
      scenes: scenes.map((s, i) => ({
        description: s.description || (s.label ? `${s.label} scene` : `Scene ${i + 1} setting`),
        script: s.script || "",
        framePrompt: s.framePrompt || "",
        label: s.label || "",
      })),
      sceneCount: scenes.length,
      topic: topic.trim(),
      estimatedDuration: dur,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Script generation error:", msg);
    return NextResponse.json({ error: "Script generation failed: " + msg }, { status: 500 });
  }
}
