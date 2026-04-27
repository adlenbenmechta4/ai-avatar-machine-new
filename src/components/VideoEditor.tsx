"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

type ZoomType = "none" | "in" | "out";

interface Segment {
  id: string;
  start: number;
  end: number;
  enabled: boolean;
  zoom: ZoomType;
  zoomLevel: number; // 1.0 to 2.0
}

interface VideoEditorProps {
  videoUrl: string;
  onClose?: (editedUrl?: string) => void;
  onCaptionEditedVideo?: (blobUrl: string) => void | Promise<void>;
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
  purple: "#8B5CF6",
  purpleLight: "#F3F0FF",
  cyan: "#16B1DE",
  cyanLight: "#F0FBFD",
};

// ─── Zoom Icon SVGs ────────────────────────────────────────────────────

function ZoomNoneIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
    </svg>
  );
}

// ─── ZoomLevel Slider ──────────────────────────────────────────────────

function ZoomLevelSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const presets = [1.2, 1.4, 1.6, 1.8, 2.0];
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Intensity</span>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-md" style={{ backgroundColor: `${color}18`, color }}>
          {value.toFixed(1)}x
        </span>
      </div>
      <input
        type="range"
        min="1.1"
        max="2.0"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - 1.1) / 0.9) * 100}%, #E5E7EB ${((value - 1.1) / 0.9) * 100}%, #E5E7EB 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className="px-1.5 py-0.5 rounded text-[8px] font-bold transition-all"
            style={{
              backgroundColor: value === p ? `${color}18` : "transparent",
              color: value === p ? color : COLORS.textMuted,
            }}
          >
            {p}x
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── VideoEditor Component ──────────────────────────────────────────────

