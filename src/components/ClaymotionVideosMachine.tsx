"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { saveVideoToStorage } from "@/lib/video-store";
import { useAuth } from "@/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClayScene {
  id: string;
  imageUrl: string | null; // uploaded image data URL or server URL
  videoPrompt: string; // user-written prompt for the transition FROM this scene to the next
  videoUrl: string | null; // generated video URL
  videoProgress: number;
  videoDone: boolean;
}

// ─── Colors (Black & White only) ────────────────────────────────────────────

const C = {
  black: "#000000",
  dark: "#111111",
  darkGray: "#1A1A1A",
  medDark: "#2A2A2A",
  gray: "#6B7280",
  lightGray: "#9CA3AF",
  border: "#333333",
  inputBg: "#1A1A1A",
  inputBorder: "#333333",
  cardBg: "#111111",
  cardBorder: "#2A2A2A",
  white: "#FFFFFF",
  offWhite: "#F3F4F6",
  accent: "#FFFFFF",
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ClaymotionVideosMachine({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();

  // ── State ──
  const [scenes, setScenes] = useState<ClayScene[]>([
    { id: generateId(), imageUrl: null, videoPrompt: "", videoUrl: null, videoProgress: 0, videoDone: false },
    { id: generateId(), imageUrl: null, videoPrompt: "", videoUrl: null, videoProgress: 0, videoDone: false },
    { id: generateId(), imageUrl: null, videoPrompt: "", videoUrl: null, videoProgress: 0, videoDone: false },
  ]);
  const [kieApiKey, setKieApiKey] = useState("");
  const [falApiKey, setFalApiKey] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [uploadingScene, setUploadingScene] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ── Scene Management ──
  const addScene = useCallback(() => {
    setScenes((prev) => [...prev, {
      id: generateId(), imageUrl: null, videoPrompt: "", videoUrl: null, videoProgress: 0, videoDone: false,
    }]);
  }, []);

  const removeScene = useCallback((id: string) => {
    if (scenes.length <= 2) return;
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }, [scenes.length]);

  const updateScene = useCallback((id: string, field: keyof ClayScene, value: string | number | boolean | null) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }, []);

  // ── Image Upload ──
  const handleImageUpload = useCallback(async (sceneId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }
    setUploadingScene(sceneId);
    try {
      // Compress and convert to data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Upload to server
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("avatar", blob, `claymotion-${sceneId}.jpg`);
      formData.append("kieApiKey", kieApiKey);

      const uploadRes = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        // Fallback: just use data URL locally
        updateScene(sceneId, "imageUrl", dataUrl);
        addLog("Image saved locally (server upload failed).");
        return;
      }

      const uploadData = await uploadRes.json();
      const serverUrl = uploadData.url || dataUrl;
      updateScene(sceneId, "imageUrl", serverUrl);
      addLog(`Scene image uploaded successfully.`);
    } catch (err) {
      addLog(`Image upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingScene(null);
    }
  }, [kieApiKey, updateScene, addLog]);

  // ── Video Generation ──
  const generateVideos = useCallback(async () => {
    if (!kieApiKey || kieApiKey.length < 10) {
      alert("Please enter your KIE API key.");
      return;
    }
    if (scenes.length < 2) {
      alert("You need at least 2 scenes.");
      return;
    }
    const scenesWithImages = scenes.filter((s) => s.imageUrl);
    if (scenesWithImages.length < 2) {
      alert("At least 2 scenes need images.");
      return;
    }

    setIsRunning(true);
    setMergedUrl(null);
    addLog("Starting Claymotion video generation...");

    try {
      // Find consecutive pairs with images
      const pairs: Array<{ startIdx: number; endIdx: number; startUrl: string; endUrl: string; prompt: string }> = [];
      for (let i = 0; i < scenes.length - 1; i++) {
        const startScene = scenes[i];
        const endScene = scenes[i + 1];
        if (startScene.imageUrl && endScene.imageUrl) {
          pairs.push({
            startIdx: i,
            endIdx: i + 1,
            startUrl: startScene.imageUrl,
            endUrl: endScene.imageUrl,
            prompt: startScene.videoPrompt.trim() || `Smooth transition from scene ${i + 1} to scene ${i + 2}`,
          });
        }
      }

      if (pairs.length === 0) {
        throw new Error("No valid scene pairs found. Ensure consecutive scenes have images.");
      }

      addLog(`Found ${pairs.length} scene transitions to generate.`);

      // Process each video sequentially
      for (const pair of pairs) {
        const videoIdx = pair.startIdx;
        addLog(`Generating Video ${videoIdx + 1}: Scene ${pair.startIdx + 1} → Scene ${pair.endIdx + 1}...`);

        updateScene(scenes[videoIdx].id, "videoProgress", 5);

        try {
          // Submit to KIE API
          const submitRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${kieApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: `CLAYMATION TRANSITION: ${pair.prompt}. IMPORTANT: The video must smoothly transition from the first reference image to the second reference image. Start exactly matching the first image and end exactly matching the second image. NO fade-in, NO fade-out. RAW continuous footage. Smooth morphing/transition between the two frames. Fixed camera position.`,
              imageUrls: [pair.startUrl, pair.endUrl],
              model: "veo3_lite",
              aspect_ratio: "9:16",
              enableTranslation: false,
            }),
          });

          const submitData = await submitRes.json();

          if (submitData.code !== 200) {
            throw new Error(`KIE submit failed: ${submitData.msg || JSON.stringify(submitData)}`);
          }

          const taskId = submitData.data?.taskId;
          if (!taskId) throw new Error("No taskId returned from KIE");

          addLog(`Video ${videoIdx + 1}: Task submitted (${taskId.slice(0, 8)}...), waiting...`);
          updateScene(scenes[videoIdx].id, "videoProgress", 15);

          // Poll for completion
          let completed = false;
          let attempts = 0;
          const maxAttempts = 180; // 15 min max

          while (!completed && attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 5000));
            attempts++;

            try {
              const statusRes = await fetch(`https://api.kie.ai/api/v1/veo/status?taskId=${taskId}`, {
                headers: { Authorization: `Bearer ${kieApiKey}` },
              });
              const statusData = await statusRes.json();

              if (statusData.code === 200 && statusData.data?.status === "completed") {
                const videoUrl = statusData.data?.result?.videoUrl;
                if (videoUrl) {
                  updateScene(scenes[videoIdx].id, "videoUrl", videoUrl);
                  updateScene(scenes[videoIdx].id, "videoProgress", 100);
                  updateScene(scenes[videoIdx].id, "videoDone", true);
                  addLog(`Video ${videoIdx + 1}: Complete!`);
                  completed = true;
                }
              } else if (statusData.data?.status === "failed") {
                throw new Error(`KIE generation failed: ${statusData.data?.msg || "Unknown error"}`);
              } else {
                const pct = Math.min(90, 15 + attempts * 0.5);
                updateScene(scenes[videoIdx].id, "videoProgress", pct);
                if (attempts % 6 === 0) {
                  addLog(`Video ${videoIdx + 1}: Still processing... (${Math.round(attempts * 5 / 60)}m elapsed)`);
                }
              }
            } catch (pollErr) {
              if (attempts > 10 && pollErr instanceof TypeError) {
                addLog(`Video ${videoIdx + 1}: Network error during polling, retrying...`);
              }
            }
          }

          if (!completed) {
            throw new Error(`Video ${videoIdx + 1}: Timed out after ${maxAttempts * 5 / 60} minutes`);
          }
        } catch (vidErr) {
          const msg = vidErr instanceof Error ? vidErr.message : String(vidErr);
          addLog(`ERROR Video ${videoIdx + 1}: ${msg}`);
          updateScene(scenes[videoIdx].id, "videoProgress", 0);
        }
      }

      addLog("All video generation complete!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`ERROR: ${msg}`);
      alert("Video generation failed: " + msg);
    } finally {
      setIsRunning(false);
    }
  }, [scenes, kieApiKey, updateScene, addLog]);

  // ── Merge Videos ──
  const mergeAllVideos = useCallback(async () => {
    if (!falApiKey || falApiKey.length < 10) {
      alert("Please enter your Fal.ai API key for merging.");
      return;
    }

    const completedVideos = scenes.filter((s) => s.videoDone && s.videoUrl);
    if (completedVideos.length < 2) {
      alert("Need at least 2 completed videos to merge.");
      return;
    }

    setIsMerging(true);
    addLog("Merging videos...");

    try {
      const videoUrls = completedVideos.map((s) => s.videoUrl!).filter((u) => u.startsWith("http"));

      // Submit merge request to fal.ai
      const submitRes = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
        method: "POST",
        headers: {
          Authorization: `Key ${falApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ video_urls: videoUrls }),
      });

      const submitData = await submitRes.json();
      const requestId = submitData.request_id;

      if (!requestId) {
        throw new Error("No request_id from fal.ai merge");
      }

      addLog("Merge submitted, waiting...");

      // Poll for merge completion
      const statusUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
      const resultUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;

      let done = false;
      let attempts = 0;
      while (!done && attempts < 60) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;

        const stRes = await fetch(statusUrl, { headers: { Authorization: `Key ${falApiKey}` } });
        const stData = await stRes.json();

        if (stData.status === "COMPLETED") {
          const resRes = await fetch(resultUrl, { headers: { Authorization: `Key ${falApiKey}` } });
          const resData = await resRes.json();
          const mergedVideoUrl = resData.video?.url || resData.output?.video_url;

          if (mergedVideoUrl) {
            setMergedUrl(mergedVideoUrl);
            addLog("Merge complete! Video ready.");

            // Save to library
            if (user?.email) {
              saveVideoToStorage(user.email, {
                id: generateId(),
                title: "Claymotion Video",
                url: mergedVideoUrl,
                type: "claymotion",
                createdAt: new Date().toISOString(),
              });
              addLog("Video saved to library.");
            }
          }
          done = true;
        } else if (stData.status === "FAILED") {
          throw new Error("fal.ai merge failed");
        } else {
          if (attempts % 5 === 0) addLog("Still merging...");
        }
      }

      if (!done) throw new Error("Merge timed out");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Merge ERROR: ${msg}`);
      alert("Merge failed: " + msg);
    } finally {
      setIsMerging(false);
    }
  }, [scenes, falApiKey, user, addLog]);

  const allVideosDone = scenes.filter((s) => s.videoDone).length >= 2 && scenes.filter((s) => s.imageUrl && !s.videoDone).length === 0;
  const canGenerate = !isRunning && scenes.length >= 2 && scenes.filter((s) => s.imageUrl).length >= 2 && kieApiKey.length >= 10;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, color: C.white, fontFamily: "var(--font-etna), 'Etna', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3" style={{ backgroundColor: C.dark, borderBottom: `1px solid ${C.border}` }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          style={{ backgroundColor: C.medDark, border: `1px solid ${C.border}`, color: C.white }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 className="text-sm font-bold uppercase tracking-widest">Claymotion Videos Machine</h1>
        <div className="w-20" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* API Keys */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.lightGray }}>API Keys</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.gray }}>KIE API Key</label>
              <input
                type={showKeys ? "text" : "password"}
                value={kieApiKey}
                onChange={(e) => setKieApiKey(e.target.value)}
                placeholder="Enter KIE API key..."
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: C.inputBg, border: `1px solid ${kieApiKey ? C.white : C.inputBorder}`, color: C.white, caretColor: C.white }}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.gray }}>Fal.ai API Key (for merge)</label>
              <input
                type={showKeys ? "text" : "password"}
                value={falApiKey}
                onChange={(e) => setFalApiKey(e.target.value)}
                placeholder="Enter Fal.ai API key..."
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: C.inputBg, border: `1px solid ${falApiKey ? C.white : C.inputBorder}`, color: C.white, caretColor: C.white }}
              />
            </div>
          </div>
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="mt-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            style={{ color: C.lightGray }}
          >
            {showKeys ? "Hide Keys" : "Show Keys"}
          </button>
        </div>

        {/* How It Works */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.lightGray }}>How It Works</label>
          <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: C.gray }}>
            <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: C.medDark }}>Scene 1 Image</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke={C.lightGray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: C.medDark }}>Video 1</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke={C.lightGray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: C.medDark }}>Scene 2 Image</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke={C.lightGray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: C.medDark }}>Video 2</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke={C.lightGray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: C.medDark }}>Scene 3 Image</span>
            <span style={{ color: C.lightGray }}>...</span>
          </div>
          <p className="text-[10px] mt-2" style={{ color: C.gray }}>
            Each scene image serves as both the END of the previous video and the START of the next video, creating a smooth chain.
          </p>
        </div>

        {/* Scenes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.lightGray }}>
              Scenes ({scenes.length}) — {scenes.length - 1} videos will be generated
            </label>
            <button
              onClick={addScene}
              disabled={isRunning || scenes.length >= 20}
              className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30"
              style={{ backgroundColor: C.white, color: C.black }}
            >
              + Add Scene
            </button>
          </div>

          {scenes.map((scene, i) => (
            <div key={scene.id} className="rounded-2xl p-4 transition-all" style={{ backgroundColor: C.cardBg, border: `1px solid ${scene.videoDone ? C.white : C.cardBorder}` }}>
              {/* Scene Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: C.white }}>SCENE {i + 1}</span>
                  {i < scenes.length - 1 && (
                    <span className="text-[9px] px-2 py-0.5 rounded-lg" style={{ backgroundColor: C.medDark, color: C.lightGray }}>
                      START of Video {i + 1}
                    </span>
                  )}
                  {i > 0 && (
                    <span className="text-[9px] px-2 py-0.5 rounded-lg" style={{ backgroundColor: C.medDark, color: C.lightGray }}>
                      END of Video {i}
                    </span>
                  )}
                </div>
                {scenes.length > 2 && (
                  <button
                    onClick={() => removeScene(scene.id)}
                    disabled={isRunning}
                    className="text-[10px] font-bold cursor-pointer transition-all disabled:opacity-30"
                    style={{ color: C.lightGray }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.gray }}>Scene Image</label>
                  {scene.imageUrl ? (
                    <div className="relative group">
                      <div className="w-full aspect-[9/16] max-h-[200px] rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                        <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                      {!isRunning && (
                        <button
                          onClick={() => updateScene(scene.id, "imageUrl", null)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                          style={{ backgroundColor: "rgba(0,0,0,0.7)", color: C.white }}
                        >
                          X
                        </button>
                      )}
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center w-full aspect-[9/16] max-h-[200px] rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-white"
                      style={{ borderColor: C.border, backgroundColor: C.inputBg }}
                    >
                      {uploadingScene === scene.id ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span className="text-[10px]" style={{ color: C.gray }}>Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                          <span className="text-[10px] font-semibold" style={{ color: C.gray }}>Upload Image</span>
                          <span className="text-[9px]" style={{ color: C.gray }}>9:16 recommended</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(scene.id, f); }} className="hidden" disabled={isRunning || !!uploadingScene} />
                    </label>
                  )}
                </div>

                {/* Video Prompt + Progress */}
                <div className="flex flex-col gap-3">
                  {/* Video prompt - only for scenes that have a next scene */}
                  {i < scenes.length - 1 && (
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.gray }}>
                        Video {i + 1} Prompt (Scene {i + 1} → Scene {i + 2})
                      </label>
                      <textarea
                        value={scene.videoPrompt}
                        onChange={(e) => updateScene(scene.id, "videoPrompt", e.target.value)}
                        placeholder={`Describe the transition from Scene ${i + 1} to Scene ${i + 2}...`}
                        disabled={isRunning}
                        rows={4}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none transition-all disabled:opacity-50 resize-none"
                        style={{ backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.white, caretColor: C.white }}
                      />
                    </div>
                  )}

                  {/* Video Progress */}
                  {i < scenes.length - 1 && (scene.videoProgress > 0 || scene.videoDone) && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: scene.videoDone ? C.white : C.gray }}>
                          Video {i + 1} {scene.videoDone ? "Complete" : "Processing..."}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: scene.videoDone ? C.white : C.lightGray }}>
                          {Math.round(scene.videoProgress)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.medDark }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${scene.videoProgress}%`, backgroundColor: scene.videoDone ? C.white : C.lightGray }}
                        />
                      </div>
                      {scene.videoUrl && (
                        <div className="mt-2 aspect-[9/16] max-h-[150px] rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                          <video src={scene.videoUrl} controls className="w-full h-full object-contain" style={{ backgroundColor: C.black }} />
                        </div>
                      )}
                    </div>
                  )}

                  {i === scenes.length - 1 && (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ backgroundColor: C.medDark }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.lightGray} strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                      </svg>
                      <span className="text-[10px]" style={{ color: C.lightGray }}>
                        Last scene — only used as END frame for Video {i}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chain Arrow */}
              {i < scenes.length - 1 && (
                <div className="flex items-center justify-center mt-3 pt-3" style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px]" style={{ color: C.gray }}>Scene {i + 1}</span>
                    <div className="flex items-center">
                      <div className="h-px w-8" style={{ backgroundColor: C.border }} />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke={scene.videoDone ? C.white : C.border} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="h-px w-8" style={{ backgroundColor: C.border }} />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: scene.videoDone ? C.white : C.gray }}>
                      Video {i + 1} {scene.videoDone ? "✓" : ""}
                    </span>
                    <div className="flex items-center">
                      <div className="h-px w-8" style={{ backgroundColor: C.border }} />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke={C.border} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="h-px w-8" style={{ backgroundColor: C.border }} />
                    </div>
                    <span className="text-[9px]" style={{ color: C.gray }}>Scene {i + 2}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={generateVideos}
            disabled={!canGenerate}
            className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: isRunning ? C.gray : C.white, color: C.black }}
          >
            {isRunning ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              "Generate Videos"
            )}
          </button>

          {allVideosDone && !mergedUrl && (
            <button
              onClick={mergeAllVideos}
              disabled={isMerging || !falApiKey}
              className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: isMerging ? C.gray : C.white, color: C.black }}
            >
              {isMerging ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Merging...
                </span>
              ) : (
                "Merge Videos"
              )}
            </button>
          )}

          {mergedUrl && (
            <a
              href={mergedUrl}
              download
              className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
              style={{ backgroundColor: C.white, color: C.black }}
            >
              Download Video
            </a>
          )}
        </div>

        {/* Merged Video Preview */}
        {mergedUrl && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.white}` }}>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.white }}>
              Final Merged Video
            </label>
            <div className="max-w-sm mx-auto aspect-[9/16] rounded-xl overflow-hidden" style={{ border: `2px solid ${C.white}` }}>
              <video src={mergedUrl} controls className="w-full h-full object-contain" style={{ backgroundColor: C.black }} />
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}` }}>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.lightGray }}>Logs</label>
            <div className="max-h-[200px] overflow-y-auto space-y-0.5 custom-scrollbar">
              {logs.map((log, i) => (
                <p key={i} className="text-[10px] font-mono" style={{ color: log.includes("ERROR") ? "#FF6B6B" : log.includes("Complete") || log.includes("ready") ? C.white : C.gray }}>
                  {log}
                </p>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
