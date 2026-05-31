import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";

const execFileAsync = promisify(execFile);

/**
 * Download a video from a URL using Node.js fetch.
 * More reliable than curl on Railway/Docker environments.
 */
async function downloadVideo(videoUrl: string, outputPath: string): Promise<number> {
  console.log("[edit-video] Downloading video with fetch:", videoUrl);

  // Strategy 1: Direct fetch from the URL
  try {
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!response.ok) {
      throw new Error(`Direct fetch failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    // Stream the response to file using web streams API
    const fileStream = createWriteStream(outputPath);
    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
      }
    } finally {
      fileStream.end();
      reader.releaseLock();
    }

    // Wait for the stream to finish writing
    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    const stat = await fs.stat(outputPath);
    if (stat.size < 1000) {
      throw new Error(`Downloaded file too small: ${stat.size} bytes`);
    }

    console.log("[edit-video] Direct download successful:", stat.size, "bytes");
    return stat.size;
  } catch (directErr) {
    console.warn("[edit-video] Direct download failed, trying proxy:", directErr instanceof Error ? directErr.message : directErr);
  }

  // Strategy 2: Use our own proxy-video endpoint
  try {
    // Determine the base URL for our proxy
    const port = process.env.PORT || "3000";
    const host = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${port}`;

    const proxyUrl = `${host}/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
    console.log("[edit-video] Trying proxy:", proxyUrl);

    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`Proxy fetch failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No proxy response body");
    }

    const fileStream = createWriteStream(outputPath);
    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
      }
    } finally {
      fileStream.end();
      reader.releaseLock();
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    const stat = await fs.stat(outputPath);
    if (stat.size < 1000) {
      throw new Error(`Proxy downloaded file too small: ${stat.size} bytes`);
    }

    console.log("[edit-video] Proxy download successful:", stat.size, "bytes");
    return stat.size;
  } catch (proxyErr) {
    console.error("[edit-video] Proxy download also failed:", proxyErr instanceof Error ? proxyErr.message : proxyErr);
  }

  // Strategy 3: Fallback to curl
  try {
    console.log("[edit-video] Trying curl fallback...");
    await execFileAsync("curl", ["-L", "-s", "-o", outputPath, videoUrl], { timeout: 120000 });

    const stat = await fs.stat(outputPath);
    if (stat.size < 1000) {
      throw new Error(`curl downloaded file too small: ${stat.size} bytes`);
    }

    console.log("[edit-video] curl download successful:", stat.size, "bytes");
    return stat.size;
  } catch (curlErr) {
    console.error("[edit-video] All download methods failed. Last error:", curlErr instanceof Error ? curlErr.message : curlErr);
    throw new Error("Failed to download video - all methods failed");
  }
}

export async function POST(req: NextRequest) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "edit-"));

  try {
    const body = await req.json();
    const { videoUrl, segments } = body as {
      videoUrl: string;
      segments: { start: number; end: number; enabled: boolean; zoom: string; zoomLevel: number }[];
    };

    if (!videoUrl || !segments || !segments.length) {
      return NextResponse.json({ error: "Missing videoUrl or segments" }, { status: 400 });
    }

    const enabledSegs = segments.filter((s: { enabled: boolean }) => s.enabled);
    if (enabledSegs.length === 0) {
      return NextResponse.json({ error: "No enabled segments" }, { status: 400 });
    }

    // Step 1: Download video using improved download function
    const inputPath = path.join(tmpDir, "input.mp4");
    let downloadSize: number;
    try {
      downloadSize = await downloadVideo(videoUrl, inputPath);
    } catch (dlErr) {
      const msg = dlErr instanceof Error ? dlErr.message : "Failed to download video";
      console.error("[edit-video] Download failed:", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    console.log("[edit-video] Downloaded:", downloadSize, "bytes");

    // Step 2: Process each segment (trim + zoom if needed)
    for (let i = 0; i < enabledSegs.length; i++) {
      const seg = enabledSegs[i];
      const segDuration = (seg.end - seg.start).toFixed(2);
      console.log(`[edit-video] Processing segment ${i + 1}/${enabledSegs.length}: ${seg.start}-${seg.end} zoom=${seg.zoom}`);

      if (seg.zoom !== "none" && seg.zoomLevel > 1) {
        const zl = seg.zoomLevel;

        // Pass 1: Extract segment
        const trimmedPath = path.join(tmpDir, `trimmed${i}.mp4`);
        await execFileAsync("ffmpeg", [
          "-i", inputPath,
          "-ss", seg.start.toFixed(2),
          "-t", segDuration,
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
          "-an",
          "-movflags", "+faststart",
          "-y", trimmedPath,
        ], { timeout: 120000 });

        // Pass 2: Apply zoom
        const zoomedPath = path.join(tmpDir, `part${i}.mp4`);
        await execFileAsync("ffmpeg", [
          "-i", trimmedPath,
          "-vf", `scale=iw*${zl}:ih*${zl},crop=iw/${zl}:ih/${zl}`,
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
          "-an",
          "-movflags", "+faststart",
          "-y", zoomedPath,
        ], { timeout: 120000 });

        // Extract audio from original
        const audioPath = path.join(tmpDir, `audio${i}.aac`);
        await execFileAsync("ffmpeg", [
          "-i", inputPath,
          "-ss", seg.start.toFixed(2),
          "-t", segDuration,
          "-vn", "-c:a", "aac", "-b:a", "128k",
          "-y", audioPath,
        ], { timeout: 60000 });

        // Merge zoomed video + audio
        const segPath = path.join(tmpDir, `seg${i}.mp4`);
        await execFileAsync("ffmpeg", [
          "-i", zoomedPath,
          "-i", audioPath,
          "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", segPath,
        ], { timeout: 60000 });
      } else {
        // Simple trim with audio
        const segPath = path.join(tmpDir, `seg${i}.mp4`);
        await execFileAsync("ffmpeg", [
          "-i", inputPath,
          "-ss", seg.start.toFixed(2),
          "-t", segDuration,
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", segPath,
        ], { timeout: 120000 });
      }
    }

    // Step 3: Concatenate segments
    let outputPath: string;
    if (enabledSegs.length === 1) {
      outputPath = path.join(tmpDir, "seg0.mp4");
    } else {
      // Create concat file
      const concatContent = enabledSegs.map((_: unknown, i: number) => `file 'seg${i}.mp4'`).join("\n");
      const concatPath = path.join(tmpDir, "concat.txt");
      await fs.writeFile(concatPath, concatContent);

      outputPath = path.join(tmpDir, "output.mp4");
      await execFileAsync("ffmpeg", [
        "-f", "concat", "-safe", "0",
        "-i", concatPath,
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", outputPath,
      ], { timeout: 120000 });
    }

    // Step 4: Read output and return as binary
    const outputData = await fs.readFile(outputPath);

    console.log("[edit-video] Done! Output size:", outputData.length, "bytes");

    // Cleanup temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }

    return new NextResponse(outputData, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": outputData.length.toString(),
        "Content-Disposition": 'attachment; filename="edited.mp4"',
      },
    });
  } catch (err: unknown) {
    console.error("[edit-video] Error:", err);
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }

    const msg = err instanceof Error ? err.message : "Video editing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
