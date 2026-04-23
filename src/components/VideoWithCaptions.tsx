"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { generateCaptions, type CaptionCue } from "@/lib/caption-generator";

export type CaptionPosition = "top" | "center" | "bottom";
export type CaptionSize = "small" | "medium" | "large";

interface VideoWithCaptionsProps {
  videoUrl: string;
  scenes: Array<{ script: string }>;
  captionStyle?: "bold" | "outline" | "karaoke" | "minimal";
  captionPosition?: CaptionPosition;
  captionSize?: CaptionSize;
  className?: string;
}

const SIZE_MAP: Record<CaptionSize, string> = {
  small: "0.75rem",
  medium: "1rem",
  large: "1.4rem",
};

const POSITION_MAP: Record<CaptionPosition, string> = {
  top: "top-12 left-0 right-0",
  center: "top-1/2 left-0 right-0 -translate-y-1/2",
  bottom: "bottom-14 left-0 right-0",
};

const STYLES: Record<string, {
  fontWeight: number;
  color: string;
  textShadow: string;
  borderRadius: string;
  backgroundColor: string;
}> = {
  bold: {
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
    borderRadius: "8px",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  outline: {
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow:
      "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 12px rgba(0,0,0,0.9)",
    borderRadius: "4px",
    backgroundColor: "transparent",
  },
  karaoke: {
    fontWeight: 900,
    color: "#FFFF00",
    textShadow: "2px 2px 4px rgba(0,0,0,0.9), 0 0 30px rgba(255,255,0,0.3)",
    borderRadius: "12px",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  minimal: {
    fontWeight: 600,
    color: "#FFFFFF",
    textShadow: "1px 1px 4px rgba(0,0,0,0.7)",
    borderRadius: "4px",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
};

export default function VideoWithCaptions({
  videoUrl,
  scenes,
  captionStyle = "karaoke",
  captionPosition = "bottom",
  captionSize = "medium",
  className = "",
}: VideoWithCaptionsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioConnectedRef = useRef(false);
  const rafRef = useRef<number>(0);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [captions, setCaptions] = useState<CaptionCue[]>([]);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [captionOffset, setCaptionOffset] = useState(0); // user fine-tune offset in seconds

  // Generate captions when duration is known
  useEffect(() => {
    if (duration > 0 && scenes.length > 0) {
      const cues = generateCaptions(scenes, duration);
      setCaptions(cues);
    }
  }, [duration, scenes]);

  // Setup Web Audio API for speech detection
  const setupAudioAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video || audioConnectedRef.current) return;

    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(video);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      audioConnectedRef.current = true;
    } catch {
      // Audio context already exists or not supported — captions still work with timing
      audioConnectedRef.current = true;
    }
  }, []);

  // Main loop: check audio levels + sync captions
  const tick = useCallback(() => {
    const video = videoRef.current;
    const analyser = analyserRef.current;
    if (!video) return;

    const t = video.currentTime;
    setCurrentTime(t);

    // Detect if there is actual speech (audio level above threshold)
    if (analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Focus on speech frequency range (300Hz - 3000Hz)
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const binSize = sampleRate / analyser.fftSize;
      const lowBin = Math.floor(300 / binSize);
      const highBin = Math.min(Math.floor(3000 / binSize), dataArray.length - 1);

      let sum = 0;
      let count = 0;
      for (let b = lowBin; b <= highBin; b++) {
        sum += dataArray[b];
        count++;
      }
      const avgLevel = count > 0 ? sum / count : 0;
      // Threshold: speech typically above 15 in this range
      const speaking = avgLevel > 15;
      setIsSpeaking(speaking);
    }

    // Find active caption based on time + user offset
    const adjustedTime = t + captionOffset;
    let foundIndex = -1;
    for (let i = 0; i < captions.length; i++) {
      if (adjustedTime >= captions[i].startTime && adjustedTime < captions[i].endTime) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== activeCueIndex) {
      setIsTransitioning(true);
      setActiveCueIndex(foundIndex);
      setTimeout(() => setIsTransitioning(false), 120);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [captions, activeCueIndex, captionOffset]);

  // Start/stop animation loop with video play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setupAudioAnalysis();
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick, setupAudioAnalysis]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const styleDef = STYLES[captionStyle] || STYLES.karaoke;
  const fontSize = SIZE_MAP[captionSize] || SIZE_MAP.medium;
  const positionClass = POSITION_MAP[captionPosition] || POSITION_MAP.bottom;
  const activeCue = activeCueIndex >= 0 ? captions[activeCueIndex] : null;
  const showCue = showCaptions && activeCue && duration > 0;

  return (
    <div ref={containerRef} className={"relative " + className}>
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        className="w-full rounded-2xl"
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        crossOrigin="anonymous"
      />

      {/* Caption toggle button */}
      <button
        onClick={() => setShowCaptions(!showCaptions)}
        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
        style={{
          backgroundColor: showCaptions ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
          color: showCaptions ? "#FFFFFF" : "rgba(255,255,255,0.5)",
        }}
        title={showCaptions ? "Hide Captions" : "Show Captions"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          {showCaptions ? (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </>
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5" />
          )}
        </svg>
      </button>

      {/* Caption overlay */}
      {showCue && (
        <div
          className={"absolute z-10 flex justify-center pointer-events-none px-4 " + positionClass}
        >
          <div
            className="text-center transition-all duration-120"
            style={{
              fontSize: fontSize,
              fontWeight: styleDef.fontWeight as 600 | 700 | 800 | 900,
              color: styleDef.color,
              textShadow: styleDef.textShadow,
              padding: captionSize === "small" ? "3px 10px" : captionSize === "large" ? "10px 24px" : "6px 16px",
              borderRadius: styleDef.borderRadius,
              backgroundColor: styleDef.backgroundColor,
              maxWidth: "92%",
              transform: isTransitioning
                ? "translateY(3px) scale(0.96)"
                : "translateY(0) scale(1)",
              opacity: isTransitioning ? 0.6 : 1,
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {showCaptions && duration > 0 && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 rounded-full pointer-events-none" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div
            className="w-1.5 h-1.5 rounded-full transition-colors duration-200"
            style={{ backgroundColor: isSpeaking ? "#4ADE80" : "#EF4444" }}
          />
          <span className="text-[9px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.7)" }}>
            {isSpeaking ? "Speaking" : "Silent"}
          </span>
        </div>
      )}
    </div>
  );
}
