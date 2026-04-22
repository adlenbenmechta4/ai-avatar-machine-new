"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import VideoLibrary from "@/components/VideoLibrary";
import VideoEditor from "@/components/VideoEditor";
import { saveVideoToStorage } from "@/lib/video-store";

// ─── Types ───────────────────────────────────────────────────────────────────

type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

interface Scene {
  id: string;
  description: string;
  script: string;
  framePrompt: string;
  videoPrompt: string;
  frameProgress: number;
  frameDone: boolean;
  videoProgress: number;
  videoDone: boolean;
  frameUrl: string;
  videoUrl: string;
  customFrameImage: string | null;
}

// ─── Colors (holystrips.com style) ────────────────────────────────────────────

const C = {
  lime: "#9AFF01",
  pink: "#E461AD",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  lightPink: "#F9E4EE",
  lightBlue: "#F1FBFD",
  lightestPink: "#FFF1F9",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E7EB",
  inputBg: "#F9FAFB",
  inputBorder: "#E5E7EB",
  badgeBg: "#F3F4F6",
};

// ─── Pipeline Steps ──────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { num: 1, title: "Frames", icon: "\uD83D\uDDBC\uFE0F", color: C.pink },
  { num: 2, title: "Videos", icon: "\uD83C\uDFA5", color: C.cyan },
  { num: 3, title: "Merge", icon: "\uD83D\uDD17", color: C.lime },
  { num: 4, title: "Done", icon: "\u2728", color: C.pink },
];

const HEYGEN_PIPELINE_STEPS = [
  { num: 1, title: "Avatar", icon: "\uD83D\uDC64", color: C.pink },
  { num: 2, title: "Video", icon: "\uD83C\uDFA5", color: C.cyan },
  { num: 3, title: "Done", icon: "\u2728", color: C.pink },
];

// ─── Sample Data ─────────────────────────────────────────────────────────────

const SAMPLE_DESCRIPTIONS = [
  "ancient temple at golden sunrise, warm cinematic lighting",
  "modern minimalist studio with soft blue ambient light",
  "misty mountain peak at dawn, dramatic clouds in background",
  "cozy library with candlelight, wooden shelves filled with books",
  "futuristic neon city rooftop at night, holographic displays around",
  "tropical beach with turquoise water, palm trees swaying in gentle breeze",
  "snow-covered mountain cabin with warm firelight through frosty windows",
  "bustling Tokyo street at night with glowing lanterns and neon signs",
];

