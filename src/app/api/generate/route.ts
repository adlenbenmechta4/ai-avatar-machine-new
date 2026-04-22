import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { createJob, updateJob, updateScene, setJobDone, setJobError, addJobLog } from "@/lib/job-store";
import { deductCredits, getCreditBalance, getCreditCostPerScene } from "@/lib/credits";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Upload Image ─────────────────────────────────────────────────
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
      "Authorization": `Bearer ${apiKey}`,
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

// ─── Kie.ai Image Polling ─────────────────────────────────────────────
async function pollKieImage(
  jobId: string,
  sceneIndex: number,
  taskId: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const json = await res.json();
      if (json.code === 200) {
        const d = json.data;
        if (d?.state === "success") {
          let result;
          if (typeof d.resultJson === "string") {
            try { result = JSON.parse(d.resultJson); } catch {}
          } else { result = d.resultJson; }
          const imageUrl = result?.resultUrls?.[0] || result?.result_url || result?.url;
          if (imageUrl) return imageUrl;
          throw new Error("Image ready but no URL found in resultJson");
        }
        if (d?.state === "fail") throw new Error("Image gen failed: " + (d?.failMsg || "unknown error"));
      }

      // Send progress updates every ~15 seconds to keep connection alive
      if (i % 5 === 0 && i > 0) {
        const elapsed = Math.round((i * 3) / 60);
        const pct = Math.min(90, 15 + i);
        addJobLog(jobId, `Frame ${sceneIndex + 1}: still generating... [${elapsed}m elapsed]`);
        updateScene(jobId, sceneIndex, { frameProgress: pct });
        if (writer) {
          try { sse(writer, { type: "progress", step: 1, pct, message: `Frame ${sceneIndex + 1}: generating... [${elapsed}m]` }); } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Image gen failed") || msg.includes("no URL")) throw err;
      console.warn(`[Image Poll ${i}] ${msg}`);
    }
    await sleep(3000);
  }
  throw new Error("Image generation timed out after 6 minutes");
}

// ─── Kie.ai Video Polling ─────────────────────────────────────────────
async function pollKieVideo(
  jobId: string,
  sceneIndex: number,
  taskId: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  const url = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const json = await res.json();
      if (json.code === 200) {
        const d = json.data;
        if (d?.successFlag === 1 || d?.status === "success" || d?.state === "success") {
          let resp = d.response || d.result || d;
          if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }
          let videoUrl = resp?.resultUrls?.[0] || resp?.originUrls?.[0] || resp?.url || d.resultUrls?.[0] || d.videoUrl || d.video_url;
          if (!videoUrl && typeof resp?.resultUrls === "string") { try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {} }
          if (videoUrl) return videoUrl;
          throw new Error("Video ready but no URL: " + JSON.stringify(d).slice(0, 300));
        }
        if (d?.successFlag === 2 || d?.successFlag === 3 || d?.status === "failed" || d?.state === "fail") {
          throw new Error("Video gen failed: " + (d?.errorMessage || d?.error || d?.failMsg || "unknown error"));
        }
      }

      // Send progress updates every ~30 seconds to keep connection alive
      if (i % 6 === 0 && i > 0) {
        const elapsed = Math.round((i * 5) / 60);
        const pct = Math.min(90, 15 + Math.round(i * 0.5));
        const statusText = json.data?.status || json.data?.state || "waiting";
        addJobLog(jobId, `Video ${sceneIndex + 1}: still processing... [${elapsed}m elapsed] (${statusText})`);
        updateScene(jobId, sceneIndex, { videoProgress: pct });
        if (writer) {
          try { sse(writer, { type: "progress", step: 2, pct, message: `Video ${sceneIndex + 1}: processing... [${elapsed}m]` }); } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Video gen failed") || msg.includes("no URL")) throw err;
      console.warn(`[Video Poll ${i}] ${msg}`);
    }
    await sleep(5000);
  }
  throw new Error("Video generation timed out after 15 minutes");
}

