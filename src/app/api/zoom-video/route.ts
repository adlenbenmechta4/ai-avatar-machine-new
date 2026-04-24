import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 300; // 5 min timeout

interface ZoomParams {
  type: "in" | "out" | "kenburns";
  intensity: number; // 1.1 - 2.0
  speed: "slow" | "normal" | "fast";
  targetX: number; // 0-1
  targetY: number; // 0-1
}

function buildZoompanFilter(
  duration: number,
  params: ZoomParams,
  width: number,
  height: number
): string {
  const fps = 30;
  const speedMap = { slow: 0.0004, normal: 0.001, fast: 0.002 };
  const increment = speedMap[params.speed];
  const maxZ = params.intensity;
  const tx = params.targetX;
  const ty = params.targetY;
  const halfFrames = Math.round((duration * fps) / 2);

  let zExpr: string;
  switch (params.type) {
    case "in":
      zExpr = `min(zoom+${increment},${maxZ})`;
      break;
    case "out":
      zExpr = `if(eq(on,1),${maxZ},max(zoom-${increment},1.0))`;
      break;
    case "kenburns":
      zExpr = `if(lt(on,${halfFrames}),min(zoom+${increment},${maxZ}),max(zoom-${increment},1.0))`;
      break;
  }

  const xExpr = `max(0,min(iw*${tx}-iw/zoom/2,iw-iw/zoom))`;
  const yExpr = `max(0,min(ih*${ty}-ih/zoom/2,ih-ih/zoom))`;

  return `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}:fps=${fps}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      video_url,
      zoom_type = "kenburns",
      zoom_intensity = 1.3,
      zoom_speed = "normal",
      zoom_target_x = 0.5,
      zoom_target_y = 0.4,
    } = body;

    if (!video_url) {
      return NextResponse.json({ error: "Missing video_url" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(video_url);
    } catch {
      return NextResponse.json({ error: "Invalid video URL" }, { status: 400 });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 });
    }

    // Create temp directory
    const workDir = await mkdtemp(join(tmpdir(), "zoom-"));
    const inputPath = join(workDir, "input.mp4");
    const outputPath = join(workDir, "output.mp4");

    try {
      // 1. Download video
      console.log("[zoom-video] Downloading video...");
      const videoRes = await fetch(video_url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!videoRes.ok) {
        return NextResponse.json({ error: `Failed to download video: ${videoRes.status}` }, { status: 400 });
      }
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      await writeFile(inputPath, videoBuffer);
      console.log(`[zoom-video] Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      // 2. Get video metadata (duration, resolution)
      console.log("[zoom-video] Getting video metadata...");
      const probeOutput = await execFileAsync("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        inputPath,
      ]);
      const probe = JSON.parse(probeOutput.stdout);
      const videoStream = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
      if (!videoStream) {
        return NextResponse.json({ error: "No video stream found" }, { status: 400 });
      }
      const width = videoStream.width || 1920;
      const height = videoStream.height || 1080;
      const duration = parseFloat(probe.format?.duration || "30");
      console.log(`[zoom-video] Video: ${width}x${height}, ${duration.toFixed(1)}s`);

      // 3. Build and run FFmpeg with zoompan filter
      const zoomParams: ZoomParams = {
        type: zoom_type,
        intensity: zoom_intensity,
        speed: zoom_speed,
        targetX: zoom_target_x,
        targetY: zoom_target_y,
      };
      const filter = buildZoompanFilter(duration, zoomParams, width, height);
      console.log(`[zoom-video] Filter: ${filter}`);

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", inputPath,
        "-vf", filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputPath,
      ], { maxBuffer: 50 * 1024 * 1024 });
      console.log("[zoom-video] FFmpeg processing complete");

      // 4. Read output file
      const outputBuffer = await readFile(outputPath);
      console.log(`[zoom-video] Output: ${(outputBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      // 5. Return as downloadable file
      return new NextResponse(outputBuffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="zoom-${Date.now()}.mp4"`,
          "Content-Length": outputBuffer.length.toString(),
        },
      });
    } finally {
      // Cleanup temp files
      try {
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
      } catch {}
    }
  } catch (error: unknown) {
    console.error("[zoom-video] Error:", error);
    const msg = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