const SAMPLE_SCRIPTS = [
  "The journey of a thousand miles begins with a single step. But what most people don\u2019t realize is that the first step isn\u2019t physical \u2014 it\u2019s mental.",
  "You\u2019ve been told to think outside the box your entire life. But the real secret? There is no box. There never was.",
  "Every master was once a disaster. The difference is they didn\u2019t quit when it got uncomfortable. They leaned in.",
  "Knowledge without action is just entertainment. If you\u2019re not applying what you learn, you\u2019re just consuming content.",
  "The future belongs to those who build it, not those who wait for it. Start creating today.",
  "Success isn\u2019t about being the best. It\u2019s about being better than you were yesterday. That\u2019s it. That\u2019s the whole formula.",
  "Your limitations are stories you\u2019ve told yourself so many times you started believing them. Rewrite the story.",
  "The people who changed the world didn\u2019t have permission. They didn\u2019t wait for the right moment. They just started.",
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// ─── Confetti Component ──────────────────────────────────────────────────────

function Confetti() {
  const particles = useRef(
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1,
      duration: 1.5 + Math.random() * 2,
      color: [C.pink, C.lime, C.cyan, "#F59E0B", "#EF4444", "#8B5CF6"][
        Math.floor(Math.random() * 6)
      ],
      size: 5 + Math.random() * 9,
      rotation: Math.random() * 360,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: "-12px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Ticker Bar Component ────────────────────────────────────────────────────

function TickerBar({ bg, text }: { bg: string; text: string }) {
  return (
    <div className="w-full py-2.5 overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="flex animate-ticker whitespace-nowrap">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="inline-flex items-center gap-6 mx-8 text-sm font-semibold uppercase tracking-wider"
            style={{ color: bg === C.pink || bg === C.cyan ? C.white : C.dark }}
          >
            {text}
            <span className="opacity-50">&#9679;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Eye Icon SVG ────────────────────────────────────────────────────────────

function EyeIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  if (open) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

// ─── Dark Theme Colors ──────────────────────────────────────────────────────

const DC = {
  lime: "#9AFF01",
  pink: "#E461AD",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#E8E8E8",
  textMuted: "#9CA3AF",
  lightPink: "#2D1F2A",
  lightBlue: "#1A2A2E",
  lightestPink: "#2A1525",
  white: "#111111",
  cardBg: "#1A1A1A",
  cardBorder: "#2A2A2A",
  inputBg: "#1E1E1E",
  inputBorder: "#333333",
  badgeBg: "#222222",
};

// ─── Theme Helper ──────────────────────────────────────────────────────────

function useThemeColors(theme: "light" | "dark") {
  return theme === "dark" ? DC : C;
}

// ─── Create Avatar Section ────────────────────────────────────────────────

function CreateAvatarSection({
  theme,
  kieApiKey,
  avatarImage,
  onGenerate,
  isGenerating,
  progress,
  generatedUrl,
  error,
  saved,
}: {
  theme: string;
  kieApiKey: string;
  avatarImage: string | null;
  onGenerate: (prompt: string, referenceImageUrl: string, aspectRatio: string) => Promise<void>;
  isGenerating: boolean;
  progress: string;
  generatedUrl: string;
  error: string;
  saved: boolean;
}) {
  const T = useThemeColors(theme as "light" | "dark");
  const isDark = theme === "dark";
  const [prompt, setPrompt] = useState("");
  const [useReference, setUseReference] = useState(false);
  const [uploadedRefImage, setUploadedRefImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedRefImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || prompt.trim().length < 10) {
      alert("Please describe your character and environment in detail (at least 10 characters).");
      return;
    }
    if (!kieApiKey || kieApiKey.length < 10) {
      alert("Please enter a valid Image API key in the Create Video section first.");
      return;
    }

    let refUrl = "";
    if (useReference) {
      if (uploadedRefImage) {
        try {
          const res = await fetch(uploadedRefImage);
          const blob = await res.blob();
          const formData = new FormData();
          formData.append("avatar", blob, "reference.jpg");
          formData.append("kieApiKey", kieApiKey);

          const uploadRes = await fetch("/api/upload-avatar", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) throw new Error("Reference image upload failed");
          const uploadData = await uploadRes.json();
          refUrl = uploadData.avatarUrl || "";
        } catch (err) {
          alert("Failed to upload reference image: " + (err instanceof Error ? err.message : String(err)));
          return;
        }
      }
    }

    await onGenerate(prompt.trim(), refUrl, aspectRatio);
  }, [prompt, kieApiKey, useReference, uploadedRefImage, aspectRatio, onGenerate]);

  const samplePrompts = [
    "A professional young woman with dark hair wearing a navy blue blazer, standing confidently in front of a modern glass office building with city skyline at golden hour",
    "A friendly bearded man in his 30s wearing a casual green hoodie, sitting on a wooden bench in a beautiful autumn park with orange and red leaves falling",
    "An elegant woman with long flowing hair wearing a white dress, standing on a tropical beach with turquoise water and palm trees at sunset",
    "A young male scientist wearing a lab coat and glasses, standing in a futuristic laboratory with holographic displays and blue ambient lighting",
  ];

  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <div className="rounded-[28px] p-1" style={{ backgroundColor: `${T.cyan}15` }}>
        <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: T.cardBg }}>
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${T.cyan}15` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide" style={{ color: T.text }}>
                Create Your <span style={{ color: T.cyan }}>Avatar</span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                AI-Powered Avatar Generation
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-6" style={{ color: T.textMuted }}>
            Describe how you want your character to look and the environment they should be in. 
            The AI will generate a stunning avatar image for you. You can optionally upload a 
            reference photo to maintain facial consistency.
          </p>

          {/* Aspect Ratio Selector */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.text }}>
              Image Aspect Ratio
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setAspectRatio("9:16")}
                className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer border-2"
                style={{
                  backgroundColor: aspectRatio === "9:16" ? `${T.cyan}15` : T.inputBg,
                  borderColor: aspectRatio === "9:16" ? T.cyan : T.inputBorder,
                  color: aspectRatio === "9:16" ? T.cyan : T.textMuted,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="2" width="10" height="20" rx="2" />
                </svg>
                <div className="text-left">
                  <div className="text-[11px] font-black">9:16 Vertical</div>
                  <div className="text-[9px] opacity-70 font-normal">Portrait / Stories / Reels</div>
                </div>
              </button>
              <button
                onClick={() => setAspectRatio("16:9")}
                className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer border-2"
                style={{
                  backgroundColor: aspectRatio === "16:9" ? `${T.cyan}15` : T.inputBg,
                  borderColor: aspectRatio === "16:9" ? T.cyan : T.inputBorder,
                  color: aspectRatio === "16:9" ? T.cyan : T.textMuted,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
                <div className="text-left">
                  <div className="text-[11px] font-black">16:9 Landscape</div>
                  <div className="text-[9px] opacity-70 font-normal">YouTube / Desktop / Web</div>
                </div>
              </button>
            </div>
          </div>

          {/* Reference Photo Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setUseReference(!useReference)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer border-2"
              style={{
                backgroundColor: useReference ? `${T.cyan}15` : T.inputBg,
                borderColor: useReference ? T.cyan : T.inputBorder,
                color: useReference ? T.cyan : T.textMuted,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z" />
                <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z" />
              </svg>
              {useReference ? "Reference Photo: ON" : "Add Reference Photo (Optional)"}
            </button>

            {useReference && (
              <div className="mt-4 p-4 rounded-2xl" style={{ backgroundColor: T.inputBg }}>
                <p className="text-xs mb-3" style={{ color: T.textMuted }}>
                  Upload a reference photo to maintain facial consistency, or use your avatar from the Create Video section.
                </p>
                <div className="flex items-start gap-4 flex-wrap">
                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer transition-all duration-200 border-2" style={{ backgroundColor: uploadedRefImage ? `${T.cyan}15` : T.cardBg, borderColor: uploadedRefImage ? T.cyan : T.inputBorder, color: uploadedRefImage ? T.cyan : T.textMuted }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      {uploadedRefImage ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handleRefUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                {(uploadedRefImage || avatarImage) && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2" style={{ borderColor: T.cyan }}>
                      <img src={uploadedRefImage || avatarImage || ""} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: T.text }}>
                        {uploadedRefImage ? "Uploaded Reference" : "Avatar from Create Video"}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
                        This photo will be used as a reference for facial consistency
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.text }}>
              Describe Your Avatar & Environment
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A professional young woman with dark hair wearing a navy blue blazer, standing in front of a modern glass office building with city skyline at golden hour..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
              style={{ backgroundColor: T.inputBg, border: `2px solid ${T.inputBorder}`, color: T.text, minHeight: "100px" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = T.cyan; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = T.inputBorder; }}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px]" style={{ color: T.textMuted }}>
                Be descriptive: appearance, clothing, pose, background, lighting, mood
              </p>
              <span className="text-[10px] font-mono" style={{ color: prompt.length >= 10 ? T.cyan : T.textMuted }}>
                {prompt.length}/10 min
              </span>
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
              Sample Prompts (click to use)
            </p>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.slice(0, 3).map((sp, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(sp)}
                  className="text-[10px] px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer truncate max-w-[220px]"
                  style={{ backgroundColor: prompt === sp ? `${T.cyan}15` : T.inputBg, border: `1px solid ${prompt === sp ? T.cyan : T.inputBorder}`, color: prompt === sp ? T.cyan : T.textMuted }}
                  title={sp}
                >
                  {sp.slice(0, 50)}...
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleSubmit}
            disabled={isGenerating || prompt.trim().length < 10}
            className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: T.cyan, color: T.white, boxShadow: isGenerating ? "none" : `0 8px 30px ${T.cyan}30` }}
          >
            {isGenerating ? (
              <span className="inline-flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {progress || "Generating your avatar..."}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Generate Avatar Image
              </span>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="mt-4 rounded-2xl p-4 text-sm" style={{ backgroundColor: isDark ? "#2D1A1A" : "#FEF2F2", border: "2px solid #FECACA", color: "#DC2626" }}>
              <p className="font-bold mb-1">Generation Failed</p>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Generated Result */}
          {generatedUrl && !isGenerating && (
            <div className="mt-6">
              <div className="rounded-2xl overflow-hidden border-2 relative" style={{ borderColor: T.cyan }}>
                <img src={generatedUrl} alt="Generated Avatar" className="w-full max-h-[500px] object-contain" style={{ backgroundColor: isDark ? "#0A0A0A" : "#F9FAFB" }} />
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#16B1DE", backdropFilter: "blur(8px)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#16B1DE" }} />
                  AI Generated
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <a href={generatedUrl} download target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: T.dark, color: T.white }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Image
                </a>
                {saved && (
                  <div className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${T.lime}20`, color: T.lime }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved to Library
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {isGenerating && (
            <div className="mt-6">
              <div className="rounded-2xl overflow-hidden animate-pulse" style={{ backgroundColor: isDark ? "#1A1A1A" : "#F3F4F6", height: "300px" }}>
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full border-4 animate-spin mx-auto mb-4" style={{ borderColor: `${T.cyan}30`, borderTopColor: T.cyan }} />
                    <p className="text-sm font-bold" style={{ color: T.text }}>{progress || "Creating your avatar..."}</p>
                    <p className="text-xs mt-1" style={{ color: T.textMuted }}>This may take 30-60 seconds</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      <div className="rounded-[28px] p-1" style={{ backgroundColor: `${T.pink}10` }}>
        <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: T.cardBg }}>
          <h3 className="text-sm font-black uppercase tracking-wide mb-4 flex items-center gap-2" style={{ color: T.text }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill={T.pink}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            Tips for Best Results
          </h3>
          <ul className="space-y-3">
            {[
              "Describe the character in detail: age, gender, hair color, clothing, accessories, and expression",
              "Specify the environment: indoor/outdoor, lighting conditions, time of day, and mood",
              "Upload a clear reference photo for better facial consistency and likeness",
              "Use descriptive adjectives like professional, casual, elegant, futuristic to set the style",
              "Mention camera angle and composition: close-up, full body, wide shot",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: T.textMuted }}>
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill={T.cyan}>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AIAvatarMachine({ isAdmin = false, theme = "light", openLibraryKey }: { isAdmin?: boolean; theme?: string; openLibraryKey?: number }) {
  const { authFetch, user } = useAuth();
  const T = useThemeColors(theme as "light" | "dark");
  const isDark = theme === "dark";
  // ── Core State ──
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [scenes, setScenes] = useState<Scene[]>([
    { id: generateId(), description: "", script: "", framePrompt: "", videoPrompt: "", frameProgress: 0, frameDone: false, videoProgress: 0, videoDone: false, frameUrl: "", videoUrl: "", customFrameImage: null },
  ]);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [combineProgress, setCombineProgress] = useState(0);

  // ── Mode State ──
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [frameMode, setFrameMode] = useState<"avatar" | "scenes" | "custom">("avatar");
  const [aiTopic, setAiTopic] = useState("");
  const [aiDuration, setAiDuration] = useState(30);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [aiScriptApiKey, setAiScriptApiKey] = useState("");
  const [showAiScriptKey, setShowAiScriptKey] = useState(false);
  const [useFreeAi, setUseFreeAi] = useState(true);

  // ── API Keys ──
  const [kieApiKey, setKieApiKey] = useState("aaf0ea1db84a074fb1ed0ba386bbf615");
  const [showApiKey, setShowApiKey] = useState(false);
  const [falApiKey, setFalApiKey] = useState("c8b8a13a-d358-4a8c-b4a0-a6aee1da0bc5:c5c823fe4dad5a72691a9ab8eac5ef2c");
  const [showFalKey, setShowFalKey] = useState(false);

  // ── Video Provider ──
  const [videoProvider, setVideoProvider] = useState<"kie" | "heygen">("kie");
  const [heygenApiKey, setHeygenApiKey] = useState("sk_V2_hgu_kGRI9nkoelM_3gwvWJWLvYxhPq44jDMMaBOUvQDRtsMG");
  const [heygenVoiceId, setHeygenVoiceId] = useState("");
  const [heygenVoices, setHeygenVoices] = useState<Array<{ voice_id: string; name: string; display_name: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [showHeygenKey, setShowHeygenKey] = useState(false);
  const [heygenScript, setHeygenScript] = useState("");
  const [isGeneratingHeygenScript, setIsGeneratingHeygenScript] = useState(false);

  // ── View Mode ──
  const [view, setView] = useState<"create" | "library" | "create-avatar">("create");

  // When openLibraryKey changes from parent (user clicked "My Library" in top bar), switch to library view
  React.useEffect(() => {
    if (openLibraryKey && openLibraryKey > 0) {
      setView("library");
    }
  }, [openLibraryKey]);

  // ── Create Avatar State ──
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarRefImage, setAvatarRefImage] = useState<string | null>(null);
  const [avatarRefUrl, setAvatarRefUrl] = useState<string>("");
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string>("");
  const [avatarError, setAvatarError] = useState<string>("");
  const [avatarProgress, setAvatarProgress] = useState("");
  const [avatarSaved, setAvatarSaved] = useState(false);

  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // ── Video Editor State ──
  const [showEditor, setShowEditor] = useState(false);
  const [editorVideoUrl, setEditorVideoUrl] = useState("");

  // ── Results & Logs ──
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>("");
  const [finalFrameUrls, setFinalFrameUrls] = useState<string[]>([]);
  const [finalVideoUrls, setFinalVideoUrls] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [pipelineError, setPipelineError] = useState<string>("");
  const autoRetryCountRef = useRef<number>(0);
  const MAX_AUTO_RETRIES = 3;

  // ── Refs ──
  const abortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, []);

  // ── Fetch Voices ──
  useEffect(() => {
    if (videoProvider === "heygen" && heygenApiKey) {
      setLoadingVoices(true);
      fetch(`/api/heygen-voices?apiKey=${encodeURIComponent(heygenApiKey)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.voices && Array.isArray(data.voices)) {
            setHeygenVoices(data.voices);
            if (data.voices.length > 0) {
              setHeygenVoiceId((prev) =>
                prev && data.voices.some((v: { voice_id: string }) => v.voice_id === prev)
                  ? prev
                  : data.voices[0].voice_id
              );
            }
          }
        })
        .catch(() => {
          setHeygenVoices([]);
        })
        .finally(() => setLoadingVoices(false));
    }
  }, [videoProvider, heygenApiKey]);

  // ─── Avatar Upload (client-side compression) ────────────────────────────
  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Client-side compression: resize to 1024px, JPEG quality 0.90 (minimal quality loss)
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedUrl = canvas.toDataURL("image/jpeg", 0.90);
          setAvatarImage(compressedUrl);
          setAvatarUrl(""); // Reset uploaded URL
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const removeAvatar = useCallback(() => {
    setAvatarImage(null);
    setAvatarUrl("");
  }, []);

  // ─── Custom Scene Frame Upload ───────────────────────────────────────
  const handleSceneFrameUpload = useCallback((sceneId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedUrl = canvas.toDataURL("image/jpeg", 0.90);
          setScenes((prev) =>
            prev.map((s) => (s.id === sceneId ? { ...s, customFrameImage: compressedUrl } : s))
          );
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const removeSceneFrame = useCallback((sceneId: string) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, customFrameImage: null } : s))
    );
  }, []);

  // ─── Scene Management ─────────────────────────────────────────────────
  const addScene = useCallback(() => {
    if (scenes.length >= 10) return;
    setScenes((prev) => [
      ...prev,
      { id: generateId(), description: "", script: "", framePrompt: "", videoPrompt: "", frameProgress: 0, frameDone: false, videoProgress: 0, videoDone: false, frameUrl: "", videoUrl: "", customFrameImage: null },
    ]);
  }, [scenes.length]);

  const removeScene = useCallback((id: string) => {
    if (scenes.length <= 1) return;
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }, [scenes.length]);

  const updateScene = useCallback((id: string, field: keyof Scene, value: string | number | boolean) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }, []);

  // ─── AI Script Generation ─────────────────────────────────────────────
  const generateAIScript = useCallback(async () => {
    if (!aiTopic.trim() || isGeneratingScript) return;
    if (!useFreeAi && (!aiScriptApiKey || aiScriptApiKey.length < 10)) {
      alert("Please enter your AI API key (OpenAI, Google Gemini, etc.) for script generation.");
      return;
    }
    setIsGeneratingScript(true);
    addLog("Sending topic to AI script generator...");

    try {
      const res = await authFetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim(), duration: aiDuration, aiApiKey: aiScriptApiKey, useFreeAi }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Script generation failed (${res.status}): ${errText.slice(0, 200)}`);
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from script generator");
      }

      // Safe JSON parse
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON response from script generator");
      }

      const scenesArr = data.scenes as Array<{ script: string; description?: string }> | undefined;
      if (!scenesArr || !Array.isArray(scenesArr) || scenesArr.length === 0) {
        throw new Error("No scenes returned from script generator");
      }

      setScenes(
        scenesArr.map((s) => ({
          id: generateId(),
          description: s.description || "",
          script: s.script || "",
          framePrompt: "",
          videoPrompt: "",
          frameProgress: 0,
          frameDone: false,
          videoProgress: 0,
          videoDone: false,
          frameUrl: "",
          videoUrl: "",
        }))
      );

      addLog(`AI generated ${scenesArr.length} scenes successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`ERROR: ${msg}`);
      alert("Failed to generate script: " + msg);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [aiTopic, aiDuration, isGeneratingScript, aiScriptApiKey, useFreeAi]);

  // ─── Helper: add log entry ────────────────────────────────────────────
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ─── Status Polling Fallback (for when SSE stream is unreliable) ──
  const processedLogsRef = useRef<Set<string>>(new Set());

  const startStatusPolling = useCallback((jobId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    processedLogsRef.current = new Set();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await authFetch(`/api/status?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) return;
        const job = await res.json();

        // Update pipeline step and progress
        if (job.step !== undefined) {
          setPipelineStep(job.step as PipelineStep);
        }
        if (job.mergeProgress !== undefined) {
          setCombineProgress(job.mergeProgress);
        }

        // Update scene states
        if (job.scenes && Array.isArray(job.scenes)) {
          setScenes((prev) =>
            prev.map((s, i) => {
              const js = job.scenes[i];
              if (!js) return s;
              return {
                ...s,
                frameProgress: js.frameProgress ?? s.frameProgress,
                frameDone: js.frameDone ?? s.frameDone,
                videoProgress: js.videoProgress ?? s.videoProgress,
                videoDone: js.videoDone ?? s.videoDone,
                frameUrl: js.frameUrl || s.frameUrl,
                videoUrl: js.videoUrl || s.videoUrl,
              };
            })
          );
        }

        // Add new logs (avoid duplicates)
        if (job.logs && Array.isArray(job.logs)) {
          setLogs((prev) => {
            const existing = new Set(prev);
            const newLogs: string[] = [];
            for (const log of job.logs) {
              if (!existing.has(log) && !processedLogsRef.current.has(log)) {
                processedLogsRef.current.add(log);
                newLogs.push(log);
              }
            }
            return newLogs.length > 0 ? [...prev, ...newLogs] : prev;
          });
        }

        // Handle job completion
        if (job.status === "done" && job.finalVideoUrl) {
          setFinalVideoUrl(job.finalVideoUrl);
          if (job.finalFrameUrls) setFinalFrameUrls(job.finalFrameUrls);
          if (job.finalVideoUrls) setFinalVideoUrls(job.finalVideoUrls);
          setPipelineStep(4);
          setCombineProgress(100);
          setIsRunning(false);
          setPipelineError("");
          autoRetryCountRef.current = 0;
          setShowConfetti(true);
          addLog("Pipeline complete! Your video is ready!");
          setTimeout(() => setShowConfetti(false), 4000);
          // Auto-save to library
          doSaveToLibrary(job.finalVideoUrl, job.finalFrameUrls || []);

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (inactivityTimerRef.current) {
            clearInterval(inactivityTimerRef.current as unknown as number);
            inactivityTimerRef.current = null;
          }
        }

        // Handle job error
        if (job.status === "error" && job.error) {
          addLog(`PIPELINE ERROR: ${job.error}`);
          setIsRunning(false);
          setPipelineError(job.error);

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (inactivityTimerRef.current) {
            clearInterval(inactivityTimerRef.current as unknown as number);
            inactivityTimerRef.current = null;
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000); // Poll every 5 seconds
  }, [addLog]);

  // ─── Generate Talking Photo Script (AI) ──────────────────────────
  const generateHeygenScript = useCallback(async () => {
    if (!aiTopic.trim() || isGeneratingHeygenScript) return;
    if (!useFreeAi && (!aiScriptApiKey || aiScriptApiKey.length < 10)) {
      alert("Please enter your AI API key (OpenAI, Google Gemini, etc.) for script generation.");
      return;
    }
    setIsGeneratingHeygenScript(true);
    addLog("Generating script with AI...");

    try {
      const res = await authFetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim(), duration: aiDuration, singleScript: true, aiApiKey: aiScriptApiKey, useFreeAi }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Script generation failed (${res.status}): ${errText.slice(0, 200)}`);
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from script generator");
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON response from script generator");
      }

      // Support both single script and scenes format
      const singleScript = data.script as string | undefined;
      const scenesArr = data.scenes as Array<{ script: string }> | undefined;

      if (singleScript) {
        setHeygenScript(singleScript);
        addLog(`AI generated script (${singleScript.split(/\s+/).length} words)!`);
      } else if (scenesArr && scenesArr.length > 0) {
        const combined = scenesArr.map(s => s.script).join(" ");
        setHeygenScript(combined);
        addLog(`AI generated script from ${scenesArr.length} scenes (${combined.split(/\s+/).length} words)!`);
      } else {
        throw new Error("No script content returned from generator");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`ERROR: ${msg}`);
      alert("Failed to generate script: " + msg);
    } finally {
      setIsGeneratingHeygenScript(false);
    }
  }, [aiTopic, aiDuration, isGeneratingHeygenScript, addLog]);

  // ─── Upload Avatar to Server ──────────────────────────────────────────
  const uploadAvatarToServer = useCallback(async (imageDataUrl: string, apiKey: string, signal?: AbortSignal): Promise<string> => {
    addLog("Compressing & uploading avatar...");

    // Convert data URL to Blob
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append("avatar", blob, "avatar.jpg");
    formData.append("kieApiKey", apiKey);

    const uploadRes = await authFetch("/api/upload-avatar", {
      method: "POST",
      body: formData,
      signal,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Avatar upload failed (${uploadRes.status}): ${errText.slice(0, 200)}`);
    }

    const uploadText = await uploadRes.text();
    if (!uploadText || uploadText.trim().length === 0) {
      throw new Error("Empty response from avatar upload");
    }

    let uploadData: Record<string, unknown>;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      throw new Error("Invalid JSON from avatar upload");
    }

    const url = uploadData.avatarUrl as string | undefined;
    if (!url) {
      throw new Error("No avatarUrl in upload response");
    }

    addLog(`Avatar uploaded successfully (${uploadData.sizeKB || "?"}KB)`);
    return url;
  }, [addLog]);

  // ─── Run Generation Pipeline (SSE Streaming) ─────────────────────────
  const runGeneration = useCallback(async () => {
    if (isRunning) return;

    // ── Subscription / Plan Check ──
    if (user && user.plan === "free") {
      alert("Free plan users cannot create videos. Please upgrade to Pro or Enterprise to unlock video generation.");
      return;
    }

    // In custom frames mode, avatar is not required
    if (frameMode !== "custom" && !avatarImage) {
      alert("Please upload an avatar image first.");
      return;
    }

    // Validate based on provider
    let validScenes: Array<{ description: string; script: string }>;

    if (videoProvider === "heygen") {
      if (!heygenScript.trim()) {
        alert("Please write or generate a script for your video.");
        return;
      }
      if (!kieApiKey || kieApiKey.length < 10) {
        alert("Please enter a valid Image API key (needed for avatar upload).");
        return;
      }
      if (!heygenApiKey || heygenApiKey.length < 10) {
        alert("Please enter a valid Avatar API key.");
        return;
      }
      if (!heygenVoiceId) {
        alert("Please select a voice.");
        return;
      }
      validScenes = [{ description: "", script: heygenScript.trim() }];
    } else {
      validScenes = scenes.filter((s) => s.description.trim() || s.script.trim());
      if (validScenes.length === 0) {
        alert("Please add at least one scene with a script.");
        return;
      }
      if (!kieApiKey || kieApiKey.length < 10) {
        alert("Please enter a valid Image API key.");
        return;
      }
      if (!falApiKey || falApiKey.length < 10) {
        alert("Please enter a valid Merger API key.");
        return;
      }
    }

    setIsRunning(true);
    setPipelineStep(1);
    setCombineProgress(0);
    setFinalVideoUrl("");
    setFinalFrameUrls([]);
    setFinalVideoUrls([]);
    setLogs([]);
    setPipelineError("");
    if (autoRetryCountRef.current === 0) {
      // Only clear logs on first attempt, keep them on retries
    }
    lastEventTimeRef.current = Date.now();
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        frameProgress: 0,
        frameDone: false,
        videoProgress: 0,
        videoDone: false,
        frameUrl: "",
        videoUrl: "",
        framePrompt: "",
        videoPrompt: "",
      }))
    );

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Step 1: Upload avatar (not needed in custom frames mode)
      let uploadedUrl = avatarUrl || "";
      if (frameMode !== "custom" && avatarImage) {
        addLog("Uploading avatar to server...");
        uploadedUrl = await uploadAvatarToServer(avatarImage, kieApiKey, abortController.signal);
        setAvatarUrl(uploadedUrl);
        addLog("Avatar uploaded successfully!");
      }

      // Step 2: Start SSE pipeline
      addLog("Starting generation pipeline...");
      const res = await authFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoProvider,
          avatarUrl: uploadedUrl,
          frameMode,
          scenes: validScenes.map((s) => ({
            description: s.description,
            script: s.script,
            customFrameImage: s.customFrameImage || undefined,
          })),
          kieApiKey,
          falApiKey,
          heygenApiKey,
          heygenVoiceId,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        try {
          const errJson = JSON.parse(errText);
          throw new Error(errJson.error || `HTTP ${res.status}: ${errText.slice(0, 200)}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
      }

      addLog(`Pipeline started! (${validScenes.length} scene${validScenes.length > 1 ? "s" : ""})`);

      // Start inactivity timeout watcher (5 minutes)
      const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 min
      lastEventTimeRef.current = Date.now();

      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastEventTimeRef.current;
        if (elapsed > INACTIVITY_TIMEOUT && isRunning) {
          addLog(`⚠️ No progress for ${Math.round(elapsed / 60000)} min — connection may have timed out`);
          // Abort the stuck connection
          try { abortRef.current?.abort(); } catch {}
        }
      }, 30000) as unknown as ReturnType<typeof setTimeout>;

      // Step 3: Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body - streaming not supported");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Reset inactivity timer on any data received
        lastEventTimeRef.current = Date.now();

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);
            const eventType = event.type as string;

            if (eventType === "ping") {
              // Heartbeat from server — keeps connection alive, no action needed
            } else if (eventType === "started") {
              addLog("Pipeline running...");
              if (event.jobId) {
                currentJobIdRef.current = event.jobId;
                startStatusPolling(event.jobId);
              }
            } else if (eventType === "progress") {
              const step = event.step as number;
              const pct = event.pct as number;
              const message = event.message as string;
              if (step !== undefined) setPipelineStep(step as PipelineStep);
              if (pct !== undefined) setCombineProgress(pct);
              if (message) addLog(message);
            } else if (eventType === "done") {
              const videoUrl = event.videoUrl as string;
              const frameUrls = event.frameUrls as string[];
              const videoUrls = event.videoUrls as string[];
              if (videoUrl) setFinalVideoUrl(videoUrl);
              if (frameUrls) setFinalFrameUrls(frameUrls);
              if (videoUrls) setFinalVideoUrls(videoUrls);
              setPipelineStep(4);
              setCombineProgress(100);
              setIsRunning(false);
              setPipelineError("");
              autoRetryCountRef.current = 0;
              setShowConfetti(true);
              addLog("Pipeline complete! Your video is ready!");
              setTimeout(() => setShowConfetti(false), 4000);
              // Auto-save to library
              if (videoUrl) doSaveToLibrary(videoUrl, frameUrls || []);
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            } else if (eventType === "error") {
              const errMsg = event.message as string;
              addLog(`PIPELINE ERROR: ${errMsg}`);
              autoRetryCountRef.current += 1;
              // Stop polling
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }

              if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
                const retryNum = autoRetryCountRef.current;
                addLog(`🔄 Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
                setIsRunning(false);
                // Clean up inactivity timer
                if (inactivityTimerRef.current) {
                  clearInterval(inactivityTimerRef.current as unknown as number);
                  inactivityTimerRef.current = null;
                }
                // Close reader and retry
                try { reader.cancel(); } catch {}
                await new Promise(r => setTimeout(r, 10000));
                runGeneration();
                return;
              } else {
                addLog(`❌ Failed after ${MAX_AUTO_RETRIES} automatic retries.`);
                setIsRunning(false);
                setPipelineError(errMsg);
              }
            }
          } catch {
            // Ignore malformed events
          }
        }
      }

      // Clean up inactivity timer
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current as unknown as number);
        inactivityTimerRef.current = null;
      }

      // If stream ended but polling is active, let polling handle the rest
      if (isRunning && pollIntervalRef.current) {
        addLog("SSE stream ended — status polling will continue tracking progress...");
        return;
      }

      // If stream ended without "done" or "error" and no polling — auto retry
      if (isRunning) {
        const errorMsg = "Connection lost or server timed out";
        addLog(`⚠️ ${errorMsg}`);
        autoRetryCountRef.current += 1;

        if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
          const retryNum = autoRetryCountRef.current;
          addLog(`🔄 Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
          setIsRunning(false);
          await new Promise(r => setTimeout(r, 10000));
          // Retry automatically
          runGeneration();
          return;
        } else {
          addLog(`❌ Failed after ${MAX_AUTO_RETRIES} automatic retries.`);
          setIsRunning(false);
          setPipelineError("Failed after " + MAX_AUTO_RETRIES + " retries. Please reset and try again.");
        }
      }
    } catch (err: unknown) {
      // Clean up inactivity timer
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current as unknown as number);
        inactivityTimerRef.current = null;
      }
      // Clean up polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if ((err as Error).name === "AbortError" || (err as Error).message === "Aborted") {
        addLog("Generation aborted by user.");
        setIsRunning(false);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`ERROR: ${msg}`);

        // Auto retry on errors
        autoRetryCountRef.current += 1;
        if (autoRetryCountRef.current <= MAX_AUTO_RETRIES) {
          const retryNum = autoRetryCountRef.current;
          addLog(`🔄 Auto-retrying... (attempt ${retryNum}/${MAX_AUTO_RETRIES}) — waiting 10s...`);
          setIsRunning(false);
          await new Promise(r => setTimeout(r, 10000));
          runGeneration();
          return;
        } else {
          addLog(`❌ Failed after ${MAX_AUTO_RETRIES} automatic retries.`);
          setPipelineError(msg);
          setIsRunning(false);
        }
      }
    } finally {
      abortRef.current = null;
    }
  }, [isRunning, avatarImage, scenes, kieApiKey, falApiKey, frameMode, videoProvider, heygenApiKey, heygenVoiceId, heygenScript, uploadAvatarToServer, addLog, startStatusPolling]);

  // ─── Reset ────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    abortRef.current?.abort();
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    currentJobIdRef.current = null;
    setIsRunning(false);
    setPipelineStep(0);
    setCombineProgress(0);
    setShowConfetti(false);
    setFinalVideoUrl("");
    setFinalFrameUrls([]);
    setFinalVideoUrls([]);
    setLogs([]);
    setPipelineError("");
    autoRetryCountRef.current = 0;
    setSavedToLibrary(false);
    setShowEditor(false);
    setEditorVideoUrl("");
    setAvatarUrl("");
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        frameProgress: 0,
        frameDone: false,
        videoProgress: 0,
        videoDone: false,
        frameUrl: "",
        videoUrl: "",
        framePrompt: "",
        videoPrompt: "",
      }))
    );
  }, []);

  // ─── Fill Sample Data ────────────────────────────────────────────────
  const fillSampleData = useCallback(() => {
    const sceneCount = mode === "ai" ? Math.ceil(aiDuration / 8) : scenes.length;
    const newScenes: Scene[] = [];
    for (let i = 0; i < sceneCount; i++) {
      newScenes.push({
        id: generateId(),
        description: SAMPLE_DESCRIPTIONS[i % SAMPLE_DESCRIPTIONS.length],
        script: SAMPLE_SCRIPTS[i % SAMPLE_SCRIPTS.length],
        framePrompt: "",
        videoPrompt: "",
        frameProgress: 0,
        frameDone: false,
        videoProgress: 0,
        videoDone: false,
        frameUrl: "",
        videoUrl: "",
      });
    }
    setScenes(newScenes);
  }, [mode, aiDuration, scenes.length]);

  // ─── Dynamic Pipeline ─────────────────────────────────────────────
  const pipelineSteps = videoProvider === "heygen" ? HEYGEN_PIPELINE_STEPS : PIPELINE_STEPS;

  // ─── Step Status ─────────────────────────────────────────────────────
  const stepStatus = (num: number): "idle" | "active" | "done" => {
    if (pipelineStep === 0) return "idle";
    if (pipelineStep >= num + 1) return "done";
    if (pipelineStep === num) return "active";
    return "idle";
  };

  const totalDuration = scenes.length * 8;

  // ─── Duration Options ─────────────────────────────────────────────────
  const durationOptions = [
    { value: 8, label: "8s" },
    { value: 15, label: "15s" },
    { value: 30, label: "30s" },
    { value: 45, label: "45s" },
    { value: 60, label: "60s" },
    { value: 90, label: "90s" },
  ];

  // ─── Auto-scroll logs (smart: only scroll if user is already at bottom) ──
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      // Only auto-scroll if the user hasn't scrolled up manually
      if (isAtBottomRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [logs, showLogs]);

  // ─── Save to Library ──────────────────────────────────────────────
  // ─── Auto-save to library on completion ──────────────────────────
  const doSaveToLibrary = useCallback(async (videoUrl: string, frameUrls: string[]) => {
    if (!videoUrl) return;
    const videoData = {
      title: "My AI Video",
      videoUrl,
      thumbnailUrl: frameUrls[0] || null,
      duration: `${totalDuration}s`,
      scenesCount: videoProvider === "heygen" ? 1 : scenes.length,
      provider: videoProvider,
    };

    // Always save to localStorage (persistent, works without DB)
    const userEmail = user?.email || "";
    if (userEmail) {
      saveVideoToStorage(userEmail, {
        id: "local_" + Date.now(),
        ...videoData,
        createdAt: new Date().toISOString(),
      });
    }

    // Also try API save (for when DB is available)
    try {
      const res = await authFetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoData),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Auto-save to API failed:", res.status, errData);
        addLog("✅ Video saved to library (local storage)");
      } else {
        setSavedToLibrary(true);
        addLog("✅ Video saved to library!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Auto-save API error:", msg);
      addLog("✅ Video saved to library (local storage)");
    }
  }, [totalDuration, videoProvider, scenes.length, authFetch, user?.email]);

  // Manual save (button click — retry if auto-save failed)
  const saveToLibrary = useCallback(async () => {
    if (!finalVideoUrl) return;
    if (savedToLibrary) return;
    const videoData = {
      title: "My AI Video",
      videoUrl: finalVideoUrl,
      thumbnailUrl: finalFrameUrls[0] || null,
      duration: `${totalDuration}s`,
      scenesCount: videoProvider === "heygen" ? 1 : scenes.length,
      provider: videoProvider,
    };

    // Always save to localStorage
    const userEmail = user?.email || "";
    if (userEmail) {
      saveVideoToStorage(userEmail, {
        id: "local_" + Date.now(),
        ...videoData,
        createdAt: new Date().toISOString(),
      });
      setSavedToLibrary(true);
      addLog("✅ Video saved to library!");
      return;
    }

    // Fallback: try API save
    try {
      const res = await authFetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoData),
      });
      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }
      setSavedToLibrary(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to save to library: " + msg);
    }
  }, [finalVideoUrl, finalFrameUrls, totalDuration, videoProvider, scenes.length, authFetch, savedToLibrary, user?.email]);

  // ─── Video Editor: Open editor for generated video ──────────────────
  const openEditor = useCallback(() => {
    if (finalVideoUrl) {
      setEditorVideoUrl(finalVideoUrl);
      setShowEditor(true);
    }
  }, [finalVideoUrl]);

  // ─── Video Editor: Open editor for library video ────────────────────
  const openEditorForUrl = useCallback((videoUrl: string) => {
    setEditorVideoUrl(videoUrl);
    setShowEditor(true);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.white }}>

      {showConfetti && <Confetti />}

      {/* ─── Ticker Bar ─────────────────────────────────────────── */}
      <TickerBar
        bg={T.pink}
        text="YOUR AI AVATAR MACHINE"
      />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* ─── Header ────────────────────────────────────────────── */}
          <header className="text-center py-10 sm:py-14">
            <div
              className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{ backgroundColor: T.lightPink, color: T.pink }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: T.pink }} />
              Powered by AI Engine
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-none mb-4"
              style={{ color: T.text }}
            >
              AI AVATAR
              <span className="block" style={{ color: T.pink }}>MACHINE</span>
            </h1>
            <p className="text-base sm:text-lg font-light max-w-xl mx-auto" style={{ color: T.textMuted }}>
              Upload your avatar, write your script, and generate a talking-head video with consistent character across multiple scenes
            </p>

            {/* ─── Tab Toggle ──────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
              <button
                onClick={() => setView("create")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-2"
                style={{
                  backgroundColor: view === "create" ? T.pink : T.cardBg,
                  borderColor: view === "create" ? T.pink : T.cardBorder,
                  color: view === "create" ? T.white : T.textMuted,
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Video
                </span>
              </button>
              <button
                onClick={() => setView("create-avatar")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-2"
                style={{
                  backgroundColor: view === "create-avatar" ? T.cyan : T.cardBg,
                  borderColor: view === "create-avatar" ? T.cyan : T.cardBorder,
                  color: view === "create-avatar" ? T.white : T.textMuted,
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                  Create Your Avatar
                </span>
              </button>
              <button
                onClick={() => setView("library")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-2"
                style={{
                  backgroundColor: view === "library" ? T.pink : T.cardBg,
                  borderColor: view === "library" ? T.pink : T.cardBorder,
                  color: view === "library" ? T.white : T.textMuted,
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 12.75 6 12.246 6 11.625v-1.5" />
                  </svg>
                  My Library
                </span>
              </button>
            </div>
          </header>

          {/* ─── Library View ────────────────────────────────────────── */}
          {view === "library" && (
            <div className="mb-10 sm:mb-14">
              <VideoLibrary onViewCreate={() => setView("create")} onEditVideo={openEditorForUrl} theme={theme} />
            </div>
          )}

          {/* ─── Create Your Avatar View ──────────────────────────────── */}
          {view === "create-avatar" && (
            <div className="mb-10 sm:mb-14">
              <CreateAvatarSection
                theme={theme}
                kieApiKey={kieApiKey}
                avatarImage={avatarImage}
                onGenerate={async (prompt, refUrl, aspectRatio) => {
                  setIsGeneratingAvatar(true);
                  setAvatarError("");
                  setAvatarProgress("Submitting to AI...");
                  setGeneratedAvatarUrl("");
                  setAvatarSaved(false);

                  try {
                    const res = await authFetch("/api/generate-avatar-image", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        prompt,
                        referenceImageUrl: refUrl || undefined,
                        apiKey: kieApiKey,
                        aspectRatio,
                      }),
                    });

                    const resText = await res.text();
                    let data: Record<string, string | null>;
                    try {
                      data = JSON.parse(resText);
                    } catch {
                      throw new Error(resText.slice(0, 200) || "Unexpected response from server");
                    }

                    if (!res.ok) {
                      throw new Error(data.error || `Generation failed (${res.status})`);
                    }

                    setGeneratedAvatarUrl(data.imageUrl);
                    setAvatarProgress("");
                    addLog("Avatar image generated successfully!");

                    // Auto-save to library
                    const avatarData = {
                      title: "My AI Avatar",
                      videoUrl: data.imageUrl,
                      thumbnailUrl: data.imageUrl,
                      duration: null,
                      scenesCount: 1,
                      provider: "avatar" as string,
                    };

                    // Always save to localStorage
                    const userEmail = user?.email || "";
                    if (userEmail) {
                      saveVideoToStorage(userEmail, {
                        id: "local_" + Date.now(),
                        ...avatarData,
                        createdAt: new Date().toISOString(),
                      });
                    }

                    // Also try API save
                    try {
                      await authFetch("/api/videos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(avatarData),
                      });
                    } catch {
                      // API failed — localStorage save already done
                    }
                    setAvatarSaved(true);
                    addLog("Avatar saved to library!");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    setAvatarError(msg);
                    setAvatarProgress("");
                    addLog("Avatar generation error: " + msg);
                  } finally {
                    setIsGeneratingAvatar(false);
                  }
                }}
                isGenerating={isGeneratingAvatar}
                progress={avatarProgress}
                generatedUrl={generatedAvatarUrl}
                error={avatarError}
                saved={avatarSaved}
              />
            </div>
          )}

          {/* ─── Create View ─────────────────────────────────────────── */}
          {view === "create" && (
          <>

          {/* ─── Pipeline Visual ────────────────────────────────────── */}
          <section className="mb-10 sm:mb-14">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              {pipelineSteps.map((step, idx) => {
                const status = stepStatus(step.num);
                return (
                  <React.Fragment key={step.num}>
                    {/* Step circle */}
                    <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                      <div
                        className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg sm:text-2xl transition-all duration-500"
                        style={{
                          backgroundColor: status === "active" ? step.color + "20" : status === "done" ? step.color : T.inputBg,
                          border: status === "idle" ? `2px dashed ${T.cardBorder}` : `2px solid ${step.color}`,
                          boxShadow: status === "active" ? `0 0 20px ${step.color}40, 0 0 40px ${step.color}15` : status === "done" ? `0 0 12px ${step.color}30` : "none",
                          transform: status === "active" ? "scale(1.1)" : "scale(1)",
                        }}
                      >
                        {status === "done" ? (
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke={step.color} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <span
                            style={{
                              opacity: status === "idle" ? 0.35 : 1,
                              filter: status === "idle" ? "grayscale(1)" : "none",
                            }}
                          >
                            {step.icon}
                          </span>
                        )}
                        {/* Pulse ring for active step */}
                        {status === "active" && (
                          <>
                            <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: step.color, opacity: 0.15 }} />
                            <div
                              className="absolute -inset-1.5 rounded-full"
                              style={{
                                border: `2px solid ${step.color}30`,
                                animation: "pipeline-pulse 2s ease-in-out infinite",
                              }}
                            />
                          </>
                        )}
                        {/* Checkmark pop animation for done */}
                        {status === "done" && (
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              border: `2px solid ${step.color}`,
                              animation: "pipeline-done-pop 0.4s ease-out forwards",
                            }}
                          />
                        )}
                      </div>
                      <span
                        className="text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-500"
                        style={{
                          color: status === "active" ? step.color : status === "done" ? T.text : T.textMuted,
                          opacity: status === "idle" ? 0.4 : 1,
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                    {/* Connector arrow */}
                    {idx < pipelineSteps.length - 1 && (
                      <div className="flex items-center mx-1 sm:mx-2">
                        <div className="relative h-[2px] w-6 sm:w-10 overflow-hidden rounded-full" style={{ backgroundColor: T.cardBorder }}>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                            style={{
                              width: status === "done" ? "100%" : stepStatus(pipelineSteps[idx + 1].num) === "active" ? "50%" : "0%",
                              backgroundColor: step.color,
                            }}
                          />
                        </div>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 -ml-0.5 sm:-ml-1 transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke={status === "done" ? step.color : T.cardBorder} strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          {/* ─── Setup Section ─────────────────────────────────────── */}
          <div className="rounded-[28px] p-1 mb-10 sm:mb-14" style={{ backgroundColor: T.lightPink }}>
            <div className="rounded-[24px] p-5 sm:p-8" style={{ backgroundColor: T.cardBg }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

                {/* ── Avatar Upload ── */}
                <div className="lg:col-span-1">
                  <h2 className="text-xl font-black uppercase tracking-wide mb-5 flex items-center gap-2" style={{ color: T.text }}>
                    <span>👤</span> Avatar Setup
                  </h2>

                  {/* Video Provider Toggle */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      Video Provider
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: "kie" as const, label: "Multi-Scene", emoji: "🎬", desc: "Multiple scenes & backgrounds" },
                        { value: "heygen" as const, label: "Talking Photo", emoji: "🗣️", desc: "Single talking-head video" },
                      ]).map((prov) => (
                        <button
                          key={prov.value}
                          onClick={() => setVideoProvider(prov.value)}
                          disabled={isRunning}
                          className="py-2.5 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 text-center"
                          style={{
                            backgroundColor: videoProvider === prov.value ? T.pink : T.cardBg,
                            borderColor: videoProvider === prov.value ? T.pink : T.cardBorder,
                            color: videoProvider === prov.value ? T.white : T.textMuted,
                          }}
                        >
                          <div className="text-base mb-0.5">{prov.emoji}</div>
                          <div>{prov.label}</div>
                          <div className="text-[9px] font-normal lowercase tracking-normal mt-0.5 opacity-70">{prov.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!avatarImage ? (
                    <label
                      className="group cursor-pointer flex flex-col items-center justify-center aspect-[3/4] max-h-[320px] rounded-2xl border-2 border-dashed transition-all duration-300 mb-4"
                      style={{ borderColor: T.cardBorder, backgroundColor: T.inputBg }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.pink; e.currentTarget.style.backgroundColor = T.lightestPink; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.backgroundColor = T.inputBg; }}
                    >
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all" style={{ backgroundColor: T.lightPink }}>
                        <svg className="w-7 h-7" style={{ color: T.pink }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: T.text }}>Upload Avatar Image</p>
                      <p className="text-xs mt-1" style={{ color: T.textMuted }}>Front-facing photo works best</p>
                    </label>
                  ) : (
                    <div className="relative mb-4 group">
                      <div className="aspect-[3/4] max-h-[320px] rounded-2xl overflow-hidden border-2" style={{ borderColor: T.pink }}>
                        <img src={avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={removeAvatar}
                        disabled={isRunning}
                        className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-white/90 hover:bg-red-500 text-gray-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-gray-200 hover:border-red-500 disabled:opacity-0"
                      >
                        ✕
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl">
                        <p className="text-xs text-white font-semibold">
                          {avatarUrl ? "✅ Avatar uploaded & ready" : "✅ Avatar loaded (will upload on generate)"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Image API Provider Fields (Admin Only) ── */}
                  {videoProvider === "kie" && isAdmin && (
                    <>
                  {/* Image API Key */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                        Image API Key
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={kieApiKey}
                        onChange={(e) => setKieApiKey(e.target.value)}
                        placeholder="Enter your image API key..."
                        disabled={isRunning}
                        className="w-full px-4 py-3 pr-10 rounded-xl text-sm font-mono transition-all disabled:opacity-50 outline-none border-2 focus:border-current"
                        style={{ backgroundColor: T.inputBg, borderColor: kieApiKey ? T.lime : T.cardBorder, color: T.text, caretColor: T.pink }}
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                        style={{ color: T.textMuted }}
                        type="button"
                      >
                        <EyeIcon open={showApiKey} />
                      </button>
                    </div>
                    {kieApiKey && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.lime }} />
                        <span className="text-[10px] font-semibold" style={{ color: "#22C55E" }}>Image API configured</span>
                      </div>
                    )}
                  </div>

                  {/* Merger API Key */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.006a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.34 8.342" />
                        </svg>
                        Merger API Key
                        <span className="text-[9px] font-normal lowercase tracking-normal ml-1 opacity-60">(video merge)</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showFalKey ? "text" : "password"}
                        value={falApiKey}
                        onChange={(e) => setFalApiKey(e.target.value)}
                        placeholder="Enter your merger API key..."
                        disabled={isRunning}
                        className="w-full px-4 py-3 pr-10 rounded-xl text-sm font-mono transition-all disabled:opacity-50 outline-none border-2 focus:border-current"
                        style={{ backgroundColor: T.inputBg, borderColor: falApiKey ? T.lime : T.cardBorder, color: T.text, caretColor: T.pink }}
                      />
                      <button
                        onClick={() => setShowFalKey(!showFalKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                        style={{ color: T.textMuted }}
                        type="button"
                      >
                        <EyeIcon open={showFalKey} />
                      </button>
                    </div>
                    {falApiKey && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.lime }} />
                        <span className="text-[10px] font-semibold" style={{ color: "#22C55E" }}>Merger API configured</span>
                      </div>
                    )}
                  </div>
                    </>
                  )}

                  {/* ── Frame Mode Toggle ── */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      Frame Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: "avatar" as const, label: "Avatar Only", emoji: "👤", desc: "Same avatar in all scenes" },
                        { value: "scenes" as const, label: "Scene Frames", emoji: "🖼️", desc: "Unique backgrounds per scene" },
                        { value: "custom" as const, label: "Custom Frames", emoji: "📸", desc: "Upload image per scene" },
                      ]).map((fm) => (
                        <button
                          key={fm.value}
                          onClick={() => setFrameMode(fm.value)}
                          disabled={isRunning}
                          className="py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 text-center"
                          style={{
                            backgroundColor: frameMode === fm.value ? T.pink : T.cardBg,
                            borderColor: frameMode === fm.value ? T.pink : T.cardBorder,
                            color: frameMode === fm.value ? T.white : T.textMuted,
                          }}
                        >
                          <div className="text-lg mb-0.5">{fm.emoji}</div>
                          <div>{fm.label}</div>
                          <div className="text-[9px] font-normal lowercase tracking-normal mt-0.5 opacity-70">{fm.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Avatar API Provider Fields ── */}
                  {videoProvider === "heygen" && (
                    <>
                  {/* Avatar API Key */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                        Avatar API Key
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showHeygenKey ? "text" : "password"}
                        value={heygenApiKey}
                        onChange={(e) => setHeygenApiKey(e.target.value)}
                        placeholder="Enter your avatar API key..."
                        disabled={isRunning}
                        className="w-full px-4 py-3 pr-10 rounded-xl text-sm font-mono transition-all disabled:opacity-50 outline-none border-2 focus:border-current"
                        style={{ backgroundColor: T.inputBg, borderColor: heygenApiKey ? T.lime : T.cardBorder, color: T.text, caretColor: T.pink }}
                      />
                      <button
                        onClick={() => setShowHeygenKey(!showHeygenKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                        style={{ color: T.textMuted }}
                        type="button"
                      >
                        <EyeIcon open={showHeygenKey} />
                      </button>
                    </div>
                    {heygenApiKey && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.lime }} />
                        <span className="text-[10px] font-semibold" style={{ color: "#22C55E" }}>Avatar API configured</span>
                      </div>
                    )}
                  </div>

                  {/* Voice Selector */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                      <span className="inline-flex items-center gap-1.5">
                        🎙️ Voice
                      </span>
                    </label>
                    {loadingVoices ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: T.inputBg, border: "2px solid #E5E7EB" }}>
                        <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: `${T.pink}30`, borderTopColor: T.pink }} />
                        <span className="text-xs" style={{ color: T.textMuted }}>Loading voices...</span>
                      </div>
                    ) : heygenVoices.length > 0 ? (
                      <select
                        value={heygenVoiceId}
                        onChange={(e) => setHeygenVoiceId(e.target.value)}
                        disabled={isRunning}
                        className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50 outline-none border-2 focus:border-current cursor-pointer"
                        style={{ backgroundColor: T.inputBg, borderColor: heygenVoiceId ? T.lime : T.cardBorder, color: T.text }}
                      >
                        {heygenVoices.map((v) => (
                          <option key={v.voice_id} value={v.voice_id}>
                            {v.display_name || v.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: T.inputBg, border: "2px solid #E5E7EB", color: T.textMuted }}>
                        No voices available. Check your API key.
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>

                {/* ── Scene Editor ── */}
                <div className="lg:col-span-2">

                  {/* ═══ Talking Photo Mode: Single Script ═══ */}
                  {videoProvider === "heygen" ? (
                    <>
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2" style={{ color: T.text }}>
                          <span>📝</span> Script Speech
                          <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: T.lightPink, color: T.pink }}>
                            Talking Photo
                          </span>
                        </h2>
                      </div>

                      {/* Topic & Duration */}
                      <div className="rounded-2xl border-2 p-4 mb-4" style={{ borderColor: T.cardBorder, backgroundColor: T.inputBg }}>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: T.textMuted }}>
                              💡 Video Topic
                            </label>
                            <input
                              type="text"
                              value={aiTopic}
                              onChange={(e) => setAiTopic(e.target.value)}
                              placeholder="e.g. healthcare tips, motivational speech, product review..."
                              disabled={isRunning || isGeneratingHeygenScript}
                              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 outline-none border-2 focus:border-current"
                              style={{ backgroundColor: T.inputBg, borderColor: T.cardBorder, color: T.text, caretColor: T.pink }}
                            />
                          </div>
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[180px]">
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: T.textMuted }}>
                                ⏱️ Video Duration
                              </label>
                              <div className="flex gap-1.5 flex-wrap">
                                {durationOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setAiDuration(opt.value)}
                                    disabled={isRunning || isGeneratingHeygenScript}
                                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 border-2"
                                    style={{
                                      backgroundColor: aiDuration === opt.value ? T.pink : T.cardBg,
                                      borderColor: aiDuration === opt.value ? T.pink : T.cardBorder,
                                      color: aiDuration === opt.value ? T.white : T.textMuted,
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={generateHeygenScript}
                              disabled={isRunning || isGeneratingHeygenScript || !aiTopic.trim() || (!useFreeAi && !aiScriptApiKey)}
                              className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              style={{ backgroundColor: isGeneratingHeygenScript ? T.textMuted : T.pink, color: T.white }}
                            >
                              {isGeneratingHeygenScript ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Generating...
                                </span>
                              ) : "🤖 Generate Script with AI"}
                            </button>
                          </div>
                          <p className="text-[10px] font-light" style={{ color: T.textMuted }}>
                            AI will create a ~{aiDuration}s script for your talking avatar video.
                          </p>
                        </div>
                      </div>

                      {/* Single Script Textarea */}
                      <div className="rounded-2xl border-2 p-4" style={{ borderColor: heygenScript ? T.pink : T.cardBorder, backgroundColor: T.inputBg }}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textMuted }}>
                            🎤 Script Speech
                          </label>
                          {heygenScript && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: T.lightPink, color: T.pink }}>
                              {heygenScript.split(/\s+/).length} words
                            </span>
                          )}
                        </div>
                        <textarea
                          value={heygenScript}
                          onChange={(e) => setHeygenScript(e.target.value)}
                          placeholder="Write or generate your script speech here. Your avatar will speak this text in the video..."
                          disabled={isRunning}
                          rows={6}
                          className="w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 resize-none outline-none border-2 focus:border-current"
                          style={{ backgroundColor: T.inputBg, borderColor: T.cardBorder, color: T.text, caretColor: T.pink }}
                        />
                      </div>
                    </>
                  ) : (
                  <>
                  {/* ═══ Multi-Scene Mode ═══ */}
                  {/* Mode Toggle */}
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2" style={{ color: T.text }}>
                      <span>📝</span> Scenes & Script
                      <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: T.lightBlue, color: T.cyan }}>
                        {scenes.length} scenes · ~{totalDuration}s
                      </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl border-2 overflow-hidden" style={{ borderColor: T.cardBorder }}>
                        <button
                          onClick={() => setMode("ai")}
                          disabled={isRunning}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: mode === "ai" ? T.pink : T.cardBg, color: mode === "ai" ? T.white : T.textMuted }}
                        >🤖 AI Auto</button>
                        <button
                          onClick={() => setMode("manual")}
                          disabled={isRunning}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: mode === "manual" ? T.dark : T.cardBg, color: mode === "manual" ? T.white : T.textMuted }}
                        >✋ Manual</button>
                      </div>
                      <button onClick={fillSampleData} disabled={isRunning} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2" style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder, color: T.textMuted }}>🎲 Sample</button>
                      <button onClick={addScene} disabled={isRunning || scenes.length >= 10} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2" style={{ backgroundColor: T.lightPink, borderColor: T.pink, color: T.pink }}>+ Scene</button>
                    </div>
                  </div>

                  {/* AI Mode: Topic & Duration */}
                  {mode === "ai" && (
                    <div className="rounded-2xl border-2 p-4 mb-4 animate-fade-in" style={{ borderColor: T.cardBorder, backgroundColor: T.inputBg }}>
                      <div className="space-y-3">
                        {/* AI Provider Toggle */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.textMuted }}>🤖 Script AI Provider</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setUseFreeAi(true)}
                              disabled={isRunning}
                              className="py-2 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-50 border-2 text-center"
                              style={{ backgroundColor: useFreeAi ? T.lime : T.cardBg, borderColor: useFreeAi ? T.lime : T.cardBorder, color: useFreeAi ? T.dark : T.textMuted }}
                            >
                              <div className="text-sm mb-0.5">🆓</div>
                              <div>Free AI</div>
                              <div className="text-[9px] font-normal lowercase tracking-normal mt-0.5 opacity-70">No API key needed</div>
                            </button>
                            <button
                              onClick={() => setUseFreeAi(false)}
                              disabled={isRunning}
                              className="py-2 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-50 border-2 text-center"
                              style={{ backgroundColor: !useFreeAi ? T.pink : T.cardBg, borderColor: !useFreeAi ? T.pink : T.cardBorder, color: !useFreeAi ? T.white : T.textMuted }}
                            >
                              <div className="text-sm mb-0.5">🔑</div>
                              <div>Your API Key</div>
                              <div className="text-[9px] font-normal lowercase tracking-normal mt-0.5 opacity-70">OpenAI / Gemini / Groq</div>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: T.textMuted }}>💡 Video Topic</label>
                          <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. 5 tips for productivity, AI future trends, motivational speech..." disabled={isRunning || isGeneratingScript} className="w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 outline-none border-2 focus:border-current" style={{ backgroundColor: T.inputBg, borderColor: T.cardBorder, color: T.text, caretColor: T.pink }} />
                        </div>

                        {/* API Key (only in paid mode) */}
                        {!useFreeAi && (
                          <div className="animate-fade-in">
                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: T.textMuted }}>🔑 Your AI API Key</label>
                            <div className="relative">
                              <input type={showAiScriptKey ? "text" : "password"} value={aiScriptApiKey} onChange={(e) => setAiScriptApiKey(e.target.value)} placeholder="sk-... or your API key" disabled={isRunning} className="w-full px-3 py-2.5 pr-16 rounded-xl text-sm font-mono transition-all disabled:opacity-50 outline-none border-2 focus:border-current" style={{ backgroundColor: T.inputBg, borderColor: aiScriptApiKey ? T.lime : T.cardBorder, color: T.text, caretColor: T.pink }} />
                              <button onClick={() => setShowAiScriptKey(!showAiScriptKey)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer" style={{ color: T.textMuted }}>
                                {showAiScriptKey ? "Hide" : "Show"}
                              </button>
                            </div>
                            <p className="text-[10px] font-light mt-1" style={{ color: T.textMuted }}>Uses gpt-4o-mini by default. Works with any OpenAI-compatible API.</p>
                          </div>
                        )}

                        {useFreeAi && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]" style={{ backgroundColor: T.lime + "15", color: T.text }}>
                            <span>🆓</span>
                            <span>Powered by <b>Pollinations AI</b> — Completely free, no limits!</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: T.textMuted }}>⏱️ Video Duration</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {durationOptions.map((opt) => (
                                <button key={opt.value} onClick={() => setAiDuration(opt.value)} disabled={isRunning || isGeneratingScript} className="px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 border-2" style={{ backgroundColor: aiDuration === opt.value ? T.pink : T.cardBg, borderColor: aiDuration === opt.value ? T.pink : T.cardBorder, color: aiDuration === opt.value ? T.white : T.textMuted }}>{opt.label}</button>
                              ))}
                            </div>
                          </div>
                          <button onClick={generateAIScript} disabled={isRunning || isGeneratingScript || !aiTopic.trim() || (!useFreeAi && !aiScriptApiKey)} className="px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap" style={{ backgroundColor: isGeneratingScript ? T.textMuted : (useFreeAi ? T.lime : T.pink), color: useFreeAi ? T.dark : T.white }}>
                            {isGeneratingScript ? (<span className="inline-flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</span>) : (useFreeAi ? "🆓 Generate Script (Free)" : "🤖 Generate Script with AI")}
                          </button>
                        </div>
                        <p className="text-[10px] font-light" style={{ color: T.textMuted }}>AI will create ~{Math.ceil(aiDuration / 8)} scenes based on your topic. Each scene is ~8 seconds.</p>
                      </div>
                    </div>
                  )}

                  {/* Scene List */}
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                    {scenes.map((scene, i) => (
                      <div
                        key={scene.id}
                        className="rounded-2xl border-2 p-4 transition-all duration-300"
                        style={{
                          backgroundColor: scene.frameDone && scene.videoDone ? T.lime + "10" : scene.frameDone ? T.lightBlue : T.inputBg,
                          borderColor: scene.frameDone && scene.videoDone ? T.lime : scene.frameDone ? T.cyan : T.cardBorder,
                        }}
                      >
                        {/* Scene header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                              style={{
                                backgroundColor: scene.frameDone && scene.videoDone ? T.lime : scene.frameDone ? T.cyan : T.cardBorder,
                                color: scene.frameDone && scene.videoDone ? (isDark ? T.text : T.dark) : scene.frameDone ? T.white : T.textMuted,
                              }}
                            >
                              {scene.frameDone && scene.videoDone ? "✓" : i + 1}
                            </span>
                            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: T.text }}>
                              Scene {i + 1}
                            </span>
                            {scene.frameDone && !scene.videoDone && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: T.lightBlue, color: T.cyan }}>
                                Frame Ready
                              </span>
                            )}
                            {scene.frameDone && scene.videoDone && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: T.lime + "30", color: "#4ADE80" }}>
                                Video Ready
                              </span>
                            )}
                            {scene.frameProgress > 0 && !scene.frameDone && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: T.lightPink, color: T.pink }}>
                                Frame {scene.frameProgress}%
                              </span>
                            )}
                            {scene.videoProgress > 0 && !scene.videoDone && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: T.lightBlue, color: T.cyan }}>
                                Video {scene.videoProgress}%
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeScene(scene.id)}
                            disabled={isRunning || scenes.length <= 1}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-xs border border-transparent hover:border-red-300 hover:text-red-500"
                            style={{ color: T.textMuted }}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Per-Scene Start Frame Upload - only in Custom Frames mode */}
                          {frameMode === "custom" && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: T.textMuted }}>
                                📸 Start Frame
                              </label>
                            {scene.customFrameImage ? (
                              <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: T.cyan }}>
                                <img
                                  src={scene.customFrameImage}
                                  alt={`Scene ${i + 1} frame`}
                                  className="w-full aspect-[9/16] object-contain"
                                  style={{ backgroundColor: isDark ? "#111" : "#F9FAFB" }}
                                />
                                <button
                                  onClick={() => removeSceneFrame(scene.id)}
                                  disabled={isRunning}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: "rgba(239,68,68,0.9)", color: "#fff" }}
                                  title="Remove frame"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <label
                                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed aspect-[9/16] w-full cursor-pointer transition-all hover:border-current"
                                style={{ borderColor: T.cardBorder, backgroundColor: T.cardBg, color: T.textMuted }}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                </svg>
                                <span className="text-xs font-semibold">Click to upload frame</span>
                                <span className="text-[10px] opacity-60">9:16 Vertical</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleSceneFrameUpload(scene.id, e)}
                                  disabled={isRunning}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                          )}

                          {/* Scene Description - HIDDEN when frameMode === "avatar" */}
                          {frameMode === "scenes" && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: T.textMuted }}>
                                📍 Scene Description
                              </label>
                              <input
                                type="text"
                                value={scene.description}
                                onChange={(e) => updateScene(scene.id, "description", e.target.value)}
                                placeholder="e.g. ancient temple at golden sunrise..."
                                disabled={isRunning}
                                className="w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 outline-none border-2 focus:border-current"
                                style={{ backgroundColor: T.inputBg, borderColor: T.cardBorder, color: T.text, caretColor: T.pink }}
                              />
                            </div>
                          )}

                          {/* Script */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: T.textMuted }}>
                              💬 Script
                            </label>
                            <textarea
                              value={scene.script}
                              onChange={(e) => updateScene(scene.id, "script", e.target.value)}
                              placeholder="Write the dialogue or narration for this scene..."
                              disabled={isRunning}
                              rows={2}
                              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 resize-none outline-none border-2 focus:border-current"
                              style={{ backgroundColor: T.inputBg, borderColor: T.cardBorder, color: T.text, caretColor: T.pink }}
                            />
                          </div>

                          {/* Frame Preview */}
                          {scene.frameDone && scene.frameUrl && (
                            <div className="pt-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#4ADE80" }}>
                                  🖼️ Generated Frame
                                </span>
                              </div>
                              <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: T.lime, maxHeight: "200px" }}>
                                <img
                                  src={scene.frameUrl}
                                  alt={`Scene ${i + 1} frame`}
                                  className="w-full h-auto object-cover"
                                  style={{ maxHeight: "200px" }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Video Preview */}
                          {scene.videoDone && scene.videoUrl && (
                            <div className="pt-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#4ADE80" }}>
                                  🎥 Generated Video
                                </span>
                              </div>
                              <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: T.lime }}>
                                <video
                                  src={scene.videoUrl}
                                  controls
                                  className="w-full"
                                  style={{ maxHeight: "200px" }}
                                  preload="metadata"
                                />
                              </div>
                            </div>
                          )}

                          {/* Progress bars */}
                          {isRunning && !scene.frameDone && pipelineStep === 1 && (
                            <div className="pt-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.pink }}>
                                  Generating frame...
                                </span>
                                <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>{scene.frameProgress}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: T.cardBorder }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${scene.frameProgress}%`, backgroundColor: T.pink }}
                                />
                              </div>
                            </div>
                          )}

                          {isRunning && !scene.videoDone && pipelineStep === 2 && (
                            <div className="pt-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.cyan }}>
                                  Creating video...
                                </span>
                                <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>{scene.videoProgress}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: T.cardBorder }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${scene.videoProgress}%`, backgroundColor: T.cyan }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Merge Progress (Multi-Scene only — Talking Photo doesn't need merge) ── */}
          {isRunning && pipelineStep === 3 && videoProvider === "kie" && (
            <div className="rounded-[28px] p-6 mb-10 sm:mb-14 border-2 animate-fade-in" style={{ borderColor: T.lime, backgroundColor: T.lime + "08" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.lime }}>
                  <span className="text-sm">🔗</span>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: T.text }}>Combining Clips</h3>
                  <p className="text-xs font-light" style={{ color: T.textMuted }}>Merging all video clips into one final video...</p>
                </div>
                <span className="ml-auto text-sm font-mono font-bold" style={{ color: "#4ADE80" }}>{combineProgress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: T.cardBorder }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${combineProgress}%`, backgroundColor: T.lime }}
                />
              </div>
            </div>
          )}

          {/* ─── Generate / Reset Buttons ──────────────────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10 sm:mb-14">
            {!isRunning && pipelineStep === 0 && (
              <button
                onClick={runGeneration}
                disabled={frameMode === "custom" ? scenes.filter((s) => s.customFrameImage && s.script.trim()).length === 0 : !avatarImage || (videoProvider === "heygen" ? !heygenScript.trim() : scenes.filter((s) => s.description.trim() || s.script.trim()).length === 0)}
                className="px-8 py-4 rounded-2xl text-base font-black uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                style={{
                  backgroundColor: T.pink,
                  color: T.white,
                  boxShadow: (frameMode === "custom" || avatarImage) ? `0 8px 30px ${T.pink}40` : "none",
                }}
              >
                🚀 Generate Video
              </button>
            )}

            {isRunning && (
              <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border-2" style={{ borderColor: T.cyan, backgroundColor: T.lightBlue }}>
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${T.cyan}30`, borderTopColor: T.cyan }} />
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: T.cyan }}>
                  Generating... Step {pipelineStep} of {pipelineSteps.length}
                </span>
              </div>
            )}

            {pipelineError && !isRunning && (
              <div className="rounded-2xl border-2 p-5 animate-fade-in" style={{ borderColor: "#EF4444", backgroundColor: isDark ? "#2D1A1A" : "#FEF2F2" }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EF444420" }}>
                    <span className="text-lg">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: "#DC2626" }}>Generation Failed</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "#FCA5A5" }}>{pipelineError}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => { resetAll(); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer border-2"
                    style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder, color: T.textMuted }}
                  >
                    ↺ Reset & Try Again
                  </button>
                </div>
              </div>
            )}

            {(isRunning || pipelineStep > 0) && !pipelineError && (
              <button
                onClick={resetAll}
                className="px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border-2 hover:bg-gray-50"
                style={{ borderColor: T.cardBorder, color: T.textMuted }}
              >
                ↺ Reset
              </button>
            )}
          </div>

          {/* ─── Completion Section ────────────────────────────────── */}
          {finalVideoUrl && (
            <div className="rounded-[28px] p-1 mb-10 sm:mb-14 animate-fade-in-up" style={{ backgroundColor: T.lime }}>
              <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: T.cardBg }}>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: T.lime + "20", color: "#4ADE80" }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.lime }} />
                    Video Complete
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight" style={{ color: T.text }}>
                    Your AI Avatar Video is Ready! 🎉
                  </h2>
                </div>

                <div className="max-w-lg mx-auto mb-6">
                  <div className="rounded-2xl overflow-hidden border-2 shadow-lg" style={{ borderColor: T.lime }}>
                    <video
                      src={finalVideoUrl}
                      controls
                      autoPlay
                      className="w-full"
                      preload="metadata"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={finalVideoUrl}
                    download={`ai-avatar-video-${Date.now()}.mp4`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: T.dark, color: T.white }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Video
                  </a>
                  <button
                    onClick={saveToLibrary}
                    disabled={savedToLibrary}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: savedToLibrary ? T.lime : T.pink,
                      color: savedToLibrary ? (isDark ? T.text : T.dark) : T.white,
                    }}
                  >
                    {savedToLibrary ? (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Saved to Library
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Save to Library
                      </>
                    )}
                  </button>
                  <button
                    onClick={openEditor}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: T.lime, color: T.dark }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Your Video
                  </button>
                  <button
                    onClick={resetAll}
                    className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer border-2 hover:bg-gray-50"
                    style={{ borderColor: T.cardBorder, color: T.textMuted }}
                  >
                    Create Another
                  </button>
                </div>

                {/* Scene Thumbnails */}
                {finalFrameUrls.length > 0 && (
                  <div className="mt-6 pt-6" style={{ borderTop: "1px solid #F3F4F6" }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: T.textMuted }}>
                      🖼️ Generated Frames ({finalFrameUrls.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {finalFrameUrls.map((url, idx) => (
                        <div key={idx} className="flex-shrink-0 rounded-xl overflow-hidden border-2" style={{ borderColor: T.lime }}>
                          <img src={url} alt={`Frame ${idx + 1}`} className="w-20 h-28 object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Video Clips */}
                {finalVideoUrls.length > 1 && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: T.textMuted }}>
                      🎥 Individual Clips ({finalVideoUrls.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {finalVideoUrls.map((url, idx) => (
                        <div key={idx} className="flex-shrink-0 rounded-xl overflow-hidden border-2" style={{ borderColor: T.cyan }}>
                          <video src={url} controls className="w-24 h-36 object-cover" preload="metadata" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Generation Logs (Collapsible) ─────────────────────── */}
          {logs.length > 0 && (
            <div className="rounded-[28px] border-2 mb-10 sm:mb-14 overflow-hidden" style={{ borderColor: T.cardBorder }}>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between px-5 py-3 cursor-pointer transition-all hover:bg-gray-50"
                style={{ backgroundColor: T.inputBg }}
              >
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: T.textMuted }}>
                  <span>📋</span> Generation Logs
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: T.cardBorder, color: T.textMuted }}>
                    {logs.length}
                  </span>
                </span>
                <span
                  className="text-xs transition-transform duration-300"
                  style={{ transform: showLogs ? "rotate(180deg)" : "rotate(0deg)", color: T.textMuted }}
                >
                  ▼
                </span>
              </button>

              {showLogs && (
                <div
                  ref={logsContainerRef}
                  className="max-h-64 overflow-y-auto custom-scrollbar"
                  style={{ backgroundColor: "#0A0A0A" }}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    // Consider "at bottom" if within 40px of the bottom
                    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                  }}
                >
                  <div className="p-4 space-y-1 font-mono text-xs">
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        className="py-0.5"
                        style={{
                          color: log.includes("ERROR") ? "#EF4444" : log.includes("complete") || log.includes("success") || log.includes("ready") ? T.lime : "#9CA3AF",
                        }}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── How It Works ──────────────────────────────────────── */}
          <section className="mb-10 sm:mb-14">
            <div className="rounded-[28px] p-1" style={{ backgroundColor: T.lightBlue }}>
              <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: T.cardBg }}>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-center mb-6" style={{ color: T.text }}>
                  How It Works
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[
                    { step: "01", title: "Upload Avatar", desc: "Upload a front-facing photo of yourself. It will be used as the base character.", emoji: "📸" },
                    { step: "02", title: "Write Script", desc: "Use AI to auto-generate or manually write your script across multiple scenes.", emoji: "✍️" },
                    { step: "03", title: "Generate", desc: videoProvider === "heygen" ? "AI creates a single talking-head video from your full script — no merging needed." : "AI creates frames, generates videos for each scene, then merges them.", emoji: "⚡" },
                    { step: "04", title: "Download", desc: "Your final AI avatar talking video is ready to download and share!", emoji: "🎉" },
                  ].map((item) => (
                    <div key={item.step} className="text-center">
                      <div className="text-3xl mb-2">{item.emoji}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: T.cyan }}>{item.step}</div>
                      <h3 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: T.text }}>{item.title}</h3>
                      <p className="text-xs font-light leading-relaxed" style={{ color: T.textMuted }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          </>
          )}
        </div>

        {/* ─── Video Editor (works for both create & library views) ── */}
        {showEditor && editorVideoUrl && (
          <VideoEditor
            videoUrl={editorVideoUrl}
            onClose={() => { setShowEditor(false); setEditorVideoUrl(""); }}
            accentColor={T.lime}
          />
        )}
      </main>

      <TickerBar
        bg={T.cyan}
        text="YOUR AI AVATAR MACHINE"
      />

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="text-center py-6" style={{ backgroundColor: T.dark }}>
        <p className="text-sm font-semibold" style={{ color: T.pink }}>
          Powered by Adlene
        </p>
      </footer>
    </div>
  );
}
