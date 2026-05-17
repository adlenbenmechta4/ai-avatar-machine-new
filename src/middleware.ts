import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware sets COOP/COEP headers required for FFmpeg WASM (SharedArrayBuffer)
// in the Video Editor (AI Avatar Machine)
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Set headers required for SharedArrayBuffer (needed by @ffmpeg/ffmpeg)
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  return response;
}

export const config = {
  // Apply to all routes except static assets and API routes that don't need it
  matcher: [
    "/((?!api/download|api/proxy|_next/static|_next/image|favicon.ico|hooks|fonts).*)",
  ],
};