// ─── Download & Re-upload Frame ──────────────────────────────────────
async function downloadAndReuploadFrame(
  jobId: string,
  sceneIndex: number,
  imageUrl: string,
  apiKey: string
): Promise<string> {
  try {
    addJobLog(jobId, `Frame ${sceneIndex + 1}: downloading & re-uploading...`);
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;
    const kieUrl = await uploadImageToKie(dataUrl, `frame_${Date.now()}.png`, apiKey);
    addJobLog(jobId, `Frame ${sceneIndex + 1}: re-uploaded successfully`);
    return kieUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Frame re-upload failed for scene ${sceneIndex}:`, msg);
    addJobLog(jobId, `Frame ${sceneIndex + 1}: re-upload failed, using original URL`);
    return imageUrl;
  }
}

// ─── Generate Frame (nano-banana-edit) — with auto-retry ─────────────
async function generateFrame(
  jobId: string,
  sceneIndex: number,
  description: string,
  avatarUrl: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        addJobLog(jobId, `Frame ${sceneIndex + 1}: retrying... (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(10000); // Wait 10s before retry
      }

      const imgPrompt =
        "ONLY change the background and environment. Keep the EXACT SAME person from the reference image — " +
        "same face, same facial features, same hair, same skin tone, same body, same clothing, same expression. " +
        "Do NOT alter, modify, or regenerate the person in any way. " +
        "New background/setting: " + description.trim() +
        ". The person stays in the exact same pose and position, facing the camera directly. Photorealistic, high quality.";

      addJobLog(jobId, `Frame ${sceneIndex + 1}: submitting to AI frame generator${attempt > 1 ? ` (attempt ${attempt})` : ""}...`);
      updateScene(jobId, sceneIndex, { frameProgress: 5 });

      const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/nano-banana-edit",
          input: { prompt: imgPrompt, image_urls: [avatarUrl], image_size: "9:16", output_format: "png", strength: 0.35 },
        }),
      });
      const json = await res.json();
      updateScene(jobId, sceneIndex, { frameProgress: 10 });

      if (json.code !== 200) throw new Error("Frame submit failed: " + (json.msg || JSON.stringify(json)));
      const taskId = json.data?.taskId;
      if (!taskId) throw new Error("No taskId for frame generation");

      updateScene(jobId, sceneIndex, { frameProgress: 15 });
      addJobLog(jobId, `Frame ${sceneIndex + 1}: task submitted, waiting...`);

      const rawFrameUrl = await pollKieImage(jobId, sceneIndex, taskId, apiKey, writer);
      updateScene(jobId, sceneIndex, { frameProgress: 92 });
      addJobLog(jobId, `Frame ${sceneIndex + 1}: generated!`);

      const kieFrameUrl = await downloadAndReuploadFrame(jobId, sceneIndex, rawFrameUrl, apiKey);
      updateScene(jobId, sceneIndex, { frameProgress: 100, frameDone: true, frameUrl: kieFrameUrl });
      addJobLog(jobId, `Frame ${sceneIndex + 1}: ready!`);
      return kieFrameUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addJobLog(jobId, `Frame ${sceneIndex + 1} attempt ${attempt} failed: ${msg}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Frame ${sceneIndex + 1} failed after ${MAX_RETRIES} attempts: ${msg}`);
      }
      // Reset progress for retry
      updateScene(jobId, sceneIndex, { frameProgress: 0 });
    }
  }
  throw new Error(`Frame ${sceneIndex + 1}: unexpected exit from retry loop`);
}

// ─── Video Voice Prompt ──────────────────────────────────────────────
const VIDEO_VOICE_PROMPT =
  "AUDIO RULES: MUTE ALL BACKGROUND AUDIO COMPLETELY. " +
  "ZERO music — no background music, no instrumental music, no ambient music, no soundtrack, no beat, no melody, no jingle, no BGM of any kind. " +
  "ZERO ambient sounds — no wind, no birds, no traffic, no footsteps, no nature sounds, no room tone, no echo, no reverb, no environmental audio whatsoever. " +
  "The ONLY audio allowed is the person's own voice: a clear, warm, natural speaking voice with confident tone and friendly delivery. " +
  "The audio track must contain ONLY clean, dry voice — no music intro, no music outro, no music transitions between scenes, no background score at any point. " +
  "Absolutely no sound effects, no whoosh, no ding, no transition sounds. " +
  "This is critical: the final audio must be 100% voice-only with zero musical or ambient elements. ";

// ─── Visual Constraints Prompt ────────────────────────────────────────
// Prevents transitions, hallucinated objects, and excessive/unrealistic movement
const VIDEO_VISUAL_CONSTRAINTS =
  "IMPORTANT: This is a RAW UNCUT CONTINUOUS SHOT — NOT an edited video. You must NOT apply ANY post-production effects, transitions, or editing. " +
  "Output must look like raw footage from a single locked camera — like a security cam or webcam recording. No editing, no effects, no transitions at all. " +
  "\n" +
  "1. ABSOLUTE BAN ON ALL TRANSITIONS (ZERO TOLERANCE): " +
  "Do NOT add ANY visual transitions at ANY point — beginning, middle, or end of the video. " +
  "BANNED transitions (ALL of these are FORBIDDEN): " +
  "fade-in from black, fade-out to black, fade-in from white, fade-out to white, cross-dissolve, cross-fade, wipe, flash, glitch, " +
  "jump cut, whip pan, blur transition, iris wipe, slide transition, zoom transition, dip to color, soft wipe, hard cut, " +
  "morph transition, ink wipe, clock wipe, star wipe, any fade effect, any dissolve effect, any color flash. " +
  "The video must START INSTANTLY at full brightness — NO fade-in. " +
  "The video must END INSTANTLY at full brightness — NO fade-out. " +
  "There must be ZERO cuts, ZERO edits, ZERO transition effects of ANY kind at ANY timestamp in the video. " +
  "Every single frame from 0:00 to the end must maintain full, consistent visibility with NO opacity changes, NO color shifts, NO brightness changes. " +
  "If you add any transition effect, the video will be REJECTED. This is the #1 most important rule. " +
  "\n" +
  "2. STATIC CAMERA (LOCKED TRIPOD): " +
  "The camera angle, framing, and composition MUST remain IDENTICAL to the reference image for the ENTIRE duration. " +
  "NO zooming, NO panning, NO tilting, NO tracking, NO dolly, NO camera shake, NO floating camera movement. " +
  "The camera must be 100% locked and static — no movement whatsoever. " +
  "\n" +
  "3. OBJECT LOCK: " +
  "Do NOT add, remove, modify, or animate ANY objects that were not in the reference image. " +
  "NO floating text, NO graphics, NO subtitles, NO overlays, NO particles, NO sparkles, NO light rays, NO lens flare, NO bokeh. " +
  "The background must remain EXACTLY as shown in the reference image — no changes. " +
  "\n" +
  "4. MINIMAL PERSON MOVEMENT (news anchor style): " +
  "ONLY lip movement for speech and VERY SUBTLE facial micro-expressions. " +
  "Allowed: slight lip movement, very subtle occasional blink, extremely gentle eyebrow raise. " +
  "FORBIDDEN: head tilt, head turn, head nod, head shake, lean, shoulder movement, hand gestures, arm movement, " +
  "body sway, torso rotation, standing up, sitting down, walking, dancing, exaggerated expressions, dramatic eye movements. " +
  "Person must appear as a professional news anchor — calm, still, composed. " +
  "\n" +
  "5. LIGHTING CONSISTENCY: " +
  "Lighting must remain EXACTLY as shown in the reference image — NO changes, NO flickering, NO color shifts, NO brightness changes. " +
  "\n" +
  "6. SCRIPT BOUNDARY — SILENCE AFTER LAST WORD: " +
  "The person must say ONLY the exact words in the dialogue and NOTHING ELSE. " +
  "After the last word: mouth CLOSED, gentle smile, steady eye contact, perfectly still. " +
  "ZERO extra words, ZERO filler sounds, ZERO lip movement after script ends. ";

