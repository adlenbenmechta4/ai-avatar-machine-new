import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.armsleeves_READ_WRITE_TOKEN || "";
    const { blobs } = await list({ prefix: "ai-avatar-machine", token });

    const files = blobs.map(b => {
      const fileName = b.pathname.split("/").pop() || b.pathname;
      return {
        name: fileName,
        size: b.size,
        uploadedAt: b.uploadedAt,
        proxyUrl: `/api/download/file?name=${encodeURIComponent(fileName)}`,
      };
    });

    return NextResponse.json({ files });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg, files: [] }, { status: 500 });
  }
}
