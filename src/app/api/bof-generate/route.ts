import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Workflow Types ─────────────────────────────────────────────────────
type WorkflowType = "intro-video-ai" | "warehouse-showcase" | "standard-bof" | "overlay-studio";

// ─── Scene Preset Prompts (for intro-video-ai Step 1) ──────────────────
const SCENE_PROMPTS: Record<string, string> = {
  "kitchen-counter":
    "Place this product on a modern kitchen countertop. The product should be the main focus, clearly visible and well-lit with its label facing the camera. The kitchen has marble countertops, soft natural light coming from a window, and subtle kitchen elements in the background like a coffee maker and fresh fruits. Warm, inviting atmosphere. Photorealistic, high quality product photography style.",
  "bathroom-counter":
    "Place this product on a clean bathroom counter. The product should be the main focus, clearly visible with its label facing the camera. Soft natural lighting, marble countertop, modern bathroom interior with elegant fixtures. Clean, fresh atmosphere. Photorealistic, high quality product photography style.",
  "bedroom-nightstand":
    "Place this product on a wooden bedroom nightstand. The product should be the main focus, clearly visible with its label facing the camera. Warm lamp light, cozy bedroom setting with soft blankets and pillows in background. Intimate, lifestyle aesthetic. Photorealistic, high quality product photography style.",
  "living-room":
    "Place this product on a living room coffee table. The product should be the main focus, clearly visible with its label facing the camera. Natural window light, modern couch in background, stylish interior decor. Comfortable, lifestyle product photography. Photorealistic, high quality.",
  "office-desk":
    "Place this product on a clean office desk. The product should be the main focus, clearly visible with its label facing the camera. Professional lighting, laptop and notepad in background, organized workspace. Business aesthetic. Photorealistic, high quality product photography style.",
  "outdoor-patio":
    "Place this product on an outdoor patio table. The product should be the main focus, clearly visible with its label facing the camera. Natural sunlight, plants and outdoor furniture in background, fresh and bright atmosphere. Photorealistic, high quality product photography style.",
  "vanity-mirror":
    "Place this product on a vanity table with a mirror. The product should be the main focus, clearly visible with its label facing the camera. Ring light illumination, makeup and beauty accessories in background, elegant mirror reflection. Beauty aesthetic. Photorealistic, high quality product photography style.",
  "gym-bench":
    "Place this product on a gym bench. The product should be the main focus, clearly visible with its label facing the camera. Dynamic lighting, fitness equipment in background, athletic environment. Fitness lifestyle aesthetic. Photorealistic, high quality product photography style.",
};

// ─── Video Motion Prompts (for intro-video-ai Step 2) ──────────────────
const VIDEO_MOTION_PROMPTS: Record<string, string> = {
  "kitchen-counter":
    "The camera slowly pushes in toward the product on the kitchen countertop, maintaining focus on the product label. Subtle natural light shifts as if clouds are passing outside the window. Very gentle camera movement, like handheld footage. The product stays perfectly still and in focus. Warm, inviting kitchen atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "bathroom-counter":
    "The camera slowly orbits the product on the bathroom counter, maintaining focus on the product label. Soft light gently shifts creating subtle reflections on the marble surface. Smooth, elegant camera movement. The product stays perfectly still and in focus. Clean, fresh atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "bedroom-nightstand":
    "The camera slowly pulls back from the product on the nightstand, revealing the cozy bedroom setting. Warm lamp light creates a gentle glow around the product. Smooth, cinematic camera movement. The product stays perfectly still and in focus. Intimate, warm atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "living-room":
    "The camera slowly pans around the product on the coffee table, maintaining focus on the product label. Natural window light gently illuminates the scene. Smooth, documentary-style camera movement. The product stays perfectly still and in focus. Comfortable, lifestyle atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "office-desk":
    "The camera slowly pushes in toward the product on the office desk, maintaining focus on the product label. Professional lighting remains consistent. Smooth, steady camera movement. The product stays perfectly still and in focus. Professional atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "outdoor-patio":
    "The camera slowly orbits the product on the patio table, maintaining focus on the product label. Natural sunlight creates gentle shadows that shift subtly. Smooth, handheld-style camera movement. The product stays perfectly still and in focus. Fresh, bright outdoor atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "vanity-mirror":
    "The camera slowly pushes in toward the product on the vanity table, maintaining focus on the product label. Ring light creates soft, even illumination with gentle reflections in the mirror. Smooth, elegant camera movement. The product stays perfectly still and in focus. Beauty aesthetic atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
  "gym-bench":
    "The camera slowly orbits the product on the gym bench, maintaining focus on the product label. Dynamic lighting creates subtle highlights and shadows. Energetic but smooth camera movement. The product stays perfectly still and in focus. Athletic atmosphere. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.",
};

