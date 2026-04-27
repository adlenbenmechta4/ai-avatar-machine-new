import { NextRequest, NextResponse } from "next/server";

/**
 * Video proxy with full HTTP Range request support.
 *
 * Why this matters:
 * - Without Range support, browsers must download the ENTIRE video before playing.
 * - With Range (206 Partial Content), browsers can:
 *   ▸ Start playing almost instantly (fetch just the first few KB for metadata)
 *   ▸ Seek to any position without re-downloading from the start
 *   ▸ Stream efficiently even on slower connections
 *
 * This is the #1 fix for choppy/buffering video playback.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get("url");

    if (!videoUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Validate URL format
    let parsed: URL;
    try {
      parsed = new URL(videoUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 });
    }

    // Get client's Range header (if any)
    const clientRange = req.headers.get("range");

    // Build headers to forward to upstream
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    // Forward Range header to upstream so we don't download more than needed
    if (clientRange) {
      upstreamHeaders["Range"] = clientRange;
    }

    // Fetch from upstream
    const response = await fetch(videoUrl, {
      headers: upstreamHeaders,
      // Allow the connection to stay open for streaming
      // @ts-expect-error - Next.js types don't expose this but it exists in undici
      highWaterMark: 1024 * 64, // 64KB chunks for smoother streaming
    });

    if (!response.ok && response.status !== 206 && response.status !== 304) {
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");
    const body = response.body;

    if (!body) {
      return NextResponse.json({ error: "No video data received" }, { status: 502 });
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", // Cache for 24h, stale for 7d
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    };

    // Forward content-length if present
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    // Forward Accept-Ranges to tell browser seeking is supported
    if (acceptRanges) {
      responseHeaders["Accept-Ranges"] = acceptRanges;
    } else {
      // Explicitly tell the browser we support ranges
      responseHeaders["Accept-Ranges"] = "bytes";
    }

    // Handle 206 Partial Content (Range request)
    if (response.status === 206) {
      responseHeaders["Content-Range"] = contentRange || "";
      return new NextResponse(body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    // Handle full 200 response
    return new NextResponse(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
      "Access-Control-Max-Age": "86400",
    },
  });
}
