"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scene {
  id: string;
  imageUrl: string | null; // base64 data URL or uploaded URL
  uploadedUrl: string; // server URL after upload
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
}

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

  // ── Scenes ──
  const [scenes, setScenes] = useState<Scene[]>([
    createDefaultScene(),
    createDefaultScene(),
    createDefaultScene(),
  ]);

  // ── Video Generation ──
  const [videoStatuses, setVideoStatuses] = useState<VideoStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [generationError, setGenerationError] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Computed ──
  const allVideosDone = videoStatuses.length > 0 && videoStatuses.every((v) => v.status === "done");
  const hasAnyError = videoStatuses.some((v) => v.status === "error");
  const canGenerate =
    scenes.length >= 2 &&
    scenes.every((s) => s.imageUrl) &&
    scenes.filter((s) => !s.imageUrl).length === 0 &&
    !isGenerating;

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // ── Scene Management ──
  const addScene = useCallback(() => {
    setScenes((prev) => [...prev, createDefaultScene()]);
  }, []);

  const removeScene = useCallback((index: number) => {
    setScenes((prev) => {
      if (prev.length <= 2) return prev; // minimum 2 scenes
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

  // ── Generate Videos ──
  const startGeneration = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationError("");
    setMergedVideoUrl("");
    setMergeError("");

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
      });
    }
    setVideoStatuses(pairs);

    try {
      // Upload all images first
      const uploadedUrls: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        if (controller.signal.aborted) throw new Error("aborted");

        setVideoStatuses((prev) =>
          prev.map((v, idx) => (idx === 0 ? { ...v, status: "uploading", progress: Math.round(((i + 1) / scenes.length) * 10) } : v))
        );

        if (scenes[i].uploadedUrl) {
          uploadedUrls.push(scenes[i].uploadedUrl);
        } else if (scenes[i].imageUrl) {
          const url = await uploadImage(scenes[i].imageUrl, kieApiKey);
          uploadedUrls.push(url);
          // Save uploaded URL
          setScenes((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, uploadedUrl: url } : s))
          );
        } else {
          throw new Error(`Scene ${i + 1} has no image`);
        }
      }

      if (controller.signal.aborted) throw new Error("aborted");

      // Submit to claymotion-generate API
      const response = await fetch("/api/claymotion-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sceneImageUrls: uploadedUrls,
          videoPrompts: scenes.slice(0, -1).map((s) => s.videoPrompt),
          kieApiKey,
          falApiKey,
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

            if (event.type === "video_progress") {
              const videoIdx = event.videoIndex;
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIdx
                    ? { ...v, status: "generating", progress: event.pct || 0 }
                    : v
                )
              );
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
            }

            if (event.type === "video_error") {
              const videoIdx = event.videoIndex;
              setVideoStatuses((prev) =>
                prev.map((v, i) =>
                  i === videoIdx
                    ? { ...v, status: "error", error: event.error || "Video generation failed" }
                    : v
                )
              );
            }

            if (event.type === "merge_progress") {
              setIsMerging(true);
            }

            if (event.type === "merge_done") {
              setIsMerging(false);
              setMergedVideoUrl(event.videoUrl);
            }

            if (event.type === "error") {
              setGenerationError(event.message || "Generation failed");
            }

            if (event.type === "done") {
              if (event.videoUrl) {
                setMergedVideoUrl(event.videoUrl);
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg !== "aborted") {
        setGenerationError(msg);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [canGenerate, scenes, kieApiKey, falApiKey, uploadImage]);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setIsMerging(false);
  }, []);

  // ── Merge Videos ──
  const mergeVideos = useCallback(async () => {
    const doneVideos = videoStatuses.filter((v) => v.status === "done" && v.videoUrl);
    if (doneVideos.length < 2) return;

    setIsMerging(true);
    setMergeError("");

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setMergeError(msg);
    } finally {
      setIsMerging(false);
    }
  }, [videoStatuses, falApiKey]);

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

        {isGenerating && (
          <button
            onClick={cancelGeneration}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ backgroundColor: C.gray900, color: C.white }}
          >
            Cancel
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── How It Works ── */}
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

        {/* ── Scenes Section ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.black }}>
              Scenes ({scenes.length})
            </h2>
            <button
              onClick={addScene}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
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
                    {/* Show role labels */}
                    {index === 0 && scenes.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        START of Video 1
                      </span>
                    )}
                    {index > 0 && index < scenes.length - 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        END of Video {index} &middot; START of Video {index + 1}
                      </span>
                    )}
                    {index === scenes.length - 1 && scenes.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: C.gray200, color: C.gray600 }}>
                        END of Video {index}
                      </span>
                    )}
                  </div>
                  {scenes.length > 2 && (
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
                          <button
                            onClick={() => updateSceneImage(index, null)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1 1l8 8M9 1l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
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
                        disabled={index === scenes.length - 1}
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
                {/* Scene thumbnail */}
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

                {/* Arrow + Video indicator (between scenes) */}
                {index < scenes.length - 1 && (
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    {/* Video status badge */}
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

        {/* ── Pipeline Controls ── */}
        <div className="space-y-3">
          {/* Generate Button */}
          <button
            onClick={startGeneration}
            disabled={!canGenerate || isGenerating}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: C.black, color: C.white }}
          >
            {isGenerating ? (
              <span className="inline-flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {isMerging ? "Merging videos..." : "Generating videos..."}
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

          {/* Progress per video */}
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
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: C.gray200 }}>
                        <span className="text-[10px] font-bold" style={{ color: C.gray500 }}>{i + 1}</span>
                      </div>
                    )}
                    {v.status === "uploading" && (
                      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.gray500}40`, borderTopColor: C.gray500 }} />
                    )}
                    {v.status === "generating" && (
                      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${C.black}40`, borderTopColor: C.black }} />
                    )}
                    {v.status === "done" && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: C.black }}>
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="white">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {v.status === "error" && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="#DC2626">
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
                    </div>
                    {v.status === "generating" && (
                      <div className="mt-1.5 w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.gray200 }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${v.progress}%`, backgroundColor: C.black }}
                        />
                      </div>
                    )}
                    {v.status === "error" && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#DC2626" }}>{v.error}</p>
                    )}
                    {v.status === "done" && v.videoUrl && (
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] mt-0.5 underline"
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

          {/* Error */}
          {generationError && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
            >
              <p className="font-bold mb-1">Generation Error</p>
              <p className="text-xs">{generationError}</p>
            </div>
          )}

          {/* Merge Button */}
          {allVideosDone && !mergedVideoUrl && videoStatuses.length > 1 && (
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
                onClick={() => {
                  setVideoStatuses([]);
                  setMergedVideoUrl("");
                  setGenerationError("");
                  setMergeError("");
                }}
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
      </main>
    </div>
  );
}