// ─── Warehouse Showcase Prompt (Store to Home) ───────────────────────
const WAREHOUSE_SCENE_PROMPT =
  "Dozens of this EXACT product — same size, same shape, same packaging — stacked in neat rows on a multi-tiered pallet display standing in the center of a wide warehouse aisle. CRITICAL: The product must look EXACTLY like the reference image — same physical size, same proportions, same packaging design with the same brand name and labels clearly visible. Do NOT enlarge or change the product. Each individual product retains its original retail packaging with all branding, logos, and text perfectly preserved as shown in the reference image. The pallet display has a wooden pallet base with 4 to 5 tiers, each tier holding multiple rows of identical products with their packaging and labels clearly facing forward. Tall industrial metal shelving units filled with boxes line both sides of the aisle, receding into the distance. The scene is shot from a slightly low angle, looking up at the pallet display. Bright overhead fluorescent warehouse lighting. Concrete floor. The impression is of a massive wholesale warehouse with this product as the star. Photorealistic, high quality product photography style.";

const WAREHOUSE_VIDEO_PROMPT =
  "Handheld camera footage filmed by a real person walking through a warehouse aisle. The camera operator holds the camera at chest height with natural, subtle hand shake — not a stabilized gimbal, but organic handheld movement with slight sway and micro-jitters that make it feel authentic and real. PHASE 1 (first 4 seconds): The camera operator walks forward toward a multi-tiered pallet display standing in the center of the aisle, slowly zooming IN on the products stacked on the display. The products' packaging and brand labels become clearer as the camera gets closer. PHASE 2 (next 4 seconds): The camera operator stops and slowly zooms OUT, pulling back from the pallet display to reveal the full warehouse aisle with tall industrial shelving units on both sides receding into the distance. Dozens of identical products are stacked in neat rows on the pallet display tiers — each product is the same size and packaging as the reference image, with all brand names and labels clearly visible and preserved. Bright overhead fluorescent lighting, concrete floor. The footage feels like a real person filming inside a massive wholesale warehouse, not a smooth robotic zoom. The products stay perfectly still and in focus throughout. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness. Realistic handheld documentary style.";

// ─── Standard BOF Prompt ───────────────────────────────────────────────
const STANDARD_BOF_VIDEO_PROMPT =
  "Professional product showcase video. The camera slowly rotates around the product, showing it from multiple angles with smooth, cinematic camera movement. The product is well-lit with studio lighting on a clean, neutral background. The product label and packaging are clearly visible. Professional e-commerce style. NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.";

// ─── Text Overlay Scripts ────────────────────────────────────────────────
const SCRIPT_TEXTS: Record<string, string> = {
  "script-1": "This was literally double the price in-store / I couldn't believe how much they were charging / I found the exact same {name} way cheaper on TikTok Shop / tap below before it sells out",
  "script-2": "SORRY to anyone who / recently got the / {name}, / cause it just went on a / massive sale w/ free / shipping...",
  "script-3": "If you waited until / today you absolutely / won because the / {name} / is dirt cheap rn / with free shipping",
  "script-4": "Anyone else grabbing / a boatload of the / {name} / today since it's a / fraction of the price?",
  "script-5": "When a company is / rebranding so / {name} / is on a massive sale / to clear out stock",
  "script-6": "TikTok bullied the price / down and now the / {name} / is on a massive sale with / free shipping for the / next few hours...",
  "script-7": "Someone fcked up / at TikTok cus today the / {name} / is on a triple discount / with free shipping...",
  "script-8": "When the company / massivley overproduceed the / {name} / and now it is dirt cheap with / free shipping to clear some / stock!",
};

// ─── Warehouse Overlay Text Options (first 4s, like BatchBot) ───────────
const WAREHOUSE_OVERLAY_TEXTS: Record<string, string> = {
  "none": "",
  "insane-deal": "INSANE {name} DEAL!!!",
  "product-deal": "{name} DEAL!",
  "on-sale": "{name} on sale!",
};

// ─── Upload Image/File to KIE ────────────────────────────────────────────
async function uploadImageToKie(
  base64Data: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  let rawBase64 = base64Data;
  if (rawBase64.includes(",")) {
    rawBase64 = rawBase64.split(",")[1];
  }

  const res = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Data: rawBase64, fileName, uploadPath: "images" }),
  });

  const json = await res.json();
  if (!json.success) throw new Error("Image upload failed: " + (json.msg || JSON.stringify(json)));
  const downloadUrl = json.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Upload succeeded but no downloadUrl returned");
  return downloadUrl;
}

