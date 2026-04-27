import { NextRequest, NextResponse } from "next/server";

const FAL_KEY = "c8b8a13a-d358-4a8c-b4a0-a6aee1da0bc5:c5c823fe4dad5a72691a9ab8eac5ef2c";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      video_url,
      language = "en",
      font_name = "Cairo",
      font_size = 100,
      font_weight = "bold",
      font_color = "white",
      highlight_color = "yellow",
      stroke_width = 3,
      stroke_color = "black",
      position = "bottom",
      y_offset = 75,
      words_per_subtitle = 3,
      enable_animation = true,
      background_color = "none",
      background_opacity = 0,
    } = body;

    if (!video_url) {
      return NextResponse.json({ error: "video_url is required" }, { status: 400 });
    }

    // Submit the job to fal.ai
    const submitRes = await fetch(
      "https://fal.run/fal-ai/workflow-utilities/auto-subtitle",
      {
        method: "POST",
        headers: {
          "Authorization": "Key " + FAL_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_url,
          language,
          font_name,
          font_size,
          font_weight,
          font_color,
          highlight_color,
          stroke_width,
          stroke_color,
          position,
          y_offset,
          words_per_subtitle,
          enable_animation,
          background_color,
          background_opacity,
        }),
      }
    );

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error("FAL submit error:", submitRes.status, errText);
      return NextResponse.json(
        { error: "Failed to submit subtitle job: " + errText.slice(0, 300) },
        { status: submitRes.status }
      );
    }

    // FAL returns the result directly for short videos, or a request_id for longer ones
    const contentType = submitRes.headers.get("content-type") || "";
    let data: Record<string, unknown>;

    if (contentType.includes("text/plain")) {
      // Sometimes FAL returns plain text with the URL
      const text = await submitRes.text();
      try {
        data = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Unexpected response from subtitle service" }, { status: 502 });
      }
    } else {
      data = await submitRes.json();
    }

    // If we got a request_id, we need to poll for the result
    if (data.request_id && !data.video) {
      const requestId = data.request_id as string;
      const statusUrl = "https://fal.run/fal-ai/workflow-utilities/auto-subtitle/status/" + requestId;

      // Poll every 3 seconds, max 10 minutes
      const maxAttempts = 200;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusRes = await fetch(statusUrl, {
          headers: { "Authorization": "Key " + FAL_KEY },
        });

        if (!statusRes.ok) continue;

        const statusData = await statusRes.json() as Record<string, unknown>;

        if (statusData.status === "COMPLETED") {
          return NextResponse.json({
            video_url: (statusData.video as Record<string, string>)?.url || "",
            transcription: statusData.transcription || "",
            subtitle_count: statusData.subtitle_count || 0,
            words: statusData.words || [],
          });
        }

        if (statusData.status === "FAILED") {
          return NextResponse.json(
            { error: "Subtitle processing failed: " + JSON.stringify(statusData.error || "Unknown error") },
            { status: 500 }
          );
        }

        // Still processing — return progress info if caller needs it
        if (attempt === 0 || attempt % 5 === 0) {
          // Could send SSE events here, but for now we just keep polling
        }
      }

      return NextResponse.json({ error: "Processing timed out after 10 minutes" }, { status: 504 });
    }

    // Direct result (short video)
    if (data.video) {
      const videoData = data.video as Record<string, string>;
      return NextResponse.json({
        video_url: videoData.url || "",
        transcription: data.transcription || "",
        subtitle_count: data.subtitle_count || 0,
        words: data.words || [],
      });
    }

    return NextResponse.json(
      { error: "Unexpected response from subtitle service: " + JSON.stringify(data).slice(0, 200) },
      { status: 502 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Auto-subtitle error:", msg);
    return NextResponse.json({ error: "Internal server error: " + msg }, { status: 500 });
  }
}