// ─── Generate Video — with auto-retry ────────────────────────────────
async function generateVideo(
  jobId: string,
  sceneIndex: number,
  description: string,
  script: string,
  frameUrl: string,
  apiKey: string,
  isAvatarOnly: boolean,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        addJobLog(jobId, `Video ${sceneIndex + 1}: retrying... (attempt ${attempt}/${MAX_RETRIES}), waiting 15s...`);
        updateScene(jobId, sceneIndex, { videoProgress: 0 });
        await sleep(15000); // Wait 15s before retry (API needs time to recover)
      }

      let videoPrompt: string;
      if (isAvatarOnly) {
        videoPrompt =
          `${VIDEO_VISUAL_CONSTRAINTS}\n\n` +
          `REFERENCE IMAGE: This is a talking-head video. The reference image is the ONLY source of truth. ` +
          `Output must look like a raw, unedited, continuous webcam recording of a person speaking. ` +
          `CRITICAL REMINDERS: NO fade-in at start. NO fade-out at end. NO transitions whatsoever. NO cuts. ` +
          `RAW FOOTAGE ONLY. INSTANT start, INSTANT end. Full brightness at all times. ` +
          `Dialogue: "${script}" ${VIDEO_VOICE_PROMPT}`;
      } else {
        videoPrompt =
          `${VIDEO_VISUAL_CONSTRAINTS}\n\n` +
          `REFERENCE IMAGE: The first frame is the ONLY source of truth for every visual element. ` +
          `Output must look like raw, unedited, continuous footage from a locked camera. ` +
          `CRITICAL REMINDERS: NO fade-in at start. NO fade-out at end. NO transitions whatsoever. NO cuts. ` +
          `RAW FOOTAGE ONLY. INSTANT start, INSTANT end. Full brightness at all times. ` +
          `Dialogue spoken by the person: "${script}"\n\n` +
          `REPEATED FOR EMPHASIS: NO MUSIC. NO BACKGROUND SOUND. VOICE ONLY. NO transitions. NO fade-in. NO fade-out. ` +
          `NO new objects. MINIMAL movement. STATIC camera. IDENTICAL background to reference frame. RAW UNEDITED FOOTAGE.`;
      }

      addJobLog(jobId, `Video ${sceneIndex + 1}: submitting to AI video engine${attempt > 1 ? ` (attempt ${attempt})` : ""}...`);
      updateScene(jobId, sceneIndex, { videoProgress: 5 });

      const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          imageUrls: [frameUrl],
          model: "veo3_lite",
          aspect_ratio: "9:16",
          enableTranslation: true,
        }),
      });
      const json = await res.json();
      updateScene(jobId, sceneIndex, { videoProgress: 10 });

      if (json.code !== 200) throw new Error("Video submit failed: " + (json.msg || JSON.stringify(json)));
      const taskId = json.data?.taskId;
      if (!taskId) throw new Error("No taskId for video generation");

      updateScene(jobId, sceneIndex, { videoProgress: 15 });
      addJobLog(jobId, `Video ${sceneIndex + 1}: task submitted, waiting (5-15 min)...`);

      const videoUrl = await pollKieVideo(jobId, sceneIndex, taskId, apiKey, writer);
      updateScene(jobId, sceneIndex, { videoProgress: 100, videoDone: true, videoUrl });
      addJobLog(jobId, `Video ${sceneIndex + 1}: complete!`);
      return videoUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addJobLog(jobId, `Video ${sceneIndex + 1} attempt ${attempt} failed: ${msg}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Video ${sceneIndex + 1} failed after ${MAX_RETRIES} attempts: ${msg}`);
      }
      // Reset progress for retry
      updateScene(jobId, sceneIndex, { videoProgress: 0 });
    }
  }
  throw new Error(`Video ${sceneIndex + 1}: unexpected exit from retry loop`);
}

