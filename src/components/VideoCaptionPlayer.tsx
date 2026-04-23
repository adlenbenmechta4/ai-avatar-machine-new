"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { CaptionCue } from "@/lib/caption-utils";

export type CaptionPosition = "top" | "center" | "bottom";
export type CaptionSize = "small" | "medium" | "large" | "xl";

interface VideoCaptionPlayerProps {
  videoUrl: string;
  captions: CaptionCue[];
  captionStyle?: "bold" | "outline" | "karaoke" | "minimal";
  captionPosition?: CaptionPosition;
  captionSize?: CaptionSize;
  className?: string;
  /** Offset in seconds to shift all captions (positive = later, negative = earlier) */
  captionOffset?: number;
}

const SIZE_MAP: Record<CaptionSize, { fontSize: string; padding: string }> = {
  small:  { fontSize: "0.7rem",  padding: "2px 8px" },
  medium: { fontSize: "0.95rem", padding: "5px 14px" },
  large:  { fontSize: "1.25rem", padding: "8px 20px" },
  xl:     { fontSize: "1.6rem",  padding: "10px 26px" },
};

const POSITION_MAP: Record<CaptionPosition, string> = {
  top:    "top-[12%] left-0 right-0",
  center: "top-1/2 left-0 right-0 -translate-y-1/2",
  bottom: "bottom-[10%] left-0 right-0",
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  outline: {
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 12px rgba(0,0,0,0.9)",
    borderRadius: "4px",
    backgroundColor: "transparent",
  },
  karaoke: {
    fontWeight: 900,
    color: "#FFFF00",
    textShadow: "2px 2px 4px rgba(0,0,0,0.9), 0 0 30px rgba(255,255,0,0.3)",
    borderRadius: "12px",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  minimal: {
    fontWeight: 600,
    color: "#FFFFFF",
    textShadow: "1px 1px 4px rgba(0,0,0,0.7)",
    borderRadius: "4px",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
};

export default function VideoCaptionPlayer({
  videoUrl,
  captions,
  captionStyle = "karaoke",
  captionPosition = "bottom",
  captionSize = "medium",
  className = "",
  captionOffset = 0,
}: VideoCaptionPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  const [showCaptions, setShowCaptions] = useState(true);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animation loop: sync caption with video time
  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const adjustedTime = video.currentTime + captionOffset;
    let found = -1;

    for (let i = 0; i < captions.length; i++) {
      if (adjustedTime >= captions[i].startTime && adjustedTime <= captions[i].endTime) {
        found = i;
        break;
      }
    }

    if (found !== activeCueIndex) {
      setIsTransitioning(true);
      setActiveCueIndex(found);
      setTimeout(() => setIsTransitioning(false), 100);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [captions, activeCueIndex, captionOffset]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
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
  }, [tick]);

  const styleDef = STYLES[captionStyle] || STYLES.karaoke;
  const sizeDef = SIZE_MAP[captionSize] || SIZE_MAP.medium;
  const positionClass = POSITION_MAP[captionPosition] || POSITION_MAP.bottom;
  const activeCue = activeCueIndex >= 0 ? captions[activeCueIndex] : null;
  const showCue = showCaptions && activeCue && captions.length > 0;

  return (
    <div className={"relative " + className}>
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        className="w-full rounded-2xl"
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Caption toggle */}
      <button
        onClick={() => setShowCaptions(!showCaptions)}
        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 cursor-pointer"
        style={{
          backgroundColor: showCaptions ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
          color: showCaptions ? "#FFFFFF" : "rgba(255,255,255,0.5)",
        }}
        title={showCaptions ? "Hide Captions" : "Show Captions"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          {showCaptions ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
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
            className="text-center"
            style={{
              fontSize: sizeDef.fontSize,
              fontWeight: styleDef.fontWeight as 600 | 700 | 800 | 900,
              color: styleDef.color,
              textShadow: styleDef.textShadow,
              padding: sizeDef.padding,
              borderRadius: styleDef.borderRadius,
              backgroundColor: styleDef.backgroundColor,
              maxWidth: "92%",
              lineHeight: 1.4,
              transform: isTransitioning ? "translateY(2px) scale(0.97)" : "translateY(0) scale(1)",
              opacity: isTransitioning ? 0.7 : 1,
              transition: "all 0.1s ease-out",
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}
    </div>
  );
}
