import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware sets COOP/COEP headers required for FFmpeg WASM (SharedArrayBuffer)
// in the Video Editor (AI Avatar Machine).
// Since FFmpeg core files are served locally from /public/ffmpeg/, COEP won't block them.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set headers required for SharedArrayBuffer (needed by @ffmpeg/ffmpeg multi-threaded core)
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  return response;
}

export const config = {
  // Apply to all pages except static assets and API routes
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|ffmpeg|hooks|fonts|images).*)",
  ],
};