// ─── Upload Video File to KIE (base64) ──────────────────────────────────
async function uploadVideoToKie(
  filePath: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  console.log("[BOF Upload] Reading video file for upload:", filePath);
  const fileBuffer = await fs.readFile(filePath);
  const base64Data = fileBuffer.toString("base64");

  const res = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Data, fileName, uploadPath: "videos" }),
  });

  const json = await res.json();
  if (!json.success) throw new Error("Video upload failed: " + (json.msg || JSON.stringify(json)));
  const downloadUrl = json.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Video upload succeeded but no downloadUrl returned");
  console.log("[BOF Upload] Video uploaded:", downloadUrl);
  return downloadUrl;
}

// ─── Generate Scene Image (nano-banana-edit) ───────────────────────────
async function generateSceneImage(
  productImageUrl: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  console.log("[BOF Scene] Generating scene image...");

  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/nano-banana-edit",
      input: {
        prompt,
        image_urls: [productImageUrl],
        image_size: "9:16",
        output_format: "png",
        strength: 0.45,
      },
    }),
  });

  const json = await res.json();
  console.log("[BOF Scene] Submit response:", JSON.stringify(json).slice(0, 300));
  if (json.code !== 200) throw new Error("Scene image submit failed: " + (json.msg || JSON.stringify(json)));
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("No taskId for scene image generation");

  console.log("[BOF Scene] Task submitted:", taskId);

  for (let i = 0; i < 120; i++) {
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json();
      if (i % 10 === 0 || pollJson.code !== 200 || pollJson.data?.state === "success" || pollJson.data?.state === "fail") {
        console.log(`[BOF Scene] Poll #${i}:`, JSON.stringify(pollJson).slice(0, 500));
      }
      if (pollJson.code === 200) {
        const d = pollJson.data;
        if (d?.state === "success") {
          // Try every possible path to find the image URL
          let result = d.resultJson;
          if (typeof result === "string") { try { result = JSON.parse(result); } catch {} }

          const imageUrl =
            result?.resultUrls?.[0] ||
            result?.result_url ||
            result?.url ||
            result?.output?.url ||
            result?.images?.[0]?.url ||
            d.resultUrls?.[0] ||
            d.result_url ||
            d.url ||
            d.output?.url;

          if (imageUrl) {
            console.log("[BOF Scene] Scene image ready:", imageUrl);
            return imageUrl;
          }

          // Log the FULL response to debug URL extraction
          console.error("[BOF Scene] SUCCESS but no URL found. Full data:", JSON.stringify(d).slice(0, 1000));
          if (result && result !== d) {
            console.error("[BOF Scene] Full result:", JSON.stringify(result).slice(0, 1000));
          }
          throw new Error("Scene image ready but no URL found");
        }
        if (d?.state === "fail") throw new Error("Scene image generation failed: " + (d?.failMsg || "unknown"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("generation failed") || msg.includes("no URL")) throw err;
    }
    await sleep(3000);
  }
  throw new Error("Scene image generation timed out after 6 minutes");
}