// ─── Safe JSON parse helper ──────────────────────────────────────────
async function safeJsonParse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`Empty response from ${res.url} (status ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${res.url}: ${text.slice(0, 200)}`);
  }
}

// ─── Merge Videos ──────────────────────────────────────────────────────
async function mergeVideos(
  jobId: string,
  videoUrls: string[],
  apiKey: string
): Promise<string> {
  addJobLog(jobId, "Merge: submitting videos to merger...");
  updateJob(jobId, { step: 3, mergeProgress: 5 });

  let json: Record<string, unknown> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
        method: "POST",
        headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_urls: videoUrls }),
      });
      json = await safeJsonParse(res);
      break;
    } catch (mergeErr) {
      const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
      console.warn(`[Merge] Submit attempt ${attempt} failed: ${msg}`);
      if (attempt === 3) throw new Error("Merge submit failed after 3 attempts: " + msg);
      await sleep(2000);
    }
  }

  if (!json) throw new Error("Merge submit failed: no response");

  // Check for direct result (synchronous)
  if (json.video && typeof json.video === "object" && (json.video as Record<string, unknown>).url) {
    const url = (json.video as Record<string, unknown>).url as string;
    updateJob(jobId, { mergeProgress: 100 });
    addJobLog(jobId, "Merge: complete!");
    return url;
  }
  if (json.url && typeof json.url === "string") {
    updateJob(jobId, { mergeProgress: 100 });
    addJobLog(jobId, "Merge: complete!");
    return json.url as string;
  }

  // Async result — need to poll
  const requestId = json.request_id as string | undefined;
  if (requestId) {
    const responseUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;
    // Use GET for status (POST returns 405)
    const statusUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
    updateJob(jobId, { mergeProgress: 20 });
    addJobLog(jobId, "Merge: processing, polling status...");

    for (let i = 0; i < 90; i++) {
      await sleep(3000);

      try {
        // Use GET instead of POST for status endpoint
        const statusRes = await fetch(statusUrl, {
          method: "GET",
          headers: { Authorization: `Key ${apiKey}` },
        });
        const statusJson = await safeJsonParse(statusRes);
        const status = statusJson.status as string | undefined;

        if (status === "COMPLETED") {
          updateJob(jobId, { mergeProgress: 80 });
          addJobLog(jobId, "Merge: fetching result...");
          // Use GET for result endpoint
          const resultRes = await fetch(responseUrl, {
            method: "GET",
            headers: { Authorization: `Key ${apiKey}` },
          });
          const resultJson = await safeJsonParse(resultRes);
          updateJob(jobId, { mergeProgress: 100 });

          const videoObj = resultJson.video as Record<string, unknown> | undefined;
          if (videoObj?.url) {
            addJobLog(jobId, "Merge: complete!");
            return videoObj.url as string;
          }
          if (typeof resultJson.url === "string") {
            addJobLog(jobId, "Merge: complete!");
            return resultJson.url as string;
          }
          throw new Error("Merge done but no URL in result: " + JSON.stringify(resultJson).slice(0, 500));
        }

        if (status === "FAILED") {
          throw new Error("Video merge failed: " + ((statusJson.error as string) || "unknown error"));
        }

        // Periodic log
        if (i % 10 === 0 && i > 0) {
          addJobLog(jobId, `Merge: still processing... [${i * 3}s elapsed]`);
          updateJob(jobId, { mergeProgress: Math.min(75, 20 + i) });
        }
      } catch (pollErr) {
        const pollMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
        if (pollMsg.includes("Merge failed") || pollMsg.includes("no URL")) throw pollErr;
        console.warn(`[Merge] Poll ${i + 1} error:`, pollMsg);
      }
    }
    throw new Error("Video merge timed out after 4.5 minutes");
  }

  throw new Error("Merge failed: no direct URL and no request_id in response: " + JSON.stringify(json).slice(0, 500));
}

// ═══════════════════════════════════════════════════════════════════════
// Avatar Photo API Pipeline
// Pipeline: Upload → Create Group → Get talking_photo_id → Generate Video → Poll
// ═══════════════════════════════════════════════════════════════════════

async function heyGenUploadAsset(
  jobId: string,
  avatarUrl: string,
  apiKey: string
): Promise<string> {
  addJobLog(jobId, "Avatar: Downloading avatar image...");
  updateJob(jobId, { step: 1, mergeProgress: 5, message: "Downloading avatar image..." });

  const imgRes = await fetch(avatarUrl);
  if (!imgRes.ok) throw new Error("Failed to download avatar image: " + imgRes.status);
  const imgBuffer = await imgRes.arrayBuffer();

  addJobLog(jobId, "Avatar: Uploading to server...");
  updateJob(jobId, { step: 1, mergeProgress: 15, message: "Uploading to server..." });

  const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "X-Api-Key": apiKey,
      "accept": "application/json",
    },
    body: imgBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error("Avatar asset upload failed: " + errText.slice(0, 300));
  }
  const json = await uploadRes.json();
  const imageKey = json.data?.image_key;
  if (!imageKey) throw new Error("Avatar upload succeeded but no image_key returned");

  updateJob(jobId, { step: 1, mergeProgress: 30, message: "Image uploaded" });
  addJobLog(jobId, "Avatar: Image uploaded successfully");
  return imageKey;
}