export default function VideoEditor({ videoUrl, onClose, onCaptionEditedVideo, accentColor = COLORS.gold }: VideoEditorProps) {
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
  const [isPlayheadDragging, setIsPlayheadDragging] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [liveZoomScale, setLiveZoomScale] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const segmentsRef = useRef<Segment[]>([]);
  const durationRef = useRef(0);

  // ─── Undo / Redo History ─────────────────────────────────────
  const historyRef = useRef<Segment[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((newSegments: Segment[]) => {
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    // Remove any redo states ahead of current index
    const trimmed = hist.slice(0, idx + 1);
    trimmed.push(JSON.parse(JSON.stringify(newSegments)));
    // Keep max 50 entries
    if (trimmed.length > 50) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setCanUndo(trimmed.length > 1);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const prevSegs = hist[idx - 1];
    historyIndexRef.current = idx - 1;
    setSegments(JSON.parse(JSON.stringify(prevSegs)));
    setCanUndo(idx - 1 > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const hist = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx >= hist.length - 1) return;
    const nextSegs = hist[idx + 1];
    historyIndexRef.current = idx + 1;
    setSegments(JSON.parse(JSON.stringify(nextSegs)));
    setCanUndo(true);
    setCanRedo(idx + 1 < hist.length - 1);
  }, []);

  // Wrap setSegments to auto-push history
  const setSegmentsWithHistory = useCallback((updater: Segment[] | ((prev: Segment[]) => Segment[])) => {
    setSegments((prev) => {
      const newSegs = typeof updater === "function" ? updater(prev) : updater;
      // Push to history in a microtask to avoid circular state
      setTimeout(() => pushHistory(newSegs), 0);
      return newSegs;
    });
  }, [pushHistory]);

  const ffmpegRef = useRef<unknown>(null);
  const progressCallbackRef = useRef<((msg: string) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomAnimRef = useRef<number>(0);

  // ─── Load Video Metadata ────────────────────────────────────────
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration && isFinite(video.duration)) {
      setDuration(video.duration);
      const initial: Segment[] = [{ id: "seg-0", start: 0, end: video.duration, enabled: true, zoom: "none", zoomLevel: 1.5 }];
      setSegments(initial);
      historyRef.current = [JSON.parse(JSON.stringify(initial))];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    }
  }, []);

  // ─── Keep refs in sync with state for animation loop ──
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // ─── Auto-scroll timeline to keep playhead visible during playback ──
  useEffect(() => {
    if (!isPlaying || !timelineScrollRef.current || !timelineRef.current || timelineZoom <= 1) return;
    const scrollEl = timelineScrollRef.current;
    const trackRect = timelineRef.current.getBoundingClientRect();
    const viewWidth = scrollEl.clientWidth;
    const totalWidth = viewWidth * timelineZoom;
    const playheadX = duration > 0 ? (currentTime / duration) * totalWidth : 0;
    const scrollLeft = scrollEl.scrollLeft;
    // Keep playhead in the center 60% of view
    const margin = viewWidth * 0.2;
    if (playheadX < scrollLeft + margin) {
      scrollEl.scrollLeft = Math.max(0, playheadX - margin);
    } else if (playheadX > scrollLeft + viewWidth - margin) {
      scrollEl.scrollLeft = Math.min(totalWidth - viewWidth, playheadX - viewWidth + margin);
    }
  }, [currentTime, isPlaying, duration, timelineZoom]);

  // ─── Real-time zoom animation loop (updates CSS transform on playing video) ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let running = true;

    const updateZoom = () => {
      if (!running) return;

      const t = video.currentTime;
      setCurrentTime(t);

      const segs = segmentsRef.current;
      const dur = durationRef.current;

      // Calculate zoom for current time — DIRECT instant zoom
      let scale = 1;
      if (dur > 0 && segs.length > 0) {
        const seg = segs.find((s) => s.enabled && t >= s.start && t <= s.end);
        if (seg && seg.zoom !== "none") {
          scale = seg.zoomLevel; // instant zoom, no gradual transition
        }
      }

      setLiveZoomScale(scale);

      // Apply CSS transform directly to video element for smooth real-time zoom
      video.style.transform = `scale(${scale})`;
      video.style.transformOrigin = "center center";

      zoomAnimRef.current = requestAnimationFrame(updateZoom);
    };

    zoomAnimRef.current = requestAnimationFrame(updateZoom);
    return () => {
      running = false;
      cancelAnimationFrame(zoomAnimRef.current);
    };
  }, []);

  // ─── Video end handler ───────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      setIsPlaying(false);
      setLiveZoomScale(1);
      video.style.transform = "scale(1)";
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, []);

  // ─── Play/Pause ────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        video.muted = isMuted;
        await video.play();
        setIsPlaying(true);
      } catch {
        // Autoplay may be blocked, try muted play
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
          setIsPlaying(true);
        } catch {
          console.warn("Could not play video");
        }
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isMuted]);

  // ─── Seek to time ──────────────────────────────────────────────
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    // Update live zoom for seeked position — direct instant zoom
    const seg = segments.find((s) => s.enabled && clampedTime >= s.start && clampedTime <= s.end);
    if (seg && seg.zoom !== "none") {
      setLiveZoomScale(seg.zoomLevel);
    } else {
      setLiveZoomScale(1);
    }
  }, [duration, segments]);

  // ─── Timeline Click to Seek (getBoundingClientRect handles scroll) ──
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !timelineRef.current || isDragging) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }, [duration, seekTo, isDragging]);

  // ─── Add Split at Playhead ─────────────────────────────────────
  const addSplit = useCallback(() => {
    if (!duration || !videoRef.current) return;
    const time = videoRef.current.currentTime;
    if (time <= 0.1 || time >= duration - 0.1) return;

    setSegmentsWithHistory((prev) => {
      const segIndex = prev.findIndex((s) => time > s.start + 0.05 && time < s.end - 0.05);
      if (segIndex === -1) return prev;
      const seg = prev[segIndex];
      const newSegs = [...prev];
      newSegs.splice(segIndex, 1,
        { ...seg, end: time, id: `seg-${Date.now()}-a` },
        { ...seg, start: time, id: `seg-${Date.now()}-b`, enabled: seg.enabled, zoom: seg.zoom, zoomLevel: seg.zoomLevel },
      );
      return newSegs;
    });
  }, [duration, setSegmentsWithHistory]);

  // ─── Remove Split ──────────────────────────────────────────────
  const removeSplit = useCallback((splitTime: number) => {
    setSegmentsWithHistory((prev) => {
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
  }, [setSegmentsWithHistory]);

  // ─── Toggle Segment ────────────────────────────────────────────
  const toggleSegment = useCallback((segId: string) => {
    setSegmentsWithHistory((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, enabled: !s.enabled } : s))
    );
  }, [setSegmentsWithHistory]);

  // ─── Get split points (internal boundaries) ───────────────────
  const splitPoints = segments.slice(1).map((s) => s.start);

  // ─── Update Segment Zoom ───────────────────────────────────────
  const updateSegmentZoom = useCallback((segId: string, zoom: ZoomType) => {
    setSegmentsWithHistory((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, zoom } : s))
    );
  }, [setSegmentsWithHistory]);

  const updateSegmentZoomLevel = useCallback((segId: string, zoomLevel: number) => {
    setSegmentsWithHistory((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, zoomLevel } : s))
    );
  }, [setSegmentsWithHistory]);

  // ─── Apply Zoom to All Segments ────────────────────────────────
  const applyZoomToAll = useCallback((zoom: ZoomType) => {
    setSegmentsWithHistory((prev) =>
      prev.map((s) => ({ ...s, zoom }))
    );
  }, [setSegmentsWithHistory]);

  // ─── Enable All Segments ───────────────────────────────────────
  const enableAll = useCallback(() => {
    setSegmentsWithHistory((prev) => prev.map((s) => ({ ...s, enabled: true })));
  }, [setSegmentsWithHistory]);

  // ─── Remove All Splits ─────────────────────────────────────────
  const removeAllSplits = useCallback(() => {
    if (!duration) return;
    setSegmentsWithHistory([{ id: "seg-0", start: 0, end: duration, enabled: true, zoom: "none", zoomLevel: 1.5 }]);
    setSelectedSegmentId(null);
  }, [duration, setSegmentsWithHistory]);

  // ─── Handle Playhead Drag (accounts for zoom + scroll) ──────
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPlayheadDragging(true);

    const video = videoRef.current;
    if (video) video.pause();

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (moveE.clientX - rect.left) / rect.width));
      const newTime = Math.round(ratio * duration * 100) / 100;
      seekTo(newTime);
    };

    const handleMouseUp = () => {
      setIsPlayheadDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [duration, seekTo]);

  // ─── Handle Playhead Touch Drag ────────────────────────────────
  const handlePlayheadTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsPlayheadDragging(true);

    const video = videoRef.current;
    if (video) video.pause();

    const handleTouchMove = (moveE: TouchEvent) => {
      if (!timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const touch = moveE.touches[0];
      const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const newTime = Math.round(ratio * duration * 100) / 100;
      seekTo(newTime);
    };

    const handleTouchEnd = () => {
      setIsPlayheadDragging(false);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  }, [duration, seekTo]);

  // ─── Handle Split Drag (accounts for zoom + scroll) ───────
  const handleSplitMouseDown = useCallback((e: React.MouseEvent, splitTime: number) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragSplitId(`split-${splitTime}`);

    // Save snapshot before drag for undo
    const snapshotBefore = JSON.parse(JSON.stringify(segmentsRef.current));

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
      // Push to history after drag ends (only if segments actually changed)
      const currentSegs = JSON.parse(JSON.stringify(segmentsRef.current));
      if (JSON.stringify(snapshotBefore) !== JSON.stringify(currentSegs)) {
        pushHistory(currentSegs);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [duration, pushHistory]);

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

  // ─── Get Zoom Color ────────────────────────────────────────────
  function getZoomColor(zoom: ZoomType): string {
    switch (zoom) {
      case "in": return COLORS.purple;
      case "out": return COLORS.cyan;
      default: return COLORS.green;
    }
  }

  // ─── Process & Export Video ─────────────────────────────────────
  const processVideo = useCallback(async () => {
    if (!duration || !ffmpegLoaded) return;

    const enabledSegs = segments.filter((s) => s.enabled);
    if (enabledSegs.length === 0) {
      setProcessError("No segments selected. Enable at least one segment.");
      return;
    }

    // Check if there are any zoom effects
    const hasZoom = enabledSegs.some((s) => s.zoom !== "none");

    // If no edits needed (single full segment, no zoom), just provide the original
    if (!hasZoom && enabledSegs.length === 1 && enabledSegs[0].start < 0.1 && enabledSegs[0].end > duration - 0.1) {
      setResultUrl(videoUrl);
      return;
    }

    setIsProcessing(true);
    setProcessError("");
    setResultUrl("");
    setProcessProgress("Downloading video file...");

    try {
      const ffmpeg = ffmpegRef.current as {
        writeFile: (n: string, d: Uint8Array) => Promise<void>;
        exec: (args: string[]) => Promise<void>;
        readFile: (n: string) => Promise<Uint8Array>;
        on: (e: string, cb: (data: { progress?: number }) => void) => void;
      };

      // Download video via proxy
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
      const videoRes = await fetch(proxyUrl);
      if (!videoRes.ok) throw new Error("Failed to download video");
      const videoData = new Uint8Array(await videoRes.arrayBuffer());

      setProcessProgress("Loading video into editor...");
      await ffmpeg.writeFile("input.mp4", videoData);

      setProcessProgress("Processing cuts...");

      // Step 1: Extract and optionally apply zoom to each segment
      for (let i = 0; i < enabledSegs.length; i++) {
        const seg = enabledSegs[i];
        const segDuration = (seg.end - seg.start).toFixed(2);
        setProcessProgress(`Processing segment ${i + 1} of ${enabledSegs.length}...`);

        ffmpeg.on("progress", ({ progress }) => {
          if (progress !== undefined) {
            setProcessProgress(`Processing segment ${i + 1}... ${Math.round(progress * 100)}%`);
          }
        });

        if (seg.zoom !== "none") {
          const zl = seg.zoomLevel;

          // Pass 1: Extract segment (trim only, keep original quality)
          setProcessProgress(`Extracting segment ${i + 1}...`);
          await ffmpeg.exec([
            "-i", "input.mp4",
            "-ss", seg.start.toFixed(2),
            "-t", segDuration,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "18",
            "-an",
            "-movflags", "+faststart",
            `trimmed${i}.mp4`,
          ]);

          // Pass 2: Apply instant zoom using scale + crop (matches CSS transform)
          // This scales the video UP by zoomLevel, then crops back to original size from center
          // Equivalent to CSS: transform: scale(zl); transform-origin: center center;
          setProcessProgress(`Applying zoom to segment ${i + 1}...`);
          await ffmpeg.exec([
            "-i", `trimmed${i}.mp4`,
            "-vf", `scale=iw*${zl}:ih*${zl},crop=iw/${zl}:ih/${zl}`,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "20",
            "-an",
            "-movflags", "+faststart",
            `part${i}.mp4`,
          ]);

          // Extract audio for this segment (from original, no re-encoding)
          await ffmpeg.exec([
            "-i", "input.mp4",
            "-ss", seg.start.toFixed(2),
            "-t", segDuration,
            "-vn",
            "-c:a", "aac",
            "-b:a", "128k",
            `audio${i}.aac`,
          ]);

          // Merge zoomed video + audio
          await ffmpeg.exec([
            "-i", `part${i}.mp4`,
            "-i", `audio${i}.aac`,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            `seg${i}.mp4`,
          ]);
        } else {
          // No zoom — simple trim with audio
          await ffmpeg.exec([
            "-i", "input.mp4",
            "-ss", seg.start.toFixed(2),
            "-t", segDuration,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            `seg${i}.mp4`,
          ]);
        }
      }

      // Step 2: Concatenate all segments
      if (enabledSegs.length === 1) {
        await ffmpeg.exec(["-i", "seg0.mp4", "-c", "copy", "-movflags", "+faststart", "output.mp4"]);
      } else {
        setProcessProgress("Merging segments...");
        const concatContent = enabledSegs.map((_, i) => `file 'seg${i}.mp4'`).join("\n");
        const encoder = new TextEncoder();
        await ffmpeg.writeFile("concat.txt", encoder.encode(concatContent));

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
  }, [duration, segments, ffmpegLoaded, videoUrl]);

  // ─── Keyboard Shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addSplit(); }
      // Ctrl+Z / Cmd+Z = Undo
      if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      // Ctrl+Shift+Z / Ctrl+Alt+Z = Redo
      if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey)) { e.preventDefault(); redo(); }
      // Ctrl+Y = Redo (alternative)
      if (e.code === "KeyY" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlay, addSplit, undo, redo]);

  // ─── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  // ─── Total kept duration ───────────────────────────────────────
  const keptDuration = segments.filter((s) => s.enabled).reduce((acc, s) => acc + (s.end - s.start), 0);
  const keptPercent = duration > 0 ? (keptDuration / duration) * 100 : 100;

  // ─── Selected Segment ──────────────────────────────────────────
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  // ─── Count segments with zoom ──────────────────────────────────
  const zoomCount = segments.filter((s) => s.zoom !== "none").length;

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
                Split, cut, zoom & trim like a pro
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose?.()}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: "#F3F4F6", color: COLORS.textMuted }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Video Player with Real-Time Zoom ──────────── */}
        <div className="flex justify-center mb-5">
          <div
            ref={containerRef}
            className="rounded-2xl overflow-hidden border-2 shadow-lg relative"
            style={{
              borderColor: accentColor,
              width: "min(280px, 80vw)",
              aspectRatio: "9/16",
            }}
          >
            {/* Visible video element with real-time CSS zoom transform */}
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleVideoLoaded}
              preload="auto"
              playsInline
              muted={isMuted}
              onClick={togglePlay}
              className="w-full h-full object-cover block cursor-pointer"
              style={{
                transform: "scale(1)",
                transformOrigin: "center center",
              }}
            />

            {/* Custom video controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-8" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
              <div className="w-full h-1 rounded-full mb-2 cursor-pointer" style={{ backgroundColor: "rgba(255,255,255,0.25)" }} onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                seekTo(ratio * duration);
              }}>
                <div className="h-full rounded-full" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%", backgroundColor: accentColor, transition: "width 0.1s linear" }} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: COLORS.white }}>
                  {isPlaying ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <span className="text-[9px] font-mono" style={{ color: COLORS.white }}>
                  {formatTime(currentTime)} / {formatTimeShort(duration)}
                </span>
                <div className="flex-1" />
                {/* Mute/Unmute button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const video = videoRef.current;
                    if (video) {
                      const newMuted = !isMuted;
                      video.muted = newMuted;
                      setIsMuted(newMuted);
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: isMuted ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)", color: COLORS.white }}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Zoom indicator badge */}
            {liveZoomScale !== 1 && (
              <div
                className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                style={{
                  backgroundColor: "rgba(0,0,0,0.7)",
                  color: COLORS.white,
                  backdropFilter: "blur(8px)",
                }}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                {liveZoomScale.toFixed(1)}x
              </div>
            )}
          </div>
        </div>

        {/* ─── Playback Controls Bar ─────────────────────────────── */}
        {duration > 0 && (
          <div className="max-w-lg mx-auto mb-4">
            <div className="flex items-center gap-2 px-2">
              {/* Undo */}
              <button
                onClick={undo}
                disabled={!canUndo || isProcessing}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: canUndo ? `${accentColor}15` : "transparent", color: canUndo ? accentColor : COLORS.textMuted }}
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M3 13c1.5-4 5-6 9-6s6.5 2 7.5 5" />
                </svg>
              </button>

              {/* Redo */}
              <button
                onClick={redo}
                disabled={!canRedo || isProcessing}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: canRedo ? `${accentColor}15` : "transparent", color: canRedo ? accentColor : COLORS.textMuted }}
                title="Redo (Ctrl+Shift+Z)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6" />
                  <path d="M21 13c-1.5-4-5-6-9-6S5.5 9 4.5 12" />
                </svg>
              </button>

              {/* divider */}
              <div className="w-px h-5" style={{ backgroundColor: COLORS.track }} />

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

              {/* Mute/Unmute */}
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    const newMuted = !isMuted;
                    video.muted = newMuted;
                    setIsMuted(newMuted);
                  }
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                style={{ backgroundColor: isMuted ? "#F3F4F6" : `${accentColor}20`, color: isMuted ? COLORS.textMuted : accentColor }}
                title={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>

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
            {/* Time labels + Zoom controls row */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>0:00</span>
              </div>
              {/* Timeline Zoom Controls - prominent */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: "#F3F4F6" }}>
                <span className="text-[8px] font-bold uppercase tracking-wider mr-1" style={{ color: COLORS.textMuted }}>Timeline</span>
                <button
                  onClick={() => setTimelineZoom((z) => Math.max(1, z - 1))}
                  disabled={timelineZoom <= 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-25"
                  style={{ backgroundColor: timelineZoom > 1 ? accentColor : "#E5E7EB", color: timelineZoom > 1 ? COLORS.white : COLORS.textMuted }}
                  title="Zoom out timeline"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </button>
                <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded min-w-[36px] text-center" style={{ backgroundColor: COLORS.white, color: accentColor, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  {timelineZoom}x
                </span>
                <button
                  onClick={() => setTimelineZoom((z) => Math.min(10, z + 1))}
                  disabled={timelineZoom >= 10}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-25"
                  style={{ backgroundColor: timelineZoom < 10 ? accentColor : "#E5E7EB", color: timelineZoom < 10 ? COLORS.white : COLORS.textMuted }}
                  title="Zoom in timeline"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                  </svg>
                </button>
                {timelineZoom > 1 && (
                  <button
                    onClick={() => setTimelineZoom(1)}
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded transition-all hover:opacity-80"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                  {formatTimeShort(keptDuration)} kept ({Math.round(keptPercent)}%)
                </span>
                {zoomCount > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.purple}15`, color: COLORS.purple }}>
                    {zoomCount} zoom
                  </span>
                )}
                <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>{formatTimeShort(duration)}</span>
              </div>
            </div>

            {/* Scrollable Timeline Container */}
            <div
              ref={timelineScrollRef}
              className="rounded-xl overflow-x-auto overflow-y-hidden"
              style={{
                scrollbarWidth: timelineZoom > 1 ? "thin" : "none",
              }}
            >
            {/* Timeline Track */}
            <div
              ref={timelineRef}
              className="relative h-14 rounded-xl overflow-hidden cursor-pointer select-none"
              style={{
                backgroundColor: COLORS.track,
                width: `${timelineZoom * 100}%`,
                minWidth: "100%",
              }}
              onClick={handleTimelineClick}
            >
              {/* Segments */}
              {segments.map((seg) => {
                const left = (seg.start / duration) * 100;
                const width = ((seg.end - seg.start) / duration) * 100;
                const isSelected = selectedSegmentId === seg.id;
                const zoomColor = getZoomColor(seg.zoom);

                return (
                  <div
                    key={seg.id}
                    className={`absolute inset-y-0 transition-colors duration-150 ${seg.enabled ? "" : "opacity-40"}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: seg.enabled ? zoomColor : COLORS.red,
                      borderRight: seg === segments[segments.length - 1] ? "none" : `1px solid ${COLORS.white}`,
                      outline: isSelected ? `2px solid ${COLORS.dark}` : "none",
                      outlineOffset: "-1px",
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      toggleSegment(seg.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSegmentId(seg.id);
                    }}
                  >
                    {/* Segment label */}
                    <div className="flex items-center justify-center h-full gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSegment(seg.id);
                        }}
                        className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer transition-all hover:scale-110 hover:brightness-110"
                        style={{ color: COLORS.white, backgroundColor: seg.enabled ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" }}
                        title={seg.enabled ? "Click to CUT this segment" : "Click to KEEP this segment"}
                      >
                        {seg.enabled ? "KEEP" : "CUT"}
                      </button>
                      {seg.zoom !== "none" && seg.enabled && (
                        <span className="text-[7px] font-black uppercase px-1 rounded" style={{ color: COLORS.white, backgroundColor: "rgba(0,0,0,0.35)" }}>
                          {seg.zoom === "in" ? "ZOOM+" : "ZOOM-"}
                        </span>
                      )}
                    </div>
                    {/* Selected indicator */}
                    {isSelected && (
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

              {/* Playhead - Draggable Scrubber */}
              <div
                className="absolute top-0 bottom-0 z-30 flex flex-col items-center"
                style={{
                  left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                  transform: "translateX(-50%)",
                }}
              >
                {/* Time tooltip above playhead */}
                {isPlayheadDragging && (
                  <div
                    className="absolute -top-8 px-2 py-0.5 rounded-md text-[10px] font-black font-mono whitespace-nowrap"
                    style={{
                      backgroundColor: COLORS.dark,
                      color: COLORS.white,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    {formatTime(currentTime)}
                  </div>
                )}
                {/* Grab handle at top */}
                <div
                  className="w-5 h-5 -mt-2 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform hover:scale-125 z-30"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 0 2px ${COLORS.white}, 0 2px 8px rgba(0,0,0,0.3)`,
                  }}
                  onMouseDown={handlePlayheadMouseDown}
                  onTouchStart={handlePlayheadTouchStart}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke={COLORS.white} strokeWidth={3} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                {/* Vertical line */}
                <div
                  className="flex-1 w-0.5 min-h-0"
                  style={{ backgroundColor: accentColor }}
                />
                {/* Bottom anchor */}
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
            {/* End scrollable container */}
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

        {/* ─── Zoom Controls Panel ────────────────────────────────── */}
        {duration > 0 && (
          <div className="max-w-lg mx-auto mb-5">
            <div
              className="rounded-xl p-4 border-2"
              style={{
                backgroundColor: selectedSegment ? `${COLORS.purpleLight}30` : "#FAFAFA",
                borderColor: selectedSegment ? `${COLORS.purple}30` : "#F3F4F6",
              }}
            >
              {/* Zoom Section Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${COLORS.purple}18` }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={COLORS.purple} strokeWidth={2.5} strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                      <path d="M11 8v6M8 11h6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: COLORS.text }}>Zoom Effect</p>
                    <p className="text-[9px]" style={{ color: COLORS.textMuted }}>
                      {selectedSegment
                        ? `Editing: ${formatTimeShort(selectedSegment.start)} - ${formatTimeShort(selectedSegment.end)}`
                        : "Select a segment on the timeline to apply zoom"
                      }
                    </p>
                  </div>
                </div>

                {/* Apply to All dropdown */}
                {segments.length > 1 && (
                  <div className="relative group">
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                      style={{ backgroundColor: "#F3F4F6", color: COLORS.textMuted }}
                    >
                      Apply All
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20 hidden group-hover:block min-w-[120px]">
                      {(["none", "in", "out"] as ZoomType[]).map((z) => (
                        <button
                          key={z}
                          onClick={() => applyZoomToAll(z)}
                          className="w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors"
                          style={{ color: COLORS.text }}
                        >
                          {z === "none" ? "No Zoom" : z === "in" ? "Zoom In" : "Zoom Out"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Zoom Type Selector (for selected segment) */}
              {selectedSegment && selectedSegment.enabled && (
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    {/* No Zoom */}
                    <button
                      onClick={() => updateSegmentZoom(selectedSegment.id, "none")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                      style={{
                        backgroundColor: selectedSegment.zoom === "none" ? `${COLORS.green}18` : "#F3F4F6",
                        color: selectedSegment.zoom === "none" ? COLORS.green : COLORS.textMuted,
                        boxShadow: selectedSegment.zoom === "none" ? `0 0 12px ${COLORS.green}20` : "none",
                        border: `1.5px solid ${selectedSegment.zoom === "none" ? `${COLORS.green}40` : "transparent"}`,
                      }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                      </svg>
                      None
                    </button>

                    {/* Zoom In */}
                    <button
                      onClick={() => updateSegmentZoom(selectedSegment.id, "in")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                      style={{
                        backgroundColor: selectedSegment.zoom === "in" ? `${COLORS.purple}18` : "#F3F4F6",
                        color: selectedSegment.zoom === "in" ? COLORS.purple : COLORS.textMuted,
                        boxShadow: selectedSegment.zoom === "in" ? `0 0 12px ${COLORS.purple}20` : "none",
                        border: `1.5px solid ${selectedSegment.zoom === "in" ? `${COLORS.purple}40` : "transparent"}`,
                      }}
                    >
                      <ZoomInIcon />
                      Zoom In
                    </button>

                    {/* Zoom Out */}
                    <button
                      onClick={() => updateSegmentZoom(selectedSegment.id, "out")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                      style={{
                        backgroundColor: selectedSegment.zoom === "out" ? `${COLORS.cyan}18` : "#F3F4F6",
                        color: selectedSegment.zoom === "out" ? COLORS.cyan : COLORS.textMuted,
                        boxShadow: selectedSegment.zoom === "out" ? `0 0 12px ${COLORS.cyan}20` : "none",
                        border: `1.5px solid ${selectedSegment.zoom === "out" ? `${COLORS.cyan}40` : "transparent"}`,
                      }}
                    >
                      <ZoomOutIcon />
                      Zoom Out
                    </button>
                  </div>

                  {/* Zoom Level Slider */}
                  {selectedSegment.zoom !== "none" && (
                    <ZoomLevelSlider
                      value={selectedSegment.zoomLevel}
                      onChange={(v) => updateSegmentZoomLevel(selectedSegment.id, v)}
                      color={getZoomColor(selectedSegment.zoom)}
                    />
                  )}
                </div>
              )}

              {/* Quick info when no segment selected */}
              {!selectedSegment && (
                <div className="text-center py-2">
                  <p className="text-[10px]" style={{ color: COLORS.textMuted }}>
                    Click on a segment in the timeline to configure its zoom effect
                  </p>
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
              <li>Click segments on the timeline to select, then choose <b style={{ color: COLORS.purple }}>Zoom In</b> or <b style={{ color: COLORS.cyan }}>Zoom Out</b></li>
              <li><b style={{ color: COLORS.purple }}>Purple</b> segments = Zoom In &nbsp;|&nbsp; <b style={{ color: COLORS.cyan }}>Cyan</b> segments = Zoom Out</li>
              <li>Preview zoom live by pressing play — watch the video zoom in real-time!</li>
              <li>Drag split handles to fine-tune cut positions</li>
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
                  Export {zoomCount > 0 ? "with Zoom " : ""}
                  Edited Video
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
                {onCaptionEditedVideo && (
                  <button
                    onClick={async () => {
                      setCaptionLoading(true);
                      setCaptionError("");
                      try {
                        await onCaptionEditedVideo(resultUrl);
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Failed to upload video for captions";
                        setCaptionError(msg);
                      } finally {
                        setCaptionLoading(false);
                      }
                    }}
                    disabled={captionLoading}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: COLORS.cyan, color: COLORS.white, boxShadow: "0 4px 16px rgba(22,177,222,0.4)" }}
                  >
                    {captionLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: COLORS.white }} />
                        Uploading for Captions...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                        </svg>
                        Add Captions
                      </>
                    )}
                  </button>
                )}
                {captionError && (
                  <div className="w-full mt-2 rounded-xl border-2 p-3" style={{ borderColor: COLORS.red, backgroundColor: COLORS.redLight }}>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                      <div>
                        <p className="text-xs font-bold" style={{ color: COLORS.red }}>Caption upload failed</p>
                        <p className="text-[10px] mt-0.5" style={{ color: COLORS.textMuted }}>{captionError}</p>
                      </div>
                    </div>
                  </div>
                )}
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
