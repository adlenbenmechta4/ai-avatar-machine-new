"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  loadVideosFromStorage,
  deleteVideoFromStorage,
  updateVideoUrlInStorage,
  type StoredVideo,
} from "@/lib/video-store";

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  lime: "#9AFF01",
  pink: "#E461AD",
  cyan: "#16B1DE",
  gold: "#C9A96E",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E7EB",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface VideoItem {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: string | null;
  scenesCount: number;
  provider: string;
  createdAt: string;
}

type FilterTab = "all" | "avatar" | "video" | "podcast" | "carousel";

interface UnifiedLibraryProps {
  onBack: () => void;
  onEditVideo: (videoUrl: string) => void;
  onCaptionVideo: (videoUrl: string, videoId: string) => void;
  theme?: string;
}

// ─── Provider Helpers ───────────────────────────────────────────────────────

function getProviderLabel(provider: string): string {
  switch (provider) {
    case "kie": return "AI Avatar";
    case "heygen": return "HeyGen";
    case "avatar": return "Avatar";
    case "podcast": return "Podcast";
    case "carousel": return "Carousel";
    default: return provider;
  }
}

function getProviderCategory(provider: string): FilterTab {
  if (provider === "podcast") return "podcast";
  if (provider === "avatar") return "avatar";
  if (provider === "carousel") return "carousel";
  return "video";
}

function getProviderColor(provider: string): string {
  switch (provider) {
    case "kie": return C.pink;
    case "heygen": return C.cyan;
    case "avatar": return C.cyan;
    case "podcast": return C.gold;
    case "carousel": return C.lime;
    default: return C.pink;
  }
}

function getProviderAspect(provider: string): string {
  if (provider === "podcast") return "16/9";
  if (provider === "carousel") return "1/1";
  return "9/16";
}

