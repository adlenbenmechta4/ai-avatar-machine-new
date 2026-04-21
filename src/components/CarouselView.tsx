"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── Colors ─────────────────────────────────────────────────────────────────

const C = {
  pink: "#E461AD",
  gold: "#C9A96E",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  lightPink: "#F9E4EE",
  lightGold: "#FBF5EB",
  white: "#FFFFFF",
  cream: "#FFF8F0",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface Slide {
  slideNumber: number;
  title: string;
  body: string;
  imagePrompt: string;
  imageUrl: string | null;
  status: "done" | "image_failed";
  error?: string;
  textOverlayUrl?: string | null; // canvas-rendered image with text
}

interface CarouselViewProps {
  onBack: () => void;
  isAdmin?: boolean;
}

// ─── Canvas: Render text overlay on image ────────────────────────────────────
function renderTextOnImage(
  imageUrl: string,
  overlayText: string,
  slideIndex: number,
  totalSlides: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1792;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      // Draw the original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // ─── Dark gradient overlay at bottom ───
      const gradHeight = canvas.height * 0.32;
      const grad = ctx.createLinearGradient(0, canvas.height - gradHeight, 0, canvas.height);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.4, "rgba(0,0,0,0.5)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, canvas.height - gradHeight, canvas.width, gradHeight);

      // ─── Draw text ───
      const maxWidth = canvas.width * 0.85;
      const padding = canvas.width * 0.075;

      // Determine font size based on text length
      const textLen = overlayText.length;
      let fontSize: number;
      if (textLen <= 20) fontSize = canvas.width * 0.08;
      else if (textLen <= 50) fontSize = canvas.width * 0.065;
      else if (textLen <= 100) fontSize = canvas.width * 0.055;
      else fontSize = canvas.width * 0.045;

      // Ensure minimum font size
      fontSize = Math.max(fontSize, 28);

      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      // Word wrap
      const words = overlayText.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Draw text lines from bottom up
      const lineHeight = fontSize * 1.35;
      const textBlockHeight = lines.length * lineHeight;
      const baseY = canvas.height - padding;

      // Draw subtle text shadow for readability
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = fontSize * 0.15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      for (let i = 0; i < lines.length; i++) {
        const y = baseY - ((lines.length - 1 - i) * lineHeight);
        ctx.fillText(lines[i], canvas.width / 2, y);
      }

      // ─── Slide number badge ───
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      const badgeText = `${slideIndex + 1}/${totalSlides}`;
      const badgeFontSize = canvas.width * 0.035;
      ctx.font = `bold ${badgeFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

      const badgePadding = badgeFontSize * 0.6;
      const badgeTextWidth = ctx.measureText(badgeText).width;
      const badgeW = badgeTextWidth + badgePadding * 2;
      const badgeH = badgeFontSize + badgePadding * 1.2;
      const badgeX = padding;
      const badgeY = padding;

      // Badge background
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const badgeRadius = badgeH / 2;
      ctx.beginPath();
      ctx.moveTo(badgeX + badgeRadius, badgeY);
      ctx.lineTo(badgeX + badgeW - badgeRadius, badgeY);
      ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeRadius);
      ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeRadius);
      ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - badgeRadius, badgeY + badgeH);
      ctx.lineTo(badgeX + badgeRadius, badgeY + badgeH);
      ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeRadius);
      ctx.lineTo(badgeX, badgeY + badgeRadius);
      ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
      ctx.closePath();
      ctx.fill();

      // Badge text
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for text overlay"));
    img.src = imageUrl;
  });
}

// ─── Carousel View Component ───────────────────────────────────────────────

export default function CarouselView({ onBack, isAdmin = false }: CarouselViewProps) {
  // ─── States ──────────────────────────────────────────────────────────
  const [idea, setIdea] = useState("");
  const [kieApiKey, setKieApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [numSlides, setNumSlides] = useState(5);
  const [language, setLanguage] = useState<"en" | "ar" | "fr">("en");

  // Text overlay
  const [textOverlay, setTextOverlay] = useState(false);
  const [slideTexts, setSlideTexts] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [error, setError] = useState("");

  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [applyingOverlay, setApplyingOverlay] = useState(false);

  const [showResult, setShowResult] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // ─── Initialize slide texts when numSlides changes ───────────────────
  useEffect(() => {
    setSlideTexts((prev) => {
      const newTexts = Array.from({ length: numSlides }, (_, i) => prev[i] || "");
      return newTexts;
    });
  }, [numSlides]);

  // ─── Update a single slide text ──────────────────────────────────────
  const updateSlideText = useCallback((index: number, value: string) => {
    setSlideTexts((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  // ─── Apply text overlay to all slides ────────────────────────────────
  const applyTextOverlay = useCallback(async (rawSlides: Slide[], texts: string[]) => {
    setApplyingOverlay(true);
    setGenerationStep("Applying text overlay...");

    const updated = [...rawSlides];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].imageUrl && texts[i] && texts[i].trim()) {
        try {
          const overlayUrl = await renderTextOnImage(updated[i].imageUrl!, texts[i].trim(), i, updated.length);
          updated[i] = { ...updated[i], textOverlayUrl: overlayUrl };
        } catch (err) {
          console.error(`[Carousel] Text overlay failed for slide ${i + 1}:`, err);
          updated[i] = { ...updated[i], textOverlayUrl: null };
        }
      }
    }

    setSlides(updated);
    setApplyingOverlay(false);
    setGenerationStep("");
  }, []);

  // ─── Handle Generate ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!idea.trim()) return;
    if (isAdmin && (!kieApiKey.trim() || kieApiKey.trim().length < 10)) {
      setError("Please enter your kie.ai API key");
      return;
    }

    setGenerating(true);
    setError("");
    setSlides([]);
    setCurrentSlide(0);
    setShowResult(false);
    setGenerationStep("Generating carousel content with AI...");

    try {
      const res = await fetch("/api/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          kieApiKey: isAdmin ? kieApiKey.trim() : "",
          numSlides,
          language,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      const rawSlides: Slide[] = (data.slides || []).map((s: Record<string, unknown>) => ({
        ...s,
        textOverlayUrl: null,
      }));

      setSlides(rawSlides);
      setShowResult(true);
      setGenerationStep("");

      // If text overlay is enabled and there are texts, apply them
      const hasTexts = slideTexts.some((t) => t && t.trim());
      if (textOverlay && hasTexts) {
        await applyTextOverlay(rawSlides, slideTexts);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Re-apply text overlay after editing texts ───────────────────────
  const handleReapplyOverlay = async () => {
    if (slides.length === 0) return;
    setApplyingOverlay(true);
    await applyTextOverlay(slides, slideTexts);
    setApplyingOverlay(false);
  };

  // ─── Download Slide Image ────────────────────────────────────────────
  const downloadSlide = async (slide: Slide, index: number) => {
    const downloadUrl = slide.textOverlayUrl || slide.imageUrl;
    if (!downloadUrl) return;

    try {
      // If it's a data URL (canvas), download directly
      if (downloadUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `carousel-slide-${index + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const imgRes = await fetch(downloadUrl);
      const blob = await imgRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carousel-slide-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(downloadUrl, "_blank");
    }
  };

  // ─── Touch / Swipe handling ──────────────────────────────────────────
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1);
      } else if (diff < 0 && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    }
  };

  // ─── Examples ────────────────────────────────────────────────────────
  const examples = [
    "5 tips to grow your Instagram in 2025",
    "How AI is changing digital marketing",
    "Healthy morning routine for productivity",
    "Top 7 mistakes entrepreneurs make",
    "The psychology of viral content",
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // RESULT VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (showResult && slides.length > 0) {
    const slide = slides[currentSlide];
    const displayUrl = slide.textOverlayUrl || slide.imageUrl;

    return (
      <div className="min-h-screen" style={{ backgroundColor: C.dark }}>
        {/* ─── Top Bar ──────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3"
          style={{
            backgroundColor: `${C.dark}ee`,
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid #222222`,
          }}
        >
          <button
            onClick={() => {
              setShowResult(false);
              setSlides([]);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
            style={{
              backgroundColor: "#1A1A1A",
              color: "#E0E0E0",
              border: `1.5px solid #333333`,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${C.gold}25` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M9 9h6M9 13h4" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#E0E0E0" }}>
              {currentSlide + 1} / {slides.length}
            </span>
          </div>

          {displayUrl && (
            <button
              onClick={() => downloadSlide(slide, currentSlide)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
              style={{
                backgroundColor: `${C.pink}20`,
                color: C.pink,
                border: `1.5px solid ${C.pink}40`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save
            </button>
          )}
        </header>

        {/* ─── Applying overlay indicator ─────────────────────────── */}
        {applyingOverlay && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2"
            style={{ backgroundColor: `${C.gold}`, color: C.white, boxShadow: `0 4px 20px ${C.gold}40` }}>
            <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Applying text overlay...
          </div>
        )}

        {/* ─── Slide Display ─────────────────────────────────────── */}
        <main
          className="flex items-center justify-center min-h-[calc(100vh-56px)] p-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full max-w-sm mx-auto">
            {/* Slide Image */}
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                aspectRatio: "9/16",
                backgroundColor: "#1A1A1A",
                border: `2px solid #333333`,
                boxShadow: `0 8px 40px rgba(0,0,0,0.5)`,
              }}
            >
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: `${C.pink}15` }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "#E0E0E0" }}>
                      Image failed to generate
                    </p>
                    <p className="text-xs mt-2" style={{ color: "#888888" }}>
                      {slide.error || "Unknown error"}
                    </p>
                  </div>
                </div>
              )}

              {/* Text overlay badge */}
              {slide.textOverlayUrl && (
                <div
                  className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  style={{ backgroundColor: `${C.pink}cc`, color: C.white }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9.5" y1="20" x2="14.5" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                  Text
                </div>
              )}
            </div>

            {/* Slide Text Content */}
            <div className="mt-5 px-2">
              <h2 className="text-lg font-black mb-2" style={{ color: C.white }}>
                {slide.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#A0A0A0" }}>
                {slide.body}
              </p>
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 disabled:opacity-20"
                style={{
                  backgroundColor: "#1A1A1A",
                  border: "1.5px solid #333333",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Slide dots */}
              <div className="flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === currentSlide ? "24px" : "8px",
                      height: "8px",
                      backgroundColor: i === currentSlide ? C.pink : "#444444",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                disabled={currentSlide === slides.length - 1}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 disabled:opacity-20"
                style={{
                  backgroundColor: "#1A1A1A",
                  border: "1.5px solid #333333",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Download All Button */}
            <button
              onClick={async () => {
                for (let i = 0; i < slides.length; i++) {
                  if (slides[i].imageUrl) {
                    await downloadSlide(slides[i], i);
                    await new Promise((r) => setTimeout(r, 500));
                  }
                }
              }}
              className="w-full mt-6 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${C.pink}, ${C.gold})`,
                color: C.white,
                boxShadow: `0 4px 20px ${C.pink}30`,
              }}
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download All Slides
              </span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INPUT VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ backgroundColor: C.cream }}>
      {/* ─── Top Bar ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{
          backgroundColor: `${C.white}ee`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid #F3F4F6`,
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
          style={{
            backgroundColor: C.white,
            color: C.text,
            border: `1.5px solid ${C.lightPink}`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Menu
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: C.gold, boxShadow: `0 2px 10px ${C.gold}40` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 9h6M9 13h4" />
              <circle cx="18" cy="6" r="2" fill="white" stroke="none" />
            </svg>
          </div>
          <span
            className="text-sm font-black uppercase tracking-wider hidden sm:inline"
            style={{ color: C.dark }}
          >
            Carousel Machine
          </span>
        </div>

        <div className="w-[100px]" />
      </header>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ backgroundColor: `${C.gold}18` }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.gold }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.gold }}>
              AI-Powered
            </span>
          </div>

          <h1
            className="text-3xl sm:text-5xl font-black uppercase tracking-tight mb-4 leading-tight"
            style={{ color: C.dark }}
          >
            AI Viral{" "}
            <span style={{ color: C.pink }}>Carousel</span>{" "}
            Machine
          </h1>

          <p className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ color: C.textMuted }}>
            Turn any idea into scroll-stopping carousels. Our AI creates stunning images and copy for each slide, ready to go viral.
          </p>
        </div>

        {/* Main Input Card */}
        <div
          className="rounded-3xl p-6 sm:p-8 mb-6"
          style={{
            backgroundColor: C.white,
            border: `1.5px solid #F3F4F6`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.04)`,
          }}
        >
          {/* ─── API Key Input (Admin Only) ─────────────────────── */}
          {isAdmin && <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${C.gold}18` }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
                kie.ai API Key
              </label>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={kieApiKey}
                onChange={(e) => setKieApiKey(e.target.value)}
                placeholder="Enter your kie.ai API key..."
                className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: `${C.lightGold}40`,
                  border: `1.5px solid ${kieApiKey ? `${C.gold}50` : "#F3F4F6"}`,
                  color: C.text,
                }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: C.textMuted }}
              >
                {showApiKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: C.textMuted }}>
              Admin only — override the default server key
            </p>
          </div>}

          {/* ─── Settings Row ──────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-4 mb-5">
            {/* Number of Slides */}
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${C.pink}12` }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
                  Slides
                </label>
              </div>
              <div className="flex items-center gap-2">
                {[3, 5, 7, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumSlides(n)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                    style={{
                      backgroundColor: numSlides === n ? C.pink : "#F9FAFB",
                      color: numSlides === n ? C.white : C.textMuted,
                      border: `1.5px solid ${numSlides === n ? C.pink : "#E5E7EB"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="min-w-[140px]">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${C.pink}12` }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
                  Language
                </label>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { code: "en" as const, label: "EN" },
                  { code: "ar" as const, label: "AR" },
                  { code: "fr" as const, label: "FR" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                    style={{
                      backgroundColor: language === lang.code ? C.pink : "#F9FAFB",
                      color: language === lang.code ? C.white : C.textMuted,
                      border: `1.5px solid ${language === lang.code ? C.pink : "#E5E7EB"}`,
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Text Overlay Toggle ────────────────────────────── */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${C.pink}12` }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9.5" y1="20" x2="14.5" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
                  Text on Images
                </label>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => setTextOverlay(!textOverlay)}
                className="relative w-12 h-7 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: textOverlay ? C.pink : "#E5E7EB",
                  boxShadow: textOverlay ? `0 0 0 3px ${C.pink}20` : "none",
                }}
              >
                <div
                  className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300"
                  style={{
                    left: textOverlay ? "calc(100% - 26px)" : "2px",
                  }}
                />
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: C.textMuted }}>
              {textOverlay
                ? "Add custom text overlay on each slide image"
                : "Generate clean images without text overlay"}
            </p>
          </div>

          {/* ─── Slide Text Inputs (when text overlay is ON) ────── */}
          {textOverlay && (
            <div
              className="mb-5 rounded-2xl p-4 space-y-3"
              style={{
                backgroundColor: `${C.lightPink}20`,
                border: `1.5px dashed ${C.pink}30`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.pink }}>
                  Slide Text Content
                </span>
              </div>
              <p className="text-[11px] mb-2" style={{ color: C.textMuted }}>
                Write the text you want displayed on each slide image. Leave blank to skip.
              </p>

              {Array.from({ length: numSlides }, (_, i) => (
                <div key={i} className="flex items-start gap-2">
                  {/* Slide number */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black mt-0.5"
                    style={{
                      backgroundColor: i === 0 ? C.pink : i === numSlides - 1 ? C.gold : `${C.pink}15`,
                      color: (i === 0 || i === numSlides - 1) ? C.white : C.pink,
                    }}
                  >
                    {i + 1}
                  </div>
                  <input
                    type="text"
                    value={slideTexts[i] || ""}
                    onChange={(e) => updateSlideText(i, e.target.value)}
                    placeholder={
                      i === 0
                        ? "Cover slide — write a hook title..."
                        : i === numSlides - 1
                        ? "Last slide — write a CTA..."
                        : `Slide ${i + 1} text...`
                    }
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                    style={{
                      backgroundColor: C.white,
                      border: `1.5px solid ${slideTexts[i] ? `${C.pink}40` : "#E5E7EB"}`,
                      color: C.text,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ─── Idea Input ────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${C.pink}12` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
              </svg>
            </div>
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
              What&apos;s your carousel idea?
            </label>
          </div>

          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. 5 proven strategies to go viral on Instagram in 2025..."
            rows={4}
            className="w-full px-5 py-4 rounded-2xl text-sm outline-none resize-none transition-all duration-200"
            style={{
              backgroundColor: `${C.lightPink}30`,
              border: `1.5px solid ${idea ? `${C.pink}40` : "#F3F4F6"}`,
              color: C.text,
              boxShadow: idea ? `0 0 0 3px ${C.pink}10` : "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = `${C.pink}50`;
              e.target.style.boxShadow = `0 0 0 3px ${C.pink}10`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = idea ? `${C.pink}40` : "#F3F4F6";
              e.target.style.boxShadow = idea ? `0 0 0 3px ${C.pink}10` : "none";
            }}
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px]" style={{ color: C.textMuted }}>
              {idea.length > 0 ? `${idea.length} characters` : "Be specific for better results"}
            </p>
          </div>

          {/* ─── Error Message ─────────────────────────────────── */}
          {error && (
            <div
              className="mt-4 px-4 py-3 rounded-xl text-sm"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!idea.trim() || (isAdmin && !kieApiKey.trim()) || generating}
            className="w-full mt-5 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: generating
                ? `linear-gradient(135deg, ${C.pink}90, ${C.gold}90)`
                : `linear-gradient(135deg, ${C.pink}, ${C.gold})`,
              color: C.white,
              boxShadow: idea.trim() && (isAdmin ? kieApiKey.trim() : true) && !generating ? `0 6px 24px ${C.pink}35` : "none",
              transform: idea.trim() && (isAdmin ? kieApiKey.trim() : true) && !generating ? "scale(1)" : "scale(0.98)",
            }}
          >
            {generating ? (
              <span className="inline-flex items-center gap-3">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {generationStep || "Generating..."}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Generate Carousel
              </span>
            )}
          </button>
        </div>

        {/* ─── Generating Progress ────────────────────────────── */}
        {generating && (
          <div
            className="rounded-2xl p-6 text-center animate-pulse"
            style={{
              backgroundColor: C.white,
              border: `1.5px solid ${C.pink}20`,
            }}
          >
            <div
              className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin mx-auto mb-4"
              style={{ borderColor: `${C.pink}33`, borderTopColor: C.pink }}
            />
            <p className="text-sm font-semibold" style={{ color: C.dark }}>
              Creating your viral carousel...
            </p>
            <p className="text-xs mt-2" style={{ color: C.textMuted }}>
              AI is writing content and generating images for each slide.
              <br />
              This may take 2-5 minutes depending on the number of slides.
              {textOverlay && " Text overlay will be applied after images are ready."}
            </p>
          </div>
        )}

        {/* Example Ideas */}
        {!generating && (
          <>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.textMuted }}>
                Try these ideas
              </p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setIdea(ex)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
                    style={{
                      backgroundColor: C.white,
                      color: C.text,
                      border: `1px solid #E5E7EB`,
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Features Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                  ),
                  title: "AI Image Generation",
                  desc: "Stunning images powered by Nano Banana 2 via kie.ai",
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7" />
                      <line x1="9.5" y1="20" x2="14.5" y2="20" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                  ),
                  title: "Text Overlay",
                  desc: "Add custom text on each slide with beautiful styling",
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  ),
                  title: "Instant Download",
                  desc: "Download all slides as images, ready to post",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 text-center transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  style={{
                    backgroundColor: C.white,
                    border: "1px solid #F3F4F6",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: `${C.lightPink}40` }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xs font-bold mb-1" style={{ color: C.dark }}>
                    {feature.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed" style={{ color: C.textMuted }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
