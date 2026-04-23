"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { generateCaptions, type CaptionCue } from "@/lib/caption-generator";

interface VideoWithCaptionsProps {
  videoUrl: string;
  scenes: Array<{ script: string }>;
  captionStyle?: "bold" | "outline" | "karaoke" | "minimal";
  className?: string;
}

const STYLES = {
  bold: {
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#FFFFFF",
    textShadow: "2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
    padding: "6px 16px",
    borderRadius: "8px",
    backgroundColor: "rgba(0,0,0,0.45)",
    transform: "none",
  },
  outline: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#FFFFFF",
    textShadow:
      "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 12px rgba(0,0,0,0.9)",
    padding: "4px 12px",
    borderRadius: "4px",
    backgroundColor: "transparent",
    transform: "none",
  },
  karaoke: {
    fontSize: "1.3rem",
    fontWeight: 900,
    color: "#FFFF00",
    textShadow: "2px 2px 4px rgba(0,0,0,0.9), 0 0 30px rgba(255,255,0,0.3)",
    padding: "8px 20px",
    borderRadius: "12px",
    backgroundColor: "rgba(0,0,0,0.5)",
    transform: "scale(1)",
  },
  minimal: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#FFFFFF",
    textShadow: "1px 1px 4px rgba(0,0,0,0.7)",
    padding: "3px 10px",
    borderRadius: "4px",
    backgroundColor: "rgba(0,0,0,0.3)",
    transform: "none",
  },
};

export default function VideoWithCaptions({
  videoUrl,
  scenes,
  captionStyle = "karaoke",
  className = "",
}: VideoWithCaptionsProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [captions, setCaptions] = useState<CaptionCue[]>([]);
  const [activeCue, setActiveCue] = useState<CaptionCue | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isCueTransitioning, setIsCueTransitioning] = useState(false);

  // Generate captions when duration is known
  useEffect(() => {
    if (duration > 0 && scenes.length > 0) {
      const cues = generateCaptions(scenes, duration);
      setCaptions(cues);
    }
  }, [duration, scenes]);

  // Track video time and find active caption
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);

    const cue = captions.find((c) => t >= c.startTime && t < c.endTime);
    if (cue && cue !== activeCue) {
      setIsCueTransitioning(true);
      setActiveCue(cue);
      setTimeout(() => setIsCueTransitioning(false), 150);
    } else if (!cue && activeCue) {
      setIsCueTransitioning(true);
      setActiveCue(null);
      setTimeout(() => setIsCueTransitioning(false), 150);
    }
  }, [captions, activeCue]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const style = STYLES[captionStyle] || STYLES.karaoke;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        className="w-full rounded-2xl"
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5" />
            </>
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5" />
          )}
        </svg>
      </button>

      {/* Caption overlay */}
      {showCaptions && activeCue && duration > 0 && (
        <div
          className="absolute bottom-14 left-0 right-0 z-10 flex justify-center pointer-events-none px-4"
        >
          <div
            className="text-center transition-all duration-150"
            style={{
              fontSize: style.fontSize,
              fontWeight: style.fontWeight as 700 | 800 | 900 | 600,
              color: style.color,
              textShadow: style.textShadow,
              padding: style.padding,
              borderRadius: style.borderRadius,
              backgroundColor: style.backgroundColor,
              maxWidth: "90%",
              transform: isCueTransitioning
                ? "translateY(4px) scale(0.95)"
                : "translateY(0) scale(1)",
              opacity: isCueTransitioning ? 0.7 : 1,
            }}
          >
            {activeCue.text}
          </div>
        </div>
      )}

      {/* Caption progress bar */}
      {showCaptions && captions.length > 0 && duration > 0 && (
        <div className="absolute bottom-12 left-4 right-4 z-10 h-0.5 rounded-full overflow-hidden pointer-events-none" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: duration > 0 ? (currentTime / duration) * 100 + "%" : "0%",
              backgroundColor: "rgba(255,255,255,0.6)",
            }}
          />
        </div>
      )}
    </div>
  );
}