async function heyGenCreateAndGetAvatar(
  jobId: string,
  imageKey: string,
  apiKey: string
): Promise<string> {
  addJobLog(jobId, "Avatar: Creating talking avatar...");
  updateJob(jobId, { step: 1, mergeProgress: 35, message: "Creating talking avatar..." });

  const res = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/create", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `avatar_${Date.now()}`, image_key: imageKey }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Avatar group creation failed: " + errText.slice(0, 300));
  }
  const json = await res.json();
  const groupId = json.data?.group_id || json.data?.id;
  if (!groupId) throw new Error("Avatar group created but no group_id returned");

  addJobLog(jobId, `Avatar: Group ${groupId} created, fetching avatars...`);
  updateJob(jobId, { step: 1, mergeProgress: 45, message: "Fetching avatar..." });

  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(3000);

    try {
      const avatarsRes = await fetch(
        `https://api.heygen.com/v2/avatar_group/${groupId}/avatars`,
        { headers: { "X-Api-Key": apiKey } }
      );

      if (!avatarsRes.ok) {
        console.warn(`[Avatar] Avatar list attempt ${attempt}: HTTP ${avatarsRes.status}`);
        continue;
      }

      const avatarsData = await avatarsRes.json();
      const avatarList = avatarsData.data?.avatar_list || [];

      if (avatarList.length > 0) {
        const avatar = avatarList[0];
        const talkingPhotoId = avatar.id;
        const status = avatar.status;

        if (talkingPhotoId && status === "completed") {
          updateJob(jobId, { step: 1, mergeProgress: 50, message: "Avatar ready!" });
          addJobLog(jobId, `Avatar: Avatar ready! ID: ${talkingPhotoId}`);
          return talkingPhotoId;
        }
        if (talkingPhotoId && (status === "pending" || status === "processing")) {
          if (attempt % 5 === 0) {
            addJobLog(jobId, `Avatar: Avatar still ${status}... (attempt ${attempt}/30)`);
          }
          updateJob(jobId, { step: 1, mergeProgress: 45 + Math.min(attempt, 5), message: `Preparing avatar (${status})...` });
          continue;
        }
        if (talkingPhotoId && status === "failed") {
          throw new Error("Avatar creation failed: " + (avatar.workflow_error || "unknown error"));
        }
        // Unknown status but has ID — might be ready
        if (talkingPhotoId) {
          addJobLog(jobId, `Avatar: Avatar has ID but status is "${status}", assuming ready`);
          updateJob(jobId, { step: 1, mergeProgress: 50, message: "Avatar ready!" });
          return talkingPhotoId;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("avatar creation failed")) throw err;
      console.warn(`[Avatar] Avatar poll attempt ${attempt} error:`, msg);
    }
  }
  throw new Error("Avatar creation timed out after 90 seconds");
}

async function heyGenGenerateVideo(
  jobId: string,
  talkingPhotoId: string,
  script: string,
  voiceId: string,
  apiKey: string
): Promise<string> {
  addJobLog(jobId, "Avatar: Submitting video generation...");
  updateJob(jobId, { step: 2, mergeProgress: 55, message: "Submitting video generation..." });

  const res = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: "talking_photo",
          talking_photo_id: talkingPhotoId,
          avatar_style: "normal",
        },
        voice: {
          type: "text",
          input_text: script,
          voice_id: voiceId,
        },
      }],
      dimension: { width: 1080, height: 1920 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Avatar video generation failed: " + errText.slice(0, 300));
  }
  const json = await res.json();
  const videoId = json.data?.video_id;
  if (!videoId) throw new Error("Avatar video created but no video_id returned");

  updateJob(jobId, { step: 2, mergeProgress: 60, message: "Video generation started..." });
  addJobLog(jobId, `Avatar: Video ID: ${videoId} — processing started`);
  return videoId;
}