// ─── Generate Video (Veo/Sora) ─────────────────────────────────────────
async function generateVideo(
  imageUrl: string,
  motionPrompt: string,
  videoModel: string,
  apiKey: string
): Promise<string> {
  // Map frontend model names to KIE.ai model names
  const modelMap: Record<string, string> = {
    "veo3_lite": "veo3_lite",
    "veo3_fast": "veo3_fast",
    "sora_2": "sora2",
  };
  const model = modelMap[videoModel] || "veo3_lite";

  console.log("[BOF Video] Generating video with model:", model);

  const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: motionPrompt,
      imageUrls: [imageUrl],
      model,
      aspect_ratio: "9:16",
      enableTranslation: false,
    }),
  });

  const json = await res.json();
  console.log("[BOF Video] Submit response:", JSON.stringify(json).slice(0, 300));
  if (json.code !== 200) throw new Error("Video submit failed: " + (json.msg || JSON.stringify(json)));
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("No taskId for video generation");

  console.log("[BOF Video] Video task submitted:", taskId);

  for (let i = 0; i < 180; i++) {
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json();
      if (i % 10 === 0 || pollJson.code !== 200 || pollJson.data?.successFlag === 1 || pollJson.data?.successFlag === 2 || pollJson.data?.successFlag === 3) {
        console.log(`[BOF Video] Poll #${i}:`, JSON.stringify(pollJson).slice(0, 800));
      }
      if (pollJson.code === 200) {
        const d = pollJson.data;
        if (d?.successFlag === 1 || d?.status === "success" || d?.state === "success") {
          // Try every possible path to find the video URL
          let resp = d.response || d.result || d;
          if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }

          let videoUrl =
            resp?.resultUrls?.[0] ||
            resp?.originUrls?.[0] ||
            resp?.url ||
            resp?.output?.url ||
            resp?.videoUrl ||
            resp?.video_url ||
            resp?.downloadUrl ||
            d.resultUrls?.[0] ||
            d.originUrls?.[0] ||
            d.videoUrl ||
            d.url ||
            d.output?.url ||
            d.downloadUrl;

          // Try parsing string resultUrls
          if (!videoUrl && typeof resp?.resultUrls === "string") {
            try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {}
          }
          if (!videoUrl && typeof d?.resultUrls === "string") {
            try { videoUrl = JSON.parse(d.resultUrls)[0]; } catch {}
          }

          // Deep search: scan all string values in the response for a URL pattern
          if (!videoUrl) {
            const urlPattern = /https?:\/\/[^\s"']+\.(mp4|mov|avi|webm)/i;
            const allStrings = JSON.stringify(d);
            const match = allStrings.match(urlPattern);
            if (match) {
              videoUrl = match[0];
              console.log("[BOF Video] Found URL via deep search:", videoUrl);
            }
          }

          // Even broader: look for any https URL that looks like a CDN video link
          if (!videoUrl) {
            const anyUrlPattern = /https?:\/\/[^\s"']+/g;
            const allStr = JSON.stringify(d);
            const allUrls = allStr.match(anyUrlPattern) || [];
            // Prefer URLs with video-related keywords
            videoUrl = allUrls.find((u: string) => /video|cdn|media|output|result|download|veo|sora/i.test(u)) || allUrls[0] || "";
            if (videoUrl) {
              console.log("[BOF Video] Found URL via broad search:", videoUrl);
            }
          }

          if (videoUrl) {
            console.log("[BOF Video] Video ready:", videoUrl);
            return videoUrl;
          }

          // Log the FULL response to debug URL extraction
          console.error("[BOF Video] SUCCESS but no URL found. Full data:", JSON.stringify(d).slice(0, 2000));
          if (resp && resp !== d) {
            console.error("[BOF Video] Full resp:", JSON.stringify(resp).slice(0, 2000));
          }
          throw new Error("Video ready but no URL found");
        }
        if (d?.successFlag === 2 || d?.successFlag === 3 || d?.status === "failed" || d?.state === "fail") {
          throw new Error("Video generation failed: " + (d?.errorMessage || d?.error || d?.failMsg || "unknown"));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("generation failed") || msg.includes("no URL")) throw err;
    }
    await sleep(5000);
  }
  throw new Error("Video generation timed out after 15 minutes");
}

// ─── Download Video to Temp File ────────────────────────────────────────
async function downloadVideoToTemp(videoUrl: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bof-vid-"));
  const tmpPath = path.join(tmpDir, "input.mp4");

  console.log("[BOF FFmpeg] Downloading video to:", tmpPath);
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);
  console.log("[BOF FFmpeg] Video downloaded, size:", buffer.length);
  return tmpPath;
}

// ─── Get Video Dimensions ───────────────────────────────────────────────
async function getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0",
    videoPath,
  ]);
  const parts = stdout.trim().split("x");
  return { width: parseInt(parts[0]), height: parseInt(parts[1]) };
}

// ─── Word-wrap text to fit video width ───────────────────────────────────
// Estimates text width and breaks lines that would exceed maxWidth
function wordWrapText(lines: string[], fontSize: number, maxWidth: number): string[] {
  // Poppins Bold average char width ≈ 0.55 * fontSize
  const charWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.max(8, Math.floor(maxWidth / charWidth)); // minimum 8 chars per line

  const wrapped: string[] = [];
  for (const line of lines) {
    if (line.length <= maxCharsPerLine) {
      wrapped.push(line);
    } else {
      // Break long lines at word boundaries
      const words = line.split(" ");
      let currentLine = "";
      for (const word of words) {
        // If a single word is longer than maxCharsPerLine, split it
        if (word.length > maxCharsPerLine) {
          if (currentLine) {
            wrapped.push(currentLine);
            currentLine = "";
          }
          // Split long word into chunks
          for (let i = 0; i < word.length; i += maxCharsPerLine) {
            wrapped.push(word.substring(i, i + maxCharsPerLine));
          }
          continue;
        }
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) wrapped.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) wrapped.push(currentLine);
    }
  }
  return wrapped;
}

