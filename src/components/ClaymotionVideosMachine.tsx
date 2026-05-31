"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scene {
  id: string;
  imageUrl: string | null;
  uploadedUrl: string;
  videoPrompt: string;
}

interface VideoStatus {
  id: string;
  sceneStartIndex: number;
  sceneEndIndex: number;
  status: "pending" | "uploading" | "generating" | "done" | "error";
  progress: number;
  videoUrl: string;
  error: string;
  retryCount: number;
}

type PipelineStep = 0 | 1 | 2 | 3 | 4;

// ─── Constants (Black & White Theme) ─────────────────────────────────────────

const C = {
  black: "#000000",
  white: "#FFFFFF",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",
};

const PIPELINE_STEPS = [
  { num: 1, title: "Upload", icon: "📤", color: C.black },
  { num: 2, title: "Videos", icon: "🎬", color: C.gray800 },
  { num: 3, title: "Merge", icon: "🔗", color: C.gray600 },
  { num: 4, title: "Done", icon: "✅", color: C.black },
];

const MAX_AUTO_RETRIES = 5;

// ─── Utility ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function createDefaultScene(): Scene {
  return {
    id: uid(),
    imageUrl: null,
    uploadedUrl: "",
    videoPrompt: "",
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface ClaymotionVideosMachineProps {
  onBack?: () => void;
}

export default function ClaymotionVideosMachine({ onBack }: ClaymotionVideosMachineProps) {
  // ── API Keys (same as AI Avatar Machine) ──
  const kieApiKey = "aaf0ea1db84a074fb1ed0ba386bbf615";
  const falApiKey = "c8b8a13a-d358-4a8c-b4a0-a6aee1da0bc5:c5c823fe4dad5a72691a9ab8eac5ef2c";

  // ── Video Model Selection ──
  const [videoModel, setVideoModel] = useState<"veo3_lite" | "veo3_fast" | "grok-imagine">("veo3_lite");

  // ── Scenes ──
  const [scenes, setScenes] = useState<Scene[]>([
    createDefaultScene(),
    createDefaultScene(),
    createDefaultScene(),
  ]);

  // ── Pipeline ──
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(0);
  const [pipelineError, setPipelineError] = useState("");

  // ── Video Generation ──
  const [videoStatuses, setVideoStatuses] = useState<VideoStatus[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [generationError, setGenerationError] = useState("");

  // ── Logs ──
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // ── Refs ──
  const abortRef = useRef<AbortController | null>(null);
  const autoRetryCountRef = useRef<number>(0);
  const isRunningRef = useRef(false);
  const runGenerationRef = useRef<() => void>(() => {});

  // ── Computed ──
  const allVideosDone = videoStatuses.length > 0 && videoStatuses.every((v) => v.status === "done");
  const hasAnyError = videoStatuses.some((v) => v.status === "error");
  const canGenerate =
    scenes.length >= 2 &&
    scenes.every((s) => s.imageUrl) &&
    scenes.filter((s) => !s.imageUrl).length === 0 &&
    !isRunning;

  // ── Pipeline Step Status ──
  const stepStatus = useCallback((num: number): "idle" | "active" | "done" => {
    if (pipelineStep === 0) return "idle";
    if (pipelineStep > num) return "done";
    if (pipelineStep === num) return "active";
    return "idle";
  }, [pipelineStep]);

  // ── Auto-scroll logs ──
  useEffect(() => {
    if (isAtBottomRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Log utility ──
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ── Scene Management ──
  const addScene = useCallback(() => {
    setScenes((prev) => [...prev, createDefaultScene()]);
  }, []);

  const removeScene = useCallback((index: number) => {
    setScenes((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateSceneImage = useCallback((index: number, imageUrl: string | null) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, imageUrl, uploadedUrl: "" } : s))
    );
  }, []);

  const updateScenePrompt = useCallback((index: number, videoPrompt: string) => {
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, videoPrompt } : s))
    );
  }, []);

  const handleImageUpload = useCallback((index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSceneImage(index, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [updateSceneImage]);

  const handleDrop = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSceneImage(index, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [updateSceneImage]);

  // ── Upload single image to server ──
  const uploadImage = useCallback(async (imageDataUrl: string, kieKey: string): Promise<string> => {
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("avatar", blob, "scene.jpg");
    formData.append("kieApiKey", kieKey);

    const uploadRes = await fetch("/api/upload-avatar", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) throw new Error("Image upload failed");
    const data = await uploadRes.json();
    return data.avatarUrl || data.url || "";
  }, []);

  // ── Generate Videos (Full Pipeline with Auto-Retry) ──
  const startGeneration = useCallback(async () => {
    if (!canGenerate) return;

    setIsRunning(true);
    isRunningRef.current = true;
    setGenerationError("");
    setMergedVideoUrl("");
    setMergeError("");
    setPipelineError("");

    const controller = new AbortController();
    abortRef.current = controller;

    // Build video pairs (N scenes → N-1 videos)
    const pairs: VideoStatus[] = [];
    for (let i = 0; i < scenes.length - 1; i++) {
      pairs.push({
        id: uid(),
        sceneStartIndex: i,
        sceneEndIndex: i + 1,
        status: "pending",
        progress: 0,
        videoUrl: "",
        error: "",
        retryCount: 0,
      });
    }
    setVideoStatuses(pairs);

    try {
      // ── STEP 1: Upload Images ──
      setPipelineStep(1);
      addLog("Uploading scene images...");
      const uploadedUrls: string[] = [];

      for (let i = 0; i < scenes.length; i++) {
        if (controller.signal.aborted) throw new Error("aborted");

        addLog(`Uploading Scene ${i + 1} image...`);
        setVideoStatuses((prev) =>
          prev.map((v, idx) => (idx === 0 ? { ...v, status: "uploading", progress: Math.round(((i + 1) / scenes.length) * 10) } : v))
        );

        if (scenes[i].uploadedUrl) {
          uploadedUrls.push(scenes[i].uploadedUrl);
          addLog(`Scene ${i + 1} already uploaded, reusing URL.`);
        } else if (scenes[i].imageUrl) {
          const url = await uploadImage(scenes[i].imageUrl, kieApiKey);
          uploadedUrls.push(url);
          setScenes((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, uploadedUrl: url } : s))
          );
          addLog(`Scene ${i + 1} uploaded successfully.`);
        } else {
          throw new Error(`Scene ${i + 1} has no image`);
        }
      }

      addLog(`All ${scenes.length} scene images uploaded!`);
      setPipelineStep(2);

      if (controller.signal.aborted) throw new Error("aborted");

      // ── STEP 2: Generate Videos (SSE Stream) ──
      addLog("Starting video generation pipeline...");
      addLog(`Generating ${scenes.length - 1} videos using ${videoModel === "veo3_lite" ? "Veo 3.1 Lite (KIE AI)" : videoModel === "veo3_fast" ? "Veo 3.1 Fast (KIE AI)" : "Grok Imagine (fal.ai)"}...`);

      const response = await fetch("/api/claymotion-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sceneImageUrls: uploadedUrls,
          videoPrompts: scenes.slice(0, -1).map((s) => s.videoPrompt),
          kieApiKey,
          falApiKey,
          videoModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Server error" }));
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamEndedNormally = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "ping") continue;

            if (event.type === "started") {
              addLog(`Pipeline started! Generating ${event.totalVideos} videos...`);
            }

            if (event.type === "video_progress") {
              const videoIdx = event.videoIndex;
              const pct = event.pct || 0;
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIdx
                    ? { ...v, status: "generating", progress: pct }
                    : v
                )
              );
              if (pct === 5 || pct <= 10) {
                addLog(`Video ${videoIdx + 1}: Submitting to KIE AI...`);
              }
            }

            if (event.type === "video_done") {
              const videoIdx = event.videoIndex;
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIdx
                    ? { ...v, status: "done", progress: 100, videoUrl: event.videoUrl }
                    : v
                )
              );
              addLog(`Video ${videoIdx + 1} complete! (Scene ${videoIdx + 1} → Scene ${videoIdx + 2})`);
            }

            if (event.type === "video_error") {
              const videoIdx = event.videoIndex;
              const errorMsg = event.error || "Video generation failed";
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIdx
                    ? { ...v, status: "error", error: errorMsg }
                    : v
                )
              );
              addLog(`Video ${videoIdx + 1} ERROR: ${errorMsg}`);
            }

            if (event.type === "merge_progress") {
              setIsMerging(true);
              setPipelineStep(3);
              addLog("Merging all videos together...");
            }

            if (event.type === "merge_error") {
              setIsMerging(false);
              addLog(`Merge ERROR: ${event.error || "Unknown merge error"}`);
            }

            if (event.type === "merge_done") {
              setIsMerging(false);
              setMergedVideoUrl(event.videoUrl);
              addLog("Videos merged successfully!");
            }

            if (event.type === "error") {
              addLog(`PIPELINE ERROR: ${event.message || "Generation failed"}`);
              // Auto-retry
              autoRetryCountRef.current += 1;
              if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
                const retryNum = autoRetryCountRef.current;
                addLog(`Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
                setIsRunning(false);
                isRunningRef.current = false;
                try { reader.cancel(); } catch {}
                await new Promise(r => setTimeout(r, 10000));
                runGenerationRef.current?.();
                return;
              } else {
                addLog(`Failed after ${MAX_AUTO_RETRIES} automatic retries.`);
                setPipelineError("Failed after " + MAX_AUTO_RETRIES + " retries. Please reset and try again.");
              }
            }

            if (event.type === "done") {
              streamEndedNormally = true;
              if (event.videoUrl) {
                setMergedVideoUrl(event.videoUrl);
                addLog("Pipeline complete! Merged video ready.");
              } else if (event.videoUrls) {
                addLog(`Pipeline complete! ${event.videoUrls.length} videos generated.`);
              }
              setPipelineStep(4);
              autoRetryCountRef.current = 0;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // If stream ended without "done" — auto retry
      if (!streamEndedNormally && isRunningRef.current) {
        addLog("Connection lost or server timed out. Auto-retrying...");
        autoRetryCountRef.current += 1;
        if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
          const retryNum = autoRetryCountRef.current;
          addLog(`Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
          setIsRunning(false);
          isRunningRef.current = false;
          await new Promise(r => setTimeout(r, 10000));
          runGenerationRef.current?.();
          return;
        } else {
          addLog(`Failed after ${MAX_AUTO_RETRIES} automatic retries.`);
          setPipelineError("Connection lost after " + MAX_AUTO_RETRIES + " retries.");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg !== "aborted") {
        addLog(`ERROR: ${msg}`);
        setGenerationError(msg);

        // Auto-retry on error (not user abort)
        autoRetryCountRef.current += 1;
        if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
          const retryNum = autoRetryCountRef.current;
          addLog(`Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
          setIsRunning(false);
          isRunningRef.current = false;
          await new Promise(r => setTimeout(r, 10000));
          runGenerationRef.current?.();
          return;
        } else {
          setPipelineError("Failed after " + MAX_AUTO_RETRIES + " retries.");
        }
      }
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
      abortRef.current = null;
    }
  }, [canGenerate, scenes, kieApiKey, falApiKey, videoModel, uploadImage, addLog]);

  // Keep ref updated
  runGenerationRef.current = startGeneration;

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    isRunningRef.current = false;
    setIsMerging(false);
    setPipelineStep(0);
    setPipelineError("");
    addLog("Generation cancelled by user.");
  }, [addLog]);

  // ── Retry Single Failed Video ──
  const retryVideo = useCallback(async (videoIndex: number) => {
    const vs = videoStatuses[videoIndex];
    if (!vs || vs.status !== "error") return;

    addLog(`Retrying Video ${videoIndex + 1} (Scene ${vs.sceneStartIndex + 1} → Scene ${vs.sceneEndIndex + 1})...`);

    // Reset this video's status
    setVideoStatuses((prev) =>
      prev.map((v, i) =>
        i === videoIndex
          ? { ...v, status: "pending", progress: 0, error: "", retryCount: v.retryCount + 1 }
          : v
      )
    );

    // Get the scene image URLs
    const startScene = scenes[vs.sceneStartIndex];
    const endScene = scenes[vs.sceneEndIndex];

    if (!startScene?.uploadedUrl || !endScene?.uploadedUrl) {
      addLog(`Cannot retry: missing uploaded image URLs for video ${videoIndex + 1}`);
      return;
    }

    const prompt = startScene.videoPrompt || `Smooth transition from scene ${vs.sceneStartIndex + 1} to scene ${vs.sceneEndIndex + 1}`;

    setVideoStatuses((prev) =>
      prev.map((v, i) => (i === videoIndex ? { ...v, status: "generating", progress: 5 } : v))
    );

    try {
      const response = await fetch("/api/claymotion-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "single_video",
          startFrameUrl: startScene.uploadedUrl,
          endFrameUrl: endScene.uploadedUrl,
          prompt,
          kieApiKey,
          falApiKey,
          videoModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Server error" }));
        throw new Error(errData.error || `Server error (${response.status})`);
      }

      // Read SSE stream for single video
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "ping") continue;

            if (event.type === "video_progress" && event.videoIndex === 0) {
              setVideoStatuses((prev) =>
                prev.map((v, i) => (i === videoIndex ? { ...v, progress: event.pct || 0 } : v))
              );
            }

            if (event.type === "video_done" && event.videoIndex === 0) {
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIndex
                    ? { ...v, status: "done", progress: 100, videoUrl: event.videoUrl }
                    : v
                )
              );
              addLog(`Video ${videoIndex + 1} retry complete!`);
            }

            if (event.type === "video_error" && event.videoIndex === 0) {
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIndex
                    ? { ...v, status: "error", error: event.error || "Retry failed" }
                    : v
                )
              );
              addLog(`Video ${videoIndex + 1} retry failed: ${event.error}`);
            }

            if (event.type === "done" && event.videoUrl) {
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIndex
                    ? { ...v, status: "done", progress: 100, videoUrl: event.videoUrl }
                    : v
                )
              );
              addLog(`Video ${videoIndex + 1} retry complete!`);
            }

            if (event.type === "error") {
              throw new Error(event.message || "Retry failed");
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && !parseErr.message.includes("JSON")) throw parseErr;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed";
      setVideoStatuses((prev) =>
        prev.map((v, i) =>
          i === videoIndex ? { ...v, status: "error", error: msg } : v
        )
      );
      addLog(`Video ${videoIndex + 1} retry ERROR: ${msg}`);
    }
  }, [videoStatuses, scenes, kieApiKey, falApiKey, videoModel, addLog]);

  // ── Merge Videos ──
  const mergeVideos = useCallback(async () => {
    const doneVideos = videoStatuses.filter((v) => v.status === "done" && v.videoUrl);
    if (doneVideos.length < 2) return;

    setIsMerging(true);
    setMergeError("");
    setPipelineStep(3);
    addLog(`Merging ${doneVideos.length} videos via fal.ai...`);

    try {
      const response = await fetch("/api/claymotion-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          videoUrls: doneVideos.map((v) => v.videoUrl),
          falApiKey,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Merge failed");
      }

      setMergedVideoUrl(data.videoUrl);
      setPipelineStep(4);
      addLog("Videos merged successfully! Final video ready.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setMergeError(msg);
      addLog(`Merge ERROR: ${msg}`);
    } finally {
      setIsMerging(false);
    }
  }, [videoStatuses, falApiKey, addLog]);

  // ── Reset ──
  const resetPipeline = useCallback(() => {
    setPipelineStep(0);
    setPipelineError("");
    setGenerationError("");
    setVideoStatuses([]);
    setMergedVideoUrl("");
    setMergeError("");
    setIsRunning(false);
    isRunningRef.current = false;
    autoRetryCountRef.current = 0;
    setLogs([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.white, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.gray200}` }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all hover:bg-gray-100"
              style={{ color: C.gray700 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wide" style={{ color: C.black }}>
              Claymotion Videos
            </h1>
            <p className="text-[10px] sm:text-xs" style={{ color: C.gray400 }}>
              Linked Scene Video Creator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={cancelGeneration}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{ backgroundColor: C.gray900, color: C.white }}
            >
              Cancel
            </button>
          )}
          {pipelineStep > 0 && !isRunning && (
            <button
              onClick={resetPipeline}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{ backgroundColor: C.gray200, color: C.gray700 }}
            >
              Reset
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── Pipeline Visual (like AI Avatar Machine) ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="mb-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {PIPELINE_STEPS.map((step, idx) => {
              const status = stepStatus(step.num);
              return (
                <React.Fragment key={step.num}>
                  {/* Step circle */}
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <div
                      className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg sm:text-2xl transition-all duration-500"
                      style={{
                        backgroundColor: status === "active" ? step.color + "20" : status === "done" ? step.color : C.gray100,
                        border: status === "idle" ? `2px dashed ${C.gray300}` : `2px solid ${step.color}`,
                        boxShadow: status === "active" ? `0 0 20px ${step.color}40, 0 0 40px ${step.color}15` : status === "done" ? `0 0 12px ${step.color}30` : "none",
                        transform: status === "active" ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      {status === "done" ? (
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke={C.white} strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span
                          style={{
                            opacity: status === "idle" ? 0.35 : 1,
                            filter: status === "idle" ? "grayscale(1)" : "none",
                          }}
                        >
                          {step.icon}
                        </span>
                      )}
                      {/* Pulse ring for active step */}
                      {status === "active" && (
                        <>
                          <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: step.color, opacity: 0.15 }} />
                          <div
                            className="absolute -inset-1.5 rounded-full"
                            style={{
                              border: `2px solid ${step.color}30`,
                              animation: "pipeline-pulse 2s ease-in-out infinite",
                            }}
                          />
                        </>
                      )}
                      {/* Pop animation for done */}
                      {status === "done" && (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            border: `2px solid ${step.color}`,
                            animation: "pipeline-done-pop 0.4s ease-out forwards",
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-500"
                      style={{
                        color: status === "active" ? step.color : status === "done" ? C.black : C.gray400,
                        opacity: status === "idle" ? 0.4 : 1,
                      }}
                    >
                      {step.title}
                    </span>
                  </div>
                  {/* Connector arrow */}
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="flex items-center mx-1 sm:mx-2">
                      <div className="relative h-[2px] w-6 sm:w-10 overflow-hidden rounded-full" style={{ backgroundColor: C.gray200 }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                          style={{
                            width: status === "done" ? "100%" : stepStatus(PIPELINE_STEPS[idx + 1].num) === "active" ? "50%" : "0%",
                            backgroundColor: step.color,
                          }}
                        />
                      </div>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 -ml-0.5 sm:-ml-1 transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke={status === "done" ? step.color : C.gray300} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Pipeline Error */}
          {pipelineError && (
            <div
              className="mt-4 rounded-xl p-4 text-sm text-center"
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
            >
              <p className="font-bold mb-1">Pipeline Error</p>
              <p className="text-xs">{pipelineError}</p>
              <button
                onClick={resetPipeline}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: "#DC2626", color: C.white }}
              >
                Reset Pipeline
              </button>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── Video Model Selection ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}` }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: C.black }}>
            Video Model
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Veo 3.1 Lite Option */}
            <button
              onClick={() => setVideoModel("veo3_lite")}
              disabled={isRunning}
              className="relative rounded-xl p-4 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: videoModel === "veo3_lite" ? C.black : C.white,
                border: `2px solid ${videoModel === "veo3_lite" ? C.black : C.gray200}`,
                color: videoModel === "veo3_lite" ? C.white : C.black,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: videoModel === "veo3_lite" ? C.white + "20" : C.gray100,
                  }}
                >
                  🎬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">Veo 3.1 Lite</span>
                    {videoModel === "veo3_lite" && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                        style={{ backgroundColor: C.white, color: C.black }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{
                    color: videoModel === "veo3_lite" ? C.gray300 : C.gray500,
                  }}>
                    Google Veo via KIE AI. Start + end frames, fast generation.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "veo3_lite" ? C.white + "15" : C.gray100,
                        color: videoModel === "veo3_lite" ? C.white : C.gray600,
                      }}
                    >
                      Start + End
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "veo3_lite" ? C.white + "15" : C.gray100,
                        color: videoModel === "veo3_lite" ? C.white : C.gray600,
                      }}
                    >
                      Fast
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Veo 3.1 Fast Option */}
            <button
              onClick={() => setVideoModel("veo3_fast")}
              disabled={isRunning}
              className="relative rounded-xl p-4 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: videoModel === "veo3_fast" ? C.black : C.white,
                border: `2px solid ${videoModel === "veo3_fast" ? C.black : C.gray200}`,
                color: videoModel === "veo3_fast" ? C.white : C.black,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: videoModel === "veo3_fast" ? C.white + "20" : C.gray100,
                  }}
                >
                  ⚡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">Veo 3.1 Fast</span>
                    {videoModel === "veo3_fast" && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                        style={{ backgroundColor: C.white, color: C.black }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{
                    color: videoModel === "veo3_fast" ? C.gray300 : C.gray500,
                  }}>
                    Google Veo via KIE AI. Start + end frames, higher quality output.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "veo3_fast" ? C.white + "15" : C.gray100,
                        color: videoModel === "veo3_fast" ? C.white : C.gray600,
                      }}
                    >
                      Start + End
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "veo3_fast" ? C.white + "15" : C.gray100,
                        color: videoModel === "veo3_fast" ? C.white : C.gray600,
                      }}
                    >
                      HQ
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Grok Imagine Option */}
            <button
              onClick={() => setVideoModel("grok-imagine")}
              disabled={isRunning}
              className="relative rounded-xl p-4 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: videoModel === "grok-imagine" ? C.black : C.white,
                border: `2px solid ${videoModel === "grok-imagine" ? C.black : C.gray200}`,
                color: videoModel === "grok-imagine" ? C.white : C.black,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: videoModel === "grok-imagine" ? C.white + "20" : C.gray100,
                  }}
                >
                  🤖
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">Grok Imagine</span>
                    {videoModel === "grok-imagine" && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                        style={{ backgroundColor: C.white, color: C.black }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{
                    color: videoModel === "grok-imagine" ? C.gray300 : C.gray500,
                  }}>
                    xAI Grok via fal.ai. Start frame only, end frame described in prompt.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "grok-imagine" ? C.white + "15" : C.gray100,
                        color: videoModel === "grok-imagine" ? C.white : C.gray600,
                      }}
                    >
                      Start Frame Only
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: videoModel === "grok-imagine" ? C.white + "15" : C.gray100,
                        color: videoModel === "grok-imagine" ? C.white : C.gray600,
                      }}
                    >
                      720p
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ── How It Works (hidden when running) ── */}
        {!isRunning && pipelineStep === 0 && (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}` }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: C.black }}>
              How It Works
            </h2>
            <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: C.gray500 }}>
              <span className="px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: C.gray200, color: C.black }}>Scene 1</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-3-3l3 3-3 3" stroke={C.gray400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: C.black, color: C.white }}>Video 1</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-3-3l3 3-3 3" stroke={C.gray400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: C.gray200, color: C.black }}>Scene 2</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-3-3l3 3-3 3" stroke={C.gray400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: C.black, color: C.white }}>Video 2</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m-3-3l3 3-3 3" stroke={C.gray400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: C.gray200, color: C.black }}>Scene 3</span>
            </div>
            <p className="text-[11px] mt-2" style={{ color: C.gray400 }}>
              Each scene image serves as both the END frame of the previous video and the START frame of the next video. For {scenes.length} scenes, {Math.max(0, scenes.length - 1)} videos will be generated.
            </p>
          </div>
        )}

        {/* ── Scenes Section ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.black }}>
              Scenes ({scenes.length})
            </h2>
            <button
              onClick={addScene}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
              style={{ backgroundColor: C.black, color: C.white }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Add Scene
            </button>
          </div>

          <div className="space-y-4">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${C.gray200}` }}
              >
                {/* Scene Header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: C.gray50, borderBottom: `1px solid ${C.gray200}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: C.black, color: C.white }}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.gray700 }}>
                      Scene {index + 1}
                    </span>
                    {index === 0 && scenes.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        START of Video 1
                      </span>
                    )}
                    {index > 0 && index < scenes.length - 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        END of Video {index} · START of Video {index + 1}
                      </span>
                    )}
                    {index === scenes.length - 1 && scenes.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        END of Video {index}
                      </span>
                    )}
                  </div>
                  {scenes.length > 2 && !isRunning && (
                    <button
                      onClick={() => removeScene(index)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all hover:bg-gray-200"
                      style={{ color: C.gray400 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Remove
                    </button>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Image Upload */}
                    <div className="flex-shrink-0">
                      {scene.imageUrl ? (
                        <div className="relative w-28 h-40 rounded-xl overflow-hidden" style={{ border: `2px solid ${C.gray200}` }}>
                          <img
                            src={scene.imageUrl}
                            alt={`Scene ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {!isRunning && (
                            <button
                              onClick={() => updateSceneImage(index, null)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1 1l8 8M9 1l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <label
                          className="flex flex-col items-center justify-center w-28 h-40 rounded-xl cursor-pointer transition-all"
                          style={{ border: `2px dashed ${C.gray300}`, backgroundColor: C.gray50 }}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.black; }}
                          onDragLeave={(e) => { e.currentTarget.style.borderColor = C.gray300; }}
                          onDrop={(e) => handleDrop(index, e)}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gray400} strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                          <span className="text-[10px] font-semibold mt-1.5" style={{ color: C.gray400 }}>
                            Upload Image
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(index, e)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Video Prompt */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.gray600 }}>
                        Video Prompt {index < scenes.length - 1 ? `(for Video ${index + 1})` : ""}
                      </label>
                      <textarea
                        value={scene.videoPrompt}
                        onChange={(e) => updateScenePrompt(index, e.target.value)}
                        placeholder={
                          index < scenes.length - 1
                            ? `Describe how Scene ${index + 1} transitions to Scene ${index + 2}...`
                            : "No video after the last scene"
                        }
                        rows={3}
                        disabled={index === scenes.length - 1 || isRunning}
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: C.gray50, border: `1.5px solid ${C.gray200}`, color: C.black, minHeight: "80px" }}
                        onFocus={(e) => { if (index < scenes.length - 1) e.currentTarget.style.borderColor = C.black; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = C.gray200; }}
                      />
                      {index < scenes.length - 1 && (
                        <p className="text-[10px] mt-1" style={{ color: C.gray400 }}>
                          This prompt controls the transition from Scene {index + 1} to Scene {index + 2}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Visual Chain Display ── */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: C.gray50, border: `1px solid ${C.gray200}` }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: C.black }}>
            Video Chain Preview
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {scenes.map((scene, index) => (
              <React.Fragment key={scene.id}>
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div
                    className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ border: `2px solid ${scene.imageUrl ? C.gray300 : C.gray200}`, backgroundColor: C.gray100 }}
                  >
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gray300} strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold" style={{ color: C.gray500 }}>S{index + 1}</span>
                </div>

                {index < scenes.length - 1 && (
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    {videoStatuses[index] ? (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold"
                        style={{
                          backgroundColor: videoStatuses[index].status === "done"
                            ? C.black
                            : videoStatuses[index].status === "error"
                            ? "#FEF2F2"
                            : videoStatuses[index].status === "generating"
                            ? C.gray100
                            : C.gray50,
                          color: videoStatuses[index].status === "done"
                            ? C.white
                            : videoStatuses[index].status === "error"
                            ? "#DC2626"
                            : C.gray600,
                          border: `1px solid ${videoStatuses[index].status === "error" ? "#FECACA" : C.gray200}`,
                        }}
                      >
                        {videoStatuses[index].status === "generating" && (
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.gray600}40`, borderTopColor: C.gray600 }} />
                        )}
                        {videoStatuses[index].status === "done" && (
                          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        V{index + 1}
                        {videoStatuses[index].status === "generating" && ` ${videoStatuses[index].progress}%`}
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold"
                        style={{ backgroundColor: C.gray50, color: C.gray400, border: `1px solid ${C.gray200}` }}
                      >
                        V{index + 1}
                      </div>
                    )}
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                      <path d="M0 6h16m-4-4l4 4-4 4" stroke={C.gray300} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── Pipeline Controls + Video Status ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          {/* Generate Button */}
          <button
            onClick={startGeneration}
            disabled={!canGenerate || isRunning}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: C.black, color: C.white }}
          >
            {isRunning ? (
              <span className="inline-flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {isMerging ? "Merging videos..." : pipelineStep === 1 ? "Uploading images..." : pipelineStep === 2 ? "Generating videos..." : pipelineStep === 3 ? "Merging videos..." : "Processing..."}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                Generate {Math.max(0, scenes.length - 1)} Videos
              </span>
            )}
          </button>

          {/* ── Per-Video Progress (like AI Avatar Machine scene progress) ── */}
          {videoStatuses.length > 0 && (
            <div className="space-y-2">
              {videoStatuses.map((v, i) => (
                <div
                  key={v.id}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{
                    backgroundColor: v.status === "error" ? "#FEF2F2" : C.gray50,
                    border: `1px solid ${v.status === "error" ? "#FECACA" : C.gray200}`,
                  }}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {v.status === "pending" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: C.gray200 }}>
                        <span className="text-[10px] font-bold" style={{ color: C.gray500 }}>{i + 1}</span>
                      </div>
                    )}
                    {v.status === "uploading" && (
                      <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.gray500}40`, borderTopColor: C.gray500 }} />
                    )}
                    {v.status === "generating" && (
                      <div className="w-7 h-7 rounded-full border-[2.5px] border-t-transparent animate-spin" style={{ borderColor: `${C.black}30`, borderTopColor: C.black }} />
                    )}
                    {v.status === "done" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: C.black }}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {v.status === "error" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="#DC2626">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: C.black }}>
                        Video {i + 1}
                      </span>
                      <span className="text-[10px]" style={{ color: C.gray400 }}>
                        Scene {v.sceneStartIndex + 1} → Scene {v.sceneEndIndex + 1}
                      </span>
                      {v.retryCount > 0 && v.status !== "done" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                          retry #{v.retryCount}
                        </span>
                      )}
                    </div>
                    {v.status === "generating" && (
                      <div className="mt-1.5 w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.gray200 }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${v.progress}%`, backgroundColor: C.black }}
                        />
                      </div>
                    )}
                    {v.status === "error" && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] flex-1" style={{ color: "#DC2626" }}>{v.error}</p>
                        <button
                          onClick={() => retryVideo(i)}
                          className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
                          style={{ backgroundColor: C.black, color: C.white }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {v.status === "done" && v.videoUrl && (
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] mt-0.5 underline inline-block"
                        style={{ color: C.gray500 }}
                      >
                        View video
                      </a>
                    )}
                  </div>

                  {/* Progress percentage */}
                  {(v.status === "generating" || v.status === "uploading") && (
                    <span className="text-xs font-mono font-bold" style={{ color: C.gray600 }}>
                      {v.progress}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Generation Error */}
          {generationError && !pipelineError && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
            >
              <p className="font-bold mb-1">Generation Error</p>
              <p className="text-xs">{generationError}</p>
            </div>
          )}

          {/* Merge Button (manual merge if auto-merge didn't happen) */}
          {allVideosDone && !mergedVideoUrl && videoStatuses.length > 1 && !isRunning && (
            <button
              onClick={mergeVideos}
              disabled={isMerging}
              className="w-full py-3.5 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: C.gray800, color: C.white, border: `2px solid ${C.gray700}` }}
            >
              {isMerging ? (
                <span className="inline-flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Merging videos...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Merge {videoStatuses.length} Videos
                </span>
              )}
            </button>
          )}

          {mergeError && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
            >
              <p className="font-bold mb-1">Merge Error</p>
              <p className="text-xs">{mergeError}</p>
            </div>
          )}
        </div>

        {/* ── Result Section ── */}
        {mergedVideoUrl && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `2px solid ${C.black}` }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: C.black }}
            >
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.white }}>
                Final Merged Video
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: C.white, color: C.black }}>
                {videoStatuses.length} clips merged
              </span>
            </div>
            <div style={{ backgroundColor: C.gray900 }}>
              <video
                src={mergedVideoUrl}
                controls
                className="w-full max-h-[500px] object-contain"
                style={{ backgroundColor: C.black }}
              />
            </div>
            <div className="p-4 flex gap-3" style={{ backgroundColor: C.gray50 }}>
              <a
                href={mergedVideoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:opacity-90"
                style={{ backgroundColor: C.black, color: C.white }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Video
              </a>
              <button
                onClick={resetPipeline}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:opacity-90"
                style={{ backgroundColor: C.white, color: C.black, border: `1.5px solid ${C.gray300}` }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ── Generation Logs (like AI Avatar Machine) ── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {logs.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${C.gray200}` }}
          >
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between px-4 py-3 transition-all"
              style={{ backgroundColor: C.gray50 }}
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.black }}>
                <span>📋</span> Generation Logs
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                  {logs.length}
                </span>
              </span>
              <span
                className="text-xs transition-transform duration-300"
                style={{ transform: showLogs ? "rotate(180deg)" : "rotate(0deg)", color: C.gray400 }}
              >
                ▼
              </span>
            </button>

            {showLogs && (
              <div
                ref={logsContainerRef}
                className="max-h-64 overflow-y-auto"
                style={{ backgroundColor: C.gray900, scrollbarWidth: "thin" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                }}
              >
                <div className="p-4 space-y-1 font-mono text-xs">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className="py-0.5"
                      style={{
                        color: log.includes("ERROR") || log.includes("error") ? "#EF4444" : log.includes("complete") || log.includes("success") || log.includes("ready") || log.includes("done") ? "#9AFF01" : log.includes("retry") || log.includes("Retry") ? "#FBBF24" : C.gray400,
                      }}
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Pipeline Animations ── */}
      <style jsx>{`
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes pipeline-done-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