async function heyGenPollVideoStatus(
  jobId: string,
  videoId: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  // Avatar video processing can take 15-25 minutes
  const MAX_POLL = 360; // 360 × 5s = 30 min max
  let lastStatus = "";

  for (let i = 0; i < MAX_POLL; i++) {
    try {
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { "X-Api-Key": apiKey } }
      );

      if (!res.ok) {
        const errStatus = res.status;
        if (errStatus === 429 || errStatus >= 500) {
          if (i % 12 === 0) {
            addJobLog(jobId, `Avatar: API temporarily unavailable (${errStatus}), retrying...`);
          }
          await sleep(10);
          continue;
        }
        if (errStatus === 401 || errStatus === 403) {
          throw new Error(`Avatar API auth failed (${errStatus}). Check your API key.`);
        }
        await sleep(5);
        continue;
      }

      const json = await res.json();
      const data = json.data;
      const status = data?.status;
      const videoUrl = data?.video_url;

      // Periodic log + SSE progress every ~30 seconds
      if (i % 6 === 0) {
        const elapsed = Math.round((i * 5) / 60);
        const heygenPct = data?.percentage ? parseInt(data.percentage) : null;
        const estimatedPct = 60 + Math.round((i / MAX_POLL) * 38);
        const pct = heygenPct !== null ? Math.min(95, heygenPct) : Math.min(95, estimatedPct);
        const statusLabel = status === "processing" ? "processing" : status === "pending" ? "queued" : (status || "waiting");
        addJobLog(jobId, `Avatar: [${elapsed}m] ${statusLabel}... ${pct}%${heygenPct ? " (Avatar)" : ""}`);
        updateJob(jobId, { mergeProgress: pct, message: `[${elapsed}m elapsed] Avatar ${statusLabel}... ${pct}%` });
        if (writer) {
          try { sse(writer, { type: "progress", step: 2, pct, message: `Avatar: ${statusLabel}... ${pct}% [${elapsed}m]` }); } catch {}
        }
      }

      if (status === "completed") {
        if (!videoUrl) throw new Error("Avatar video completed but no video_url returned");
        addJobLog(jobId, "Avatar: Video complete!");
        updateJob(jobId, { mergeProgress: 98, message: "Video ready!" });
        return videoUrl;
      }

      if (status === "failed") {
        const errMsg = data?.error?.message || data?.error_message || data?.fail_reason || "Unknown error";
        throw new Error(`Avatar video failed: ${errMsg}`);
      }

      lastStatus = status || "unknown";
    } catch (pollErr: unknown) {
      const pollMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
      if (pollMsg.includes("auth failed") || pollMsg.includes("video failed:")) throw pollErr;
      if (i % 12 === 0) {
        addJobLog(jobId, `Avatar: Network issue during polling: ${pollMsg.slice(0, 80)}`);
      }
    }

    await sleep(5);
  }

  // Final recovery check
  addJobLog(jobId, "Avatar: Timeout reached! Final recovery check...");
  await sleep(3);
  try {
    const finalRes = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      { headers: { "X-Api-Key": apiKey } }
    );
    if (finalRes.ok) {
      const finalJson = await finalRes.json();
      const finalStatus = finalJson.data?.status;
      const finalUrl = finalJson.data?.video_url;
      if (finalStatus === "completed" && finalUrl) {
        addJobLog(jobId, "Avatar: Video found in recovery! Success!");
        return finalUrl;
      }
      if (finalStatus === "failed") {
        const errMsg = finalJson.data?.error?.message || finalJson.data?.error_message || "Unknown error";
        throw new Error(`Avatar video failed: ${errMsg}`);
      }
      throw new Error(
        `Avatar video is still ${finalStatus || "processing"} after 30 minutes. ` +
        `Check later: video_id: ${videoId}`
      );
    }
  } catch (recoveryErr: unknown) {
    const msg = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
    if (msg.includes("video_id:") || msg.includes("failed:")) throw recoveryErr;
  }

  throw new Error(`Avatar video generation timed out after 30 minutes (last status: ${lastStatus}, video_id: ${videoId})`);
}

// ═══════════════════════════════════════════════════════════════════════
// SSE Streaming Pipeline (Vercel-compatible)
// ═══════════════════════════════════════════════════════════════════════

