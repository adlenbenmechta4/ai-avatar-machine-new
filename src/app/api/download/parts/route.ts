import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const part = request.nextUrl.searchParams.get("part");
    if (!part || !["1", "2"].includes(part)) {
      return NextResponse.json({ error: "Use ?part=1 or ?part=2" }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.armsleeves_READ_WRITE_TOKEN || "";
    const { blobs } = await list({ prefix: "ai-avatar-machine-full-part" + part, token });

    if (blobs.length === 0) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    const blob = blobs[0];
    const response = await fetch(blob.downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const fileName = `ai-avatar-machine-full-part${part}.zip`;
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Content-Encoding", "identity");
    headers.set("Content-Length", blob.size.toString());
    headers.set("Cache-Control", "no-store");

    return new NextResponse(response.body, { headers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
