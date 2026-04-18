import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const apiKey = searchParams.get("apiKey");

    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: "Valid API key is required" }, { status: 400 });
    }

    const res = await fetch("https://api.heygen.com/v2/voices", {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Voice API error (${res.status}): ${errText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    const voices = (json.data?.voices || []).map((v: Record<string, unknown>) => ({
      voice_id: v.voice_id as string,
      name: v.name as string,
      display_name: (v.display_name as string) || (v.name as string),
      language: (v.language as string) || "unknown",
      gender: (v.gender as string) || "unknown",
    }));

    return NextResponse.json({ voices });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
