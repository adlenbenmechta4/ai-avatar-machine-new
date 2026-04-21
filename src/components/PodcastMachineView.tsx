"use client";

import React, { useState, useRef, useCallback } from "react";

// ─── Colors ─────────────────────────────────────────────────────────────────

const C = {
  pink: "#E461AD",
  gold: "#C9A96E",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  lightPink: "#F9E4EE",
  lightCyan: "#E8F8FD",
  lightGold: "#FBF5EB",
  white: "#FFFFFF",
  cream: "#FFF8F0",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface DialogueEntry {
  id: string;
  text: string;
}

interface PodcastMachineViewProps {
  onBack: () => void;
  isAdmin?: boolean;
}

// ─── Character Panel Component ──────────────────────────────────────────────

function CharacterPanel({
  characterLabel,
  characterNum,
  imageUrl,
  onImageChange,
  dialogues,
  onDialoguesChange,
  accentColor,
  lightColor,
  uploading,
  setUploading,
  disabled,
}: {
  characterLabel: string;
  characterNum: 1 | 2;
  imageUrl: string;
  onImageChange: (url: string) => void;
  dialogues: DialogueEntry[];
  onDialoguesChange: (dialogues: DialogueEntry[]) => void;
  accentColor: string;
  lightColor: string;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  disabled: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(imageUrl && !imageUrl.startsWith("blob:") ? imageUrl : "");

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/upload-podcast-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, fileName: `char${characterNum}-${Date.now()}.png` }),
          });
          const data = await res.json();
          if (data.url) {
            onImageChange(data.url);
            setUrlInput(data.url);
          } else {
            alert("Failed to upload image: " + (data.error || "Unknown error"));
          }
        } catch {
          alert("Failed to upload image. Please try again.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }, [characterNum, onImageChange, setUploading]);

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      onImageChange(urlInput.trim());
    }
  }, [urlInput, onImageChange]);

  const addDialogue = useCallback(() => {
    const newEntry: DialogueEntry = {
      id: `d-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: "",
    };
    onDialoguesChange([...dialogues, newEntry]);
  }, [dialogues, onDialoguesChange]);

  const updateDialogue = useCallback((id: string, text: string) => {
    onDialoguesChange(
      dialogues.map((d) => (d.id === id ? { ...d, text } : d))
    );
  }, [dialogues, onDialoguesChange]);

  const removeDialogue = useCallback((id: string) => {
    onDialoguesChange(dialogues.filter((d) => d.id !== id));
  }, [dialogues, onDialoguesChange]);

  return (
    <div
      className="rounded-3xl p-5 sm:p-6 flex flex-col h-full"
      style={{
        backgroundColor: C.white,
        border: `1.5px solid #F3F4F6`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.04)`,
      }}
    >
      {/* ─── Character Header ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <span className="text-sm font-black" style={{ color: accentColor }}>
            {characterNum}
          </span>
        </div>
        <div>
          <h3 className="text-base font-black uppercase tracking-wider" style={{ color: C.dark }}>
            {characterLabel}
          </h3>
          <p className="text-[11px]" style={{ color: C.textMuted }}>
            {characterNum === 1 ? "Right Speaker" : "Left Speaker"}
          </p>
        </div>
      </div>

      {/* ─── Image Upload Area ────────────────────────────── */}
      <div className="mb-5">
        {imageUrl ? (
          <div className="relative group">
            <img
              src={imageUrl}
              alt={`Character ${characterNum}`}
              className="w-full h-40 sm:h-48 object-cover rounded-2xl"
              style={{ border: `2px solid ${accentColor}30` }}
            />
            {!disabled && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              >
                <span className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl"
                  style={{ backgroundColor: `${accentColor}cc` }}
                >
                  Change Image
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || disabled}
            className="w-full h-40 sm:h-48 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200"
            style={{
              backgroundColor: `${lightColor}40`,
              border: `2px dashed ${accentColor}40`,
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? (
              <div className="w-8 h-8 rounded-full border-3 border-t-transparent animate-spin"
                style={{ borderColor: `${accentColor}40`, borderTopColor: accentColor }}
              />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  Upload Character Image
                </span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || disabled}
        />

        {/* URL Input */}
        {!imageUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); }}
              placeholder="Or paste image URL..."
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
              style={{
                backgroundColor: `${lightColor}30`,
                border: `1px solid #E5E7EB`,
                color: C.text,
              }}
              disabled={disabled}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || disabled}
              className="px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              style={{
                backgroundColor: accentColor,
                color: C.white,
              }}
            >
              Use
            </button>
          </div>
        )}
      </div>

      {/* ─── Dialogues ─────────────────────────────────────── */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
              Dialogue Lines ({dialogues.length})
            </span>
          </div>
          <button
            onClick={addDialogue}
            disabled={disabled}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{
              backgroundColor: `${accentColor}12`,
              color: accentColor,
              border: `1px solid ${accentColor}25`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${accentColor}30 transparent` }}
        >
          {dialogues.map((d, i) => (
            <div key={d.id} className="flex items-start gap-2">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black mt-0.5"
                style={{
                  backgroundColor: i === 0 ? accentColor : `${accentColor}15`,
                  color: i === 0 ? C.white : accentColor,
                }}
              >
                {i + 1}
              </div>
              <textarea
                value={d.text}
                onChange={(e) => updateDialogue(d.id, e.target.value)}
                placeholder={`Line ${i + 1}...`}
                rows={2}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none resize-none transition-all"
                style={{
                  backgroundColor: `${lightColor}30`,
                  border: `1px solid ${d.text ? `${accentColor}30` : "#E5E7EB"}`,
                  color: C.text,
                }}
                disabled={disabled}
              />
              {dialogues.length > 1 && !disabled && (
                <button
                  onClick={() => removeDialogue(d.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 transition-all hover:scale-110"
                  style={{ backgroundColor: "#FEF2F2" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {dialogues.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: C.textMuted }}>
                Click &quot;+ Add&quot; to add dialogue lines
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Podcast Machine View Component ─────────────────────────────────────────

export default function PodcastMachineView({ onBack, isAdmin = false }: PodcastMachineViewProps) {
  // ─── State ────────────────────────────────────────────────────────────
  const [char1ImageUrl, setChar1ImageUrl] = useState("");
  const [char2ImageUrl, setChar2ImageUrl] = useState("");
  const [char1Dialogues, setChar1Dialogues] = useState<DialogueEntry[]>([
    { id: "d1-1", text: "" },
  ]);
  const [char2Dialogues, setChar2Dialogues] = useState<DialogueEntry[]>([
    { id: "d2-1", text: "" },
  ]);

  const [kieApiKey, setKieApiKey] = useState("");
  const [falApiKey, setFalApiKey] = useState("");
  const [showKieKey, setShowKieKey] = useState(false);
  const [showFalKey, setShowFalKey] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState("");

  const [result, setResult] = useState<{
    mergedVideoUrl: string | null;
    individualVideos: string[];
    totalGenerated: number;
    totalRequested: number;
    errors?: Array<{ index: number; character: number; text: string; error: string }>;
  } | null>(null);

  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);

  // ─── Validation ──────────────────────────────────────────────────────
  const isValid = char1ImageUrl && char2ImageUrl &&
    char1Dialogues.some((d) => d.text.trim()) &&
    char2Dialogues.some((d) => d.text.trim());

  const totalSteps = () => {
    const c1 = char1Dialogues.filter((d) => d.text.trim()).length;
    const c2 = char2Dialogues.filter((d) => d.text.trim()).length;
    return Math.max(c1, c2) * 2 + 1; // videos + merge
  };

  // ─── Handle Generate ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!isValid) return;

    setGenerating(true);
    setError("");
    setResult(null);
    setGenerationProgress(0);
    setGenerationStatus("Starting podcast generation...");

    const total = totalSteps();
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      // Simulate slow progress while waiting for API
      setGenerationStatus((prev) => {
        if (prev.includes("Generating video")) {
          const match = prev.match(/video (\d+)/);
          if (match) {
            const vNum = parseInt(match[1]);
            const subStep = Math.floor((Date.now() / 5000) % 4);
            const dots = ".".repeat(subStep + 1);
            return `Generating video ${vNum} of ${total - 1}${dots}`;
          }
        }
        return prev;
      });
    }, 5000);

    try {
      const res = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          char1ImageUrl,
          char2ImageUrl,
          char1Dialogues: char1Dialogues.filter((d) => d.text.trim()).map((d) => d.text.trim()),
          char2Dialogues: char2Dialogues.filter((d) => d.text.trim()).map((d) => d.text.trim()),
          kieApiKey: isAdmin ? kieApiKey.trim() : "",
          falApiKey: isAdmin ? falApiKey.trim() : "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setResult(data);
      setGenerationProgress(100);
      setGenerationStatus("Done!");

      if (!data.success) {
        setError(data.error || "Generation failed. Check errors below.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      clearInterval(progressInterval);
      setGenerating(false);
    }
  };

  // ─── Download merged video ───────────────────────────────────────────
  const downloadVideo = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RESULT VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (result) {
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
              setResult(null);
              setError("");
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
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${C.cyan}25` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#E0E0E0" }}>
              Podcast Result
            </span>
          </div>

          {result.mergedVideoUrl && (
            <button
              onClick={() => downloadVideo(result.mergedVideoUrl!, "podcast-merged.mp4")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg"
              style={{
                backgroundColor: `${C.cyan}20`,
                color: C.cyan,
                border: `1.5px solid ${C.cyan}40`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save
            </button>
          )}
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* ─── Stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#1A1A1A", border: "1px solid #333333" }}>
              <p className="text-2xl font-black" style={{ color: C.cyan }}>{result.totalGenerated}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#888888" }}>Videos Created</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#1A1A1A", border: "1px solid #333333" }}>
              <p className="text-2xl font-black" style={{ color: result.errors && result.errors.length > 0 ? "#EF4444" : "#22C55E" }}>
                {result.errors?.length || 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#888888" }}>Errors</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#1A1A1A", border: "1px solid #333333" }}>
              <p className="text-2xl font-black" style={{ color: C.gold }}>
                {result.mergedVideoUrl ? "Ready" : "N/A"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#888888" }}>Merged</p>
            </div>
          </div>

          {/* ─── Merged Video Player ────────────────────────────────── */}
          {result.mergedVideoUrl ? (
            <div className="mb-8">
              <h2 className="text-lg font-black mb-4" style={{ color: C.white }}>
                Complete Podcast Video
              </h2>
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  border: `2px solid #333333`,
                  boxShadow: `0 8px 40px rgba(0,0,0,0.5)`,
                }}
              >
                <video
                  controls
                  autoPlay
                  className="w-full"
                  style={{ maxHeight: "500px", objectFit: "contain", backgroundColor: "#000" }}
                >
                  <source src={result.mergedVideoUrl} type="video/mp4" />
                  Your browser does not support video playback.
                </video>
              </div>

              <button
                onClick={() => downloadVideo(result.mergedVideoUrl!, "podcast-video.mp4")}
                className="w-full mt-4 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300"
                style={{
                  background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`,
                  color: C.white,
                  boxShadow: `0 4px 20px ${C.cyan}30`,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Merged Podcast Video
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center mb-8" style={{ backgroundColor: "#1A1A1A", border: "1px solid #333333" }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "#FEF2F2" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-bold" style={{ color: "#E0E0E0" }}>Merge Failed</p>
              <p className="text-xs mt-1" style={{ color: "#888888" }}>
                Videos were generated but could not be merged. Download individual videos below.
              </p>
            </div>
          )}

          {/* ─── Individual Videos ──────────────────────────────────── */}
          {result.individualVideos.length > 0 && (
            <div>
              <h2 className="text-lg font-black mb-4" style={{ color: C.white }}>
                Individual Videos ({result.individualVideos.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.individualVideos.map((url, i) => (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1px solid #333333", backgroundColor: "#1A1A1A" }}
                  >
                    <video
                      controls
                      preload="metadata"
                      className="w-full"
                      style={{ maxHeight: "200px", objectFit: "contain", backgroundColor: "#000" }}
                    >
                      <source src={url} type="video/mp4" />
                    </video>
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: "#E0E0E0" }}>
                        Video {i + 1}
                      </span>
                      <button
                        onClick={() => downloadVideo(url, `podcast-part-${i + 1}.mp4`)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                        style={{
                          backgroundColor: `${C.cyan}15`,
                          color: C.cyan,
                          border: `1px solid ${C.cyan}30`,
                        }}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Errors ─────────────────────────────────────────────── */}
          {result.errors && result.errors.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-black mb-4" style={{ color: "#EF4444" }}>
                Errors ({result.errors.length})
              </h2>
              <div className="space-y-2">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: "#1A1A1A", border: "1px solid #333333" }}
                  >
                    <p className="text-xs font-bold" style={{ color: "#E0E0E0" }}>
                      Video {err.index} (Character {err.character}): &quot;{err.text.slice(0, 60)}...&quot;
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "#888888" }}>{err.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATING VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: C.dark }}>
        <div className="text-center max-w-md px-6">
          {/* Animated Icon */}
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${C.cyan}, ${C.pink})`,
                boxShadow: `0 0 40px ${C.cyan}40, 0 0 80px ${C.pink}20`,
                animation: "podcastPulse 2s ease-in-out infinite",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-black uppercase tracking-wider mb-3" style={{ color: C.white }}>
            Generating Podcast
          </h2>

          <p className="text-sm mb-6" style={{ color: "#A0A0A0" }}>
            {generationStatus}
          </p>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#2A2A2A" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${generationProgress}%`,
                background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`,
                boxShadow: `0 0 12px ${C.cyan}60`,
              }}
            />
          </div>

          {/* Sequence Preview */}
          <div className="mt-8">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#666666" }}>
              Generation Sequence
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(() => {
                const c1 = char1Dialogues.filter((d) => d.text.trim()).length;
                const c2 = char2Dialogues.filter((d) => d.text.trim()).length;
                const maxR = Math.max(c1, c2);
                const items: Array<{ label: string; char: number }> = [];
                for (let i = 0; i < maxR; i++) {
                  if (i < c1) items.push({ label: `C1-${i + 1}`, char: 1 });
                  if (i < c2) items.push({ label: `C2-${i + 1}`, char: 2 });
                }
                return items.map((item, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 rounded-md text-[9px] font-bold"
                    style={{
                      backgroundColor: item.char === 1 ? `${C.cyan}20` : `${C.pink}20`,
                      color: item.char === 1 ? C.cyan : C.pink,
                      border: `1px solid ${item.char === 1 ? `${C.cyan}30` : `${C.pink}30`}`,
                    }}
                  >
                    {item.label}
                  </div>
                ));
              })()}
              <div className="px-2 py-1 rounded-md text-[9px] font-bold"
                style={{ backgroundColor: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}30` }}
              >
                MERGE
              </div>
            </div>
          </div>

          <p className="text-[11px] mt-6" style={{ color: "#555555" }}>
            This may take several minutes. Please keep this page open.
          </p>
        </div>

        <style jsx>{`
          @keyframes podcastPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
        `}</style>
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
            <path d="M10 3L5 8l5 5" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Menu
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: C.cyan, boxShadow: `0 2px 10px ${C.cyan}40` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <span
            className="text-sm font-black uppercase tracking-wider hidden sm:inline"
            style={{ color: C.dark }}
          >
            Podcast Machine
          </span>
        </div>

        <div className="w-[100px]" />
      </header>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
            style={{ backgroundColor: `${C.cyan}15` }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.cyan }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.cyan }}>
              AI-Powered
            </span>
          </div>

          <h1
            className="text-3xl sm:text-5xl font-black uppercase tracking-tight mb-4 leading-tight"
            style={{ color: C.dark }}
          >
            AI Podcast{" "}
            <span style={{ color: C.cyan }}>Machine</span>
          </h1>

          <p className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ color: C.textMuted }}>
            Create AI-powered podcast videos with two characters. Upload their images, write dialogues, and let AI generate and merge the complete podcast.
          </p>
        </div>

        {/* ─── Admin API Keys ──────────────────────────────────── */}
        {isAdmin && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: C.white,
              border: `1.5px solid #F3F4F6`,
              boxShadow: `0 2px 12px rgba(0,0,0,0.03)`,
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${C.gold}18` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>
                Admin API Keys
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* kie.ai Key */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textMuted }}>
                  kie.ai API Key
                </label>
                <div className="relative">
                  <input
                    type={showKieKey ? "text" : "password"}
                    value={kieApiKey}
                    onChange={(e) => setKieApiKey(e.target.value)}
                    placeholder="Override default..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-xs outline-none"
                    style={{
                      backgroundColor: `${C.lightGold}40`,
                      border: `1px solid #E5E7EB`,
                      color: C.text,
                    }}
                  />
                  <button
                    onClick={() => setShowKieKey(!showKieKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: C.textMuted }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {showKieKey
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              {/* fal.ai Key */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textMuted }}>
                  fal.ai API Key
                </label>
                <div className="relative">
                  <input
                    type={showFalKey ? "text" : "password"}
                    value={falApiKey}
                    onChange={(e) => setFalApiKey(e.target.value)}
                    placeholder="Override default..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-xs outline-none"
                    style={{
                      backgroundColor: `${C.lightCyan}40`,
                      border: `1px solid #E5E7EB`,
                      color: C.text,
                    }}
                  />
                  <button
                    onClick={() => setShowFalKey(!showFalKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: C.textMuted }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {showFalKey
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Character Panels ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Character 2 (LEFT) */}
          <CharacterPanel
            characterLabel="Character 2"
            characterNum={2}
            imageUrl={char2ImageUrl}
            onImageChange={setChar2ImageUrl}
            dialogues={char2Dialogues}
            onDialoguesChange={setChar2Dialogues}
            accentColor={C.pink}
            lightColor={C.lightPink}
            uploading={uploading2}
            setUploading={setUploading2}
            disabled={generating}
          />

          {/* Character 1 (RIGHT) */}
          <CharacterPanel
            characterLabel="Character 1"
            characterNum={1}
            imageUrl={char1ImageUrl}
            onImageChange={setChar1ImageUrl}
            dialogues={char1Dialogues}
            onDialoguesChange={setChar1Dialogues}
            accentColor={C.cyan}
            lightColor={C.lightCyan}
            uploading={uploading1}
            setUploading={setUploading1}
            disabled={generating}
          />
        </div>

        {/* ─── Error Message ───────────────────────────────────── */}
        {error && (
          <div
            className="rounded-2xl px-5 py-4 mb-6 text-sm font-medium text-center"
            style={{
              backgroundColor: "#FEF2F2",
              color: "#DC2626",
              border: "1px solid #FECACA",
            }}
          >
            {error}
          </div>
        )}

        {/* ─── Generate Button ─────────────────────────────────── */}
        <button
          onClick={handleGenerate}
          disabled={!isValid || generating}
          className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-40"
          style={{
            background: isValid
              ? `linear-gradient(135deg, ${C.cyan}, ${C.pink})`
              : "linear-gradient(135deg, #D1D5DB, #9CA3AF)",
            color: C.white,
            boxShadow: isValid ? `0 6px 24px ${C.cyan}30` : "none",
            transform: isValid ? "scale(1)" : "scale(0.98)",
          }}
        >
          <span className="inline-flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Generate Podcast Video
          </span>
        </button>

        {/* ─── Info Section ────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl p-5 sm:p-6" style={{
          backgroundColor: C.white,
          border: `1.5px solid #F3F4F6`,
        }}>
          <h3 className="text-sm font-black uppercase tracking-wider mb-3" style={{ color: C.text }}>
            How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Upload Images", desc: "Upload character images for both speakers", color: C.cyan },
              { step: "2", title: "Write Dialogues", desc: "Add dialogue lines for each character", color: C.pink },
              { step: "3", title: "Generate Videos", desc: "AI creates videos alternating between characters", color: C.gold },
              { step: "4", title: "Merge & Download", desc: "All videos merged into one complete podcast", color: "#22C55E" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  {item.step}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: C.text }}>{item.title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
