"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BOFProduct {
  id: string;
  name: string;
  imageUrl: string;
}

interface BOFVideo {
  id: string;
  productId: string;
  productName: string;
  workflowType: WorkflowType;
  scenePreset: string;
  sceneImageUrl: string;
  videoUrl: string;
  status: "pending" | "uploading" | "generating_scene" | "generating_video" | "done" | "error" | "cancelled";
  progress: number;
  error: string;
  createdAt: string;
}

type WorkflowType = "intro-video-ai" | "warehouse-showcase" | "standard-bof" | "overlay-studio";
type TabView = "create" | "products" | "library";

interface BOFVideosMachineProps {
  isAdmin?: boolean;
  theme?: string;
  onBack?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY = "#0075FD";
const BG = "#0A0A0F";
const CARD_BG = "#14141F";
const CARD_HOVER = "#1A1A2E";
const BORDER = "#2A2A3E";
const T1 = "#F1F1F5";
const T2 = "#8B8BA3";
const T3 = "#5A5A72";
const ACCENT_PURPLE = "#8B5CF6";
const ACCENT_GREEN = "#10B981";
const ACCENT_ORANGE = "#F59E0B";
const ACCENT_PINK = "#EC4899";

const WORKFLOW_TYPES: { id: WorkflowType; name: string; tag: string; tagColor: string; desc: string; icon: string }[] = [
  {
    id: "intro-video-ai",
    name: "Intro Video + AI",
    tag: "Hybrid",
    tagColor: ACCENT_PURPLE,
    desc: "Add an intro clip, generate AI product footage, then combine them into TikTok-ready videos.",
    icon: "🎬",
  },
  {
    id: "warehouse-showcase",
    name: "Store to Home",
    tag: "AI Generated",
    tagColor: ACCENT_ORANGE,
    desc: "Generates an 8-second video showcasing your products in a warehouse setting with voiceover.",
    icon: "🏭",
  },
  {
    id: "standard-bof",
    name: "Standard BOF",
    tag: "AI Generated",
    tagColor: ACCENT_GREEN,
    desc: "Select products and create AI-generated TikTok-ready product videos.",
    icon: "⚡",
  },
  {
    id: "overlay-studio",
    name: "Overlay Studio",
    tag: "Real Footage",
    tagColor: ACCENT_PINK,
    desc: "Upload short clips, pick an overlay, and get all clips back with the overlay burned in.",
    icon: "🎨",
  },
];

const SCENE_PRESETS = [
  { id: "custom", name: "Custom Prompt", emoji: "✏️", desc: "Write your own scene prompt" },
  { id: "kitchen-counter", name: "Kitchen Counter", emoji: "🍳", desc: "Modern kitchen with warm lighting" },
  { id: "bathroom-counter", name: "Bathroom Counter", emoji: "🚿", desc: "Clean bathroom with marble surfaces" },
  { id: "bedroom-nightstand", name: "Bedroom Nightstand", emoji: "🛏️", desc: "Cozy bedroom with warm lamp light" },
  { id: "living-room", name: "Living Room", emoji: "🛋️", desc: "Coffee table with natural window light" },
  { id: "office-desk", name: "Office Desk", emoji: "💻", desc: "Professional workspace setting" },
  { id: "outdoor-patio", name: "Outdoor Patio", emoji: "🌿", desc: "Fresh outdoor atmosphere" },
  { id: "vanity-mirror", name: "Vanity Mirror", emoji: "💄", desc: "Beauty setup with ring light" },
  { id: "gym-bench", name: "Gym Bench", emoji: "🏋️", desc: "Dynamic athletic environment" },
];

const VIDEO_MODELS = [
  { id: "veo3_lite", name: "Veo 3 Lite", desc: "~8s, slower" },
  { id: "veo3_fast", name: "Veo 3 Fast", desc: "~8s, faster" },
  { id: "sora_2", name: "Sora 2", desc: "~8s, high quality" },
];

const DURATION_OPTIONS = [
  { id: "3s", label: "3s", credits: 100 },
  { id: "7s", label: "7s", credits: 200 },
  { id: "11s", label: "11s", credits: 300 },
];

// Store to Home scripts (2-scene format matching BatchBot)
const WAREHOUSE_SCRIPTS = [
  { id: "script-1", name: "Script 1", text: "This was literally double the price in-store / I couldn't believe how much they were charging / I found the exact same [Product Name] way cheaper on TikTok Shop / tap below before it sells out" },
  { id: "script-2", name: "Script 2", text: "SORRY to anyone who / recently got the / [Product Name] / cause it just went on a / massive sale w/ free / shipping..." },
  { id: "custom", name: "Custom Script", text: "" },
];

// Store to Home overlay text options (first 4s, like BatchBot)
const WAREHOUSE_OVERLAY_TEXTS = [
  { id: "none", name: "None", text: "" },
  { id: "insane-deal", name: "INSANE DEAL", text: "INSANE [Product Name] DEAL!!!" },
  { id: "product-deal", name: "DEAL", text: "[Product Name] DEAL!" },
  { id: "on-sale", name: "On Sale", text: "[Product Name] on sale!" },
  { id: "custom-overlay", name: "Custom", text: "" },
];

// Voice narration options (like BatchBot)
const VOICE_OPTIONS = [
  { id: "none", name: "None", icon: "🔇", desc: "No voiceover" },
  { id: "kristen", name: "Kristen", icon: "🎤", desc: "Warm & Friendly" },
  { id: "emma", name: "Emma", icon: "🎙️", desc: "Clear & Bright" },
  { id: "kelly", name: "Kelly", icon: "📢", desc: "Bold & Energetic" },
];

// Quality options (like BatchBot)
const QUALITY_OPTIONS = [
  { id: "standard", name: "Standard", desc: "Good quality, faster" },
  { id: "high", name: "High", desc: "Best quality, slower" },
];

// Overlay Studio & Intro Video + AI scripts (Scripts 3-8 + Custom)
const OVERLAY_SCRIPTS = [
  { id: "script-3", name: "Script 3", text: "If you waited until / today you absolutely / won because the / [Product Name] / is dirt cheap rn / with free shipping" },
  { id: "script-4", name: "Script 4", text: "Anyone else grabbing / a boatload of the / [Product Name] / today since it's a / fraction of the price?" },
  { id: "script-5", name: "Script 5", text: "When a company is / rebranding so / [Product Name] / is on a massive sale / to clear out stock" },
  { id: "script-6", name: "Script 6", text: "TikTok bullied the price / down and now the / [Product Name] / is on a massive sale with / free shipping for the / next few hours..." },
  { id: "script-7", name: "Script 7", text: "Someone fcked up / at TikTok cus today the / [Product Name] / is on a triple discount / with free shipping..." },
  { id: "script-8", name: "Script 8", text: "When the company / massivley overproduceed the / [Product Name] / and now it is dirt cheap with / free shipping to clear some / stock!" },
  { id: "custom", name: "Custom Script", text: "" },
];

// Hook video options for Intro Video + AI pipeline
const HOOK_VIDEO_OPTIONS = [
  { id: "none", name: "No Hook", emoji: "🚫", desc: "Skip hook video" },
  { id: "hook-1", name: "Hook 1", emoji: "🎬", desc: "Preset hook video 1", src: "/hooks/hook-1.mp4" },
  { id: "hook-2", name: "Hook 2", emoji: "🎥", desc: "Preset hook video 2", src: "/hooks/hook-2.mp4" },
  { id: "hook-3", name: "Hook 3", emoji: "🔥", desc: "Preset hook video 3", src: "/hooks/hook-3.mp4" },
  { id: "hook-4", name: "Hook 4", emoji: "⚡", desc: "Preset hook video 4", src: "/hooks/hook-4.mp4" },
  { id: "hook-5", name: "Hook 5", emoji: "💥", desc: "Preset hook video 5", src: "/hooks/hook-5.mp4" },
  { id: "custom", name: "Custom Upload", emoji: "📤", desc: "Upload your own hook video" },
];

// Standard BOF image overlays
const IMAGE_OVERLAYS = [
  { id: "none", name: "No Overlay", icon: "🚫" },
  { id: "triple-discount", name: "Triple Discount", icon: "🏷️" },
  { id: "50off", name: "50% OFF", icon: "💰" },
  { id: "full-price", name: "~~Full Price~~", icon: "💲" },
];

// Audio options for Standard BOF
const AUDIO_OPTIONS = [
  { id: "none", name: "No Audio", icon: "🔇" },
  { id: "double-discount", name: "Double Discount", icon: "🔊" },
  { id: "last-day", name: "Today is the Last Day", icon: "📢" },
  { id: "triple-discount", name: "Triple Discount", icon: "🔔" },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BOFVideosMachine({
  isAdmin = false,
  theme = "dark",
  onBack,
}: BOFVideosMachineProps) {
  const { user, authFetch } = useAuth();
  const userEmail = user?.email || "guest";

  // ── View State ──
  const [tab, setTab] = useState<TabView>("create");
  const [workflowType, setWorkflowType] = useState<WorkflowType>("intro-video-ai");
  const [scenePreset, setScenePreset] = useState("kitchen-counter");
  const [customPrompt, setCustomPrompt] = useState("");
  const [videoModel, setVideoModel] = useState("veo3_lite");
  const [duration, setDuration] = useState("7s");
  const [reversePlayback, setReversePlayback] = useState(false);
  const [textOverlay, setTextOverlay] = useState(true);
  const [overlayScript, setOverlayScript] = useState("script-1"); // for warehouse
  const [overlayScriptOverlay, setOverlayScriptOverlay] = useState("script-3"); // for overlay studio/intro
  const [overlayPosition, setOverlayPosition] = useState<"top" | "center">("center");
  const [overlaySize, setOverlaySize] = useState(100); // 40-100, step 5
  const [customOverlayText, setCustomOverlayText] = useState("");
  const [selectedImageOverlay, setSelectedImageOverlay] = useState("none"); // for standard BOF
  const [selectedAudio, setSelectedAudio] = useState("none"); // for standard BOF
  const [videosPerProduct, setVideosPerProduct] = useState(1);
  const [warehouseOverlayText, setWarehouseOverlayText] = useState("insane-deal"); // overlay text for warehouse
  const [warehouseCustomOverlayText, setWarehouseCustomOverlayText] = useState(""); // custom overlay text for warehouse
  const [selectedVoice, setSelectedVoice] = useState("none"); // voice narration
  const [selectedQuality, setSelectedQuality] = useState("standard"); // video quality
  const [selectedHookVideo, setSelectedHookVideo] = useState("none"); // hook video for intro
  const [customHookVideo, setCustomHookVideo] = useState(""); // base64 of custom hook video

  // ── Products ──
  const [products, setProducts] = useState<BOFProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductImage, setNewProductImage] = useState("");

  // ── Videos ──
  const [videos, setVideos] = useState<BOFVideo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(new Set());

  // ── localStorage ──
  const PROD_KEY = `bof_prod_${userEmail.toLowerCase().trim()}`;
  const VID_KEY = `bof_vid_${userEmail.toLowerCase().trim()}`;

  useEffect(() => {
    try {
      const sp = localStorage.getItem(PROD_KEY);
      if (sp) setProducts(JSON.parse(sp));
      const sv = localStorage.getItem(VID_KEY);
      if (sv) {
        const parsed: BOFVideo[] = JSON.parse(sv);
        // Auto-mark stuck videos as cancelled (they were in processing state when page reloaded)
        const cleaned = parsed.map((v) =>
          ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)
            ? { ...v, status: "cancelled" as const, error: "Session ended — video was interrupted" }
            : v
        );
        setVideos(cleaned);
      }
    } catch {}
  }, [PROD_KEY, VID_KEY]);

