"use client";

import React, { useState, useRef, useCallback } from "react";
import PodcastVideoLibrary from "@/components/PodcastVideoLibrary";
import VideoEditor from "@/components/VideoEditor";
import CaptionPanelModal from "@/components/CaptionPanelModal";
import { saveVideoToStorage, updateVideoUrlInStorage } from "@/lib/video-store";
import { useAuth } from "@/providers/auth-provider";

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

interface PodcastVideoClip {
  index: number;
  character: 1 | 2;
  text: string;
  videoProgress: number;
  videoDone: boolean;
  videoUrl: string;
  error: string;
}

interface PodcastMachineViewProps {
  onBack: () => void;
  isAdmin?: boolean;
}

// ─── Pipeline Steps (same visual style as AI Avatar Machine) ───────────────

const PIPELINE_STEPS = [
  { num: 1, title: "Videos", icon: "\uD83C\uDFA5", color: C.cyan },
  { num: 2, title: "Merge", icon: "\uD83D\uDD17", color: C.gold },
  { num: 3, title: "Done", icon: "\u2728", color: C.pink },
];

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
              className="w-full object-cover rounded-2xl"
              style={{ border: `2px solid ${accentColor}30`, aspectRatio: "9/16" }}
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
            className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200"
            style={{
              backgroundColor: `${lightColor}40`,
              border: `2px dashed ${accentColor}40`,
              opacity: uploading ? 0.6 : 1,
              aspectRatio: "9/16",
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
  // ─── Form State ──────────────────────────────────────────────────────
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

  // ─── Pipeline State (same pattern as AI Avatar Machine) ─────────────
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [combineProgress, setCombineProgress] = useState(0);
  const [pipelineError, setPipelineError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // ─── Video Clips State ──────────────────────────────────────────────
  const [clips, setClips] = useState<PodcastVideoClip[]>([]);
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null);
  const [editClipText, setEditClipText] = useState("");
  const [isRetryingClip, setIsRetryingClip] = useState(false);

  // ─── Results ─────────────────────────────────────────────────────────
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [finalVideoUrls, setFinalVideoUrls] = useState<string[]>([]);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [view, setView] = useState<"create" | "library">("create");

  // ─── Auto Subtitle State (fal.ai) ──
  const [subtitleVideoUrl, setSubtitleVideoUrl] = useState<string>("");
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [subtitleProgress, setSubtitleProgress] = useState("");
  const [subtitleError, setSubtitleError] = useState("");
  const [subtitleDone, setSubtitleDone] = useState(false);
  const [subtitleTranscription, setSubtitleTranscription] = useState("");
  const [subtitleCount, setSubtitleCount] = useState(0);
  const [showSubtitlePanel, setShowSubtitlePanel] = useState(false);

  // Subtitle customization
  const [subLanguage, setSubLanguage] = useState("ar");
  const [subFontName, setSubFontName] = useState("Cairo");
  const [subFontSize, setSubFontSize] = useState(100);
  const [subFontWeight, setSubFontWeight] = useState<"normal" | "bold" | "black">("bold");
  const [subFontColor, setSubFontColor] = useState("white");
  const [subHighlightColor, setSubHighlightColor] = useState("yellow");
  const [subStrokeWidth, setSubStrokeWidth] = useState(3);
  const [subPosition, setSubPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [subYOffset, setSubYOffset] = useState(75);
  const [subWordsPerLine, setSubWordsPerLine] = useState(3);
  const [subAnimation, setSubAnimation] = useState(true);
  const [subBgColor, setSubBgColor] = useState("none");
  const [subBgOpacity, setSubBgOpacity] = useState(0);

  const [showEditor, setShowEditor] = useState(false);
  const [editorVideoUrl, setEditorVideoUrl] = useState("");

  // ─── Library Caption Modal State ──
  const [captionVideoUrl, setCaptionVideoUrl] = useState<string>("");
  const [captionVideoId, setCaptionVideoId] = useState<string>("");
  const [showCaptionModal, setShowCaptionModal] = useState(false);

  const { user } = useAuth();

  // ─── Save to Library ─────────────────────────────────────────────────
  const doSaveToLibrary = useCallback(() => {
    if (!finalVideoUrl || savedToLibrary) return;
    const userEmail = user?.email || "";
    if (!userEmail) return;
    saveVideoToStorage(userEmail, {
      id: "podcast_" + Date.now(),
      title: "My AI Podcast",
      videoUrl: finalVideoUrl,
      thumbnailUrl: null,
      duration: null,
      scenesCount: finalVideoUrls.length || 1,
      provider: "podcast",
      createdAt: new Date().toISOString(),
    });
    setSavedToLibrary(true);
    addLog("✅ Podcast video saved to library!");
  }, [finalVideoUrl, finalVideoUrls.length, savedToLibrary, user?.email]);

  // Auto-save on completion
  React.useEffect(() => {
    if (finalVideoUrl && !savedToLibrary) {
      doSaveToLibrary();
    }
  }, [finalVideoUrl, savedToLibrary, doSaveToLibrary]);

  // ─── Upload State ────────────────────────────────────────────────────
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  const pipelineRunningRef = useRef(false);

  // ─── Cleanup ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      pipelineRunningRef.current = false;
    };
  }, []);

  // ─── Validation ──────────────────────────────────────────────────────
  const isValid = char1ImageUrl && char2ImageUrl &&
    char1Dialogues.some((d) => d.text.trim()) &&
    char2Dialogues.some((d) => d.text.trim());

  // ─── Helper: add log entry ───────────────────────────────────────────
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }, []);

  // ─── Pipeline API helpers ──────────────────────────────────────────
  const submitVideo = async (imageUrl: string, dialogueText: string, promptStyle?: number): Promise<string> => {
    const res = await fetch("/api/podcast/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, dialogueText, apiKey: isAdmin ? kieApiKey.trim() : "", promptStyle }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Failed to submit video");
    return data.taskId;
  };

  // ── Smart prompt style variation for retries (dialogue text stays EXACTLY the same) ──
  const varyPrompt = (text: string, attempt: number): string => {
    // Always return the original text — never modify what the user wrote
    return text;
  };

  const getPromptStyle = (attempt: number): number => {
    // Cycle through different visual descriptions, keeping dialogue text intact
    if (attempt <= 1) return 0; // original style
    if (attempt === 2) return 1; // "natural body language..."
    if (attempt === 3) return 2; // "subtle head and hand..."
    return 3;                    // "calm confident..."
  };

  const checkVideoStatus = async (taskId: string): Promise<{ status: string; videoUrl?: string; error?: string }> => {
    const apiKeyParam = isAdmin && kieApiKey.trim() ? `&apiKey=${encodeURIComponent(kieApiKey.trim())}` : "";
    const res = await fetch(`/api/podcast/video?taskId=${encodeURIComponent(taskId)}${apiKeyParam}`);
    return res.json();
  };

  const submitMerge = async (videoUrls: string[]): Promise<{ requestId?: string; videoUrl?: string }> => {
    const res = await fetch("/api/podcast/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrls, apiKey: isAdmin ? falApiKey.trim() : "" }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Failed to submit merge");
    if (data.status === "completed" && data.videoUrl) return { videoUrl: data.videoUrl };
    if (data.requestId) return { requestId: data.requestId };
    throw new Error("No requestId or videoUrl from merge");
  };

  const checkMergeStatus = async (requestId: string): Promise<{ status: string; videoUrl?: string; error?: string }> => {
    const apiKeyParam = isAdmin && falApiKey.trim() ? `&apiKey=${encodeURIComponent(falApiKey.trim())}` : "";
    const res = await fetch(`/api/podcast/merge?requestId=${encodeURIComponent(requestId)}${apiKeyParam}`);
    return res.json();
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ─── Edit & Retry single clip handlers ────────────────────────────────
  const handleEditRetry = (clipIndex: number) => {
    const clip = clips.find((c) => c.index === clipIndex);
    if (!clip) return;
    setEditingClipIndex(clipIndex);
    setEditClipText(clip.text);
  };

  const handleRetryWithoutEdit = async (clipIndex: number) => {
    setIsRetryingClip(true);
    const MAX_RETRIES = 4;
    const POLL_VIDEO_INTERVAL = 8000;
    const clip = clips.find((c) => c.index === clipIndex);
    if (!clip) { setIsRetryingClip(false); return; }
    const imageUrl = clip.character === 1 ? char1ImageUrl : char2ImageUrl;
    addLog(`🔄 Retrying video ${clipIndex}...`);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const style = getPromptStyle(attempt);
        const taskId = await submitVideo(imageUrl, clip.text, style);
        addLog(`📋 Video ${clipIndex}: Submitted (taskId: ${taskId.slice(0, 8)}..., attempt ${attempt})`);
        setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 20, error: "" } : c));
        let pollCount = 0;
        while (true) {
          await sleep(POLL_VIDEO_INTERVAL);
          pollCount++;
          const status = await checkVideoStatus(taskId);
          if (status.status === "completed" && status.videoUrl) {
            addLog(`✅ Video ${clipIndex}: Complete!`);
            setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 100, videoDone: true, videoUrl: status.videoUrl!, error: "" } : c));
            break;
          }
          if (status.status === "failed") {
            addLog(`⚠️ Video ${clipIndex} attempt ${attempt} failed: ${status.error || "Unknown error"}`);
            setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 0, error: `Attempt ${attempt} failed` } : c));
            break;
          }
          setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: Math.min(20 + Math.round((pollCount / 45) * 70), 90) } : c));
          if (pollCount % 6 === 0) addLog(`⏳ Video ${clipIndex}: Still processing... (${Math.round(pollCount * POLL_VIDEO_INTERVAL / 1000)}s elapsed)`);
        }
      } catch {
        if (attempt < MAX_RETRIES) {
          addLog(`🔄 Video ${clipIndex}: Retrying (${attempt}/${MAX_RETRIES})...`);
          await sleep(Math.min(15 + (attempt - 1) * 20, 120) * 1000);
        } else {
          addLog(`❌ Video ${clipIndex}: All ${MAX_RETRIES} attempts failed.`);
          setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, error: `Failed after ${MAX_RETRIES} attempts` } : c));
        }
      }
    }
    setIsRetryingClip(false);
  };

  const handleSaveRetryClip = async () => {
    if (editingClipIndex === null || !editClipText.trim()) return;
    setIsRetryingClip(true);
    const idx = editingClipIndex;
    const newText = editClipText.trim();
    setEditingClipIndex(null);
    const MAX_RETRIES = 4;
    const POLL_VIDEO_INTERVAL = 8000;
    const clip = clips.find((c) => c.index === idx);
    if (!clip) { setIsRetryingClip(false); return; }
    const imageUrl = clip.character === 1 ? char1ImageUrl : char2ImageUrl;
    addLog(`🔄 Retrying video ${idx} with new dialogue...`);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const style = getPromptStyle(attempt);
        const taskId = await submitVideo(imageUrl, newText, style);
        addLog(`📋 Video ${idx}: Submitted (taskId: ${taskId.slice(0, 8)}..., attempt ${attempt})`);
        setClips((prev) => prev.map((c) => c.index === idx ? { ...c, videoProgress: 20, error: "", text: newText } : c));
        let pollCount = 0;
        while (true) {
          await sleep(POLL_VIDEO_INTERVAL);
          pollCount++;
          const status = await checkVideoStatus(taskId);
          if (status.status === "completed" && status.videoUrl) {
            addLog(`✅ Video ${idx}: Complete!`);
            setClips((prev) => prev.map((c) => c.index === idx ? { ...c, videoProgress: 100, videoDone: true, videoUrl: status.videoUrl!, error: "" } : c));
            break;
          }
          if (status.status === "failed") {
            addLog(`⚠️ Video ${idx} attempt ${attempt} failed: ${status.error || "Unknown error"}`);
            setClips((prev) => prev.map((c) => c.index === idx ? { ...c, videoProgress: 0, error: `Attempt ${attempt} failed` } : c));
            break;
          }
          setClips((prev) => prev.map((c) => c.index === idx ? { ...c, videoProgress: Math.min(20 + Math.round((pollCount / 45) * 70), 90) } : c));
          if (pollCount % 6 === 0) addLog(`⏳ Video ${idx}: Still processing... (${Math.round(pollCount * POLL_VIDEO_INTERVAL / 1000)}s elapsed)`);
        }
      } catch {
        if (attempt < MAX_RETRIES) {
          addLog(`🔄 Video ${idx}: Retrying (${attempt}/${MAX_RETRIES})...`);
          await sleep(Math.min(15 + (attempt - 1) * 20, 120) * 1000);
        } else {
          addLog(`❌ Video ${idx}: All ${MAX_RETRIES} attempts failed.`);
          setClips((prev) => prev.map((c) => c.index === idx ? { ...c, error: `Failed after ${MAX_RETRIES} attempts` } : c));
        }
      }
    }
    setIsRetryingClip(false);
  };

  // ─── Run Generation (client-driven polling pipeline) ─────────────────
  const runGeneration = useCallback(async () => {
    if (!isValid || isRunning) return;

    const MAX_RETRIES = 4;
    const POLL_VIDEO_INTERVAL = 8000;
    const POLL_MERGE_INTERVAL = 5000;

    // Reset
    setIsRunning(true);
    setPipelineStep(1);
    setPipelineError("");
    setFinalVideoUrl("");
    setFinalVideoUrls([]);
    setSavedToLibrary(false);
    setCombineProgress(0);
    setLogs([]);
    setShowLogs(false);

    // Create abort controller
    const controller = new AbortController();
    abortRef.current = controller;
    pipelineRunningRef.current = true;

    // Build sequence
    const d1 = char1Dialogues.filter((d) => d.text.trim()).map((d) => d.text.trim());
    const d2 = char2Dialogues.filter((d) => d.text.trim()).map((d) => d.text.trim());
    const sequence: Array<{ character: 1 | 2; text: string }> = [];
    const maxRounds = Math.max(d1.length, d2.length);
    for (let i = 0; i < maxRounds; i++) {
      if (i < d1.length) sequence.push({ character: 1, text: d1[i] });
      if (i < d2.length) sequence.push({ character: 2, text: d2[i] });
    }

    // Initialize clip states
    const initialClips: PodcastVideoClip[] = sequence.map((s, i) => ({
      index: i + 1,
      character: s.character,
      text: s.text,
      videoProgress: 0,
      videoDone: false,
      videoUrl: "",
      error: "",
    }));
    setClips(initialClips);
    addLog(`Starting podcast generation: ${sequence.length} video clips`);

    const videoUrls: string[] = [];

    try {
      // ── Phase 1: Generate each video sequentially ──────────────────
      for (let si = 0; si < sequence.length; si++) {
        if (!pipelineRunningRef.current) throw new DOMException("Aborted", "AbortError");

        const clip = sequence[si];
        const imageUrl = clip.character === 1 ? char1ImageUrl : char2ImageUrl;
        const clipIdx = si + 1;

        addLog(`🎬 Submitting video ${clipIdx}/${sequence.length} (Character ${clip.character})...`);
        setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, videoProgress: 10, error: "" } : c));

        let clipSucceeded = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (!pipelineRunningRef.current) throw new DOMException("Aborted", "AbortError");

          try {
            // Submit — use different visual prompt style on retries, dialogue text stays EXACTLY the same
            const style = getPromptStyle(attempt);
            if (attempt > 1) {
              addLog(`📝 Video ${clipIdx}: Retry ${attempt} — trying different visual style (dialogue unchanged)`);
            }
            const taskId = await submitVideo(imageUrl, clip.text, style);
            addLog(`📋 Video ${clipIdx}: Submitted (taskId: ${taskId.slice(0, 8)}..., attempt ${attempt})`);
            setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, videoProgress: 20, error: "" } : c));

            // Poll until done/failed
            let pollCount = 0;
            while (true) {
              if (!pipelineRunningRef.current) throw new DOMException("Aborted", "AbortError");
              await sleep(POLL_VIDEO_INTERVAL);
              pollCount++;

              const status = await checkVideoStatus(taskId);
              const pct = Math.min(20 + Math.round((pollCount / 45) * 70), 90);

              if (status.status === "completed" && status.videoUrl) {
                addLog(`✅ Video ${clipIdx}: Complete!`);
                setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, videoProgress: 100, videoDone: true, videoUrl: status.videoUrl!, error: "" } : c));
                videoUrls.push(status.videoUrl);
                clipSucceeded = true;
                break;
              }

              if (status.status === "failed") {
                addLog(`⚠️ Video ${clipIdx} attempt ${attempt} failed: ${status.error || "Unknown error"}`);
                setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, videoProgress: 0, error: `Attempt ${attempt} failed: ${status.error || "Error"}` } : c));
                break;
              }

              // Still processing — update progress
              setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, videoProgress: pct } : c));
              if (pollCount % 6 === 0) {
                addLog(`⏳ Video ${clipIdx}: Still processing... (${Math.round(pollCount * POLL_VIDEO_INTERVAL / 1000)}s elapsed)`);
              }
            }

            if (clipSucceeded) break;

          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === "AbortError") throw err;

            if (attempt < MAX_RETRIES) {
              addLog(`🔄 Video ${clipIdx}: Retrying with different visual style (${attempt}/${MAX_RETRIES})...`);
              setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, error: `Retrying (${attempt}/${MAX_RETRIES})...`, videoProgress: 0 } : c));
              const retryDelay = Math.min(15 + (attempt - 1) * 20, 120) * 1000;
              addLog(`⏳ Waiting ${Math.round(retryDelay / 1000)}s before retry...`);
              await sleep(retryDelay);
            } else {
              addLog(`❌ Video ${clipIdx}: All ${MAX_RETRIES} attempts failed.`);
              setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, error: `Failed after ${MAX_RETRIES} attempts` } : c));
            }
          }
        }

        if (!clipSucceeded) {
          // Don't throw — pause pipeline and let user retry individual clips
          setPipelineStep(0);
          setIsRunning(false);
          pipelineRunningRef.current = false;
          abortRef.current = null;
          setClips((prev) => prev.map((c) => c.index === clipIdx ? { ...c, error: `Failed — click "Edit & Retry" to try again` } : c));
          addLog(`⚠️ Video ${clipIdx} failed. You can edit the dialogue and retry this video, or merge the successful ones.`);
          return;
        }
      }

      // ── Phase 2: Merge videos ─────────────────────────────────────
      if (!pipelineRunningRef.current) throw new DOMException("Aborted", "AbortError");

      setPipelineStep(2);
      setCombineProgress(10);
      addLog(`🔗 Submitting merge for ${videoUrls.length} videos...`);

      const mergeResult = await submitMerge(videoUrls);

      if (mergeResult.videoUrl) {
        // Merge completed instantly
        setPipelineStep(3);
        setCombineProgress(100);
        setFinalVideoUrl(mergeResult.videoUrl);
        setFinalVideoUrls(videoUrls);
        setIsRunning(false);
        pipelineRunningRef.current = false;
        addLog("Podcast complete!");
        return;
      }

      // Poll merge status
      addLog(`📋 Merge submitted (requestId: ${mergeResult.requestId!.slice(0, 8)}...)`);
      setCombineProgress(20);

      let mergePollCount = 0;
      while (true) {
        if (!pipelineRunningRef.current) throw new DOMException("Aborted", "AbortError");
        await sleep(POLL_MERGE_INTERVAL);
        mergePollCount++;

        const mergeStatus = await checkMergeStatus(mergeResult.requestId!);
        const mergePct = Math.min(20 + Math.round((mergePollCount / 30) * 70), 95);
        setCombineProgress(mergePct);

        if (mergeStatus.status === "completed" && mergeStatus.videoUrl) {
          setPipelineStep(3);
          setCombineProgress(100);
          setFinalVideoUrl(mergeStatus.videoUrl);
          setFinalVideoUrls(videoUrls);
          setIsRunning(false);
          pipelineRunningRef.current = false;
          addLog("Podcast complete!");
          return;
        }

        if (mergeStatus.status === "failed") {
          throw new Error(mergeStatus.error || "Merge failed");
        }

        if (mergePollCount % 6 === 0) {
          addLog(`⏳ Merge still processing... (${Math.round(mergePollCount * POLL_MERGE_INTERVAL / 1000)}s elapsed)`);
        }
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "AbortError") {
        setPipelineError(msg);
        addLog("ERROR: " + msg);
      } else {
        addLog("Pipeline cancelled");
      }
      setIsRunning(false);
      pipelineRunningRef.current = false;
    } finally {
      abortRef.current = null;
    }
  }, [isValid, isRunning, char1ImageUrl, char2ImageUrl, char1Dialogues, char2Dialogues, isAdmin, kieApiKey, falApiKey, addLog]);

  // ─── Retry a single failed clip with optional new dialogue text ──────
  const retrySingleClip = useCallback(async (clipIndex: number, newText?: string) => {
    const MAX_RETRIES = 4;
    const POLL_VIDEO_INTERVAL = 8000;

    const clip = clips.find((c) => c.index === clipIndex);
    if (!clip) return;

    const imageUrl = clip.character === 1 ? char1ImageUrl : char2ImageUrl;
    const dialogue = newText || clip.text;

    // Update clip with new text if provided
    if (newText) {
      setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, text: newText, videoProgress: 10, error: "", videoDone: false, videoUrl: "" } : c));
    } else {
      setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 10, error: "" } : c));
    }
    addLog(`🔄 Retrying video ${clipIndex}...${newText ? ' (with new dialogue)' : ''}`);

    let clipSucceeded = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const style = getPromptStyle(attempt);
        const taskId = await submitVideo(imageUrl, dialogue, style);
        addLog(`📋 Video ${clipIndex}: Submitted (taskId: ${taskId.slice(0, 8)}..., attempt ${attempt})`);
        setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 20, error: "" } : c));

        let pollCount = 0;
        while (true) {
          await sleep(POLL_VIDEO_INTERVAL);
          pollCount++;

          const status = await checkVideoStatus(taskId);
          const pct = Math.min(20 + Math.round((pollCount / 45) * 70), 90);

          if (status.status === "completed" && status.videoUrl) {
            addLog(`✅ Video ${clipIndex}: Complete!`);
            setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 100, videoDone: true, videoUrl: status.videoUrl!, error: "" } : c));
            clipSucceeded = true;
            break;
          }

          if (status.status === "failed") {
            addLog(`⚠️ Video ${clipIndex} attempt ${attempt} failed: ${status.error || "Unknown error"}`);
            setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: 0, error: `Attempt ${attempt} failed` } : c));
            break;
          }

          setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, videoProgress: pct } : c));
          if (pollCount % 6 === 0) {
            addLog(`⏳ Video ${clipIndex}: Still processing... (${Math.round(pollCount * POLL_VIDEO_INTERVAL / 1000)}s elapsed)`);
          }
        }

        if (clipSucceeded) break;

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < MAX_RETRIES) {
          addLog(`🔄 Video ${clipIndex}: Retrying (${attempt}/${MAX_RETRIES})...`);
          const retryDelay = Math.min(15 + (attempt - 1) * 20, 120) * 1000;
          addLog(`⏳ Waiting ${Math.round(retryDelay / 1000)}s before retry...`);
          await sleep(retryDelay);
        } else {
          addLog(`❌ Video ${clipIndex}: All ${MAX_RETRIES} attempts failed.`);
          setClips((prev) => prev.map((c) => c.index === clipIndex ? { ...c, error: `Failed after ${MAX_RETRIES} attempts` } : c));
        }
      }
    }

    return clipSucceeded;
  }, [clips, char1ImageUrl, char2ImageUrl, submitVideo, checkVideoStatus, addLog]);

  // ─── Merge all successful video clips (skips failed ones) ───────────
  const mergeSuccessfulVideos = useCallback(async () => {
    const successfulClips = clips.filter((c) => c.videoDone && c.videoUrl);
    if (successfulClips.length < 2) {
      addLog("ERROR: Need at least 2 successful videos to merge.");
      setPipelineError("Need at least 2 successful videos to merge.");
      return;
    }

    const videoUrls = successfulClips.map((c) => c.videoUrl);
    setPipelineError("");
    setPipelineStep(2);
    setCombineProgress(10);
    setIsRunning(true);
    addLog(`🔗 Merging ${videoUrls.length} successful videos...`);

    try {
      const mergeResult = await submitMerge(videoUrls);

      if (mergeResult.videoUrl) {
        setPipelineStep(3);
        setCombineProgress(100);
        setFinalVideoUrl(mergeResult.videoUrl);
        setFinalVideoUrls(videoUrls);
        setIsRunning(false);
        addLog("Podcast complete!");
        return;
      }

      addLog(`📋 Merge submitted (requestId: ${mergeResult.requestId!.slice(0, 8)}...)`);
      setCombineProgress(20);

      let mergePollCount = 0;
      while (true) {
        await sleep(5000);
        mergePollCount++;

        const mergeStatus = await checkMergeStatus(mergeResult.requestId!);
        const mergePct = Math.min(20 + Math.round((mergePollCount / 30) * 70), 95);
        setCombineProgress(mergePct);

        if (mergeStatus.status === "completed" && mergeStatus.videoUrl) {
          setPipelineStep(3);
          setCombineProgress(100);
          setFinalVideoUrl(mergeStatus.videoUrl);
          setFinalVideoUrls(videoUrls);
          setIsRunning(false);
          addLog("Podcast complete!");
          return;
        }

        if (mergeStatus.status === "failed") {
          throw new Error(mergeStatus.error || "Merge failed");
        }

        if (mergePollCount % 6 === 0) {
          addLog(`⏳ Merge still processing... (${Math.round(mergePollCount * 5000 / 1000)}s elapsed)`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipelineError(msg);
      addLog("ERROR: " + msg);
      setIsRunning(false);
    }
  }, [clips, submitMerge, checkMergeStatus, addLog]);

  // ─── Auto Subtitle via fal.ai ──────────────────────────────────────────
  const generateSubtitles = useCallback(async () => {
    if (!finalVideoUrl || isGeneratingSubtitles) return;

    setIsGeneratingSubtitles(true);
    setSubtitleProgress("Processing subtitles, please wait...");
    setSubtitleError("");
    setSubtitleDone(false);
    setSubtitleVideoUrl("");
    setSubtitleTranscription("");
    setSubtitleCount(0);

    try {
      const res = await fetch("/api/auto-subtitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: finalVideoUrl,
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
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((errData as Record<string, string>).error || "Failed to generate subtitles");
      }

      const data = await res.json() as Record<string, unknown>;

      if ((data.video_url as string)) {
        setSubtitleVideoUrl(data.video_url as string);
        setSubtitleTranscription((data.transcription as string) || "");
        setSubtitleCount((data.subtitle_count as number) || 0);
        setSubtitleDone(true);
        setSubtitleProgress("Done!");
        addLog("Auto-subtitle generated! " + ((data.subtitle_count as number) || 0) + " subtitles added.");
      } else {
        throw new Error("Subtitle generation failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubtitleError(msg);
      setSubtitleProgress("Failed");
      addLog("ERROR: Auto-subtitle failed - " + msg);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  }, [finalVideoUrl, isGeneratingSubtitles, subLanguage, subFontName, subFontSize, subFontWeight, subFontColor, subHighlightColor, subStrokeWidth, subPosition, subYOffset, subWordsPerLine, subAnimation, subBgColor, subBgOpacity, addLog]);

  // ─── Reset ───────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setIsRunning(false);
    setPipelineStep(0);
    setPipelineError("");
    setFinalVideoUrl("");
    setFinalVideoUrls("");
    setSavedToLibrary(false);
    setCombineProgress(0);
    setLogs([]);
    setClips([]);
    setShowEditor(false);
    setEditorVideoUrl("");
    pipelineRunningRef.current = false;
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  // ─── Video Editor: Open editor for generated video ────────────────────
  const editorRef = useRef<HTMLDivElement>(null);

  const openEditor = useCallback(() => {
    if (finalVideoUrl) {
      setEditorVideoUrl(finalVideoUrl);
      setShowEditor(true);
      requestAnimationFrame(() => {
        setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      });
    }
  }, [finalVideoUrl]);

  // ─── Video Editor: Open editor for library video ────────────────────────
  const openEditorForUrl = useCallback((videoUrl: string) => {
    setEditorVideoUrl(videoUrl);
    setShowEditor(true);
    requestAnimationFrame(() => {
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    });
  }, []);

  // ─── Library Caption: Open caption modal for library video ─────────────
  const openCaptionForUrl = useCallback((videoUrl: string, videoId: string) => {
    setCaptionVideoUrl(videoUrl);
    setCaptionVideoId(videoId);
    setShowCaptionModal(true);
  }, []);

  // ─── Download ────────────────────────────────────────────────────────
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

  // ─── Pipeline Step Status ────────────────────────────────────────────
  const stepStatus = (num: number): "idle" | "active" | "done" => {
    if (pipelineStep === 0) return "idle";
    if (pipelineStep >= num + 1) return "done";
    if (pipelineStep === num) return "active";
    return "idle";
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
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

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView("create")}
            className="px-3 sm:px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-2"
            style={{
              backgroundColor: view === "create" ? C.cyan : C.white,
              borderColor: view === "create" ? C.cyan : "#E5E7EB",
              color: view === "create" ? C.white : C.textMuted,
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span className="hidden sm:inline">Create</span>
            </span>
          </button>
          <button
            onClick={() => setView("library")}
            className="px-3 sm:px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all duration-300 cursor-pointer border-2"
            style={{
              backgroundColor: view === "library" ? C.cyan : C.white,
              borderColor: view === "library" ? C.cyan : "#E5E7EB",
              color: view === "library" ? C.white : C.textMuted,
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 12.75 6 12.246 6 11.625v-1.5" />
              </svg>
              <span className="hidden sm:inline">My Library</span>
            </span>
          </button>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* ─── Library View ──────────────────────────────────── */}
        {view === "library" && (
          <div className="mb-10 sm:mb-14">
            <PodcastVideoLibrary user={user} onViewCreate={() => setView("create")} onEditVideo={openEditorForUrl} onCaptionVideo={openCaptionForUrl} />
          </div>
        )}

        {/* ─── Create View ───────────────────────────────────── */}
        {view === "create" && (
        <React.Fragment>
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

        {/* ═══════════════════════════════════════════════════════════
            PIPELINE VISUAL (same style as AI Avatar Machine)
        ═══════════════════════════════════════════════════════════ */}
        <section className="mb-8 sm:mb-10">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {PIPELINE_STEPS.map((step, idx) => {
              const status = stepStatus(step.num);
              return (
                <React.Fragment key={step.num}>
                  {/* Step circle */}
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <div
                      className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-lg sm:text-2xl transition-all duration-500"
                      style={{
                        backgroundColor: status === "active" ? step.color + "20" : status === "done" ? step.color : "#F9FAFB",
                        border: status === "idle" ? `2px dashed #E5E7EB` : `2px solid ${step.color}`,
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
                    </div>
                    <span
                      className="text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-500"
                      style={{
                        color: status === "active" ? step.color : status === "done" ? C.text : C.textMuted,
                        opacity: status === "idle" ? 0.4 : 1,
                      }}
                    >
                      {step.title}
                    </span>
                  </div>
                  {/* Connector arrow */}
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="flex items-center mx-1 sm:mx-2">
                      <div className="relative h-[2px] w-6 sm:w-10 overflow-hidden rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                          style={{
                            width: stepStatus(PIPELINE_STEPS[idx + 1].num) === "done" ? "100%" : stepStatus(PIPELINE_STEPS[idx + 1].num) === "active" ? "50%" : "0%",
                            backgroundColor: step.color,
                          }}
                        />
                      </div>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 -ml-0.5 sm:-ml-1 transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke={status === "done" ? step.color : "#E5E7EB"} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </section>

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
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textMuted }}>
                  Image Generation API Key
                </label>
                <div className="relative">
                  <input
                    type={showKieKey ? "text" : "password"}
                    value={kieApiKey}
                    onChange={(e) => setKieApiKey(e.target.value)}
                    placeholder="Override default..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-xs outline-none"
                    style={{ backgroundColor: `${C.lightGold}40`, border: `1px solid #E5E7EB`, color: C.text }}
                  />
                  <button onClick={() => setShowKieKey(!showKieKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {showKieKey
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.textMuted }}>
                  Auto Subtitle API Key
                </label>
                <div className="relative">
                  <input
                    type={showFalKey ? "text" : "password"}
                    value={falApiKey}
                    onChange={(e) => setFalApiKey(e.target.value)}
                    placeholder="Override default..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-xs outline-none"
                    style={{ backgroundColor: `${C.lightCyan}40`, border: `1px solid #E5E7EB`, color: C.text }}
                  />
                  <button onClick={() => setShowFalKey(!showFalKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }}>
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
            disabled={isRunning}
          />
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
            disabled={isRunning}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════
            CLIP PROGRESS (per-video progress bars — same as AI Avatar Machine)
        ═══════════════════════════════════════════════════════════ */}
        {clips.length > 0 && (isRunning || clips.some((c) => c.error || c.videoDone)) && (pipelineStep === 0 || pipelineStep === 1) && (
          <div className="rounded-[28px] p-1 mb-6 animate-fade-in" style={{ backgroundColor: `${C.cyan}15` }}>
            <div className="rounded-[24px] p-5 sm:p-6" style={{ backgroundColor: C.white }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${C.cyan}15` }}>
                  <span className="text-xs">🎬</span>
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: C.text }}>
                  Generating Videos
                </h3>
                <span className="ml-auto text-[10px] font-mono px-2 py-1 rounded-lg" style={{ backgroundColor: `${C.cyan}10`, color: C.cyan }}>
                  {clips.filter((c) => c.videoDone).length}/{clips.length}
                </span>
              </div>
              <div className="space-y-3">
                {clips.map((clip) => (
                  <div key={clip.index} className="rounded-xl p-3" style={{ backgroundColor: `${clip.character === 1 ? C.lightCyan : C.lightPink}50` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold" style={{ color: clip.character === 1 ? C.cyan : C.pink }}>
                        Character {clip.character} — Clip {clip.index}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: clip.videoDone ? "#22C55E" : C.textMuted }}>
                        {clip.videoDone ? "Done" : `${clip.videoProgress}%`}
                      </span>
                    </div>
                    {clip.error ? (
                      <>
                        <p className="text-[10px]" style={{ color: "#EF4444" }}>{clip.error}</p>
                        {/* Edit & Retry / Retry buttons — only show when pipeline is paused (not running) */}
                        {!isRunning && !clip.videoDone && (
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => handleEditRetry(clip.index)}
                              disabled={isRetryingClip}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: C.pink, color: "#FFF" }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                              Edit & Retry
                            </button>
                            <button
                              onClick={() => handleRetryWithoutEdit(clip.index)}
                              disabled={isRetryingClip}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: "#E5E7EB", color: C.text }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                              </svg>
                              Retry
                            </button>
                          </div>
                        )}
                        {/* Edit dialogue input modal */}
                        {editingClipIndex === clip.index && (
                          <div className="mt-2 p-2.5 rounded-xl" style={{ backgroundColor: "#FFF", border: "1.5px solid #E5E7EB" }}>
                            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.textMuted }}>
                              Edit dialogue for Video {clip.index}
                            </label>
                            <textarea
                              value={editClipText}
                              onChange={(e) => setEditClipText(e.target.value)}
                              rows={3}
                              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none resize-none"
                              style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", color: C.text, caretColor: C.pink }}
                              placeholder="Enter new dialogue text..."
                            />
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={handleSaveRetryClip}
                                disabled={!editClipText.trim() || isRetryingClip}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: C.dark, color: "#FFF" }}
                              >
                                Save & Retry
                              </button>
                              <button
                                onClick={() => setEditingClipIndex(null)}
                                disabled={isRetryingClip}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: "#E5E7EB", color: C.textMuted }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : clip.videoDone ? (
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                        <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: "#22C55E" }} />
                      </div>
                    ) : (
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${clip.videoProgress}%`,
                            backgroundColor: clip.character === 1 ? C.cyan : C.pink,
                          }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] mt-1 truncate" style={{ color: C.textMuted }}>
                      &quot;{clip.text}&quot;
                    </p>
                  </div>
                ))}
              </div>

              {/* Merge Successful Videos button — show when pipeline paused with some failures */}
              {!isRunning && clips.length > 0 && clips.some((c) => c.error) && clips.filter((c) => c.videoDone).length >= 2 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={mergeSuccessfulVideos}
                    disabled={isRetryingClip}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: C.gold, color: "#FFF" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Merge {clips.filter((c) => c.videoDone).length} Successful Videos
                  </button>
                  <span className="text-[10px] flex items-center" style={{ color: C.textMuted }}>
                    ({clips.filter((c) => c.videoDone).length} done, {clips.filter((c) => c.error).length} failed)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            MERGE PROGRESS (same style as AI Avatar Machine)
        ═══════════════════════════════════════════════════════════ */}
        {isRunning && pipelineStep === 2 && (
          <div className="rounded-[28px] p-6 mb-6 border-2 animate-fade-in" style={{ borderColor: C.gold, backgroundColor: `${C.gold}08` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.gold }}>
                <span className="text-sm">🔗</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text }}>Combining Clips</p>
                <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>Merging all video clips into final podcast...</p>
              </div>
              <span className="text-sm font-mono font-bold" style={{ color: C.gold }}>{combineProgress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${combineProgress}%`,
                  background: `linear-gradient(90deg, ${C.gold}, ${C.pink})`,
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Pipeline Error ──────────────────────────────────── */}
        {pipelineError && !isRunning && (
          <div className="rounded-2xl border-2 p-5 mb-6 animate-fade-in" style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EF444420" }}>
                <span className="text-lg">!</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: "#DC2626" }}>Generation Failed</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#FCA5A5" }}>{pipelineError}</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Generate / Reset Buttons ──────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          {!isRunning && pipelineStep === 0 && (
            <button
              onClick={runGeneration}
              disabled={!isValid}
              className="px-8 py-4 rounded-2xl text-base font-black uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
              style={{
                backgroundColor: C.cyan,
                color: C.white,
                boxShadow: isValid ? `0 8px 30px ${C.cyan}40` : "none",
              }}
            >
              Generate Podcast Video
            </button>
          )}

          {isRunning && (
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border-2" style={{ borderColor: C.cyan, backgroundColor: C.lightCyan }}>
              <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${C.cyan}30`, borderTopColor: C.cyan }} />
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: C.cyan }}>
                Generating... Step {pipelineStep} of {PIPELINE_STEPS.length}
              </span>
            </div>
          )}

          {(isRunning || pipelineStep > 0) && !pipelineError && (
            <button
              onClick={resetAll}
              className="px-6 py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border-2 hover:bg-gray-50"
              style={{ borderColor: "#E5E7EB", color: C.textMuted }}
            >
              Reset
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            COMPLETION SECTION (same style as AI Avatar Machine)
        ═══════════════════════════════════════════════════════════ */}
        {finalVideoUrl && (
          <div className="rounded-[28px] p-1 mb-8 animate-fade-in-up" style={{ backgroundColor: C.pink }}>
            <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: C.white }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: `${C.pink}20`, color: C.pink }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.pink }} />
                  Podcast Complete
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight" style={{ color: C.text }}>
                  Your Podcast Video is Ready!
                </h2>
              </div>

              <div className="max-w-lg mx-auto mb-4">
                <div className="rounded-2xl overflow-hidden border-2 shadow-lg relative" style={{ borderColor: subtitleDone ? C.cyan : C.pink }}>
                  <video
                    key={subtitleDone ? subtitleVideoUrl : finalVideoUrl}
                    src={subtitleDone ? subtitleVideoUrl : finalVideoUrl}
                    controls
                    autoPlay
                    className="w-full"
                    preload="metadata"
                  />
                  {subtitleDone && (
                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 z-10" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "#16B1DE", backdropFilter: "blur(8px)" }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#16B1DE" }} />
                      Subtitled
                    </div>
                  )}
                </div>
              </div>

              {/* Auto Subtitle Button */}
              <div className="max-w-lg mx-auto mb-4">
                <button
                  onClick={() => setShowSubtitlePanel(!showSubtitlePanel)}
                  className="w-full py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2.5"
                  style={{
                    backgroundColor: showSubtitlePanel ? C.dark : "rgba(0,0,0,0.04)",
                    color: showSubtitlePanel ? C.white : C.text,
                    border: "2px solid " + (showSubtitlePanel ? C.dark : "#E5E7EB"),
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  Auto Subtitles
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transform: showSubtitlePanel ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Subtitle Customization Panel */}
              {showSubtitlePanel && (
                <div className="max-w-lg mx-auto mb-6 rounded-2xl p-5 space-y-4" style={{ backgroundColor: "#FAFAFA", border: "1.5px solid #E5E7EB" }}>

                  {/* Language */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Language</label>
                    <select value={subLanguage} onChange={(e) => setSubLanguage(e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold outline-none cursor-pointer" style={{ backgroundColor: C.white, border: "1.5px solid #E5E7EB", color: C.text }}>
                      <option value="ar">Arabic</option>
                      <option value="en">English</option>
                      <option value="fr">French</option>
                      <option value="es">Spanish</option>
                      <option value="de">German</option>
                      <option value="tr">Turkish</option>
                      <option value="ur">Urdu</option>
                      <option value="hi">Hindi</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="pt">Portuguese</option>
                      <option value="it">Italian</option>
                      <option value="ru">Russian</option>
                    </select>
                  </div>

                  {/* Position + Y Offset */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Position</label>
                    {(["top", "center", "bottom"] as const).map((pos) => (
                      <button key={pos} onClick={() => setSubPosition(pos)} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02]" style={{ backgroundColor: subPosition === pos ? C.pink : "rgba(0,0,0,0.05)", color: subPosition === pos ? C.white : C.textMuted, border: "1.5px solid " + (subPosition === pos ? C.pink : "#E5E7EB") }}>
                        {pos === "top" ? "Top" : pos === "center" ? "Center" : "Bottom"}
                      </button>
                    ))}
                    <span className="text-[10px] font-bold uppercase tracking-widest ml-2" style={{ color: C.textMuted }}>Y:</span>
                    <input type="range" min="-200" max="200" value={subYOffset} onChange={(e) => setSubYOffset(parseInt(e.target.value))} className="w-20 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: C.pink }} />
                    <span className="text-[10px] font-mono font-bold min-w-[30px]" style={{ color: C.textMuted }}>{subYOffset}</span>
                  </div>

                  {/* Font Size */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Size</label>
                    <input type="range" min="30" max="150" value={subFontSize} onChange={(e) => setSubFontSize(parseInt(e.target.value))} className="w-40 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: C.cyan }} />
                    <span className="text-[10px] font-mono font-bold min-w-[30px]" style={{ color: C.textMuted }}>{subFontSize}</span>
                  </div>

                  {/* Words Per Line */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Words/L</label>
                    <input type="range" min="1" max="12" value={subWordsPerLine} onChange={(e) => setSubWordsPerLine(parseInt(e.target.value))} className="w-40 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: C.dark }} />
                    <span className="text-[10px] font-mono font-bold min-w-[20px]" style={{ color: C.textMuted }}>{subWordsPerLine}</span>
                  </div>

                  {/* Font Weight */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Weight</label>
                    {(["normal", "bold", "black"] as const).map((w) => (
                      <button key={w} onClick={() => setSubFontWeight(w)} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02]" style={{ backgroundColor: subFontWeight === w ? C.dark : "rgba(0,0,0,0.05)", color: subFontWeight === w ? C.white : C.textMuted, border: "1.5px solid " + (subFontWeight === w ? C.dark : "#E5E7EB"), fontWeight: w === "normal" ? 400 : w === "bold" ? 700 : 900 }}>
                        {w}
                      </button>
                    ))}
                  </div>

                  {/* Colors */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Colors</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase" style={{ color: C.textMuted }}>Text:</span>
                      {["white", "black", "yellow", "red", "cyan", "lime"].map((c) => (
                        <button key={c} onClick={() => setSubFontColor(c)} className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 cursor-pointer" style={{ backgroundColor: c, borderColor: subFontColor === c ? C.pink : "transparent", transform: subFontColor === c ? "scale(1.15)" : "scale(1)" }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-[9px] uppercase" style={{ color: C.textMuted }}>HL:</span>
                      {["yellow", "cyan", "lime", "pink", "white", "orange"].map((c) => (
                        <button key={c} onClick={() => setSubHighlightColor(c)} className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 cursor-pointer" style={{ backgroundColor: c === "pink" ? "#E461AD" : c === "lime" ? "#9AFF01" : c === "orange" ? "#F59E0B" : c, borderColor: subHighlightColor === c ? C.dark : "transparent", transform: subHighlightColor === c ? "scale(1.15)" : "scale(1)" }} />
                      ))}
                    </div>
                  </div>

                  {/* Stroke */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Stroke</label>
                    <input type="range" min="0" max="10" value={subStrokeWidth} onChange={(e) => setSubStrokeWidth(parseInt(e.target.value))} className="w-40 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: "#E5E7EB" }} />
                    <span className="text-[10px] font-mono font-bold min-w-[20px]" style={{ color: C.textMuted }}>{subStrokeWidth}</span>
                    <span className="text-[10px] uppercase ml-2" style={{ color: C.textMuted }}>BG:</span>
                    <button onClick={() => setSubBgColor(subBgColor === "none" ? "black" : "none")} className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer" style={{ backgroundColor: subBgColor !== "none" ? C.dark : "rgba(0,0,0,0.05)", color: subBgColor !== "none" ? C.white : C.textMuted, border: "1.5px solid " + (subBgColor !== "none" ? C.dark : "#E5E7EB") }}>
                      {subBgColor !== "none" ? "ON" : "OFF"}
                    </button>
                    {subBgColor !== "none" && (
                      <>
                        <input type="range" min="0" max="100" value={Math.round(subBgOpacity * 100)} onChange={(e) => setSubBgOpacity(parseInt(e.target.value) / 100)} className="w-20 h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: C.dark }} />
                        <span className="text-[10px] font-mono" style={{ color: C.textMuted }}>{Math.round(subBgOpacity * 100)}%</span>
                      </>
                    )}
                  </div>

                  {/* Animation + Font */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[10px] font-bold uppercase tracking-widest min-w-[60px]" style={{ color: C.textMuted }}>Animate</label>
                    <button onClick={() => setSubAnimation(!subAnimation)} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02]" style={{ backgroundColor: subAnimation ? "#22C55E" : "rgba(0,0,0,0.05)", color: subAnimation ? C.white : C.textMuted, border: "1.5px solid " + (subAnimation ? "#22C55E" : "#E5E7EB") }}>
                      {subAnimation ? "ON" : "OFF"}
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest ml-2" style={{ color: C.textMuted }}>Font:</span>
                    <select value={subFontName} onChange={(e) => setSubFontName(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer" style={{ backgroundColor: C.white, border: "1.5px solid #E5E7EB", color: C.text }}>
                      <option value="Cairo">Cairo</option>
                      <option value="Tajawal">Tajawal</option>
                      <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Poppins">Poppins</option>
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Oswald">Oswald</option>
                      <option value="Bebas Neue">Bebas Neue</option>
                      <option value="Anton">Anton</option>
                    </select>
                  </div>

                  {/* Generate Button */}
                  <button onClick={generateSubtitles} disabled={isGeneratingSubtitles} className="w-full py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer" style={{ backgroundColor: isGeneratingSubtitles ? "#E5E7EB" : C.cyan, color: isGeneratingSubtitles ? C.textMuted : C.white, boxShadow: isGeneratingSubtitles ? "none" : "0 8px 30px " + C.cyan + "30" }}>
                    {isGeneratingSubtitles ? (
                      <span className="inline-flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        {subtitleProgress || "Processing..."}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        Generate Auto Subtitles ($0.03/min)
                      </span>
                    )}
                  </button>

                  {subtitleError && (
                    <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626" }}>
                      {subtitleError}
                    </div>
                  )}

                  {subtitleDone && (
                    <div className="rounded-xl p-3 text-xs space-y-1" style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0", color: "#16A34A" }}>
                      <p className="font-bold">Subtitles added successfully!</p>
                      <p>{subtitleCount} subtitle segments generated</p>
                      {subtitleTranscription && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-bold text-[10px] uppercase">Transcription</summary>
                          <p className="mt-1 text-[11px] opacity-80 max-h-24 overflow-y-auto">{subtitleTranscription}</p>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={subtitleDone ? subtitleVideoUrl : finalVideoUrl}
                  download={subtitleDone ? "subtitled-podcast-" + Date.now() + ".mp4" : "podcast-video-" + Date.now() + ".mp4"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: subtitleDone ? C.cyan : C.dark, color: C.white }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {subtitleDone ? "Download Subtitled" : "Download Video"}
                </a>
                {subtitleDone && (
                  <a
                    href={finalVideoUrl}
                    download={"podcast-video-" + Date.now() + ".mp4"}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    style={{ backgroundColor: C.dark, color: C.white }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Original
                  </a>
                )}
                <button onClick={openEditor} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: C.gold, color: C.white, boxShadow: "0 4px 16px " + C.gold + "40" }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Your Video
                </button>
                <button onClick={() => setView("library")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: savedToLibrary ? "#22C55E" : C.cyan, color: C.white }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {savedToLibrary ? "Saved to Library" : "Save to Library"}
                </button>
                <button onClick={resetAll} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer border-2 hover:bg-gray-50" style={{ borderColor: "#E5E7EB", color: C.textMuted }}>
                  Create Another
                </button>
              </div>

              {/* Individual Video Clips */}
              {finalVideoUrls.length > 1 && (
                <div className="mt-6 pt-6" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: C.textMuted }}>
                    Individual Clips ({finalVideoUrls.length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                    {finalVideoUrls.map((url, idx) => (
                      <div key={idx} className="flex-shrink-0 rounded-xl overflow-hidden border-2" style={{ borderColor: idx % 2 === 0 ? C.cyan : C.pink }}>
                        <video src={url} controls className="w-24 h-36 object-cover" preload="metadata" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            GENERATION LOGS (same style as AI Avatar Machine)
        ═══════════════════════════════════════════════════════════ */}
        {logs.length > 0 && (
          <div className="rounded-[28px] border-2 mb-8 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between px-5 py-3 cursor-pointer transition-all hover:bg-gray-50"
              style={{ backgroundColor: "#F9FAFB" }}
            >
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: C.textMuted }}>
                <span>📋</span> Generation Logs
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#E5E7EB", color: C.textMuted }}>
                  {logs.length}
                </span>
              </span>
              <span
                className="text-xs transition-transform duration-300"
                style={{ transform: showLogs ? "rotate(180deg)" : "rotate(0deg)", color: C.textMuted }}
              >
                ▼
              </span>
            </button>

            {showLogs && (
              <div
                className="max-h-64 overflow-y-auto"
                style={{ backgroundColor: "#0A0A0A", scrollbarWidth: "thin" }}
              >
                <div className="p-4 space-y-1 font-mono text-xs">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className="py-0.5"
                      style={{
                        color: log.includes("ERROR") ? "#EF4444" : log.includes("complete") || log.includes("success") || log.includes("ready") ? C.cyan : "#9CA3AF",
                      }}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </React.Fragment>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════
          VIDEO EDITOR (CapCut-like Timeline Editor) - Available for both create & library views
      ═══════════════════════════════════════════════════════════ */}
      {showEditor && editorVideoUrl && (
        <div ref={editorRef} className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
          <VideoEditor
            videoUrl={editorVideoUrl}
            onClose={() => { setShowEditor(false); setEditorVideoUrl(""); }}
            accentColor={C.gold}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LIBRARY CAPTION MODAL - Add auto captions to library videos
      ═══════════════════════════════════════════════════════════ */}
      {showCaptionModal && captionVideoUrl && (
        <CaptionPanelModal
          videoUrl={captionVideoUrl}
          onClose={(captionedUrl) => {
            if (captionedUrl && captionVideoId) {
              const userEmail = user?.email || "";
              if (userEmail) updateVideoUrlInStorage(userEmail, captionVideoId, captionedUrl);
            }
            setShowCaptionModal(false);
            setCaptionVideoUrl("");
            setCaptionVideoId("");
          }}
          accentColor={C.cyan}
        />
      )}
    </div>
  );
}
