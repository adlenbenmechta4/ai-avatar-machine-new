"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

// ─── Types ──────────────────────────────────────────────────────────────

interface CaptionPanelModalProps {
  videoUrl: string;
  onClose: (captionedUrl?: string) => void;
  accentColor?: string;
}

type FontWeight = "normal" | "bold" | "black";
type SubPosition = "top" | "center" | "bottom";

// ─── Colors ─────────────────────────────────────────────────────────────

const C = {
  pink: "#E461AD",
  gold: "#C9A96E",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  white: "#FFFFFF",
};

// ─── Language Options ───────────────────────────────────────────────────

const LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
  { code: "pt", label: "Portuguese" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "ko", label: "Korean" },
  { code: "ur", label: "Urdu" },
];

const FONT_COLORS = [
  { label: "White", value: "white" },
  { label: "Yellow", value: "yellow" },
  { label: "Cyan", value: "cyan" },
  { label: "Lime", value: "lime" },
  { label: "Pink", value: "pink" },
];

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "yellow" },
  { label: "Cyan", value: "cyan" },
  { label: "Lime", value: "lime" },
  { label: "Pink", value: "pink" },
  { label: "None", value: "none" },
];

// ─── Section Label ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-wider block mb-2"
      style={{ color: C.textMuted }}
    >
      {children}
    </span>
  );
}

// ─── Control Card ───────────────────────────────────────────────────────

function ControlCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-3.5 ${className}`}
      style={{ backgroundColor: "#F9FAFB" }}
    >
      {children}
    </div>
  );
}

// ─── CaptionPanelModal Component ────────────────────────────────────────

export default function CaptionPanelModal({
  videoUrl,
  onClose,
  accentColor = C.cyan,
}: CaptionPanelModalProps) {
  // ─── Subtitle Settings ─────────────────────────────────────────────
  const [subLanguage, setSubLanguage] = useState("ar");
  const [subFontName, setSubFontName] = useState("Cairo");
  const [subFontSize, setSubFontSize] = useState(100);
  const [subFontWeight, setSubFontWeight] = useState<FontWeight>("bold");
  const [subFontColor, setSubFontColor] = useState("white");
  const [subHighlightColor, setSubHighlightColor] = useState("yellow");
  const [subStrokeWidth, setSubStrokeWidth] = useState(3);
  const [subPosition, setSubPosition] = useState<SubPosition>("bottom");
  const [subYOffset, setSubYOffset] = useState(75);
  const [subWordsPerLine, setSubWordsPerLine] = useState(3);
  const [subAnimation, setSubAnimation] = useState(true);
  const [subBgColor, setSubBgColor] = useState("none");
  const [subBgOpacity, setSubBgOpacity] = useState(0);

  // ─── Generation State ─────────────────────────────────────────────
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [subtitleProgress, setSubtitleProgress] = useState("");
  const [subtitleError, setSubtitleError] = useState("");
  const [subtitleDone, setSubtitleDone] = useState(false);
  const [subtitleVideoUrl, setSubtitleVideoUrl] = useState("");
  const [subtitleCount, setSubtitleCount] = useState(0);

  // ─── Body Scroll Lock ─────────────────────────────────────────────
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ─── Close Helper ───────────────────────────────────────────────
  const handleClose = useCallback(() => {
    onClose(subtitleDone ? subtitleVideoUrl : undefined);
  }, [onClose, subtitleDone, subtitleVideoUrl]);

  // ─── Escape Key Handler ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // ─── Generate Subtitles ───────────────────────────────────────────
  const generateSubtitles = useCallback(async () => {
    setIsGeneratingSubtitles(true);
    setSubtitleError("");
    setSubtitleProgress("Starting subtitle generation...");
    setSubtitleDone(false);
    setSubtitleVideoUrl("");
    setSubtitleCount(0);

    try {
      setSubtitleProgress("Processing speech recognition...");

      const res = await fetch("/api/auto-subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          language: subLanguage,
          font_name: subFontName,
          font_size: subFontSize,
          font_weight: subFontWeight,
          font_color: subFontColor,
          highlight_color: subHighlightColor,
          stroke_width: subStrokeWidth,
          stroke_color: "black",
          position: subPosition,
          y_offset: subYOffset,
          words_per_subtitle: subWordsPerLine,
          enable_animation: subAnimation,
          background_color: subBgColor,
          background_opacity: subBgOpacity,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error || `Request failed with status ${res.status}`
        );
      }

      setSubtitleProgress("Rendering subtitles into video...");
      const data = await res.json();

      if (data.video_url) {
        setSubtitleVideoUrl(data.video_url);
        setSubtitleDone(true);
        if (data.subtitle_count) {
          setSubtitleCount(data.subtitle_count);
        }
        setSubtitleProgress("Subtitles generated successfully!");
      } else {
        throw new Error("No video URL returned from the API.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate subtitles";
      setSubtitleError(msg);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  }, [
    videoUrl,
    subLanguage,
    subFontName,
    subFontSize,
    subFontWeight,
    subFontColor,
    subHighlightColor,
    subStrokeWidth,
    subPosition,
    subYOffset,
    subWordsPerLine,
    subAnimation,
    subBgColor,
    subBgOpacity,
  ]);

  // ─── Download Helper ──────────────────────────────────────────────
  const downloadVideo = useCallback(
    async (url: string, filename: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Fallback: open in new tab
        window.open(url, "_blank");
      }
    },
    []
  );

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* ─── Main Panel ──────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col animate-scale-in"
        style={{ backgroundColor: C.white }}
      >
        {/* ─── Scrollable Body ──────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">
          {/* ─── Header ─────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
            style={{ backgroundColor: C.white, borderColor: "#F3F4F6" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}18` }}
              >
                {/* Microphone Icon */}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <div>
                <h2
                  className="text-lg sm:text-xl font-black uppercase tracking-tight"
                  style={{ color: C.text }}
                >
                  Add Auto Captions
                </h2>
                <p className="text-[11px]" style={{ color: C.textMuted }}>
                  $0.03/min for auto captions
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
              style={{ backgroundColor: "#F3F4F6", color: C.textMuted }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* ─── Content: Two Columns ────────────────────────────── */}
          <div className="flex flex-col lg:flex-row">
            {/* ─── Left Column: Video Preview ─────────────────────── */}
            <div className="lg:w-1/2 p-4 lg:p-6">
              <div
                className="relative rounded-2xl overflow-hidden border-2 shadow-lg"
                style={{ borderColor: accentColor }}
              >
                <video
                  src={subtitleDone ? subtitleVideoUrl : videoUrl}
                  controls
                  autoPlay
                  className="w-full"
                  preload="metadata"
                  playsInline
                />

                {/* Badge Overlay */}
                <div className="absolute top-3 left-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg"
                    style={{
                      backgroundColor: subtitleDone
                        ? "#22C55E"
                        : "#1A1A2E",
                      color: C.white,
                    }}
                  >
                    {subtitleDone ? (
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect
                          x="1"
                          y="5"
                          width="15"
                          height="14"
                          rx="2"
                          ry="2"
                        />
                      </svg>
                    )}
                    {subtitleDone ? "Subtitled" : "Original"}
                  </span>
                </div>

                {/* Generating Overlay */}
                {isGeneratingSubtitles && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
                  >
                    <div
                      className="w-10 h-10 border-3 rounded-full animate-spin"
                      style={{
                        borderColor: `${accentColor}40`,
                        borderTopColor: accentColor,
                        borderWidth: "3px",
                      }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: C.white }}
                    >
                      {subtitleProgress}
                    </span>
                  </div>
                )}
              </div>

              {/* Subtitle Count */}
              {subtitleDone && subtitleCount > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: "#22C55E15",
                      color: "#22C55E",
                    }}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                      />
                    </svg>
                    {subtitleCount} subtitles detected
                  </span>
                </div>
              )}
            </div>

            {/* ─── Right Column: Controls ─────────────────────────── */}
            <div className="lg:w-1/2 p-4 lg:p-6 lg:border-l overflow-y-auto"
              style={{ borderColor: "#F3F4F6" }}
            >
              <div className="space-y-3.5">
                {/* 1. Language */}
                <ControlCard>
                  <SectionLabel>Language</SectionLabel>
                  <Select
                    value={subLanguage}
                    onValueChange={setSubLanguage}
                  >
                    <SelectTrigger className="w-full h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.label} ({lang.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ControlCard>

                {/* 2. Position */}
                <ControlCard>
                  <SectionLabel>Position</SectionLabel>
                  <div className="flex gap-2">
                    {(["top", "center", "bottom"] as SubPosition[]).map(
                      (pos) => (
                        <button
                          key={pos}
                          onClick={() => setSubPosition(pos)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                          style={{
                            backgroundColor:
                              subPosition === pos
                                ? accentColor
                                : "#F3F4F6",
                            color:
                              subPosition === pos
                                ? C.white
                                : C.textMuted,
                          }}
                        >
                          {pos === "top" && (
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                              />
                            </svg>
                          )}
                          {pos === "center" && (
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <circle cx="12" cy="12" r="1" fill="currentColor" />
                            </svg>
                          )}
                          {pos === "bottom" && (
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                              />
                            </svg>
                          )}
                          {pos}
                        </button>
                      )
                    )}
                  </div>
                </ControlCard>

                {/* 3. Y Offset */}
                <ControlCard>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel className="mb-0">Y Offset</SectionLabel>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        color: accentColor,
                      }}
                    >
                      {subYOffset}
                    </span>
                  </div>
                  <Slider
                    value={[subYOffset]}
                    onValueChange={(v) => setSubYOffset(v[0])}
                    min={-200}
                    max={200}
                    step={5}
                    className="w-full"
                    style={
                      {
                        "--accent-color": accentColor,
                      } as React.CSSProperties
                    }
                  />
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      -200
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      200
                    </span>
                  </div>
                </ControlCard>

                {/* 4. Font Size */}
                <ControlCard>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel className="mb-0">Font Size</SectionLabel>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        color: accentColor,
                      }}
                    >
                      {subFontSize}
                    </span>
                  </div>
                  <Slider
                    value={[subFontSize]}
                    onValueChange={(v) => setSubFontSize(v[0])}
                    min={30}
                    max={200}
                    step={5}
                    className="w-full"
                    style={
                      {
                        "--accent-color": accentColor,
                      } as React.CSSProperties
                    }
                  />
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      30
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      200
                    </span>
                  </div>
                </ControlCard>

                {/* 5. Words per Line */}
                <ControlCard>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel className="mb-0">Words per Line</SectionLabel>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        color: accentColor,
                      }}
                    >
                      {subWordsPerLine}
                    </span>
                  </div>
                  <Slider
                    value={[subWordsPerLine]}
                    onValueChange={(v) => setSubWordsPerLine(v[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                    style={
                      {
                        "--accent-color": accentColor,
                      } as React.CSSProperties
                    }
                  />
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      1
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      10
                    </span>
                  </div>
                </ControlCard>

                {/* 6. Font Weight */}
                <ControlCard>
                  <SectionLabel>Font Weight</SectionLabel>
                  <div className="flex gap-2">
                    {(
                      [
                        { value: "normal", label: "Normal" },
                        { value: "bold", label: "Bold" },
                        { value: "black", label: "Black" },
                      ] as const
                    ).map((wt) => (
                      <button
                        key={wt.value}
                        onClick={() => setSubFontWeight(wt.value)}
                        className="flex-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer"
                        style={{
                          backgroundColor:
                            subFontWeight === wt.value
                              ? accentColor
                              : "#F3F4F6",
                          color:
                            subFontWeight === wt.value
                              ? C.white
                              : C.textMuted,
                          fontWeight: wt.value,
                        }}
                      >
                        {wt.label}
                      </button>
                    ))}
                  </div>
                </ControlCard>

                {/* 7. Font Name */}
                <ControlCard>
                  <SectionLabel>Font</SectionLabel>
                  <Select
                    value={subFontName}
                    onValueChange={setSubFontName}
                  >
                    <SelectTrigger className="w-full h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select font" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cairo">Cairo</SelectItem>
                      <SelectItem value="Tajawal">Tajawal</SelectItem>
                      <SelectItem value="Noto Sans Arabic">Noto Sans Arabic</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Oswald">Oswald</SelectItem>
                      <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                      <SelectItem value="Anton">Anton</SelectItem>
                    </SelectContent>
                  </Select>
                </ControlCard>

                {/* 8. Font Color */}
                <ControlCard>
                  <SectionLabel>Font Color</SectionLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={subFontColor}
                      onChange={(e) => setSubFontColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                      style={{ backgroundColor: "transparent" }}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {FONT_COLORS.map((fc) => (
                        <button
                          key={fc.value}
                          onClick={() => setSubFontColor(fc.value)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer border"
                          style={{
                            borderColor:
                              subFontColor === fc.value
                                ? accentColor
                                : "#E5E7EB",
                            backgroundColor:
                              subFontColor === fc.value
                                ? `${accentColor}15`
                                : "transparent",
                            color:
                              subFontColor === fc.value
                                ? accentColor
                                : C.textMuted,
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: fc.value }}
                            />
                            {fc.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </ControlCard>

                {/* 9. Highlight Color */}
                <ControlCard>
                  <SectionLabel>Highlight Color</SectionLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        subHighlightColor === "none"
                          ? "#000000"
                          : subHighlightColor
                      }
                      onChange={(e) => setSubHighlightColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                      style={{ backgroundColor: "transparent" }}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {HIGHLIGHT_COLORS.map((hc) => (
                        <button
                          key={hc.value}
                          onClick={() => setSubHighlightColor(hc.value)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer border"
                          style={{
                            borderColor:
                              subHighlightColor === hc.value
                                ? accentColor
                                : "#E5E7EB",
                            backgroundColor:
                              subHighlightColor === hc.value
                                ? `${accentColor}15`
                                : "transparent",
                            color:
                              subHighlightColor === hc.value
                                ? accentColor
                                : C.textMuted,
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            {hc.value !== "none" && (
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: hc.value }}
                              />
                            )}
                            {hc.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </ControlCard>

                {/* 10. Stroke Width */}
                <ControlCard>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel className="mb-0">Stroke Width</SectionLabel>
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        color: accentColor,
                      }}
                    >
                      {subStrokeWidth}
                    </span>
                  </div>
                  <Slider
                    value={[subStrokeWidth]}
                    onValueChange={(v) => setSubStrokeWidth(v[0])}
                    min={0}
                    max={10}
                    step={1}
                    className="w-full"
                    style={
                      {
                        "--accent-color": accentColor,
                      } as React.CSSProperties
                    }
                  />
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      0
                    </span>
                    <span
                      className="text-[9px]"
                      style={{ color: C.textMuted }}
                    >
                      10
                    </span>
                  </div>
                </ControlCard>

                {/* 11. Animation Toggle */}
                <ControlCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <SectionLabel className="mb-0">
                        Animation
                      </SectionLabel>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: C.textMuted }}
                      >
                        Karaoke-style word highlight
                      </p>
                    </div>
                    <Switch
                      checked={subAnimation}
                      onCheckedChange={setSubAnimation}
                      style={
                        {
                          "--accent-color": accentColor,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </ControlCard>

                {/* 12. Background */}
                <ControlCard>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <SectionLabel className="mb-0">
                        Background
                      </SectionLabel>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: C.textMuted }}
                      >
                        Subtitle backdrop color
                      </p>
                    </div>
                    <Switch
                      checked={subBgColor !== "none"}
                      onCheckedChange={(checked) =>
                        setSubBgColor(checked ? "black" : "none")
                      }
                      style={
                        {
                          "--accent-color": accentColor,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  {subBgColor !== "none" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: C.textMuted }}
                        >
                          Opacity
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${accentColor}15`,
                            color: accentColor,
                          }}
                        >
                          {subBgOpacity.toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[subBgOpacity]}
                        onValueChange={(v) => setSubBgOpacity(v[0])}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                        style={
                          {
                            "--accent-color": accentColor,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  )}
                </ControlCard>

                {/* 13. Generate Button ─────────────────────────────── */}
                {!subtitleDone && (
                  <button
                    onClick={generateSubtitles}
                    disabled={isGeneratingSubtitles}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-lg"
                    style={{
                      backgroundColor: accentColor,
                      color: C.white,
                      boxShadow: `0 6px 24px ${accentColor}40`,
                    }}
                  >
                    {isGeneratingSubtitles ? (
                      <>
                        <span
                          className="w-4 h-4 border-2 rounded-full animate-spin"
                          style={{
                            borderColor: `${C.white}40`,
                            borderTopColor: C.white,
                          }}
                        />
                        {subtitleProgress}
                      </>
                    ) : (
                      <>
                        {/* Wand / Sparkle Icon */}
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                          />
                        </svg>
                        Generate Auto Subtitles ($0.03/min)
                      </>
                    )}
                  </button>
                )}

                {/* Error Message */}
                {subtitleError && (
                  <div
                    className="rounded-xl border-2 p-3.5"
                    style={{
                      borderColor: "#EF4444",
                      backgroundColor: "#FEF2F2",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path
                          strokeLinecap="round"
                          d="M15 9l-6 6M9 9l6 6"
                        />
                      </svg>
                      <p
                        className="text-xs font-bold"
                        style={{ color: "#EF4444" }}
                      >
                        {subtitleError}
                      </p>
                    </div>
                  </div>
                )}

                {/* 13. Success / Download Section ──────────────────── */}
                {subtitleDone && (
                  <div className="space-y-3">
                    {/* Success Banner */}
                    <div
                      className="rounded-xl p-3.5 text-center"
                      style={{
                        backgroundColor: "#22C55E15",
                        border: "2px solid #22C55E30",
                      }}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        <span
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "#22C55E" }}
                        >
                          Subtitles Generated!
                        </span>
                      </div>
                      <p
                        className="text-[11px]"
                        style={{ color: C.textMuted }}
                      >
                        Your subtitled video is ready
                      </p>
                    </div>

                    {/* Download Buttons */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          downloadVideo(
                            subtitleVideoUrl,
                            `subtitled-${Date.now()}.mp4`
                          )
                        }
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          backgroundColor: "#22C55E",
                          color: C.white,
                          boxShadow: "0 4px 16px rgba(34,197,94,0.4)",
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        Download Subtitled Video
                      </button>

                      <button
                        onClick={() =>
                          downloadVideo(
                            videoUrl,
                            `original-${Date.now()}.mp4`
                          )
                        }
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer border-2 hover:bg-gray-50"
                        style={{
                          borderColor: "#E5E7EB",
                          color: C.textMuted,
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        Download Original Video
                      </button>

                      {/* Regenerate Button */}
                      <button
                        onClick={() => {
                          setSubtitleDone(false);
                          setSubtitleVideoUrl("");
                          setSubtitleError("");
                          setSubtitleProgress("");
                          setSubtitleCount(0);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: `${accentColor}10`,
                          color: accentColor,
                        }}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                          />
                        </svg>
                        Adjust Settings & Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Inline Keyframes (needed for animation classes) ────── */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
