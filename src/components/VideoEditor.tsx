"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  pink: "#E461AD",
  lime: "#9AFF01",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E7EB",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface Clip {
  id: string;
  start: number;
  end: number;
  label: string;
}

interface VideoEditorProps {
  videoUrl: string;
  onClose?: (editedUrl?: string) => void;
  accentColor?: string;
}

// ─── FFmpeg WASM singleton ──────────────────────────────────────────────────

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<void> | null = null;

async function getFFmpeg(
  onLog?: (msg: string) => void,
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoading) {
    await ffmpegLoading;
    return ffmpegInstance!;
  }

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      onLog?.(message);
    });

    ffmpeg.on("progress", ({ progress: p }) => {
      onProgress?.(Math.round(p * 100));
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = null;
  })();

  await ffmpegLoading;
  return ffmpegInstance!;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

function formatTimeFFmpeg(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function getFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/");
    const last = parts[parts.length - 1];
    if (last && last.includes(".")) return last;
    return "video.mp4";
  } catch {
    return "video.mp4";
  }
}

// ─── Video Editor Component ────────────────────────────────────────────────

export default function VideoEditor({ videoUrl, onClose, accentColor }: VideoEditorProps) {
  const accent = accentColor || COLORS.pink;

  const videoRef = useRef<HTMLVideoElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultBlobUrlRef = useRef<string>("");

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Trim handles
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Clips for split
  const [clips, setClips] = useState<Clip[]>([]);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");

  // FFmpeg loading
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoadError, setFfmpegLoadError] = useState("");
  const [ffmpegLoadProgress, setFfmpegLoadProgress] = useState("");

  // Dragging
  const [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);

  // ─── Load FFmpeg WASM on mount ───────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setFfmpegLoadProgress("Loading FFmpeg engine...");
        await getFFmpeg(
          (msg) => {
            if (!cancelled) setFfmpegLoadProgress(msg.slice(0, 80));
          },
          () => {}
        );
        if (!cancelled) {
          setFfmpegReady(true);
          setFfmpegLoadProgress("");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load FFmpeg";
          setFfmpegLoadError(msg);
          setFfmpegLoadProgress("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup result blob URL on unmount
  useEffect(() => {
    return () => {
      if (resultBlobUrlRef.current) {
        URL.revokeObjectURL(resultBlobUrlRef.current);
      }
    };
  }, []);

  // ─── Init: Load video duration ──────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      const dur = video.duration;
      if (isFinite(dur) && dur > 0) {
        setDuration(dur);
        setTrimEnd(dur);
      }
    };

    if (video.readyState >= 1) {
      handleLoaded();
    }
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
  }, [videoUrl]);

  // ─── Draw waveform placeholder ──────────────────────────────────────────

  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas || duration <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = "#1A1A2E";
    ctx.fillRect(0, 0, w, h);

    // Generate random waveform bars
    const barCount = Math.floor(w / 3);
    const barWidth = 1.5;
    const gap = 1.5;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      const amplitude = 0.3 + Math.random() * 0.5;
      const barHeight = h * amplitude * (0.5 + 0.5 * Math.sin((i / barCount) * Math.PI * 4 + Math.random() * 2));

      const timeFraction = i / barCount;
      const isInTrim = timeFraction >= trimStart / duration && timeFraction <= trimEnd / duration;

      ctx.fillStyle = isInTrim ? `${accent}60` : "#2A2A3E";
      ctx.fillRect(x, (h - barHeight) / 2, barWidth, barHeight);
    }
  }, [duration, trimStart, trimEnd, accent]);

  // ─── Time update ─────────────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || draggingPlayhead) return;
    setCurrentTime(video.currentTime);
  }, [draggingPlayhead]);

  // ─── Play / Pause ───────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [trimStart, trimEnd]);

  // Enforce trim boundaries during playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    const interval = setInterval(() => {
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, trimStart, trimEnd]);

  // ─── Seek ───────────────────────────────────────────────────────────────

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(trimStart, Math.min(time, trimEnd));
    setCurrentTime(video.currentTime);
  }, [trimStart, trimEnd]);

  // ─── Waveform click to seek ─────────────────────────────────────────────

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = x / rect.width;
    seekTo(fraction * duration);
  }, [duration, seekTo]);

  // ─── Trim handle drag ───────────────────────────────────────────────────

  const handleTrimDrag = useCallback((e: React.MouseEvent, handle: "start" | "end") => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);

    const handleMove = (ev: MouseEvent) => {
      const canvas = waveformRef.current;
      if (!canvas || duration <= 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      const time = (x / rect.width) * duration;

      if (handle === "start") {
        setTrimStart(Math.min(time, trimEnd - 0.5));
      } else {
        setTrimEnd(Math.max(time, trimStart + 0.5));
      }
    };

    const handleUp = () => {
      setDraggingHandle(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [duration, trimStart, trimEnd]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekTo(currentTime - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekTo(currentTime + 1);
      } else if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, seekTo, currentTime, onClose]);

  // ─── Split at playhead ─────────────────────────────────────────────────

  const splitAtPlayhead = useCallback(() => {
    const t = currentTime;
    if (t <= trimStart + 0.1 || t >= trimEnd - 0.1) return;

    const clip: Clip = {
      id: generateId(),
      start: Math.round(t * 10) / 10,
      end: trimEnd,
      label: `Clip ${clips.length + 1}`,
    };
    setTrimEnd(t);
    setClips((prev) => [...prev, clip]);
  }, [currentTime, trimStart, trimEnd, clips.length]);

  // ─── Remove clip ────────────────────────────────────────────────────────

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ─── Reset all ──────────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
    setClips([]);
    setResultUrl("");
    setError("");
    setProgress(0);
    setProcessingStatus("");
    if (resultBlobUrlRef.current) {
      URL.revokeObjectURL(resultBlobUrlRef.current);
      resultBlobUrlRef.current = "";
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [duration]);

  // ─── Cut / Split video using FFmpeg WASM (entirely in browser) ──────────

  const processCut = useCallback(async () => {
    if (!videoUrl || duration <= 0) return;

    setIsProcessing(true);
    setError("");
    setProgress(0);
    setResultUrl("");

    // Cleanup previous result
    if (resultBlobUrlRef.current) {
      URL.revokeObjectURL(resultBlobUrlRef.current);
      resultBlobUrlRef.current = "";
    }

    try {
      // Step 1: Load FFmpeg
      setProcessingStatus("Loading FFmpeg engine...");
      setFfmpegLoadProgress("Preparing FFmpeg...");
      const ffmpeg = await getFFmpeg(
        (msg) => setFfmpegLoadProgress(msg.slice(0, 80)),
        (p) => setProgress(p)
      );
      setFfmpegReady(true);
      setFfmpegLoadProgress("");

      // Step 2: Download source video
      setProcessingStatus("Downloading video...");
      setProgress(5);
      const fileName = getFileName(videoUrl);
      const inputName = `input_${Date.now()}.${fileName.split(".").pop() || "mp4"}`;

      try {
        const videoData = await fetchFile(videoUrl);
        await ffmpeg.writeFile(inputName, videoData);
      } catch {
        // If fetchFile fails, try fetching manually
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error("Failed to download video. Make sure the URL is accessible.");
        const arrayBuffer = await response.arrayBuffer();
        await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
      }
      setProgress(15);

      // Build all segments in order: trim region + split clips
      const segments = [
        { start: trimStart, end: trimEnd },
        ...clips.map((c) => ({ start: c.start, end: c.end })),
      ];

      if (segments.length === 1) {
        // ── Single segment: cut and export directly ──
        const seg = segments[0];
        const segDuration = seg.end - seg.start;
        const outputName = `output_${Date.now()}.mp4`;

        setProcessingStatus("Cutting video with FFmpeg...");
        setProgress(25);

        // Use output-side seeking with re-encoding for accurate cuts
        await ffmpeg.exec([
          "-i", inputName,
          "-ss", formatTimeFFmpeg(seg.start),
          "-to", formatTimeFFmpeg(seg.end),
          "-c:v", "libx264",
          "-c:a", "aac",
          "-movflags", "+faststart",
          "-preset", "ultrafast",
          "-y",
          outputName,
        ]);

        setProgress(85);
        setProcessingStatus("Preparing result...");

        const data = await ffmpeg.readFile(outputName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = new Blob([data as any], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        resultBlobUrlRef.current = url;
        setResultUrl(url);
        setProgress(100);
        setProcessingStatus("Done!");

        // Cleanup FFmpeg files
        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch {
          // Ignore cleanup errors
        }
      } else {
        // ── Multiple segments: cut each, then merge with concat demuxer ──
        setProcessingStatus(`Cutting ${segments.length} segments...`);

        const cutFiles: string[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const cutName = `cut_${i}.mp4`;

          setProcessingStatus(`Cutting segment ${i + 1}/${segments.length}...`);
          setProgress(15 + Math.round((i / segments.length) * 55));

          await ffmpeg.exec([
            "-i", inputName,
            "-ss", formatTimeFFmpeg(seg.start),
            "-to", formatTimeFFmpeg(seg.end),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-movflags", "+faststart",
            "-preset", "ultrafast",
            "-y",
            cutName,
          ]);

          cutFiles.push(cutName);
        }

        setProcessingStatus("Merging segments...");
        setProgress(75);

        // Create concat list file
        const concatList = cutFiles.map((f) => `file '${f}'`).join("\n");
        await ffmpeg.writeFile("concat_list.txt", concatList);

        // Merge using concat demuxer
        const mergedName = `merged_${Date.now()}.mp4`;
        await ffmpeg.exec([
          "-f", "concat",
          "-safe", "0",
          "-i", "concat_list.txt",
          "-c", "copy",
          "-movflags", "+faststart",
          "-y",
          mergedName,
        ]);

        setProgress(90);
        setProcessingStatus("Preparing result...");

        const data = await ffmpeg.readFile(mergedName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = new Blob([data as any], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        resultBlobUrlRef.current = url;
        setResultUrl(url);
        setProgress(100);
        setProcessingStatus("Done!");

        // Cleanup FFmpeg files
        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile("concat_list.txt");
          for (const f of cutFiles) {
            await ffmpeg.deleteFile(f);
          }
          await ffmpeg.deleteFile(mergedName);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
    }
  }, [videoUrl, duration, trimStart, trimEnd, clips]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!videoUrl) return null;

  const trimDuration = Math.max(0, trimEnd - trimStart);
  const playheadFraction = duration > 0 ? currentTime / duration : 0;
  const startFraction = duration > 0 ? trimStart / duration : 0;
  const endFraction = duration > 0 ? trimEnd / duration : 0;

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{
        backgroundColor: COLORS.cardBg,
        border: `2px solid ${COLORS.cardBorder}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}
    >
      {/* Hidden video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accent}15` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: COLORS.text }}>
            Video Editor
          </span>
          {/* FFmpeg status badge */}
          {ffmpegReady ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${COLORS.lime}20`, color: COLORS.lime }}>
              FFmpeg Ready
            </span>
          ) : ffmpegLoadError ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
              FFmpeg Error
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide animate-pulse" style={{ backgroundColor: `${COLORS.cyan}15`, color: COLORS.cyan }}>
              Loading FFmpeg...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-[1.02] cursor-pointer"
            style={{ backgroundColor: COLORS.cardBorder, color: COLORS.textMuted }}
          >
            Reset
          </button>
          <button
            onClick={() => onClose?.()}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: "#FEE2E2" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Video Preview ──────────────────────────────────── */}
      <div className="relative aspect-video bg-black">
        <video
          src={resultUrl || videoUrl}
          className="w-full h-full object-contain"
          controls={false}
          playsInline
          onClick={togglePlay}
          style={{ pointerEvents: isProcessing ? "none" : "auto" }}
        />

        {/* Big play button overlay */}
        {!isPlaying && !isProcessing && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
            style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Time display overlay */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg text-xs font-mono font-bold" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: COLORS.white }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-3 animate-spin mx-auto mb-3" style={{ borderColor: `${accent}30`, borderTopColor: accent }} />
              <p className="text-sm font-bold text-white">{processingStatus}</p>
              <div className="w-48 h-1.5 rounded-full mt-2 mx-auto" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: accent }}
                />
              </div>
              {ffmpegLoadProgress && (
                <p className="text-[9px] text-gray-400 mt-1.5 max-w-[280px] truncate mx-auto">{ffmpegLoadProgress}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Waveform / Timeline ──────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          {/* Waveform canvas */}
          <canvas
            ref={waveformRef}
            className="w-full h-16 rounded-xl cursor-pointer"
            onClick={handleWaveformClick}
            style={{ touchAction: "none" }}
          />

          {/* Trim region overlay */}
          {duration > 0 && (
            <>
              {/* Darkened left region */}
              <div
                className="absolute top-0 bottom-0 left-0"
                style={{
                  width: `${startFraction * 100}%`,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  borderRadius: "12px 0 0 12px",
                  pointerEvents: "none",
                }}
              />
              {/* Darkened right region */}
              <div
                className="absolute top-0 bottom-0 right-0"
                style={{
                  width: `${(1 - endFraction) * 100}%`,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  borderRadius: "0 12px 12px 0",
                  pointerEvents: "none",
                }}
              />

              {/* Start trim handle */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center"
                style={{
                  left: `calc(${startFraction * 100}% - 6px)`,
                  backgroundColor: accent,
                  borderRadius: "4px",
                  boxShadow: `0 0 8px ${accent}60`,
                }}
                onMouseDown={(e) => handleTrimDrag(e, "start")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="w-0.5 h-1.5 bg-white rounded-sm" />
                  <div className="w-0.5 h-1.5 bg-white rounded-sm" />
                </div>
              </div>

              {/* End trim handle */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center"
                style={{
                  left: `calc(${endFraction * 100}% - 6px)`,
                  backgroundColor: accent,
                  borderRadius: "4px",
                  boxShadow: `0 0 8px ${accent}60`,
                }}
                onMouseDown={(e) => handleTrimDrag(e, "end")}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="w-0.5 h-1.5 bg-white rounded-sm" />
                  <div className="w-0.5 h-1.5 bg-white rounded-sm" />
                </div>
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                style={{
                  left: `${playheadFraction * 100}%`,
                  backgroundColor: COLORS.white,
                  boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: COLORS.white, boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
                />
              </div>
            </>
          )}
        </div>

        {/* Time labels */}
        <div className="flex justify-between mt-1.5 text-[10px] font-mono" style={{ color: COLORS.textMuted }}>
          <span>0:00</span>
          <span>Trim: {formatTime(trimStart)} - {formatTime(trimEnd)} ({formatTime(trimDuration)})</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* ─── Playback Controls ───────────────────────────────── */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: accent, color: COLORS.white }}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip back 5s */}
          <button
            onClick={() => seekTo(currentTime - 5)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: COLORS.cardBorder }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062a1.125 1.125 0 011.683.977v8.123z" />
            </svg>
          </button>

          {/* Skip forward 5s */}
          <button
            onClick={() => seekTo(currentTime + 5)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: COLORS.cardBorder }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.69z" />
            </svg>
          </button>

          {/* Volume */}
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: COLORS.cardBorder }}
          >
            {isMuted || volume === 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.text} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>

          {/* Speed */}
          <button
            onClick={() => {
              const rates = [0.5, 1, 1.5, 2];
              const idx = rates.indexOf(playbackRate);
              const next = rates[(idx + 1) % rates.length];
              setPlaybackRate(next);
              if (videoRef.current) videoRef.current.playbackRate = next;
            }}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: COLORS.cardBorder, color: COLORS.text }}
          >
            {playbackRate}x
          </button>

          <div className="flex-1" />

          {/* Keyboard hint */}
          <span className="text-[10px] hidden sm:inline" style={{ color: COLORS.textMuted }}>
            Space: Play | Arrows: Seek | Esc: Close
          </span>
        </div>
      </div>

      {/* ─── Clips List ──────────────────────────────────────── */}
      {clips.length > 0 && (
        <div className="px-4 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: COLORS.textMuted }}>
            Split Clips ({clips.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {clips.map((clip, i) => (
              <div
                key={clip.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: `${accent}10`,
                  border: `1px solid ${accent}30`,
                }}
              >
                <span className="text-[10px] font-bold" style={{ color: accent }}>
                  {clip.label}
                </span>
                <span className="text-[10px] font-mono" style={{ color: COLORS.textMuted }}>
                  {formatTime(clip.start)} - {formatTime(clip.end)}
                </span>
                <button
                  onClick={() => removeClip(clip.id)}
                  className="w-4 h-4 rounded flex items-center justify-center cursor-pointer hover:scale-110"
                  style={{ backgroundColor: "#FEE2E2" }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FFmpeg Load Error ──────────────────────────────────── */}
      {ffmpegLoadError && !isProcessing && (
        <div className="mx-4 mb-2 p-3 rounded-xl text-xs" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626" }}>
          <span className="font-bold">FFmpeg Error: </span>{ffmpegLoadError}
          <p className="mt-1 opacity-70">Try reloading the page. FFmpeg WASM requires a modern browser.</p>
        </div>
      )}

      {/* ─── Error Display ────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-2 p-3 rounded-xl text-xs" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626" }}>
          <span className="font-bold">Error: </span>{error}
        </div>
      )}

      {/* ─── Result Display ───────────────────────────────────── */}
      {resultUrl && (
        <div className="mx-4 mb-2 p-3 rounded-xl" style={{ backgroundColor: `${COLORS.lime}15`, border: `1.5px solid ${COLORS.lime}30` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 20 20" fill={COLORS.lime}>
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold" style={{ color: COLORS.text }}>Video cut successfully!</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={resultUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-[1.02]"
                style={{ backgroundColor: COLORS.dark, color: COLORS.white }}
              >
                Download
              </a>
              <button
                onClick={() => onClose?.(resultUrl)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-[1.02] cursor-pointer"
                style={{ backgroundColor: COLORS.lime, color: COLORS.dark }}
              >
                Use This
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Action Buttons ───────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={splitAtPlayhead}
            disabled={isProcessing || duration <= 0 || trimDuration <= 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: `${COLORS.cyan}15`, color: COLORS.cyan, border: `1.5px solid ${COLORS.cyan}30` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Split at Playhead
          </button>

          <div className="flex-1" />

          <button
            onClick={processCut}
            disabled={isProcessing || duration <= 0 || trimDuration <= 0.5}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: accent,
              color: COLORS.white,
              boxShadow: `0 4px 16px ${accent}30`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {isProcessing ? "Processing..." : "Export Cut"}
          </button>
        </div>
      </div>
    </div>
  );
}