// ─── Find Font File ──────────────────────────────────────────────────────
async function findFontFile(): Promise<string> {
  const candidates = [
    // System font (installed by Dockerfile)
    "/usr/share/fonts/truetype/custom/Poppins-Bold.ttf",
    // Public directory (local dev & standalone)
    path.join(process.cwd(), "public", "fonts", "Poppins-Bold.ttf"),
    // Common Linux paths
    "/usr/share/fonts/truetype/poppins/Poppins-Bold.ttf",
    "/usr/share/fonts/Poppins-Bold.ttf",
  ];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  // Fallback: use fontconfig font name (requires fontconfig + font registered)
  // This uses font= instead of fontfile= in the drawtext filter
  return "FONTCONFIG:Poppins Bold";
}

// ─── Apply Text Overlay with FFmpeg using ASS subtitles ───────────────
// Uses ASS subtitle format instead of drawtext filter for better Alpine compatibility
// ASS subtitles are rendered by libass which is included in Alpine's ffmpeg package
async function applyTextOverlayFFmpeg(
  inputPath: string,
  overlayText: string,
  position: "top" | "center",
  scale: number, // 40-100
  fontWeight: number = 800 // 600 for intro, 800 for BOF/warehouse
): Promise<string> {
  const tmpDir = path.dirname(inputPath);
  const outputPath = path.join(tmpDir, "output.mp4");
  const assPath = path.join(tmpDir, "overlay.ass");

  // Get video dimensions for responsive text sizing
  const { width: displayWidth, height: displayHeight } = await getVideoDimensions(inputPath);

  // Font size: 3.5% of video height, scaled by user's overlaySize
  const baseFontSize = Math.round(displayHeight * 0.035);
  const fontSize = Math.max(16, Math.round(baseFontSize * (scale / 100)));
  const lineHeight = Math.round(fontSize * 1.4);

  // Split text by " / " to get individual lines (batchbot format)
  let lines = overlayText.split(" / ").filter((l) => l.trim());

  // Auto word-wrap lines to fit within video width (with 10% padding on each side)
  const maxTextWidth = displayWidth * 0.85;
  lines = wordWrapText(lines, fontSize, maxTextWidth);

  // Limit total lines
  const maxLines = position === "top"
    ? Math.floor((displayHeight * 0.5) / lineHeight)
    : Math.floor((displayHeight * 0.7) / lineHeight);
  if (lines.length > maxLines) {
    console.warn(`[BOF FFmpeg] Truncating ${lines.length} lines to ${maxLines}`);
    lines = lines.slice(0, maxLines);
  }

  // Find font file for ASS
  const fontPath = await findFontFile();
  const isFontconfig = fontPath.startsWith("FONTCONFIG:");
  const fontName = isFontconfig
    ? fontPath.replace("FONTCONFIG:", "")
    : "Poppins Bold"; // ASS uses font name, not file path

  // Build ASS subtitle file
  // ASS format: position text with black outline on semi-transparent background
  const playResX = displayWidth;
  const playResY = displayHeight;

  // Calculate vertical position
  const startY = position === "top"
    ? Math.round(displayHeight / 6)
    : Math.round(displayHeight / 2 - (lines.length * lineHeight) / 2);

  // ASS header
  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Overlay,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Build text events — each line appears at a calculated Y position
  // Use ASS positioning tags to center each line horizontally and place vertically
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    const escapedLine = lines[i]
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\\n/g, " ");
    
    // ASS \an8 = top center, \pos(x,y) = absolute position
    // Using \an2 (bottom center) with \pos for vertical centering
    assContent += `Dialogue: 0,0:00:00.00,99:59:59.99,Overlay,,0,0,0,,{\\an8\\pos(${Math.round(playResX / 2)},${y})}${escapedLine}\n`;
  }

  await fs.writeFile(assPath, assContent, "utf-8");

  console.log("[BOF FFmpeg] Applying text overlay via ASS subtitles:", {
    fontSize,
    displayWidth,
    displayHeight,
    lines: lines.length,
    position,
    scale,
    startY,
    fontName,
    assPreview: assContent.substring(0, 300),
  });

  // Run FFmpeg with ASS subtitle burn-in
  try {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-vf", `ass=${assPath}`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-c:a", "copy",
      outputPath,
    ], { timeout: 120000 });

    if (stderr && stderr.length > 0) {
      // Check for actual errors vs normal warnings
      const hasError = stderr.toLowerCase().includes("error") && !stderr.includes("[info]");
      if (hasError) {
        console.log("[BOF FFmpeg] stderr:", stderr.substring(0, 500));
      }
    }
  } catch (ffmpegErr: unknown) {
    const errMsg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
    console.error("[BOF FFmpeg] ASS subtitle approach failed!");
    console.error("[BOF FFmpeg] Error:", errMsg.substring(0, 1000));

    // Fallback: try drawtext approach
    console.log("[BOF FFmpeg] Trying drawtext fallback...");
    try {
      const drawtextFilters = lines.map((line, i) => {
        const escapedLine = line
          .replace(/\\/g, "\\\\\\\\")
          .replace(/'/g, "\\\\'")
          .replace(/:/g, "\\\\:")
          .replace(/%/g, "\\\\%");
        const y = startY + i * lineHeight;
        const fontParam = isFontconfig ? `font=${fontName}` : `fontfile=${fontPath}`;
        return `drawtext=text='${escapedLine}':${fontParam}:fontsize=${fontSize}:fontcolor=white:borderw=3:bordercolor=black:fix_bounds=1:x=(w-text_w)/2:y=${y}`;
      });
      const filterComplex = drawtextFilters.join(",");

      await execFileAsync("ffmpeg", [
        "-y",
        "-i", inputPath,
        "-vf", filterComplex,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-c:a", "copy",
        outputPath,
      ], { timeout: 120000 });
      console.log("[BOF FFmpeg] Drawtext fallback succeeded");
    } catch (fallbackErr) {
      console.error("[BOF FFmpeg] Drawtext fallback also failed:", (fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)).substring(0, 500));
      throw ffmpegErr;
    }
  }

  console.log("[BOF FFmpeg] Text overlay applied successfully");
  return outputPath;
}