  useEffect(() => {
    try { localStorage.setItem(PROD_KEY, JSON.stringify(products)); } catch {}
  }, [products, PROD_KEY]);

  useEffect(() => {
    try { localStorage.setItem(VID_KEY, JSON.stringify(videos)); } catch {}
  }, [videos, VID_KEY]);

  // ── Product Management ──
  const addProduct = useCallback(() => {
    if (!newProductName.trim() || !newProductImage) return;
    const newId = uid();
    setProducts((prev) => [...prev, { id: newId, name: newProductName.trim(), imageUrl: newProductImage }]);
    setSelectedProductIds((prev) => new Set(prev).add(newId));
    setNewProductName("");
    setNewProductImage("");
    setShowAddProduct(false);
  }, [newProductName, newProductImage]);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSelectedProductIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewProductImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  // ── Generation Pipeline ──
  const startGeneration = useCallback(async () => {
    if (selectedProductIds.size === 0) return;

    setIsGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const selectedProds = products.filter((p) => selectedProductIds.has(p.id));

    const newVideos: BOFVideo[] = selectedProds.flatMap((p) =>
      Array.from({ length: videosPerProduct }, (_, i) => ({
        id: uid(),
        productId: p.id,
        productName: p.name,
        workflowType,
        scenePreset,
        sceneImageUrl: "",
        videoUrl: "",
        status: "pending" as const,
        progress: 0,
        error: "",
        createdAt: new Date().toISOString(),
      }))
    );

    setVideos((prev) => [...newVideos, ...prev]);

    for (const video of newVideos) {
      if (controller.signal.aborted || cancelledIdsRef.current.has(video.id)) {
        // Mark as cancelled if individually cancelled
        if (cancelledIdsRef.current.has(video.id)) {
          setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "cancelled", error: "Cancelled by user" } : v));
        }
        continue;
      }
      const product = selectedProds.find((p) => p.id === video.productId)!;

