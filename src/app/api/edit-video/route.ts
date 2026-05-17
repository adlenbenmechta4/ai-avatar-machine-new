import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

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

    // Step 1: Download video
    console.log("[edit-video] Downloading video:", videoUrl);
    const inputPath = path.join(tmpDir, "input.mp4");

    // Use curl to download (handles redirects, various URL schemes)
    try {
      await execFileAsync("curl", ["-L", "-s", "-o", inputPath, videoUrl], { timeout: 60000 });
    } catch {
      // Try with proxy if direct download fails
      try {
        await execFileAsync("curl", ["-L", "-s", "-o", inputPath, `http://localhost:3000/api/proxy-video?url=${encodeURIComponent(videoUrl)}`], { timeout: 60000 });
      } catch (dlErr) {
        console.error("[edit-video] Download failed:", dlErr);
        return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
      }
    }

    // Verify file exists and has content
    const inputStat = await fs.stat(inputPath);
    if (inputStat.size < 1000) {
      return NextResponse.json({ error: "Downloaded file is too small or empty" }, { status: 500 });
    }
    console.log("[edit-video] Downloaded:", inputStat.size, "bytes");

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