// ─── Resolve Overlay Text from Script ───────────────────────────────────
function resolveOverlayText(
  overlayScript: string,
  customOverlayText: string,
  productName: string
): string {
  let text = "";
  if (overlayScript === "custom" && customOverlayText.trim()) {
    text = customOverlayText.trim();
  } else if (SCRIPT_TEXTS[overlayScript]) {
    text = SCRIPT_TEXTS[overlayScript];
  } else {
    return ""; // No overlay
  }

  // Replace product name placeholders
  text = text.replace(/\[Product Name\]/g, productName).replace(/\{name\}/g, productName);
  return text;
}

// ─── Cleanup Temp Files ─────────────────────────────────────────────────
async function cleanupTemp(inputPath: string) {
  try {
    const tmpDir = path.dirname(inputPath);
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {}
}

// ─── Auto-Retry Helper ─────────────────────────────────────────────────
// Retries a function up to maxRetries times with exponential backoff
// Only retries on transient errors (not on auth/validation errors)
const NON_RETRYABLE = ["Not authenticated", "Product image is required", "Image upload failed", "coming soon"];

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(`[BOF Retry] ${label} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;

      // Don't retry non-retryable errors
      if (NON_RETRYABLE.some(nr => msg.includes(nr))) {
        console.error(`[BOF Retry] ${label} failed with non-retryable error: ${msg}`);
        throw lastError;
      }

      if (attempt <= maxRetries) {
        const delay = attempt * 5000; // 5s, 10s backoff
        console.warn(`[BOF Retry] ${label} attempt ${attempt}/${maxRetries + 1} failed: ${msg}. Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error(`[BOF Retry] ${label} failed after ${maxRetries + 1} attempts: ${msg}`);
        throw lastError;
      }
    }
  }
  throw lastError!;
}