      try {
        setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "uploading", progress: 5 } : v));

        // Prepare hook video data (fetch preset or use custom upload)
        let hookVideoBase64 = "";
        if (workflowType === "intro-video-ai" && selectedHookVideo !== "none") {
          if (selectedHookVideo === "custom" && customHookVideo) {
            hookVideoBase64 = customHookVideo;
          } else {
            const hookOption = HOOK_VIDEO_OPTIONS.find((h) => h.id === selectedHookVideo);
            if (hookOption?.src) {
              try {
                const hookRes = await fetch(hookOption.src);
                const hookBlob = await hookRes.blob();
                hookVideoBase64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(hookBlob);
                });
              } catch (hookErr) {
                console.error("Failed to load hook video:", hookErr);
              }
            }
          }
        }

        const res = await authFetch("/api/bof-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            productImage: product.imageUrl,
            scenePreset,
            customPrompt,
            videoModel,
            workflowType,
            duration,
            reversePlayback,
            textOverlay,
            overlayScript: workflowType === "warehouse-showcase" ? overlayScript : overlayScriptOverlay,
            overlayPosition,
            overlaySize,
            customOverlayText,
            selectedImageOverlay,
            selectedAudio,
            productName: product.name,
            warehouseOverlayText,
            warehouseCustomOverlayText,
            selectedVoice,
            selectedQuality,
            hookVideo: hookVideoBase64,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `Server error (${res.status})`);

        // Check if this video was cancelled while processing
        if (cancelledIdsRef.current.has(video.id)) {
          setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "cancelled", error: "Cancelled by user" } : v));
        } else {
          setVideos((prev) =>
            prev.map((v) =>
              v.id === video.id
                ? { ...v, status: "done", progress: 100, sceneImageUrl: data.sceneImageUrl || "", videoUrl: data.videoUrl }
                : v
            )
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("aborted") || msg.includes("cancelled")) {
          // Mark remaining pending videos as cancelled on abort
          setVideos((prev) => prev.map((v) =>
            ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)
              ? { ...v, status: "cancelled", error: "Cancelled by user" }
              : v
          ));
          break;
        }
        // Skip if this video was individually cancelled
        if (cancelledIdsRef.current.has(video.id)) continue;
        setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "error", error: msg, progress: 0 } : v));
      }
    }

    setIsGenerating(false);
    abortRef.current = null;
    cancelledIdsRef.current.clear();
  }, [selectedProductIds, products, scenePreset, customPrompt, videoModel, workflowType, duration, reversePlayback, textOverlay, overlayScript, overlayScriptOverlay, overlayPosition, overlaySize, customOverlayText, selectedImageOverlay, selectedAudio, videosPerProduct, warehouseOverlayText, warehouseCustomOverlayText, selectedVoice, selectedQuality, selectedHookVideo, customHookVideo, authFetch]);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    // Mark all pending/processing videos as cancelled
    setVideos((prev) =>
      prev.map((v) =>
        ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)
          ? { ...v, status: "cancelled", error: "Cancelled by user" }
          : v
      )
    );
    setIsGenerating(false);
  }, []);

  const cancelSingleVideo = useCallback((videoId: string) => {
    cancelledIdsRef.current.add(videoId);
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId && ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)
          ? { ...v, status: "cancelled", error: "Cancelled by user" }
          : v
      )
    );
  }, []);

  const deleteVideo = useCallback((id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const clearCancelledVideos = useCallback(() => {
    setVideos((prev) => prev.filter((v) => v.status !== "cancelled"));
  }, []);

  const stuckCount = videos.filter((v) => ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)).length;
  const cancelledCount = videos.filter((v) => v.status === "cancelled").length;

  const doneCount = videos.filter((v) => v.status === "done").length;

  const statusLabel = (s: BOFVideo["status"]) => {
    switch (s) {
      case "pending": return "Queued";
      case "uploading": return "Uploading image...";
      case "generating_scene": return "Creating scene...";
      case "generating_video": return "Generating video...";
      case "done": return "Done";
      case "error": return "Error";
      case "cancelled": return "Cancelled";
    }
  };

  const statusColor = (s: BOFVideo["status"]) => {
    switch (s) {
      case "pending": return T3;
      case "uploading": return ACCENT_ORANGE;
      case "generating_scene": return ACCENT_PURPLE;
      case "generating_video": return PRIMARY;
      case "done": return ACCENT_GREEN;
      case "error": return "#EF4444";
      case "cancelled": return T3;
    }
  };

  const workflowInfo = WORKFLOW_TYPES.find((w) => w.id === workflowType)!;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: BG, fontFamily: "Inter, sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: PRIMARY }}>B</div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: T1 }}>BOF Videos</h1>
              <p className="text-[10px]" style={{ color: T3 }}>AI Product Videos</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {([
            { key: "create" as TabView, label: "Create", icon: "✨" },
            { key: "products" as TabView, label: "Products", icon: "📦" },
            { key: "library" as TabView, label: "Library", icon: "🎬" },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: tab === item.key ? `${PRIMARY}20` : "transparent",
                color: tab === item.key ? PRIMARY : T2,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">🎬</span>
            <span className="text-xs font-semibold" style={{ color: T1 }}>{doneCount} videos</span>
          </div>
          {onBack && (
            <button onClick={onBack} className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium border cursor-pointer" style={{ borderColor: BORDER, color: T2, backgroundColor: CARD_BG }}>
              ← Back
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">

          {/* ─── CREATE TAB ─── */}
          {tab === "create" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold" style={{ color: T1 }}>Create</h2>
                <p className="text-sm mt-1" style={{ color: T2 }}>Choose a workflow and generate professional product videos</p>
              </div>

              {/* ── Workflow Selector (like batchbot template cards) ── */}
              <div className="grid grid-cols-4 gap-3">
                {WORKFLOW_TYPES.map((wf) => (
                  <button
                    key={wf.id}
                    onClick={() => setWorkflowType(wf.id)}
                    className="rounded-xl border-2 p-4 text-left cursor-pointer transition-all group"
                    style={{
                      borderColor: workflowType === wf.id ? wf.tagColor : BORDER,
                      backgroundColor: workflowType === wf.id ? `${wf.tagColor}10` : CARD_BG,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{wf.icon}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${wf.tagColor}20`, color: wf.tagColor }}>{wf.tag}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: workflowType === wf.id ? T1 : T2 }}>{wf.name}</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: T3 }}>{wf.desc}</p>
                  </button>
                ))}
              </div>

              {/* ── Workflow-specific Settings ── */}
              {workflowType === "intro-video-ai" && (
                <div className="space-y-4">
                  {/* Scene Presets */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Scene</h3>
                    <p className="text-xs mb-4" style={{ color: T3 }}>Your product will be placed in this environment</p>
                    <div className="grid grid-cols-3 gap-2">
                      {SCENE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setScenePreset(preset.id)}
                          className="rounded-lg border-2 p-2.5 text-left cursor-pointer transition-all"
                          style={{
                            borderColor: scenePreset === preset.id ? PRIMARY : BORDER,
                            backgroundColor: scenePreset === preset.id ? `${PRIMARY}10` : CARD_BG,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{preset.emoji}</span>
                            <div>
                              <p className="text-xs font-medium" style={{ color: scenePreset === preset.id ? PRIMARY : T1 }}>{preset.name}</p>
                              <p className="text-[10px]" style={{ color: T3 }}>{preset.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {scenePreset === "custom" && (
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Describe the scene where your product should be placed..."
                        className="mt-3 w-full h-24 p-3 rounded-xl border text-sm resize-none"
                        style={{ borderColor: BORDER, color: T1, backgroundColor: CARD_BG, outlineColor: PRIMARY }}
                      />
                    )}
                  </div>

                  {/* Duration & Model */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border p-4" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <h3 className="text-xs font-semibold mb-2" style={{ color: T1 }}>Duration</h3>
                      <div className="flex gap-2">
                        {DURATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setDuration(opt.id)}
                            className="flex-1 rounded-lg border-2 p-2 text-center cursor-pointer transition-all"
                            style={{
                              borderColor: duration === opt.id ? PRIMARY : BORDER,
                              backgroundColor: duration === opt.id ? `${PRIMARY}10` : CARD_BG,
                            }}
                          >
                            <p className="text-sm font-semibold" style={{ color: duration === opt.id ? PRIMARY : T1 }}>{opt.label}</p>
                            <p className="text-[10px]" style={{ color: T3 }}>{opt.credits} credits</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border p-4" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <h3 className="text-xs font-semibold mb-2" style={{ color: T1 }}>Video Model</h3>
                      <div className="space-y-1.5">
                        {VIDEO_MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setVideoModel(m.id)}
                            className="w-full rounded-lg border-2 px-3 py-1.5 text-left cursor-pointer transition-all flex items-center justify-between"
                            style={{
                              borderColor: videoModel === m.id ? PRIMARY : BORDER,
                              backgroundColor: videoModel === m.id ? `${PRIMARY}10` : CARD_BG,
                            }}
                          >
                            <span className="text-xs font-medium" style={{ color: videoModel === m.id ? PRIMARY : T1 }}>{m.name}</span>
                            <span className="text-[10px]" style={{ color: T3 }}>{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hook Video for Intro Video + AI */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold" style={{ color: T1 }}>Hook Video</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${ACCENT_GREEN}20`, color: ACCENT_GREEN }}>Optional</span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: T3 }}>Add a short hook clip before your AI-generated video</p>
                    <div className="grid grid-cols-2 gap-2">
                      {HOOK_VIDEO_OPTIONS.map((hook) => (
                        <button
                          key={hook.id}
                          onClick={() => setSelectedHookVideo(hook.id)}
                          className="rounded-lg border-2 p-2.5 text-left cursor-pointer transition-all"
                          style={{
                            borderColor: selectedHookVideo === hook.id ? ACCENT_GREEN : BORDER,
                            backgroundColor: selectedHookVideo === hook.id ? `${ACCENT_GREEN}10` : CARD_BG,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{hook.emoji}</span>
                            <div>
                              <p className="text-xs font-medium" style={{ color: selectedHookVideo === hook.id ? ACCENT_GREEN : T1 }}>{hook.name}</p>
                              <p className="text-[10px]" style={{ color: T3 }}>{hook.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedHookVideo === "custom" && (
                      <div className="mt-3">
                        <label className="w-full cursor-pointer block">
                          <div className="rounded-xl border-2 border-dashed p-4 text-center transition-all hover:border-blue-400" style={{ borderColor: BORDER }}>
                            <span className="text-2xl block mb-1">📤</span>
                            <p className="text-xs font-medium" style={{ color: T1 }}>Upload Hook Video</p>
                            <p className="text-[10px]" style={{ color: T3 }}>MP4, 9:16 vertical recommended</p>
                          </div>
                          <input
                            type="file"
                            accept="video/mp4,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setCustomHookVideo(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {customHookVideo && (
                          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${ACCENT_GREEN}10` }}>
                            <span className="text-sm">✅</span>
                            <p className="text-xs font-medium" style={{ color: ACCENT_GREEN }}>Custom hook video loaded</p>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedHookVideo.startsWith("hook-") && (
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${ACCENT_GREEN}10` }}>
                        <span className="text-sm">🎬</span>
                        <p className="text-xs font-medium" style={{ color: ACCENT_GREEN }}>
                          {HOOK_VIDEO_OPTIONS.find((h) => h.id === selectedHookVideo)?.name || "Hook"} will play before your AI video
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Text Overlay for Intro Video + AI */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: T1 }}>Text Overlay</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${ACCENT_PURPLE}20`, color: ACCENT_PURPLE }}>Intro + AI</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={textOverlay} onChange={(e) => setTextOverlay(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                        <span className="text-xs font-medium" style={{ color: textOverlay ? ACCENT_GREEN : T3 }}>{textOverlay ? "On" : "Off"}</span>
                      </label>
                    </div>
                    <p className="text-xs mb-2" style={{ color: T3 }}>Add text overlay to your AI-generated video</p>
                    <p className="text-[10px] mb-4 px-2 py-1 rounded-md" style={{ color: ACCENT_PURPLE, backgroundColor: `${ACCENT_PURPLE}10` }}>Text overlay is burned into the AI-generated video</p>

                    {textOverlay && (
                      <div className="space-y-4">
                        {/* Script Selector */}
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Script</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {OVERLAY_SCRIPTS.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setOverlayScriptOverlay(s.id)}
                                className="px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                  borderColor: overlayScriptOverlay === s.id ? ACCENT_PURPLE : BORDER,
                                  backgroundColor: overlayScriptOverlay === s.id ? `${ACCENT_PURPLE}15` : CARD_BG,
                                  color: overlayScriptOverlay === s.id ? ACCENT_PURPLE : T1,
                                }}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Text */}
                        {overlayScriptOverlay === "custom" && (
                          <textarea
                            value={customOverlayText}
                            onChange={(e) => setCustomOverlayText(e.target.value)}
                            placeholder="Write your custom overlay text... Use [Product Name] as placeholder"
                            className="w-full h-20 p-3 rounded-xl border text-xs resize-none"
                            style={{ borderColor: BORDER, color: T1, backgroundColor: BG, outlineColor: ACCENT_PURPLE }}
                          />
                        )}

                        {/* Preview */}
                        {overlayScriptOverlay !== "custom" && (
                          <div>
                            <label className="text-xs font-medium block mb-1.5" style={{ color: T2 }}>Preview</label>
                            <div className="p-3 rounded-lg border" style={{ borderColor: BORDER, backgroundColor: BG }}>
                              <p className="text-xs leading-relaxed" style={{ color: T2 }}>
                                {OVERLAY_SCRIPTS.find((s) => s.id === overlayScriptOverlay)?.text.split(" / ").map((part, i) => {
                                  if (part.includes("[Product Name]")) {
                                    const segments = part.split("[Product Name]");
                                    return (
                                      <span key={i}>
                                        {i > 0 && <br />}
                                        {segments.map((seg, j) => (
                                          <span key={j}>
                                            {seg}
                                            {j < segments.length - 1 && (
                                              <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${ACCENT_PURPLE}30`, color: ACCENT_PURPLE }}>[Product Name]</span>
                                            )}
                                          </span>
                                        ))}
                                      </span>
                                    );
                                  }
                                  return <span key={i}>{i > 0 && <br />}{part}</span>;
                                })}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Position & Size */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Position</label>
                            <div className="flex gap-2">
                              {(["top", "center"] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => setOverlayPosition(pos)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium capitalize cursor-pointer transition-all"
                                  style={{
                                    borderColor: overlayPosition === pos ? ACCENT_PURPLE : BORDER,
                                    backgroundColor: overlayPosition === pos ? `${ACCENT_PURPLE}15` : CARD_BG,
                                    color: overlayPosition === pos ? ACCENT_PURPLE : T1,
                                  }}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>
                              Size <span style={{ color: ACCENT_PURPLE }}>{overlaySize}%</span>
                            </label>
                            <input
                              type="range"
                              min={40}
                              max={100}
                              step={5}
                              value={overlaySize}
                              onChange={(e) => setOverlaySize(Number(e.target.value))}
                              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: ACCENT_PURPLE, backgroundColor: BORDER }}
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px]" style={{ color: T3 }}>40%</span>
                              <span className="text-[10px]" style={{ color: T3 }}>100%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workflowType === "warehouse-showcase" && (
                <div className="space-y-4">
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Store to Home Settings</h3>
                    <p className="text-xs mb-4" style={{ color: T3 }}>8-second warehouse-style product video with voiceover and overlay text</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: T2 }}>Videos per product</label>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setVideosPerProduct(Math.max(1, videosPerProduct - 1))} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm cursor-pointer" style={{ borderColor: BORDER, color: T1, backgroundColor: CARD_BG }}>-</button>
                          <span className="text-sm font-semibold" style={{ color: T1 }}>{videosPerProduct}</span>
                          <button onClick={() => setVideosPerProduct(videosPerProduct + 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm cursor-pointer" style={{ borderColor: BORDER, color: T1, backgroundColor: CARD_BG }}>+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: T2 }}>AI video quality</label>
                        <div className="flex gap-2">
                          {QUALITY_OPTIONS.map((q) => (
                            <button
                              key={q.id}
                              onClick={() => setSelectedQuality(q.id)}
                              className="flex-1 rounded-lg border-2 p-2 text-center cursor-pointer transition-all"
                              style={{
                                borderColor: selectedQuality === q.id ? ACCENT_ORANGE : BORDER,
                                backgroundColor: selectedQuality === q.id ? `${ACCENT_ORANGE}10` : CARD_BG,
                              }}
                            >
                              <p className="text-xs font-semibold" style={{ color: selectedQuality === q.id ? ACCENT_ORANGE : T1 }}>{q.name}</p>
                              <p className="text-[10px]" style={{ color: T3 }}>{q.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={reversePlayback} onChange={(e) => setReversePlayback(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                        <div>
                          <span className="text-xs font-medium" style={{ color: T1 }}>Reverse playback</span>
                          <span className="text-[10px] ml-1" style={{ color: T3 }}>Play video in reverse</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Script Selector (2-scene format) */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Script</h3>
                    <p className="text-xs mb-3" style={{ color: T3 }}>Choose a voiceover script for your video</p>
                    <div className="flex gap-2 flex-wrap">
                      {WAREHOUSE_SCRIPTS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setOverlayScript(s.id)}
                          className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all"
                          style={{
                            borderColor: overlayScript === s.id ? ACCENT_ORANGE : BORDER,
                            backgroundColor: overlayScript === s.id ? `${ACCENT_ORANGE}15` : CARD_BG,
                            color: overlayScript === s.id ? ACCENT_ORANGE : T1,
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>

                    {/* Custom Script */}
                    {overlayScript === "custom" && (
                      <textarea
                        value={customOverlayText}
                        onChange={(e) => setCustomOverlayText(e.target.value)}
                        placeholder="Write your custom script... Use [Product Name] as placeholder. Use / to separate lines."
                        className="mt-3 w-full h-20 p-3 rounded-xl border text-xs resize-none"
                        style={{ borderColor: BORDER, color: T1, backgroundColor: BG, outlineColor: ACCENT_ORANGE }}
                      />
                    )}

                    {/* Script Preview */}
                    {overlayScript !== "custom" && (
                      <div className="mt-3">
                        <label className="text-[10px] font-medium block mb-1" style={{ color: T3 }}>Preview</label>
                        <div className="p-3 rounded-lg border" style={{ borderColor: BORDER, backgroundColor: BG }}>
                          <p className="text-xs leading-relaxed" style={{ color: T2 }}>
                            {WAREHOUSE_SCRIPTS.find((s) => s.id === overlayScript)?.text.split(" / ").map((part, i) => {
                              if (part.includes("[Product Name]")) {
                                const segments = part.split("[Product Name]");
                                return (
                                  <span key={i}>
                                    {i > 0 && <br />}
                                    {segments.map((seg, j) => (
                                      <span key={j}>
                                        {seg}
                                        {j < segments.length - 1 && (
                                          <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${ACCENT_ORANGE}30`, color: ACCENT_ORANGE }}>[Product Name]</span>
                                        )}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }
                              return <span key={i}>{i > 0 && <br />}{part}</span>;
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Narrator Voice */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Narrator Voice</h3>
                    <p className="text-xs mb-3" style={{ color: T3 }}>Choose a voice for the video narration</p>
                    <div className="grid grid-cols-4 gap-2">
                      {VOICE_OPTIONS.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVoice(v.id)}
                          className="rounded-lg border-2 p-3 text-center cursor-pointer transition-all"
                          style={{
                            borderColor: selectedVoice === v.id ? ACCENT_ORANGE : BORDER,
                            backgroundColor: selectedVoice === v.id ? `${ACCENT_ORANGE}10` : CARD_BG,
                          }}
                        >
                          <span className="text-xl block mb-1">{v.icon}</span>
                          <p className="text-xs font-semibold" style={{ color: selectedVoice === v.id ? ACCENT_ORANGE : T1 }}>{v.name}</p>
                          {v.desc && <p className="text-[10px]" style={{ color: T3 }}>{v.desc}</p>}
                        </button>
                      ))}
                    </div>
                    {selectedVoice !== "none" && (
                      <p className="text-[10px] mt-2 px-2 py-1 rounded-md" style={{ color: ACCENT_ORANGE, backgroundColor: `${ACCENT_ORANGE}10` }}>
                        Voice narration will be added in a future update. Currently generating text overlay only.
                      </p>
                    )}
                  </div>

                  {/* Overlay Text (first 4s, like BatchBot) */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: T1 }}>Overlay Text</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${ACCENT_ORANGE}20`, color: ACCENT_ORANGE }}>First 4s</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={textOverlay} onChange={(e) => setTextOverlay(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                        <span className="text-xs font-medium" style={{ color: textOverlay ? ACCENT_GREEN : T3 }}>{textOverlay ? "On" : "Off"}</span>
                      </label>
                    </div>
                    <p className="text-xs mb-3" style={{ color: T3 }}>Text overlay shown during the first 4 seconds of video</p>

                    {textOverlay && (
                      <div className="space-y-4">
                        {/* Overlay Text Options */}
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Text Style</label>
                          <div className="flex gap-2 flex-wrap">
                            {WAREHOUSE_OVERLAY_TEXTS.map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setWarehouseOverlayText(o.id)}
                                className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                  borderColor: warehouseOverlayText === o.id ? ACCENT_ORANGE : BORDER,
                                  backgroundColor: warehouseOverlayText === o.id ? `${ACCENT_ORANGE}15` : CARD_BG,
                                  color: warehouseOverlayText === o.id ? ACCENT_ORANGE : T1,
                                }}
                              >
                                {o.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Overlay Text */}
                        {warehouseOverlayText === "custom-overlay" && (
                          <textarea
                            value={warehouseCustomOverlayText}
                            onChange={(e) => setWarehouseCustomOverlayText(e.target.value)}
                            placeholder="Write your custom overlay text... Use [Product Name] as placeholder"
                            className="w-full h-20 p-3 rounded-xl border text-xs resize-none"
                            style={{ borderColor: BORDER, color: T1, backgroundColor: BG, outlineColor: ACCENT_ORANGE }}
                          />
                        )}

                        {/* Preview */}
                        {warehouseOverlayText !== "none" && warehouseOverlayText !== "custom-overlay" && (
                          <div>
                            <label className="text-[10px] font-medium block mb-1" style={{ color: T3 }}>Preview</label>
                            <div className="p-3 rounded-lg border" style={{ borderColor: BORDER, backgroundColor: BG }}>
                              <p className="text-xs font-bold" style={{ color: T1 }}>
                                {WAREHOUSE_OVERLAY_TEXTS.find((o) => o.id === warehouseOverlayText)?.text.split("[Product Name]").map((seg, j, arr) => (
                                  <span key={j}>
                                    {seg}
                                    {j < arr.length - 1 && (
                                      <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${ACCENT_ORANGE}30`, color: ACCENT_ORANGE }}>[Product Name]</span>
                                    )}
                                  </span>
                                ))}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Position & Size */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Position</label>
                            <div className="flex gap-2">
                              {(["top", "center"] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => setOverlayPosition(pos)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium capitalize cursor-pointer transition-all"
                                  style={{
                                    borderColor: overlayPosition === pos ? ACCENT_ORANGE : BORDER,
                                    backgroundColor: overlayPosition === pos ? `${ACCENT_ORANGE}15` : CARD_BG,
                                    color: overlayPosition === pos ? ACCENT_ORANGE : T1,
                                  }}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>
                              Size <span style={{ color: ACCENT_ORANGE }}>{overlaySize}%</span>
                            </label>
                            <input
                              type="range"
                              min={40}
                              max={100}
                              step={5}
                              value={overlaySize}
                              onChange={(e) => setOverlaySize(Number(e.target.value))}
                              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: ACCENT_ORANGE, backgroundColor: BORDER }}
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px]" style={{ color: T3 }}>40%</span>
                              <span className="text-[10px]" style={{ color: T3 }}>100%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workflowType === "standard-bof" && (
                <div className="space-y-4">
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Standard BOF Settings</h3>
                    <p className="text-xs mb-4" style={{ color: T3 }}>Direct product-to-video generation with AI</p>
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: T2 }}>Video Model</label>
                      <div className="flex gap-2">
                        {VIDEO_MODELS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setVideoModel(m.id)}
                            className="flex-1 rounded-lg border-2 p-3 text-center cursor-pointer transition-all"
                            style={{
                              borderColor: videoModel === m.id ? PRIMARY : BORDER,
                              backgroundColor: videoModel === m.id ? `${PRIMARY}10` : CARD_BG,
                            }}
                          >
                            <p className="text-sm font-semibold" style={{ color: videoModel === m.id ? PRIMARY : T1 }}>{m.name}</p>
                            <p className="text-[10px]" style={{ color: T3 }}>{m.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Overlay for Standard BOF */}
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: T1 }}>Overlay</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${ACCENT_GREEN}20`, color: ACCENT_GREEN }}>Standard</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={textOverlay} onChange={(e) => setTextOverlay(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                        <span className="text-xs font-medium" style={{ color: textOverlay ? ACCENT_GREEN : T3 }}>{textOverlay ? "On" : "Off"}</span>
                      </label>
                    </div>
                    <p className="text-xs mb-4" style={{ color: T3 }}>Add image and text overlays to your video</p>

                    {textOverlay && (
                      <div className="space-y-4">
                        {/* Image Overlay Selector */}
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Image Overlay</label>
                          <div className="flex gap-2 flex-wrap">
                            {IMAGE_OVERLAYS.map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setSelectedImageOverlay(o.id)}
                                className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5"
                                style={{
                                  borderColor: selectedImageOverlay === o.id ? ACCENT_GREEN : BORDER,
                                  backgroundColor: selectedImageOverlay === o.id ? `${ACCENT_GREEN}15` : CARD_BG,
                                  color: selectedImageOverlay === o.id ? ACCENT_GREEN : T1,
                                }}
                              >
                                <span>{o.icon}</span>
                                {o.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Script Selector */}
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Text Script</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {OVERLAY_SCRIPTS.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setOverlayScriptOverlay(s.id)}
                                className="px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all"
                                style={{
                                  borderColor: overlayScriptOverlay === s.id ? ACCENT_GREEN : BORDER,
                                  backgroundColor: overlayScriptOverlay === s.id ? `${ACCENT_GREEN}15` : CARD_BG,
                                  color: overlayScriptOverlay === s.id ? ACCENT_GREEN : T1,
                                }}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Text */}
                        {overlayScriptOverlay === "custom" && (
                          <textarea
                            value={customOverlayText}
                            onChange={(e) => setCustomOverlayText(e.target.value)}
                            placeholder="Write your custom overlay text... Use [Product Name] as placeholder"
                            className="w-full h-20 p-3 rounded-xl border text-xs resize-none"
                            style={{ borderColor: BORDER, color: T1, backgroundColor: BG, outlineColor: ACCENT_GREEN }}
                          />
                        )}

                        {/* Preview */}
                        {overlayScriptOverlay !== "custom" && (
                          <div>
                            <label className="text-xs font-medium block mb-1.5" style={{ color: T2 }}>Preview</label>
                            <div className="p-3 rounded-lg border" style={{ borderColor: BORDER, backgroundColor: BG }}>
                              <p className="text-xs leading-relaxed" style={{ color: T2 }}>
                                {OVERLAY_SCRIPTS.find((s) => s.id === overlayScriptOverlay)?.text.split(" / ").map((part, i) => {
                                  if (part.includes("[Product Name]")) {
                                    const segments = part.split("[Product Name]");
                                    return (
                                      <span key={i}>
                                        {i > 0 && <br />}
                                        {segments.map((seg, j) => (
                                          <span key={j}>
                                            {seg}
                                            {j < segments.length - 1 && (
                                              <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `${ACCENT_GREEN}30`, color: ACCENT_GREEN }}>[Product Name]</span>
                                            )}
                                          </span>
                                        ))}
                                      </span>
                                    );
                                  }
                                  return <span key={i}>{i > 0 && <br />}{part}</span>;
                                })}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Position & Size */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Position</label>
                            <div className="flex gap-2">
                              {(["top", "center"] as const).map((pos) => (
                                <button
                                  key={pos}
                                  onClick={() => setOverlayPosition(pos)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium capitalize cursor-pointer transition-all"
                                  style={{
                                    borderColor: overlayPosition === pos ? ACCENT_GREEN : BORDER,
                                    backgroundColor: overlayPosition === pos ? `${ACCENT_GREEN}15` : CARD_BG,
                                    color: overlayPosition === pos ? ACCENT_GREEN : T1,
                                  }}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>
                              Size <span style={{ color: ACCENT_GREEN }}>{overlaySize}%</span>
                            </label>
                            <input
                              type="range"
                              min={40}
                              max={100}
                              step={5}
                              value={overlaySize}
                              onChange={(e) => setOverlaySize(Number(e.target.value))}
                              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: ACCENT_GREEN, backgroundColor: BORDER }}
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px]" style={{ color: T3 }}>40%</span>
                              <span className="text-[10px]" style={{ color: T3 }}>100%</span>
                            </div>
                          </div>
                        </div>

                        {/* Audio Selector */}
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Audio</label>
                          <div className="flex gap-2 flex-wrap">
                            {AUDIO_OPTIONS.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => setSelectedAudio(a.id)}
                                className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5"
                                style={{
                                  borderColor: selectedAudio === a.id ? ACCENT_GREEN : BORDER,
                                  backgroundColor: selectedAudio === a.id ? `${ACCENT_GREEN}15` : CARD_BG,
                                  color: selectedAudio === a.id ? ACCENT_GREEN : T1,
                                }}
                              >
                                <span>{a.icon}</span>
                                {a.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {workflowType === "overlay-studio" && (
                <div className="space-y-4">
                  <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: T1 }}>Overlay Studio</h3>
                    <p className="text-xs mb-4" style={{ color: T3 }}>Upload short clips, pick an overlay, and get all clips back with the overlay burned in. No credits needed.</p>
                    <div className="text-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: BORDER }}>
                      <p className="text-2xl mb-2">🎨</p>
                      <p className="text-sm font-medium" style={{ color: T2 }}>Coming Soon</p>
                      <p className="text-xs mt-1" style={{ color: T3 }}>Overlay Studio is being built. Stay tuned!</p>
                    </div>
                  </div>

                  {/* Overlay Options UI (Coming Soon but showing options) */}
                  <div className="rounded-xl border p-5 opacity-60 pointer-events-none" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold" style={{ color: T1 }}>Overlay Options</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${ACCENT_PINK}20`, color: ACCENT_PINK }}>Preview</span>
                      </div>
                    </div>
                    <p className="text-xs mb-4" style={{ color: T3 }}>These options will be available when Overlay Studio launches</p>

                    <div className="space-y-4">
                      {/* Image Overlay Selector */}
                      <div>
                        <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Image Overlay</label>
                        <div className="flex gap-2 flex-wrap">
                          {IMAGE_OVERLAYS.map((o) => (
                            <button
                              key={o.id}
                              className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium flex items-center gap-1.5"
                              style={{
                                borderColor: selectedImageOverlay === o.id ? ACCENT_PINK : BORDER,
                                backgroundColor: selectedImageOverlay === o.id ? `${ACCENT_PINK}15` : CARD_BG,
                                color: selectedImageOverlay === o.id ? ACCENT_PINK : T1,
                              }}
                            >
                              <span>{o.icon}</span>
                              {o.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Script Selector */}
                      <div>
                        <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Text Script</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {OVERLAY_SCRIPTS.map((s) => (
                            <button
                              key={s.id}
                              className="px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium"
                              style={{
                                borderColor: overlayScriptOverlay === s.id ? ACCENT_PINK : BORDER,
                                backgroundColor: overlayScriptOverlay === s.id ? `${ACCENT_PINK}15` : CARD_BG,
                                color: overlayScriptOverlay === s.id ? ACCENT_PINK : T1,
                              }}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Position & Size */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Position</label>
                          <div className="flex gap-2">
                            {(["top", "center"] as const).map((pos) => (
                              <button
                                key={pos}
                                className="flex-1 px-3 py-1.5 rounded-lg border-2 text-xs font-medium capitalize"
                                style={{
                                  borderColor: overlayPosition === pos ? ACCENT_PINK : BORDER,
                                  backgroundColor: overlayPosition === pos ? `${ACCENT_PINK}15` : CARD_BG,
                                  color: overlayPosition === pos ? ACCENT_PINK : T1,
                                }}
                              >
                                {pos}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>
                            Size <span style={{ color: ACCENT_PINK }}>{overlaySize}%</span>
                          </label>
                          <input
                            type="range"
                            min={40}
                            max={100}
                            step={5}
                            value={overlaySize}
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: ACCENT_PINK, backgroundColor: BORDER }}
                          />
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px]" style={{ color: T3 }}>40%</span>
                            <span className="text-[10px]" style={{ color: T3 }}>100%</span>
                          </div>
                        </div>
                      </div>

                      {/* Audio Selector */}
                      <div>
                        <label className="text-xs font-medium block mb-2" style={{ color: T2 }}>Audio</label>
                        <div className="flex gap-2 flex-wrap">
                          {AUDIO_OPTIONS.map((a) => (
                            <button
                              key={a.id}
                              className="px-3 py-1.5 rounded-lg border-2 text-xs font-medium flex items-center gap-1.5"
                              style={{
                                borderColor: selectedAudio === a.id ? ACCENT_PINK : BORDER,
                                backgroundColor: selectedAudio === a.id ? `${ACCENT_PINK}15` : CARD_BG,
                                color: selectedAudio === a.id ? ACCENT_PINK : T1,
                              }}
                            >
                              <span>{a.icon}</span>
                              {a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Select Products ── */}
              {workflowType !== "overlay-studio" && (
                <div className="rounded-xl border p-5" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: T1 }}>Select Products</h3>
                      <p className="text-xs mt-0.5" style={{ color: T3 }}>Choose which products to generate videos for</p>
                    </div>
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      + Add Product
                    </button>
                  </div>

                  {products.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: BORDER }}>
                      <p className="text-sm" style={{ color: T3 }}>No products yet. Click &quot;+ Add Product&quot; to upload one.</p>
                    </div>
                  ) : (
                    <>
                      {selectedProductIds.size > 0 && (
                        <p className="text-xs font-medium mb-2" style={{ color: PRIMARY }}>
                          ✓ {selectedProductIds.size} product{selectedProductIds.size !== 1 ? "s" : ""} selected
                        </p>
                      )}
                      <div className="grid grid-cols-4 gap-2.5">
                        {products.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => toggleProduct(p.id)}
                            className="relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all"
                            style={{
                              borderColor: selectedProductIds.has(p.id) ? PRIMARY : BORDER,
                              backgroundColor: selectedProductIds.has(p.id) ? `${PRIMARY}08` : CARD_BG,
                            }}
                          >
                            <div className="aspect-square bg-gray-900 flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2" />
                              ) : (
                                <span className="text-2xl">📦</span>
                              )}
                            </div>
                            <div className="p-1.5">
                              <p className="text-[11px] font-medium truncate" style={{ color: T1 }}>{p.name}</p>
                            </div>
                            {selectedProductIds.has(p.id) && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px]" style={{ backgroundColor: PRIMARY }}>✓</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Generate Button ── */}
              {workflowType !== "overlay-studio" && (
                <>
                  <button
                    onClick={startGeneration}
                    disabled={isGenerating || selectedProductIds.size === 0}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: isGenerating ? T3 : PRIMARY }}
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span> Generating...
                      </span>
                    ) : selectedProductIds.size === 0 ? (
                      products.length === 0 ? "Add a product first" : "Select a product above"
                    ) : (
                      `Generate ${selectedProductIds.size * videosPerProduct} Video${selectedProductIds.size * videosPerProduct !== 1 ? "s" : ""}`
                    )}
                  </button>

                  {isGenerating && (() => {
                    const remainingCount = videos.filter(v => ["pending", "uploading", "generating_scene", "generating_video"].includes(v.status)).length;
                    return (
                      <button onClick={cancelGeneration} className="w-full py-2.5 rounded-xl text-xs font-semibold border-2 cursor-pointer transition-all hover:bg-red-500/10" style={{ borderColor: "#EF4444", color: "#EF4444", backgroundColor: "transparent" }}>
                        Cancel All ({remainingCount} remaining)
                      </button>
                    );
                  })()}
                </>
              )}

              {/* ── Pipeline Info ── */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                <p className="text-xs font-semibold mb-2" style={{ color: T1 }}>Pipeline</p>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: T3 }}>
                  {workflowType === "intro-video-ai" ? (
                    <>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${T3}15`, color: T2 }}>Upload</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_PURPLE}15`, color: ACCENT_PURPLE }}>Scene Image</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>Video</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_GREEN}15`, color: ACCENT_GREEN }}>Done!</span>
                    </>
                  ) : workflowType === "warehouse-showcase" ? (
                    <>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${T3}15`, color: T2 }}>Upload</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_ORANGE}15`, color: ACCENT_ORANGE }}>Store Scene</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>8s Video</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_ORANGE}15`, color: ACCENT_ORANGE }}>Overlay</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_GREEN}15`, color: ACCENT_GREEN }}>Done!</span>
                    </>
                  ) : (
                    <>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${T3}15`, color: T2 }}>Upload</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${ACCENT_GREEN}15`, color: ACCENT_GREEN }}>AI Video</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>Done!</span>
                    </>
                  )}
                </div>
              </div>

              {/* ── Recent Results ── */}
              {videos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold" style={{ color: T1 }}>Recent Videos</h3>
                    {cancelledCount > 0 && (
                      <button onClick={clearCancelledVideos} className="text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer" style={{ backgroundColor: `${T3}15`, color: T3, border: `1px solid ${BORDER}` }}>
                        Clear {cancelledCount} cancelled
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {videos.slice(0, 6).map((v) => (
                      <div key={v.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                        <div className="aspect-video bg-black flex items-center justify-center relative">
                          {v.status === "done" && v.videoUrl ? (
                            <video src={v.videoUrl} className="w-full h-full object-contain" controls />
                          ) : ["generating_scene", "generating_video", "uploading", "pending"].includes(v.status) ? (
                            <div className="text-center">
                              <div className="animate-spin text-2xl mb-1">⏳</div>
                              <p className="text-xs font-medium" style={{ color: statusColor(v.status) }}>{statusLabel(v.status)}</p>
                            </div>
                          ) : v.status === "error" ? (
                            <div className="text-center p-3">
                              <p className="text-xs font-medium" style={{ color: "#EF4444" }}>❌ Failed</p>
                              <p className="text-[10px] mt-1" style={{ color: T3 }}>{v.error.length > 80 ? v.error.slice(0, 80) + "..." : v.error}</p>
                            </div>
                          ) : v.status === "cancelled" ? (
                            <div className="text-center p-3">
                              <p className="text-xs font-medium" style={{ color: T3 }}>🚫 Cancelled</p>
                            </div>
                          ) : null}
                        </div>
                        <div className="p-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium" style={{ color: T1 }}>{v.productName}</p>
                            <p className="text-[10px]" style={{ color: T3 }}>
                              {WORKFLOW_TYPES.find((w) => w.id === v.workflowType)?.name}
                            </p>
                          </div>
                          {v.status === "done" ? (
                            <div className="flex items-center gap-1.5">
                              <a href={v.videoUrl} target="_blank" rel="noopener" className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>
                                View
                              </a>
                              <button onClick={() => deleteVideo(v.id)} className="text-xs px-2 py-1 rounded-md" style={{ color: T3 }}>✕</button>
                            </div>
                          ) : ["generating_scene", "generating_video", "uploading", "pending"].includes(v.status) ? (
                            <button onClick={() => cancelSingleVideo(v.id)} className="text-xs px-2.5 py-1 rounded-lg font-medium cursor-pointer" style={{ backgroundColor: `${"#EF4444"}15`, color: "#EF4444", border: `1px solid ${"#EF4444"}40` }}>
                              Cancel
                            </button>
                          ) : v.status === "cancelled" || v.status === "error" ? (
                            <button onClick={() => deleteVideo(v.id)} className="text-xs px-2 py-1 rounded-md" style={{ color: T3 }}>✕</button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── PRODUCTS TAB ─── */}
          {tab === "products" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: T1 }}>Products</h2>
                <button onClick={() => setShowAddProduct(true)} className="px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer" style={{ backgroundColor: PRIMARY }}>
                  + Add Product
                </button>
              </div>

              {products.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-xl" style={{ borderColor: BORDER }}>
                  <p className="text-2xl mb-2">📦</p>
                  <p className="text-sm" style={{ color: T3 }}>No products yet. Add your first product to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((p) => (
                    <div key={p.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                      <div className="w-16 h-16 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-xl">📦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: T1 }}>{p.name}</p>
                      </div>
                      <button onClick={() => deleteProduct(p.id)} className="text-xs px-2 py-1 rounded-md" style={{ color: "#EF4444" }}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── LIBRARY TAB ─── */}
          {tab === "library" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold" style={{ color: T1 }}>Video Library</h2>

              {videos.filter((v) => v.status === "done").length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-xl" style={{ borderColor: BORDER }}>
                  <p className="text-2xl mb-2">🎬</p>
                  <p className="text-sm" style={{ color: T3 }}>No videos yet. Generate your first video in the Create tab.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {videos
                    .filter((v) => v.status === "done")
                    .map((v) => (
                      <div key={v.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
                        <div className="aspect-video bg-black">
                          <video src={v.videoUrl} className="w-full h-full object-contain" controls />
                        </div>
                        <div className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium" style={{ color: T1 }}>{v.productName}</p>
                            <p className="text-xs" style={{ color: T3 }}>
                              {WORKFLOW_TYPES.find((w) => w.id === v.workflowType)?.icon}{" "}
                              {WORKFLOW_TYPES.find((w) => w.id === v.workflowType)?.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={v.videoUrl} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: PRIMARY, color: "#FFF" }}>
                              Download
                            </a>
                            <button onClick={() => deleteVideo(v.id)} className="text-xs" style={{ color: T3 }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── Add Product Modal ─── */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-2xl border p-6 w-full max-w-md" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: T1 }}>Add Product</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: T2 }}>Product Name</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g., Tarte Shape Tape Concealer"
                  className="w-full px-3 py-2 rounded-xl border text-sm"
                  style={{ borderColor: BORDER, color: T1, backgroundColor: BG }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: T2 }}>Product Image</label>
                {!newProductImage ? (
                  <label className="block w-full h-40 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer" style={{ borderColor: BORDER }}>
                    <div className="text-center">
                      <p className="text-2xl mb-1">📷</p>
                      <p className="text-xs" style={{ color: T3 }}>Click to upload product image</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={newProductImage} alt="Product" className="w-full h-40 object-contain rounded-xl bg-gray-900 p-2" />
                    <button
                      onClick={() => setNewProductImage("")}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddProduct(false); setNewProductName(""); setNewProductImage(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border cursor-pointer"
                style={{ borderColor: BORDER, color: T2, backgroundColor: CARD_BG }}
              >
                Cancel
              </button>
              <button
                onClick={addProduct}
                disabled={!newProductName.trim() || !newProductImage}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