// ─── SSE Helper ──────────────────────────────────────────────────────
function sse(writer: WritableStreamDefaultWriter<Uint8Array>, event: Record<string, unknown>) {
  writer.write(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

// ─── Heartbeat: keeps SSE connection alive during long operations ────
async function startHeartbeat(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  stopSignal: { stopped: boolean }
) {
  while (!stopSignal.stopped) {
    await sleep(8000);
    if (!stopSignal.stopped) {
      try {
        sse(writer, { type: "ping", t: Date.now() });
      } catch {
        stopSignal.stopped = true;
      }
    }
  }
}

// ─── Pipeline Runner with SSE Streaming (Vercel-compatible) ──────────
async function runPipelineSSE(
  avatarUrl: string,
  validScenes: Array<{ description: string; script: string; customFrameImage?: string }>,
  kieApiKey: string,
  falApiKey: string,
  useSceneFrames: boolean,
  provider: string,
  heygenApiKey: string,
  heygenVoiceId: string,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  jobId: string,
  userId: string,
) {
  const heartbeatStop = { stopped: false };

  // Start heartbeat in parallel to keep SSE connection alive
  startHeartbeat(writer, heartbeatStop);

  try {
    // Also create job for /api/status fallback
    createJob(jobId, validScenes.length, provider, userId || "anonymous");
    addJobLog(jobId, "Pipeline started");
    sse(writer, { type: "started", jobId, message: "Pipeline started" });

    // ══ Avatar Pipeline ══
    if (provider === "heygen") {
      if (!heygenApiKey || !heygenVoiceId) {
        sse(writer, { type: "error", message: "Avatar API key and voice ID are required" });
        setJobError(jobId, "Avatar API key and voice ID are required");
        heartbeatStop.stopped = true;
        return;
      }

      const imageKey = await heyGenUploadAsset(jobId, avatarUrl, heygenApiKey);
      const talkingPhotoId = await heyGenCreateAndGetAvatar(jobId, imageKey, heygenApiKey);

      const fullScript = validScenes.map(s => s.script.trim()).filter(Boolean).join(" ");
      addJobLog(jobId, `Avatar: Script (${fullScript.length} chars): "${fullScript.slice(0, 100)}..."`);

      const videoId = await heyGenGenerateVideo(jobId, talkingPhotoId, fullScript, heygenVoiceId, heygenApiKey);
      const videoUrl = await heyGenPollVideoStatus(jobId, videoId, heygenApiKey, writer);

      addJobLog(jobId, "Pipeline complete! Video is ready!");
      sse(writer, { type: "done", videoUrl, frameUrls: [avatarUrl], videoUrls: [videoUrl] });
      setJobDone(jobId, videoUrl, [avatarUrl], [videoUrl]);
      heartbeatStop.stopped = true;
      return;
    }

    // ══ Multi-Scene Pipeline ══
    const frameUrls: string[] = [];
    const videoUrls: string[] = [];

    // STEP 1: Frames
    const hasCustomFrames = validScenes.some(s => s.customFrameImage);

    if (hasCustomFrames) {
      // Custom frames mode — upload each scene's base64 image
      sse(writer, { type: "progress", step: 1, pct: 0, message: `Uploading ${validScenes.length} custom frames...` });
      addJobLog(jobId, `Uploading ${validScenes.length} custom frames...`);

      for (let i = 0; i < validScenes.length; i++) {
        const scene = validScenes[i];
        sse(writer, { type: "progress", step: 1, pct: Math.round((i / validScenes.length) * 80), message: `Uploading frame ${i + 1}/${validScenes.length}...` });

        let frameUrl: string;
        if (scene.customFrameImage) {
          try {
            frameUrl = await uploadImageToKie(scene.customFrameImage, `scene_${i + 1}_frame.jpg`, kieApiKey);
          } catch (uploadErr) {
            const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            addJobLog(jobId, `Frame ${i + 1} upload failed: ${msg}, using avatar as fallback`);
            frameUrl = avatarUrl;
          }
        } else {
          frameUrl = avatarUrl;
        }

        frameUrls.push(frameUrl);
        updateScene(jobId, i, { frameDone: true, frameProgress: 100, frameUrl });
        sse(writer, { type: "progress", step: 1, pct: Math.round(((i + 1) / validScenes.length) * 80), message: `Frame ${i + 1} ready!` });
      }

      sse(writer, { type: "progress", step: 1, pct: 85, message: "All custom frames uploaded!" });
      addJobLog(jobId, "All custom frames uploaded!");
    } else if (useSceneFrames) {
      sse(writer, { type: "progress", step: 1, pct: 0, message: `Generating frames for ${validScenes.length} scenes...` });
      addJobLog(jobId, `Generating ${validScenes.length} frames...`);

      for (let i = 0; i < validScenes.length; i++) {
        const scene = validScenes[i];
        sse(writer, { type: "progress", step: 1, pct: Math.round((i / validScenes.length) * 80), message: `Generating frame ${i + 1}/${validScenes.length}...` });
        const frameUrl = await generateFrame(jobId, i, scene.description, avatarUrl, kieApiKey, writer);
        frameUrls.push(frameUrl);
        sse(writer, { type: "progress", step: 1, pct: Math.round(((i + 1) / validScenes.length) * 80), message: `Frame ${i + 1} ready!` });
      }

      sse(writer, { type: "progress", step: 1, pct: 85, message: "All frames ready!" });
      addJobLog(jobId, "All frames generated!");
    } else {
      addJobLog(jobId, "Using avatar as frame for all scenes (no frame generation)");
      sse(writer, { type: "progress", step: 1, pct: 80, message: "Using avatar as frame for all scenes" });
      for (let i = 0; i < validScenes.length; i++) {
        frameUrls.push(avatarUrl);
        updateScene(jobId, i, { frameDone: true, frameProgress: 100, frameUrl: avatarUrl });
      }
    }

    // STEP 2: Videos
    sse(writer, { type: "progress", step: 2, pct: 0, message: `Generating ${validScenes.length} videos...` });
    addJobLog(jobId, `Generating ${validScenes.length} videos (this takes 5-15 min per video)...`);

    for (let i = 0; i < validScenes.length; i++) {
      const scene = validScenes[i];
      sse(writer, { type: "progress", step: 2, pct: Math.round((i / validScenes.length) * 90), message: `Creating video ${i + 1}/${validScenes.length}...` });
      const videoUrl = await generateVideo(
        jobId, i,
        scene.description, scene.script,
        frameUrls[i], kieApiKey,
        !useSceneFrames,
        writer
      );
      videoUrls.push(videoUrl);
      sse(writer, { type: "progress", step: 2, pct: Math.round(((i + 1) / validScenes.length) * 90), message: `Video ${i + 1} complete!` });
    }

    addJobLog(jobId, "All videos generated!");

    // STEP 3: Merge
    if (videoUrls.length > 1) {
      sse(writer, { type: "progress", step: 3, pct: 0, message: "Merging video clips..." });
      const mergedUrl = await mergeVideos(jobId, videoUrls, falApiKey);
      addJobLog(jobId, "Pipeline complete! Merged video ready!");
      sse(writer, { type: "done", videoUrl: mergedUrl, frameUrls, videoUrls });
      setJobDone(jobId, mergedUrl, frameUrls, videoUrls);
    } else {
      addJobLog(jobId, "Pipeline complete! Single video ready!");
      sse(writer, { type: "done", videoUrl: videoUrls[0], frameUrls, videoUrls });
      setJobDone(jobId, videoUrls[0], frameUrls, videoUrls);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline ${jobId}] Failed:`, msg);
    addJobLog(jobId, `ERROR: ${msg}`);
    sse(writer, { type: "error", message: msg });
    setJobError(jobId, msg);
  } finally {
    heartbeatStop.stopped = true;
    try { writer.close(); } catch {}
  }
}

// ─── Generate Job ID ─────────────────────────────────────────────────
function generateJobId(): string {
  return "job_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
}

// ─── Main API Handler (SSE Streaming) ────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      const rawText = await req.text();
      if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { avatarUrl, scenes, kieApiKey, falApiKey, frameMode, videoProvider, heygenApiKey, heygenVoiceId } = body;
    // In custom frames mode, avatar is not required — each scene has its own image
    if (frameMode !== "custom") {
      if (!avatarUrl || typeof avatarUrl !== "string" || !avatarUrl.startsWith("http")) {
        return NextResponse.json({ error: "avatarUrl is required. Please upload your avatar first." }, { status: 400 });
      }
    }

    const validScenes = (scenes as Array<{ description: string; script: string; customFrameImage?: string }>).filter(s => s.description?.trim() || s.script?.trim() || s.customFrameImage);
    if (validScenes.length === 0) {
      return NextResponse.json({ error: "No valid scenes provided" }, { status: 400 });
    }

    // Validate custom frames
    if (frameMode === "custom") {
      for (let i = 0; i < validScenes.length; i++) {
        if (!validScenes[i].customFrameImage) {
          return NextResponse.json({ error: `Scene ${i + 1} is missing a custom frame image. Please upload an image for each scene.` }, { status: 400 });
        }
      }
    }

    const provider = (videoProvider as string) || "kie";

    if (provider === "heygen") {
      if (!heygenApiKey || (heygenApiKey as string).length < 10) {
        return NextResponse.json({ error: "Avatar API key is invalid or missing" }, { status: 400 });
      }
      if (!heygenVoiceId) {
        return NextResponse.json({ error: "Voice ID is required" }, { status: 400 });
      }
    } else {
      if (!kieApiKey || (kieApiKey as string).length < 10) {
        return NextResponse.json({ error: "Image API key is invalid or missing" }, { status: 400 });
      }
      if (!falApiKey || (falApiKey as string).length < 10) {
        return NextResponse.json({ error: "Merger API key is invalid or missing" }, { status: 400 });
      }
    }

    // ═══ CREDIT CHECK ═══
    let userId: string | null = null;
    try {
      const authUser = await getAuthUser(req);
      if (authUser) {
        userId = authUser.id;
        const costPerScene = await getCreditCostPerScene();
        const totalCost = validScenes.length * costPerScene;

        if (totalCost > 0) {
          const balance = await getCreditBalance(userId);
          if (balance.available < totalCost) {
            return NextResponse.json(
              {
                error: `Insufficient credits. You need ${totalCost} credit(s) but only have ${balance.available} available. Please upgrade your plan or contact support.`,
                code: "INSUFFICIENT_CREDITS",
                required: totalCost,
                available: balance.available,
                plan: balance.plan,
              },
              { status: 402 }
            );
          }
        }
      }
    } catch (creditErr) {
      console.warn("[Pipeline] Credit check warning:", creditErr);
      // Continue without credit check if it fails (graceful degradation)
    }

    // Create SSE stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const jobId = generateJobId();

    console.log(`[Pipeline ${jobId}] Starting ${provider} pipeline with ${validScenes.length} scenes (SSE mode)`);

    // ═══ DEDUCT CREDITS ═══ (non-fatal — pipeline continues even if deduction fails)
    if (userId) {
      try {
        const costPerScene = await getCreditCostPerScene();
        const totalCost = validScenes.length * costPerScene;
        if (totalCost > 0) {
          const result = await deductCredits(
            userId,
            totalCost,
            "video_generation",
            `Video generation: ${validScenes.length} scene(s) x ${costPerScene} credit(s) = ${totalCost} credit(s)`,
            jobId
          );
          if (result.error) {
            addJobLog(jobId, `Credits: ${result.error} (skipped, continuing)`);
          } else {
            addJobLog(jobId, `Credits: ${totalCost} deducted (${validScenes.length} scenes x ${costPerScene}/scene)`);
          }
        }
      } catch (creditErr) {
        const creditMsg = creditErr instanceof Error ? creditErr.message : String(creditErr);
        console.warn(`[Pipeline ${jobId}] Credit deduction failed (non-fatal, continuing):`, creditMsg);
        addJobLog(jobId, `Credits: deduction skipped (DB unavailable)`);
        // Continue with pipeline — credit deduction is non-fatal
      }
    }

    // Run pipeline with SSE streaming
    runPipelineSSE(
      avatarUrl as string, validScenes,
      (kieApiKey as string) || "", falApiKey as string || "",
      frameMode === "scenes" || frameMode === "custom",
      provider, (heygenApiKey as string) || "", (heygenVoiceId as string) || "",
      writer, jobId, userId || "anonymous",
    );

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
