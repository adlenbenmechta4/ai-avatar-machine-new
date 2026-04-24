"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  start: number;
  end: number;
  enabled: boolean;
}

type ZoomType = "in" | "out" | "kenburns";
type ZoomSpeed = "slow" | "normal" | "fast";

interface VideoEditorProps {
  videoUrl: string;
  onClose: () => void;
  accentColor?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Colors ─────────────────────────────────────────────────────────────

const COLORS = {
  gold: "#C9A96E",
  goldLight: "#FBF5EB",
  goldDark: "#A68B4B",
  green: "#22C55E",
  greenLight: "#F0FDF4",
  red: "#EF4444",
  redLight: "#FEF2F2",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  bg: "#FFF8F0",
  track: "#E5E7EB",
  trackDark: "#D1D5DB",
};

// ─── VideoEditor Component ──────────────────────────────────────────────

export default function VideoEditor({ videoUrl, onClose, accentColor = COLORS.gold }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState("");
  const [processError, setProcessError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSplitId, setDragSplitId] = useState<string | null>(null);

  const ffmpegRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const progressCallbackRef = useRef<((msg: string) => void) | null>(null);

  // ─── Zoom Effects State ─────────────────────────────────────────
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomType, setZoomType] = useState<ZoomType>("kenburns");
  const [zoomIntensity, setZoomIntensity] = useState(1.3);
  const [zoomSpeed, setZoomSpeed] = useState<ZoomSpeed>("normal");
  const [zoomTarget, setZoomTarget] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.4 });
  const [settingZoomTarget, setSettingZoomTarget] = useState(false);

  // ─── Load Video Metadata ────────────────────────────────────────
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration && isFinite(video.duration)) {
      setDuration(video.duration);
      setSegments([{ id: "seg-0", start: 0, end: video.duration, enabled: true }]);
    }
  }, []);

  // ─── Time Update Loop ──────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ─── Play/Pause ────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // ─── Seek to time ──────────────────────────────────────────────
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  // ─── Timeline Click to Seek ────────────────────────────────────
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !timelineRef.current || isDragging) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duration);
  }, [duration, seekTo, isDragging]);

  // ─── Add Split at Playhead ─────────────────────────────────────
  const addSplit = useCallback(() => {
    if (!duration || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    if (time <= 0.1 || time >= duration - 0.1) return;

    setSegments((prev) => {
      // Find which segment the playhead is in
      const segIndex = prev.findIndex((s) => time > s.start + 0.05 && time < s.end - 0.05);
      if (segIndex === -1) return prev;

      const seg = prev[segIndex];
      const newSegs = [...prev];
      newSegs.splice(segIndex, 1,
        { ...seg, end: time, id: `seg-${Date.now()}-a` },
        { ...seg, start: time, id: `seg-${Date.now()}-b`, enabled: seg.enabled },
      );
      return newSegs;
    });
  }, [duration]);

  // ─── Remove Split ──────────────────────────────────────────────
  const removeSplit = useCallback((splitTime: number) => {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => Math.abs(s.start - splitTime) < 0.05);
      if (idx <= 0) return prev;
      const prevSeg = prev[idx - 1];
      const currSeg = prev[idx];
      const newSegs = [...prev];
      newSegs.splice(idx - 1, 2,
        { ...prevSeg, end: currSeg.end, id: `seg-${Date.now()}-m` },
      );
      return newSegs;
    });
  }, []);

  // ─── Toggle Segment ────────────────────────────────────────────
  const toggleSegment = useCallback((segId: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  // ─── Get split points (internal boundaries) ───────────────────
  const splitPoints = segments.slice(1).map((s) => s.start);

  // ─── Enable All Segments ───────────────────────────────────────
  const enableAll = useCallback(() => {
    setSegments((prev) => prev.map((s) => ({ ...s, enabled: true })));
  }, []);

  // ─── Remove All Splits ─────────────────────────────────────────
  const removeAllSplits = useCallback(() => {
    if (!duration) return;
    setSegments([{ id: "seg-0", start: 0, end: duration, enabled: true }]);
    setSelectedSegmentId(null);
  }, [duration]);

  // ─── Build Zoompan Filter String ───────────────────────────────
  const buildZoompanFilter = useCallback((segDuration: number): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const fps = 30;

    const speedMap: Record<ZoomSpeed, number> = { slow: 0.0004, normal: 0.001, fast: 0.002 };
    const increment = speedMap[zoomSpeed];
    const maxZ = zoomIntensity;
    const tx = zoomTarget.x;
    const ty = zoomTarget.y;
    const halfFrames = Math.round((segDuration * fps) / 2);

    let zExpr: string;
    switch (zoomType) {
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

    return `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${w}x${h}:fps=${fps}`;
  }, [zoomType, zoomIntensity, zoomSpeed, zoomTarget]);

  // ─── Click Video to Set Zoom Target ────────────────────────────
  const handleVideoClickForTarget = useCallback((e: React.MouseEvent<HTMLVideoElement>) => {
    if (!settingZoomTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setZoomTarget({ x, y });
    setSettingZoomTarget(false);
  }, [settingZoomTarget]);

  // ─── Handle Split Drag ─────────────────────────────────────────
  const handleSplitMouseDown = useCallback((e: React.MouseEvent, splitTime: number) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragSplitId(`split-${splitTime}`);

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (moveE.clientX - rect.left) / rect.width));
      const newTime = Math.round(ratio * duration * 10) / 10;

      setSegments((prev) => {
        const idx = prev.findIndex((s) => Math.abs(s.start - splitTime) < 0.1);
        if (idx <= 0 || idx >= prev.length) return prev;
        const prevSeg = prev[idx - 1];
        const currSeg = prev[idx];
        const minTime = prevSeg.start + 0.3;
        const maxTime = currSeg.end - 0.3;
        const clampedTime = Math.max(minTime, Math.min(newTime, maxTime));
        const newSegs = [...prev];
        newSegs[idx - 1] = { ...prevSeg, end: clampedTime };
        newSegs[idx] = { ...currSeg, start: clampedTime };
        return newSegs;
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragSplitId(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [duration]);

  // ─── Load FFmpeg ───────────────────────────────────────────────
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded || ffmpegLoading) return;
    setFfmpegLoading(true);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setFfmpegLoaded(true);
      setFfmpegLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load FFmpeg";
      setProcessError(msg);
      setFfmpegLoading(false);
    }
  }, [ffmpegLoaded, ffmpegLoading]);

  // ─── Process & Export Video ─────────────────────────────────────
  const processVideo = useCallback(async () => {
    if (!duration || !ffmpegLoaded) return;

    const enabledSegs = segments.filter((s) => s.enabled);
    if (enabledSegs.length === 0) {
      setProcessError("No segments selected. Enable at least one segment.");
      return;
    }

    // If only one segment covering the full video, just provide the original
    if (enabledSegs.length === 1 && enabledSegs[0].start < 0.1 && enabledSegs[0].end > duration - 0.1) {
      setResultUrl(videoUrl);
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    setResultUrl("");
    setProcessProgress("Downloading video file...");

    try {
      const ffmpeg = ffmpegRef.current as { writeFile: (n: string, d: Uint8Array) => Promise<void>; exec: (args: string[]) => Promise<void>; readFile: (n: string) => Promise<Uint8Array>; on: (e: string, cb: (data: { progress?: number }) => void) => void };

      // Download video via proxy
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
      const videoRes = await fetch(proxyUrl);
      if (!videoRes.ok) throw new Error("Failed to download video");
      const videoData = new Uint8Array(await videoRes.arrayBuffer());

      setProcessProgress("Loading video into editor...");
      await ffmpeg.writeFile("input.mp4", videoData);

      // Build zoompan filter if zoom is enabled
      const needsZoom = zoomEnabled;
      const zoomFilter = needsZoom ? buildZoompanFilter(duration) : null;

      if (needsZoom && !zoomFilter) {
        throw new Error("Could not build zoom filter. Make sure the video is loaded.");
      }

      // Build ffmpeg filter for extracting and concatenating segments
      setProcessProgress(needsZoom ? "Applying zoom effects..." : "Processing cuts...");

      // Use output-side seeking (-ss AFTER -i) for exact frame-accurate cuts.
      // Re-encode video (ultrafast) while copying audio to avoid:
      //   - "audio only" bug from stream-copy misalignment
      //   - "starts from beginning" bug from input-side seeking to distant keyframes
      if (enabledSegs.length === 1) {
        // Single segment — simple trim (with optional zoom)
        const seg = enabledSegs[0];
        const segDuration = (seg.end - seg.start).toFixed(2);
        ffmpeg.on("progress", ({ progress }) => {
          if (progress !== undefined) {
            setProcessProgress(needsZoom ? `Applying zoom... ${Math.round(progress * 100)}%` : `Processing... ${Math.round(progress * 100)}%`);
          }
        });
        const args = ["-i", "input.mp4"];
        if (!needsZoom) {
          args.push("-ss", seg.start.toFixed(2), "-t", segDuration);
        } else {
          // For zoom, we need to process the full segment through zoompan
          args.push("-ss", seg.start.toFixed(2), "-t", segDuration);
        }
        if (zoomFilter) {
          args.push("-vf", zoomFilter);
        }
        args.push(
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "output.mp4",
        );
        await ffmpeg.exec(args);
      } else {
        // Multiple segments — extract each then concat
        ffmpeg.on("progress", ({ progress }) => {
          if (progress !== undefined) {
            setProcessProgress(needsZoom ? `Applying zoom to segment... ${Math.round(progress * 100)}%` : `Processing segment... ${Math.round(progress * 100)}%`);
          }
        });

        for (let i = 0; i < enabledSegs.length; i++) {
          const seg = enabledSegs[i];
          const segDuration = (seg.end - seg.start).toFixed(2);
          setProcessProgress(needsZoom ? `Applying zoom to segment ${i + 1} of ${enabledSegs.length}...` : `Processing segment ${i + 1} of ${enabledSegs.length}...`);

          // Build per-segment zoom filter with correct duration
          const segZoomFilter = zoomFilter
            ? buildZoompanFilter(parseFloat(segDuration))
            : null;

          const args = ["-i", "input.mp4", "-ss", seg.start.toFixed(2), "-t", segDuration];
          if (segZoomFilter) {
            args.push("-vf", segZoomFilter);
          }
          args.push(
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            `part${i}.mp4`,
          );
          await ffmpeg.exec(args);
        }

        // Create concat file
        const concatContent = enabledSegs.map((_, i) => `file 'part${i}.mp4'`).join("\n");
        const encoder = new TextEncoder();
        await ffmpeg.writeFile("concat.txt", encoder.encode(concatContent));

        setProcessProgress("Merging segments...");
        await ffmpeg.exec([
          "-f", "concat",
          "-safe", "0",
          "-i", "concat.txt",
          "-c", "copy",
          "-movflags", "+faststart",
          "output.mp4",
        ]);
      }

      setProcessProgress("Preparing download...");
      const outputData = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([outputData], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setProcessProgress("Done!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      setProcessError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [duration, segments, ffmpegLoaded, videoUrl, zoomEnabled, buildZoompanFilter]);

  // ─── Keyboard Shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyS") { e.preventDefault(); addSplit(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, addSplit]);

  // ─── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  // ─── Total kept duration ───────────────────────────────────────
  const keptDuration = segments.filter((s) => s.enabled).reduce((acc, s) => acc + (s.end - s.start), 0);
  const keptPercent = duration > 0 ? (keptDuration / duration) * 100 : 100;

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div
      className="rounded-[28px] p-1 mb-8 animate-fade-in-up"
      style={{ backgroundColor: accentColor }}
    >
      <div className="rounded-[24px] p-5 sm:p-6" style={{ backgroundColor: COLORS.white }}>
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight" style={{ color: COLORS.text }}>
                Edit Your Video
              </h2>
              <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                Split, cut, and trim like a pro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: "#F3F4F6", color: COLORS.textMuted }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Video Player ─────────────────────────────────────── */}
        <div className="max-w-lg mx-auto mb-5">
          <div
            className="rounded-2xl overflow-hidden border-2 shadow-lg relative"
            style={{ borderColor: accentColor }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onLoadedMetadata={handleVideoLoaded}
              onClick={handleVideoClickForTarget}
              className="w-full"
              preload="metadata"
              playsInline
              style={{ cursor: settingZoomTarget ? "crosshair" : "default" }}
            />
            {/* Zoom Target Indicator */}
            {zoomEnabled && (
              <div className="absolute pointer-events-none" style={{
                left: `${zoomTarget.x * 100}%`,
                top: `${zoomTarget.y * 100}%`,
                transform: "translate(-50%, -50%)",
              }}>
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: accentColor, backgroundColor: `${accentColor}30` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                </div>
              </div>
            )}
            {/* Setting Target Overlay */}
            {settingZoomTarget && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: COLORS.white }}>
                  Click to set zoom target
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Playback Controls Bar ─────────────────────────────── */}
        {duration > 0 && (
          <div className="max-w-lg mx-auto mb-4">
            <div className="flex items-center gap-3 px-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: accentColor, color: COLORS.white }}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Time Display */}
              <span className="text-xs font-mono font-bold min-w-[80px]" style={{ color: COLORS.text }}>
                {formatTime(currentTime)} / {formatTimeShort(duration)}
              </span>

              <div className="flex-1" />

              {/* Split Button */}
              <button
                onClick={addSplit}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-40"
                style={{ backgroundColor: accentColor, color: COLORS.white }}
                title="Split at playhead (S)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                Split
              </button>
            </div>
          </div>
        )}

        {/* ─── Timeline ──────────────────────────────────────────── */}
        {duration > 0 && (
          <div className="max-w-lg mx-auto mb-5">
            {/* Time labels */}
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>0:00</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                  {formatTimeShort(keptDuration)} kept ({Math.round(keptPercent)}%)
                </span>
              </div>
              <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>{formatTimeShort(duration)}</span>
            </div>

            {/* Timeline Track */}
            <div
              ref={timelineRef}
              className="relative h-14 rounded-xl overflow-hidden cursor-pointer select-none"
              style={{ backgroundColor: COLORS.track }}
              onClick={handleTimelineClick}
            >
              {/* Segments */}
              {segments.map((seg) => {
                const left = (seg.start / duration) * 100;
                const width = ((seg.end - seg.start) / duration) * 100;
                return (
                  <div
                    key={seg.id}
                    className={`absolute inset-y-0 transition-colors duration-150 ${seg.enabled ? "" : "opacity-40"}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: seg.enabled ? COLORS.green : COLORS.red,
                      borderRight: seg === segments[segments.length - 1] ? "none" : `1px solid ${COLORS.white}`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSegment(seg.id);
                      setSelectedSegmentId(seg.id);
                    }}
                    title={seg.enabled ? "Click to remove" : "Click to keep"}
                  >
                    {/* Segment label */}
                    <div className="flex items-center justify-center h-full">
                      <span className="text-[8px] font-bold uppercase tracking-wider px-1 rounded" style={{ color: COLORS.white, backgroundColor: "rgba(0,0,0,0.25)" }}>
                        {seg.enabled ? "KEEP" : "CUT"}
                      </span>
                    </div>
                    {/* Selected indicator */}
                    {selectedSegmentId === seg.id && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ backgroundColor: COLORS.white }} />
                    )}
                  </div>
                );
              })}

              {/* Split Point Handles */}
              {splitPoints.map((time) => (
                <div
                  key={`split-${time}`}
                  className="absolute top-0 bottom-0 w-1 z-10 cursor-col-resize hover:w-1.5 transition-all"
                  style={{
                    left: `${(time / duration) * 100}%`,
                    backgroundColor: COLORS.dark,
                    transform: "translateX(-50%)",
                  }}
                  onMouseDown={(e) => handleSplitMouseDown(e, time)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to adjust split point"
                >
                  {/* Split handle circle */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center hover:scale-125 transition-transform"
                    style={{ backgroundColor: COLORS.white, borderColor: COLORS.dark }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSplit(time);
                    }}
                    title="Click to remove split"
                  >
                    <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke={COLORS.dark} strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none"
                style={{
                  left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                  backgroundColor: accentColor,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
                />
              </div>
            </div>

            {/* Segment Info */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[9px]" style={{ color: COLORS.textMuted }}>
                {segments.length} segment{segments.length !== 1 ? "s" : ""} / {splitPoints.length} split{splitPoints.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={enableAll}
                  className="text-[9px] font-bold px-2 py-1 rounded-md transition-all hover:opacity-80"
                  style={{ backgroundColor: COLORS.greenLight, color: COLORS.green }}
                >
                  Keep All
                </button>
                {splitPoints.length > 0 && (
                  <button
                    onClick={removeAllSplits}
                    className="text-[9px] font-bold px-2 py-1 rounded-md transition-all hover:opacity-80"
                    style={{ backgroundColor: COLORS.redLight, color: COLORS.red }}
                  >
                    Remove All
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Zoom Effects Panel ──────────────────────────────── */}
        {duration > 0 && (
          <div className="max-w-lg mx-auto mb-5">
            <div className="rounded-2xl p-4" style={{ backgroundColor: "#F9FAFB", border: `2px solid ${zoomEnabled ? accentColor : "#E5E7EB"}` }}>
              {/* Header Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Zoom Icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: COLORS.text }}>Zoom Effects</span>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => setZoomEnabled(!zoomEnabled)}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer"
                  style={{ backgroundColor: zoomEnabled ? accentColor : "#D1D5DB" }}
                >
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200" style={{ left: zoomEnabled ? "22px" : "2px" }} />
                </button>
              </div>

              {zoomEnabled && (
                <div className="space-y-3 animate-fade-in">
                  {/* Zoom Type */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: COLORS.textMuted }}>Type</span>
                    <div className="flex gap-1.5">
                      {([
                        { value: "in" as ZoomType, label: "Zoom In", icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" },
                        { value: "out" as ZoomType, label: "Zoom Out", icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" },
                        { value: "kenburns" as ZoomType, label: "Ken Burns", icon: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" },
                      ]).map((zt) => (
                        <button
                          key={zt.value}
                          onClick={() => setZoomType(zt.value)}
                          className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                          style={{
                            backgroundColor: zoomType === zt.value ? accentColor : "#F3F4F6",
                            color: zoomType === zt.value ? COLORS.white : COLORS.textMuted,
                          }}
                        >
                          {zt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensity */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Intensity</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                        {zoomIntensity.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.1"
                      max="2.0"
                      step="0.1"
                      value={zoomIntensity}
                      onChange={(e) => setZoomIntensity(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ backgroundColor: "#E5E7EB", accentColor }}
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[8px]" style={{ color: COLORS.textMuted }}>1.1x</span>
                      <span className="text-[8px]" style={{ color: COLORS.textMuted }}>2.0x</span>
                    </div>
                  </div>

                  {/* Speed */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: COLORS.textMuted }}>Speed</span>
                    <div className="flex gap-1.5">
                      {(["slow", "normal", "fast"] as ZoomSpeed[]).map((sp) => (
                        <button
                          key={sp}
                          onClick={() => setZoomSpeed(sp)}
                          className="flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                          style={{
                            backgroundColor: zoomSpeed === sp ? accentColor : "#F3F4F6",
                            color: zoomSpeed === sp ? COLORS.white : COLORS.textMuted,
                          }}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zoom Target */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Zoom Target</span>
                      <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>
                        {Math.round(zoomTarget.x * 100)}%, {Math.round(zoomTarget.y * 100)}%
                      </span>
                    </div>
                    <button
                      onClick={() => setSettingZoomTarget(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer border-2"
                      style={{
                        borderColor: settingZoomTarget ? accentColor : "#E5E7EB",
                        backgroundColor: settingZoomTarget ? `${accentColor}10` : "transparent",
                        color: settingZoomTarget ? accentColor : COLORS.textMuted,
                      }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                      </svg>
                      {settingZoomTarget ? "Click on the video..." : "Set Target on Video"}
                    </button>
                  </div>

                  {/* Zoom Note */}
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: `${accentColor}08` }}>
                    <p className="text-[9px] leading-relaxed" style={{ color: COLORS.textMuted }}>
                      Zoom effect requires full video re-encoding. Processing may take longer than normal trimming. Best results with clips under 60 seconds.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Tips ─────────────────────────────────────────────── */}
        {!resultUrl && !isProcessing && (
          <div className="max-w-lg mx-auto mb-5 p-3.5 rounded-xl" style={{ backgroundColor: `${COLORS.goldLight}50` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: accentColor }}>Quick Tips</p>
            <ul className="text-[10px] space-y-1" style={{ color: COLORS.textMuted }}>
              <li>Play the video and press <kbd className="px-1 py-0.5 rounded text-[9px] font-mono font-bold" style={{ backgroundColor: "#F3F4F6", color: COLORS.text }}>S</kbd> or click Split to add a cut point</li>
              <li>Click green segments to mark as CUT (red), click again to KEEP (green)</li>
              <li>Drag split handles to fine-tune cut positions</li>
              <li>Click the X on split handles to remove splits</li>
              <li>Press <kbd className="px-1 py-0.5 rounded text-[9px] font-mono font-bold" style={{ backgroundColor: "#F3F4F6", color: COLORS.text }}>Space</kbd> to play/pause</li>
            </ul>
          </div>
        )}

        {/* ─── Export Section ───────────────────────────────────── */}
        <div className="max-w-lg mx-auto">
          {/* Export Button */}
          {!resultUrl && !ffmpegLoading && (
            <button
              onClick={ffmpegLoaded ? processVideo : loadFFmpeg}
              disabled={isProcessing || segments.filter((s) => s.enabled).length === 0}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-lg"
              style={{
                backgroundColor: accentColor,
                color: COLORS.white,
                boxShadow: `0 6px 24px ${accentColor}40`,
              }}
            >
              {ffmpegLoaded ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export Edited Video
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Load Editor Engine
                </>
              )}
            </button>
          )}

          {/* FFmpeg Loading */}
          {ffmpegLoading && (
            <div className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
              <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }} />
              Loading editor engine... (one-time ~30MB download)
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="w-full rounded-2xl p-4" style={{ backgroundColor: `${accentColor}10`, border: `2px solid ${accentColor}30` }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }} />
                <span className="text-sm font-bold" style={{ color: accentColor }}>{processProgress}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                <div className="h-full rounded-full animate-pulse" style={{ backgroundColor: accentColor, width: "60%" }} />
              </div>
            </div>
          )}

          {/* Error */}
          {processError && (
            <div className="mt-3 rounded-xl border-2 p-4" style={{ borderColor: COLORS.red, backgroundColor: COLORS.redLight }}>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
                </svg>
                <p className="text-xs font-bold" style={{ color: COLORS.red }}>{processError}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {resultUrl && (
            <div className="mt-2 pt-4" style={{ borderTop: `2px solid ${COLORS.green}20` }}>
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 mb-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: COLORS.greenLight, color: COLORS.green }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Edit Complete!
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  Your edited video is ready to download
                </p>
              </div>

              <div className="max-w-sm mx-auto mb-4">
                <div className="rounded-2xl overflow-hidden border-2 shadow-lg" style={{ borderColor: COLORS.green }}>
                  <video
                    src={resultUrl}
                    controls
                    autoPlay
                    className="w-full"
                    preload="metadata"
                    playsInline
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={resultUrl}
                  download={`podcast-edited-${Date.now()}.mp4`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: COLORS.green, color: COLORS.white, boxShadow: "0 4px 16px rgba(34,197,94,0.4)" }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Edited Video
                </a>
                <button
                  onClick={() => {
                    setResultUrl("");
                    setProcessError("");
                    setProcessProgress("");
                  }}
                  className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer border-2 hover:bg-gray-50"
                  style={{ borderColor: "#E5E7EB", color: COLORS.textMuted }}
                >
                  Edit Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
