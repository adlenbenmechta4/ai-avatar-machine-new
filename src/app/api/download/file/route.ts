import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

// Edge Runtime for large file streaming
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Missing file name" }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.armsleeves_READ_WRITE_TOKEN || "";

    const { blobs } = await list({ prefix: "ai-avatar-machine", token });
    const match = blobs.find(b => {
      const fileName = b.pathname.split("/").pop();
      return fileName === name || b.pathname === name || b.pathname.endsWith("/" + name);
    });

    if (!match) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get the raw blob and pipe through with correct Content-Encoding
    const response = await fetch(match.downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Fetch failed` }, { status: 500 });
    }

    // Collect the full blob as ArrayBuffer to avoid CDN compression issues
    // For large files, this uses Edge's streaming directly
    const body = response.body;

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${name}"`);
    headers.set("Content-Encoding", "identity");
    headers.set("Content-Length", match.size.toString());
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(body, { headers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Download error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
