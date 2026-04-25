import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Track previous topics to avoid repetition
const previousTopics = new Set<string>();

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

    const { topic, duration, numScenes, singleScript, aiApiKey, aiApiUrl, aiModel, useFreeAi } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const dur = typeof duration === "number" ? duration : 30;
    // numScenes: 0 or undefined = auto (ceil(duration/8)), otherwise use the exact count
    const userNumScenes = typeof numScenes === "number" ? numScenes : 0;
    const sceneCount = userNumScenes > 0 ? Math.max(1, userNumScenes) : Math.max(1, Math.ceil(dur / 8));
    const isSingleScript = singleScript === true;
    const isFree = useFreeAi === true;

    // ── Validate API key for paid mode ──
    if (!isFree && (!aiApiKey || typeof aiApiKey !== "string" || aiApiKey.trim().length < 10)) {
      return NextResponse.json({ error: "AI API key is required for script generation" }, { status: 400 });
    }

    // ── Build prompts ──
    const systemPrompt = isSingleScript
      ? `You are an expert video scriptwriter. You create engaging, natural-sounding scripts for AI avatar talking-head videos.` +
        `\n\nRules:` +
        `\n- Create ONE continuous script (not separate scenes)` +
        `\n- The script should be approximately ${dur} seconds when spoken at normal pace (~2.5 words/second = ~${Math.round(dur * 2.5)} words)` +
        `\n- Use clear, conversational language` +
        `\n- Avoid jargon unless the topic requires it` +
        `\n- Make it engaging and compelling from start to finish` +
        `\n- It should feel like a single, natural monologue or speech` +
        `\n- Vary your vocabulary — do not repeat similar phrases` +
        (previousTopics.size > 0
          ? `\n- IMPORTANT: Avoid these previously used topics/themes: ${Array.from(previousTopics).slice(-5).join(", ")}`
          : "") +
        `\n\nRespond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):` +
        `\n{"script": "your complete script here"}`
      : `You are an expert video scriptwriter. You create engaging, natural-sounding scripts for AI avatar talking-head videos.` +
        `\n\nRules:` +
        `\n- Create exactly ${sceneCount} scenes` +
        `\n- Each scene should be 18-25 words (2-3 short sentences, ~8 seconds when spoken naturally)` +
        `\n- Each scene should flow naturally into the next` +
        `\n- Use clear, conversational language` +
        `\n- Avoid jargon unless the topic requires it` +
        `\n- Make it engaging and compelling` +
        `\n- Each scene is a single continuous speaking segment` +
        `\n- Vary your vocabulary — do not repeat similar phrases across scenes` +
        (previousTopics.size > 0
          ? `\n- IMPORTANT: Avoid these previously used topics/themes: ${Array.from(previousTopics).slice(-5).join(", ")}`
          : "") +
        `\n\nRespond ONLY with a valid JSON object (no markdown, no code blocks, no explanation):` +
        `\n{"scenes": [{"description": "visual setting for this scene", "script": "the spoken dialogue for this scene (18-25 words)"}]}`;

    const userPrompt = isSingleScript
      ? `Topic: "${topic.trim()}"\nDuration: ${dur} seconds (one continuous script)\n\nCreate the script:`
      : `Topic: "${topic.trim()}"\nDuration: ${dur} seconds (${sceneCount} scenes)\n\nCreate the script:`;

    let content = "";

    if (isFree) {
      // ═══════════════════════════════════════════════════════════════
      // FREE MODE: Pollinations AI — No API key needed, completely free
      // ═══════════════════════════════════════════════════════════════
      const freeResponse = await fetch("https://text.pollinations.ai/openai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      // ═══════════════════════════════════════════════════════════════
      // PAID MODE: User's own API key (OpenAI-compatible)
      // ═══════════════════════════════════════════════════════════════
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

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object in the response
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

    // Handle singleScript mode (Talking Photo)
    if (isSingleScript) {
      const script = parsed.script as string | undefined;
      if (!script || typeof script !== "string" || script.trim().length === 0) {
        const scenes = parsed.scenes as Array<{ script: string }> | undefined;
        if (scenes && scenes.length > 0) {
          const combined = scenes.map(s => s.script).join(" ");
          previousTopics.add(topic.trim().toLowerCase());
          return NextResponse.json({
            script: combined,
            wordCount: combined.split(/\s+/).length,
            topic: topic.trim(),
            estimatedDuration: dur,
          });
        }
        return NextResponse.json(
          { error: "AI did not return a valid script", rawContent: content.slice(0, 500) },
          { status: 500 }
        );
      }
      previousTopics.add(topic.trim().toLowerCase());
      return NextResponse.json({
        script: script.trim(),
        wordCount: script.trim().split(/\s+/).length,
        topic: topic.trim(),
        estimatedDuration: dur,
      });
    }

    // Handle multi-scene mode (Multi-Scene)
    const scenes = parsed.scenes as Array<{ description?: string; script: string }> | undefined;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      const script = parsed.script as string | undefined;
      if (script && script.trim().length > 0) {
        previousTopics.add(topic.trim().toLowerCase());
        return NextResponse.json({
          scenes: [{ description: "", script: script.trim() }],
          sceneCount: 1,
          topic: topic.trim(),
          estimatedDuration: dur,
        });
      }
      return NextResponse.json(
        { error: "AI did not return valid scenes", rawContent: content.slice(0, 500) },
        { status: 500 }
      );
    }

    // Track topic to prevent repetition
    previousTopics.add(topic.trim().toLowerCase());
    if (previousTopics.size > 20) {
      const arr = Array.from(previousTopics);
      previousTopics.clear();
      arr.slice(-10).forEach((t) => previousTopics.add(t));
    }

    return NextResponse.json({
      scenes: scenes.map((s, i) => ({
        description: s.description || `Scene ${i + 1} setting`,
        script: s.script || "",
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