// ─── Video Modal ─────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
}: {
  video: VideoItem;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const isImage = video.provider === "avatar" || video.provider === "carousel";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden mx-auto"
        style={{ backgroundColor: "#000", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", color: C.white }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex items-center justify-center min-h-[300px]">
          {isImage ? (
            <img src={video.videoUrl} alt={video.title} className="w-full h-auto max-h-[80vh] object-contain" />
          ) : (
            <video
              ref={videoRef}
              src={video.videoUrl}
              controls
              autoPlay
              className="w-full"
              playsInline
            />
          )}
        </div>

        {/* Info bar */}
        <div className="px-4 py-3" style={{ backgroundColor: "#111" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{video.title}</p>
              <p className="text-[10px] text-gray-400">
                {getProviderLabel(video.provider)} &middot; {new Date(video.createdAt).toLocaleDateString()}
              </p>
            </div>
            {!isImage && (
              <a
                href={video.videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-105 cursor-pointer"
                style={{ backgroundColor: C.pink, color: C.white }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video Card Component ───────────────────────────────────────────────────

function VideoCard({
  video,
  onDelete,
  onPlay,
  onEdit,
  onCaption,
}: {
  video: VideoItem;
  onDelete: (id: string) => void;
  onPlay: (video: VideoItem) => void;
  onEdit?: (video: VideoItem) => void;
  onCaption?: (video: VideoItem) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    onDelete(video.id);
  }, [isDeleting, onDelete, video.id]);

  const formattedDate = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isImage = video.provider === "avatar" || video.provider === "carousel";
  const providerColor = getProviderColor(video.provider);
  const aspect = getProviderAspect(video.provider);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
      style={{
        borderColor: C.cardBorder,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = providerColor;
        e.currentTarget.style.boxShadow = `0 8px 30px ${providerColor}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.cardBorder;
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{ backgroundColor: "#111", aspectRatio: aspect }}
        onClick={() => onPlay(video)}
      >
        {isImage ? (
          <img src={video.videoUrl} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <video src={video.videoUrl} className="w-full h-full object-cover" preload="metadata" playsInline />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Center play icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isImage ? (
            <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-115" style={{ backgroundColor: "rgba(22, 177, 222, 0.9)", boxShadow: "0 4px 20px rgba(22, 177, 222, 0.4)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-115" style={{ backgroundColor: "rgba(228, 97, 173, 0.9)", boxShadow: "0 4px 20px rgba(228, 97, 173, 0.4)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Provider badge */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: providerColor, color: C.white }}
        >
          {getProviderLabel(video.provider)}
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: C.white }}>
            {video.duration}
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "rgba(239,68,68,0.85)", color: C.white }}
          title="Delete"
        >
          {isDeleting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 p-3"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
          >
            <div
              className="rounded-2xl p-4 text-center max-w-[180px]"
              style={{ backgroundColor: C.white, border: "2px solid #FECACA" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <p className="text-xs font-bold mb-3" style={{ color: C.text }}>Delete this item?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                  style={{ backgroundColor: "#F3F4F6", color: C.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-white cursor-pointer"
                  style={{ backgroundColor: "#EF4444" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-2.5" style={{ backgroundColor: C.cardBg }}>
        <p className="text-[11px] font-bold truncate mb-0.5" style={{ color: C.text }}>{video.title}</p>
        <p className="text-[9px]" style={{ color: C.textMuted }}>{formattedDate}</p>

        {/* Edit/Caption actions */}
        {!isImage && (onEdit || onCaption) && (
          <div className="relative w-full mt-1.5">
            <button
              onClick={() => setShowEditMenu(!showEditMenu)}
              className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: providerColor, color: C.white }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
            {showEditMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-20" style={{ backgroundColor: C.cardBg, border: "1.5px solid #E5E7EB", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                  {onEdit && (
                    <button
                      onClick={() => { setShowEditMenu(false); onEdit(video); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:bg-gray-50"
                      style={{ color: C.text }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Video Editor
                    </button>
                  )}
                  {onCaption && (
                    <button
                      onClick={() => { setShowEditMenu(false); onCaption(video); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:bg-gray-50"
                      style={{ color: C.text, borderTop: onEdit ? "1px solid #F3F4F6" : "none" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      Add Captions
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter Tabs ────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "grid" },
  { key: "avatar", label: "Avatar", icon: "user" },
  { key: "video", label: "AI Video", icon: "video" },
  { key: "podcast", label: "Podcast", icon: "mic" },
  { key: "carousel", label: "Carousel", icon: "images" },
];

// ─── Main Unified Library Component ─────────────────────────────────────────

export default function UnifiedVideoLibrary({ onBack, onEditVideo, onCaptionVideo, theme }: UnifiedLibraryProps) {
  const { user, authFetch } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const userEmail = user?.email || "";
      const localVideos: VideoItem[] = userEmail
        ? loadVideosFromStorage(userEmail).map((v: StoredVideo) => ({
            id: v.id,
            title: v.title,
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl,
            duration: v.duration,
            scenesCount: v.scenesCount,
            provider: v.provider,
            createdAt: v.createdAt,
          }))
        : [];

      // Also try API videos
      let apiVideos: VideoItem[] = [];
      if (authFetch) {
        try {
          const res = await authFetch("/api/videos");
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              apiVideos = data.map((v: StoredVideo) => ({
                id: v.id,
                title: v.title,
                videoUrl: v.videoUrl,
                thumbnailUrl: v.thumbnailUrl,
                duration: v.duration,
                scenesCount: v.scenesCount,
                provider: v.provider || "kie",
                createdAt: v.createdAt,
              }));
            }
          }
        } catch {
          // API not available, use localStorage only
        }
      }

      // Merge (deduplicate by videoUrl)
      const apiUrls = new Set(apiVideos.map((v) => v.videoUrl));
      const uniqueLocals = localVideos.filter((v) => !apiUrls.has(v.videoUrl));
      const merged = [...apiVideos, ...uniqueLocals];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setVideos(merged);
    } catch {
      setError("Failed to load your library");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = useCallback(
    (videoId: string) => {
      const userEmail = user?.email || "";
      if (userEmail) deleteVideoFromStorage(userEmail, videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    },
    [user]
  );

  const handleCaptionClose = useCallback(
    (captionedUrl?: string) => {
      if (captionedUrl && playingVideo) {
        const userEmail = user?.email || "";
        if (userEmail) updateVideoUrlInStorage(userEmail, playingVideo.id, captionedUrl);
        setVideos((prev) =>
          prev.map((v) => (v.id === playingVideo.id ? { ...v, videoUrl: captionedUrl } : v))
        );
      }
      setPlayingVideo(null);
    },
    [user, playingVideo]
  );

  // Filter videos
  const filteredVideos = activeFilter === "all"
    ? videos
    : videos.filter((v) => getProviderCategory(v.provider) === activeFilter);

  // Counts
  const counts: Record<FilterTab, number> = {
    all: videos.length,
    avatar: videos.filter((v) => getProviderCategory(v.provider) === "avatar").length,
    video: videos.filter((v) => getProviderCategory(v.provider) === "video").length,
    podcast: videos.filter((v) => getProviderCategory(v.provider) === "podcast").length,
    carousel: videos.filter((v) => getProviderCategory(v.provider) === "carousel").length,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F9FB" }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ backgroundColor: C.white, borderBottom: "1px solid #F3F4F6" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
            style={{ backgroundColor: "#F3F4F6", color: C.text }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke={C.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight" style={{ color: C.text }}>
              My Library
            </h1>
            <p className="text-[10px]" style={{ color: C.textMuted }}>
              {videos.length} item{videos.length !== 1 ? "s" : ""} across all machines
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchVideos}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "#F3F4F6", color: C.textMuted }}
          title="Refresh"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* ─── Filter Tabs ───────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3" style={{ backgroundColor: C.white }}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = counts[tab.key];
            if (tab.key !== "all" && count === 0) return null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive ? C.dark : "#F3F4F6",
                  color: isActive ? C.white : C.textMuted,
                }}
              >
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#E5E7EB",
                    color: isActive ? C.white : C.textMuted,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Content ───────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 rounded-full animate-spin mb-3" style={{ borderColor: `${C.pink}30`, borderTopColor: C.pink }} />
            <p className="text-xs font-bold" style={{ color: C.textMuted }}>Loading your library...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-md mx-auto p-4 rounded-xl text-center" style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
            <p className="text-xs font-bold" style={{ color: "#DC2626" }}>{error}</p>
            <button
              onClick={fetchVideos}
              className="mt-2 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase cursor-pointer"
              style={{ backgroundColor: "#DC2626", color: C.white }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${C.pink}15` }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.pink} strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621-.504-1.125-1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621.504 1.125 1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 12.75 6 12.246 6 11.625v-1.5" />
              </svg>
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: C.text }}>
              {activeFilter === "all" ? "Your library is empty" : `No ${activeFilter} items found`}
            </p>
            <p className="text-xs" style={{ color: C.textMuted }}>
              Create videos from any machine and they will appear here
            </p>
            <button
              onClick={onBack}
              className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer transition-all hover:scale-[1.02]"
              style={{ backgroundColor: C.pink, color: C.white, boxShadow: "0 4px 16px rgba(228,97,173,0.3)" }}
            >
              Create Something
            </button>
          </div>
        )}

        {/* Video Grid */}
        {!loading && !error && filteredVideos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onDelete={handleDelete}
                onPlay={setPlayingVideo}
                onEdit={onEditVideo ? (v) => onEditVideo(v.videoUrl) : undefined}
                onCaption={onCaptionVideo ? (v) => onCaptionVideo(v.videoUrl, v.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Video Modal ───────────────────────────────────────── */}
      {playingVideo && (
        <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </div>
  );
}
