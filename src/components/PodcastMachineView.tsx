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

  // ─── Results ─────────────────────────────────────────────────────────
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [finalVideoUrls, setFinalVideoUrls] = useState<string[]>([]);

  // ─── Upload State ────────────────────────────────────────────────────
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Cleanup ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
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

  // ─── Status Polling Fallback (same as AI Avatar Machine) ─────────────
  const processedLogsRef = useRef<Set<string>>(new Set());

  const startStatusPolling = useCallback((jobId: string) => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); }
    processedLogsRef.current = new Set();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?jobId=${encodeURIComponent(jobId)}`);
        if (!res.ok) return;
        const job = await res.json();

        // Sync pipeline step
        if (job.step !== undefined) setPipelineStep(job.step);
        if (job.mergeProgress !== undefined) setCombineProgress(job.mergeProgress);

        // Sync clip states
        if (job.scenes && Array.isArray(job.scenes)) {
          setClips((prev) =>
            prev.map((c, i) => {
              const js = job.scenes[i];
              if (!js) return c;
              return {
                ...c,
                videoProgress: js.videoProgress ?? c.videoProgress,
                videoDone: js.videoDone ?? c.videoDone,
                videoUrl: js.videoUrl || c.videoUrl,
                error: js.error || c.error,
              };
            })
          );
        }

        // Deduplicate logs
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

        // Handle completion
        if (job.status === "done" && job.finalVideoUrl) {
          setFinalVideoUrl(job.finalVideoUrl);
          setFinalVideoUrls(job.finalVideoUrls || []);
          setPipelineStep(3);
          setCombineProgress(100);
          setIsRunning(false);
          setPipelineError("");
          addLog("Pipeline complete! Podcast video is ready!");
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
        }

        // Handle error
        if (job.status === "error" && !isRunning) {
          setPipelineError(job.error || "Pipeline failed");
          setIsRunning(false);
          addLog("ERROR: " + (job.error || "Pipeline failed"));
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
  }, [addLog]);

  // ─── Run Generation (same dual-channel approach as AI Avatar Machine) ──
  const runGeneration = useCallback(async () => {
    if (!isValid || isRunning) return;

    // Reset
    setIsRunning(true);
    setPipelineStep(1);
    setPipelineError("");
    setFinalVideoUrl("");
    setFinalVideoUrls([]);
    setCombineProgress(0);
    setLogs([]);
    setShowLogs(false);
    lastEventTimeRef.current = Date.now();

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

    // Inactivity timeout watcher (same as AI Avatar Machine)
    inactivityTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastEventTimeRef.current) / 1000;
      if (elapsed > 300) { // 5 minutes no updates
        addLog("WARNING: No progress update for 5 minutes. Connection may have been lost.");
      }
    }, 30000) as unknown as ReturnType<typeof setTimeout>;

    try {
      const res = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          char1ImageUrl,
          char2ImageUrl,
          char1Dialogues: d1,
          char2Dialogues: d2,
          kieApiKey: isAdmin ? kieApiKey.trim() : "",
          falApiKey: isAdmin ? falApiKey.trim() : "",
        }),
      });

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedTerminal = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6).trim());
            lastEventTimeRef.current = Date.now();

            switch (event.type) {
              case "ping":
                // Heartbeat — ignore
                break;

              case "started":
                addLog("Pipeline started (job: " + (event.jobId || "unknown") + ")");
                if (event.jobId) {
                  currentJobIdRef.current = event.jobId;
                  startStatusPolling(event.jobId);
                }
                break;

              case "progress":
                setPipelineStep(event.step || 1);
                if (event.step === 2 && event.pct !== undefined) {
                  setCombineProgress(event.pct);
                }
                if (event.message) addLog(event.message);
                break;

              case "video_error":
                addLog(`Video ${event.index} failed: ${event.error}`);
                setClips((prev) =>
                  prev.map((c) => c.index === event.index ? { ...c, error: event.error || "Failed" } : c)
                );
                break;

              case "merge_error":
                addLog("Merge failed: " + event.error);
                break;

              case "done":
                receivedTerminal = true;
                setPipelineStep(3);
                setCombineProgress(100);
                addLog("Podcast complete!");
                if (event.videoUrl) setFinalVideoUrl(event.videoUrl);
                if (event.videoUrls) setFinalVideoUrls(event.videoUrls);
                if (event.individualVideos) {
                  setFinalVideoUrls(event.individualVideos);
                }
                setIsRunning(false);
                setPipelineError("");
                // Stop polling
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                break;

              case "error":
                receivedTerminal = true;
                setPipelineError(event.message || "Generation failed");
                setIsRunning(false);
                addLog("ERROR: " + (event.message || "Generation failed"));
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                break;
            }
          } catch {
            // Ignore malformed SSE
          }
        }
      }

      // If stream ended without terminal event — polling will handle it
      if (!receivedTerminal && pollIntervalRef.current) {
        addLog("SSE stream ended — status polling continues tracking...");
        return;
      }

      if (!receivedTerminal && !pollIntervalRef.current) {
        setPipelineError("Connection to server was lost");
        setIsRunning(false);
        addLog("ERROR: SSE stream ended without result and no polling active");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "AbortError") {
        setPipelineError(msg);
        setIsRunning(false);
        addLog("ERROR: " + msg);
      }
    } finally {
      if (abortRef.current) { abortRef.current = null; }
      if (inactivityTimerRef.current) { clearInterval(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    }
  }, [isValid, isRunning, char1ImageUrl, char2ImageUrl, char1Dialogues, char2Dialogues, isAdmin, kieApiKey, falApiKey, addLog, startStatusPolling]);

  // ─── Reset ───────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setIsRunning(false);
    setPipelineStep(0);
    setPipelineError("");
    setFinalVideoUrl("");
    setFinalVideoUrls("");
    setCombineProgress(0);
    setLogs([]);
    setClips([]);
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
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
                  kie.ai API Key
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
                  fal.ai API Key
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
        {isRunning && clips.length > 0 && pipelineStep === 1 && (
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
                      <p className="text-[10px]" style={{ color: "#EF4444" }}>Failed: {clip.error}</p>
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

              <div className="max-w-lg mx-auto mb-6">
                <div className="rounded-2xl overflow-hidden border-2 shadow-lg" style={{ borderColor: C.pink }}>
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
                  download={`podcast-video-${Date.now()}.mp4`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: C.dark, color: C.white }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Video
                </a>
                <button
                  onClick={resetAll}
                  className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer border-2 hover:bg-gray-50"
                  style={{ borderColor: "#E5E7EB", color: C.textMuted }}
                >
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
      </main>
    </div>
  );
}