// ─── POST Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let tempInputPath: string | null = null;

  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const {
      productImage,
      scenePreset,
      customPrompt,
      videoModel,
      kieApiKey,
      workflowType = "intro-video-ai",
      duration = "7s",
      reversePlayback = false,
      textOverlay = true,
      overlayScript = "",
      overlayPosition = "center",
      overlaySize = 100,
      customOverlayText = "",
      selectedImageOverlay = "none",
      selectedAudio = "none",
      productName = "",
      warehouseOverlayText = "insane-deal",
      warehouseCustomOverlayText = "",
      selectedVoice = "none",
      selectedQuality = "standard",
    } = body;

    if (!productImage) return NextResponse.json({ error: "Product image is required" }, { status: 400 });

    const apiKey = kieApiKey?.length >= 10 ? kieApiKey : DEFAULT_KIE_API_KEY;
    const wf = (workflowType as WorkflowType) || "intro-video-ai";

    // Step 0: Upload product image to KIE
    console.log("[BOF] Uploading product image...");
    let productImageUrl: string;
    try {
      productImageUrl = await uploadImageToKie(productImage, `bof_product_${Date.now()}.png`, apiKey);
      console.log("[BOF] Product image uploaded:", productImageUrl);
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      console.error("[BOF] Product image upload failed:", msg);
      return NextResponse.json({ error: `Image upload failed: ${msg}` }, { status: 500 });
    }

    let sceneImageUrl = "";
    let videoUrl = "";

    // ── Pipeline: Intro Video + AI ──────────────────────────────────
    // 2-step: Scene image (nano-banana-edit) → Video (Veo) → FFmpeg text overlay
    if (wf === "intro-video-ai") {
      const scenePrompt =
        scenePreset === "custom" && customPrompt?.trim()
          ? customPrompt.trim()
          : SCENE_PROMPTS[scenePreset] || SCENE_PROMPTS["kitchen-counter"];

      const motionPrompt =
        scenePreset === "custom" && customPrompt?.trim()
          ? `Subtle camera movement showing the product. ${customPrompt.trim()} NO transitions, NO fade-in, NO fade-out. Start instantly at full brightness.`
          : VIDEO_MOTION_PROMPTS[scenePreset] || VIDEO_MOTION_PROMPTS["kitchen-counter"];

      console.log("[BOF] Intro Video + AI pipeline: Step 1 - Scene image");
      sceneImageUrl = await withRetry(
        () => generateSceneImage(productImageUrl, scenePrompt, apiKey),
        "Scene image (Intro)",
        2
      );
      console.log("[BOF] Scene image ready:", sceneImageUrl);

      console.log("[BOF] Intro Video + AI pipeline: Step 2 - Video from scene");
      videoUrl = await withRetry(
        () => generateVideo(sceneImageUrl, motionPrompt, videoModel, apiKey),
        "Video (Intro)",
        2
      );
      console.log("[BOF] Video ready:", videoUrl);

      // Step 3: Apply text overlay via FFmpeg (if enabled) — non-blocking
      if (textOverlay && overlayScript) {
        const overlayText = resolveOverlayText(overlayScript, customOverlayText, productName);
        if (overlayText) {
          console.log("[BOF] Intro Video + AI pipeline: Step 3 - FFmpeg text overlay");
          try {
            tempInputPath = await downloadVideoToTemp(videoUrl);
            const processedPath = await applyTextOverlayFFmpeg(
              tempInputPath,
              overlayText,
              overlayPosition as "top" | "center",
              overlaySize,
              600 // semi-bold for intro
            );
            const newUrl = await uploadVideoToKie(processedPath, `bof_overlay_${Date.now()}.mp4`, apiKey);
            videoUrl = newUrl;
            await cleanupTemp(tempInputPath);
            tempInputPath = null;
            console.log("[BOF] Text overlay applied successfully");
          } catch (ffmpegErr) {
            const msg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
            console.error("[BOF] FFmpeg text overlay failed (returning original video):", msg);
            if (tempInputPath) { await cleanupTemp(tempInputPath); tempInputPath = null; }
          }
        }
      }
    }

    // ── Pipeline: Warehouse Showcase (Store to Home) ──────────────────
    // 2-step: Warehouse scene image → Warehouse video → FFmpeg text overlay
    else if (wf === "warehouse-showcase") {
      console.log("[BOF] Store to Home pipeline: Step 1 - Warehouse scene image");
      sceneImageUrl = await withRetry(
        () => generateSceneImage(productImageUrl, WAREHOUSE_SCENE_PROMPT, apiKey),
        "Scene image (Warehouse)",
        2
      );
      console.log("[BOF] Warehouse scene image ready:", sceneImageUrl);

      let warehousePrompt = WAREHOUSE_VIDEO_PROMPT;
      if (reversePlayback) {
        warehousePrompt += " Reverse playback effect.";
      }

      // Use high quality model if selected
      const effectiveVideoModel = selectedQuality === "high" ? "veo3_fast" : videoModel;

      console.log("[BOF] Store to Home pipeline: Step 2 - 8s warehouse video");
      videoUrl = await withRetry(
        () => generateVideo(sceneImageUrl, warehousePrompt, effectiveVideoModel, apiKey),
        "Video (Warehouse)",
        2
      );
      console.log("[BOF] Warehouse video ready:", videoUrl);

      // Step 3: Apply text overlay via FFmpeg (if enabled)
      // Combine warehouse overlay text (header like "INSANE [product] DEAL!!!") + script text
      if (textOverlay) {
        // Build the full overlay text: header (overlay text) + script text
        let fullOverlayText = "";
        
        // Add warehouse overlay text (header like "INSANE DEAL!!!") if selected
        let headerText = "";
        if (warehouseOverlayText === "custom-overlay" && warehouseCustomOverlayText.trim()) {
          headerText = warehouseCustomOverlayText.trim();
        } else if (WAREHOUSE_OVERLAY_TEXTS[warehouseOverlayText]) {
          headerText = WAREHOUSE_OVERLAY_TEXTS[warehouseOverlayText];
        }
        
        // Add script text if selected
        let scriptText = resolveOverlayText(overlayScript, customOverlayText, productName);
        
        // Combine: header on top, script below (separated by " / " for line break)
        if (headerText && scriptText) {
          // Replace product name placeholder in header
          headerText = headerText.replace(/\{name\}/g, productName).replace(/\[Product Name\]/g, productName);
          fullOverlayText = headerText + " / " + scriptText;
        } else if (headerText) {
          headerText = headerText.replace(/\{name\}/g, productName).replace(/\[Product Name\]/g, productName);
          fullOverlayText = headerText;
        } else if (scriptText) {
          fullOverlayText = scriptText;
        }
        
        if (fullOverlayText) {
          console.log("[BOF] Store to Home pipeline: Step 3 - FFmpeg text overlay");
          try {
            tempInputPath = await downloadVideoToTemp(videoUrl);
            const processedPath = await applyTextOverlayFFmpeg(
              tempInputPath,
              fullOverlayText,
              overlayPosition as "top" | "center",
              overlaySize,
              800 // extra-bold for warehouse
            );
            const newUrl = await uploadVideoToKie(processedPath, `bof_warehouse_${Date.now()}.mp4`, apiKey);
            videoUrl = newUrl;
            await cleanupTemp(tempInputPath);
            tempInputPath = null;
            console.log("[BOF] Warehouse text overlay applied successfully");
          } catch (ffmpegErr) {
            const msg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
            console.error("[BOF] FFmpeg text overlay failed (returning original video):", msg);
            if (tempInputPath) { await cleanupTemp(tempInputPath); tempInputPath = null; }
          }
        }
      }
    }

    // ── Pipeline: Standard BOF ──────────────────────────────────────
    // 1-step: Direct image-to-video → FFmpeg text overlay
    else if (wf === "standard-bof") {
      console.log("[BOF] Standard BOF pipeline: Step 1 - Direct image-to-video");
      videoUrl = await withRetry(
        () => generateVideo(productImageUrl, STANDARD_BOF_VIDEO_PROMPT, videoModel, apiKey),
        "Video (Standard BOF)",
        2
      );
      console.log("[BOF] Standard BOF video ready:", videoUrl);

      // Step 2: Apply text overlay via FFmpeg (if enabled) — non-blocking
      if (textOverlay && overlayScript) {
        const overlayText = resolveOverlayText(overlayScript, customOverlayText, productName);
        if (overlayText) {
          console.log("[BOF] Standard BOF pipeline: Step 2 - FFmpeg text overlay");
          try {
            tempInputPath = await downloadVideoToTemp(videoUrl);
            const processedPath = await applyTextOverlayFFmpeg(
              tempInputPath,
              overlayText,
              overlayPosition as "top" | "center",
              overlaySize,
              800 // extra-bold for BOF
            );
            const newUrl = await uploadVideoToKie(processedPath, `bof_standard_${Date.now()}.mp4`, apiKey);
            videoUrl = newUrl;
            await cleanupTemp(tempInputPath);
            tempInputPath = null;
            console.log("[BOF] Standard BOF text overlay applied successfully");
          } catch (ffmpegErr) {
            const msg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
            console.error("[BOF] FFmpeg text overlay failed (returning original video):", msg);
            if (tempInputPath) { await cleanupTemp(tempInputPath); tempInputPath = null; }
          }
        }
      }
    }

    // ── Pipeline: Overlay Studio ────────────────────────────────────
    // Not yet implemented (requires video upload + overlay)
    else if (wf === "overlay-studio") {
      return NextResponse.json({ error: "Overlay Studio is coming soon" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sceneImageUrl,
      videoUrl,
      workflowType: wf,
      retries: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BOF] Error:", msg);
    // Cleanup temp files on error
    if (tempInputPath) await cleanupTemp(tempInputPath);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
