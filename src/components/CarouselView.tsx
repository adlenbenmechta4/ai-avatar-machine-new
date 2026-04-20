"use client";

import React, { useState } from "react";

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

// ─── Carousel View Component ───────────────────────────────────────────────

interface CarouselViewProps {
  onBack: () => void;
}

export default function CarouselView({ onBack }: CarouselViewProps) {
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setGenerating(true);
    // Placeholder — will be connected to API later
    setTimeout(() => {
      setGenerating(false);
    }, 2000);
  };

  const examples = [
    "5 tips to grow your Instagram in 2025",
    "How AI is changing digital marketing",
    "Healthy morning routine for productivity",
    "Top 7 mistakes entrepreneurs make",
    "The psychology of viral content",
  ];

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
        {/* Back button */}
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

        {/* Logo */}
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

        {/* Spacer */}
        <div className="w-[100px]" />
      </header>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          {/* Badge */}
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
            Turn any idea into scroll-stopping carousels. Just describe your topic and our AI will create stunning slides ready to go viral.
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
          {/* Label */}
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

          {/* Textarea */}
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

          {/* Character count */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px]" style={{ color: C.textMuted }}>
              {idea.length > 0 ? `${idea.length} characters` : "Be specific for better results"}
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!idea.trim() || generating}
            className="w-full mt-5 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: generating
                ? `linear-gradient(135deg, ${C.pink}90, ${C.gold}90)`
                : `linear-gradient(135deg, ${C.pink}, ${C.gold})`,
              color: C.white,
              boxShadow: idea.trim() && !generating ? `0 6px 24px ${C.pink}35` : "none",
              transform: idea.trim() && !generating ? "scale(1)" : "scale(0.98)",
            }}
          >
            {generating ? (
              <span className="inline-flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                />
                Generating Your Carousel...
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

        {/* Example Ideas */}
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
              title: "Multi-Slide Design",
              desc: "Beautiful slides optimized for Instagram & LinkedIn",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              ),
              title: "AI Copywriting",
              desc: "Engaging text that hooks your audience instantly",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              ),
              title: "Viral-Ready",
              desc: "Designed with proven viral content principles",
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
      </main>
    </div>
  );
}
