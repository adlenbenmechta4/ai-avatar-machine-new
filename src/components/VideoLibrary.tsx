"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  saveVideoToStorage,
  loadVideosFromStorage,
  deleteVideoFromStorage,
  mergeVideos,
  type StoredVideo,
} from "@/lib/video-store";

// ─── Colors (matching AIAvatarMachine) ────────────────────────────────────────

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
};

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

// ─── Video Modal ─────────────────────────────────────────────────────────────

function VideoModal({
  video,
  onClose,
  theme,
}: {
  video: VideoItem;
  onClose: () => void;
  theme?: string;
}) {
  const T = theme === "dark" ? DC : C;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden mx-auto"
        style={{ backgroundColor: "#000", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", color: T.white }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content: Image or Video */}
        {video.provider === "avatar" ? (
          <img
            src={video.videoUrl}
            alt={video.title}
            className="w-full"
            style={{ maxHeight: "80vh", objectFit: "contain" }}
          />
        ) : (
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            autoPlay
            className="w-full aspect-[9/16]"
            playsInline
            style={{ maxHeight: "80vh", objectFit: "contain" }}
          />
        )}

        {/* Bottom info bar */}
        <div className="flex items-center justify-between p-4" style={{ backgroundColor: "#111" }}>
          <div>
            <h3 className="font-bold text-sm text-white truncate" style={{ maxWidth: "300px" }} title={video.title}>
              {video.title}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
              {video.provider === "avatar" ? "AI Avatar Image" : video.provider === "heygen" ? "HeyGen Avatar" : "Multi-Scene Video"}
              {video.duration ? ` · ${video.duration}` : ""}
              {video.scenesCount > 1 ? ` · ${video.scenesCount} scenes` : ""}
            </p>
          </div>
          <a
            href={video.videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{ backgroundColor: video.provider === "avatar" ? T.cyan : T.pink, color: T.white }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Video Card Component ────────────────────────────────────────────────────

function VideoCard({
  video,
  onDelete,
  onPlay,
  onCaption,
  theme,
}: {
  video: VideoItem;
  onDelete: (id: string) => void;
  onPlay: (video: VideoItem) => void;
  onCaption?: (video: VideoItem) => void;
  theme?: string;
}) {
  const T = theme === "dark" ? DC : C;
  const isDark = theme === "dark";
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

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const formattedDate = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
      style={{
        borderColor: T.cardBorder,
        boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.pink;
        e.currentTarget.style.boxShadow = `0 8px 30px ${T.pink}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.cardBorder;
        e.currentTarget.style.boxShadow = isDark ? "0 1px 3px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04)";
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[9/16] overflow-hidden cursor-pointer mx-auto"
        style={{ backgroundColor: "#111", maxWidth: "220px" }}
        onClick={() => onPlay(video)}
      >
        {video.provider === "avatar" ? (
          <img
            src={video.videoUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={video.videoUrl}
            className="w-full h-full object-cover"
            preload="metadata"
            playsInline
          />
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Center icon (avatar vs video) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {video.provider === "avatar" ? (
            <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-115" style={{ backgroundColor: "rgba(22, 177, 222, 0.9)", boxShadow: "0 4px 20px rgba(22, 177, 222, 0.4)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" stroke="white" strokeWidth="2" fill="none" />
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
          style={{
            backgroundColor: video.provider === "avatar" ? T.cyan : video.provider === "heygen" ? T.cyan : T.pink,
            color: T.white,
          }}
        >
          {video.provider === "avatar" ? "Avatar" : video.provider === "heygen" ? "HeyGen" : "Video"}
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div
            className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold"
            style={{ backgroundColor: "rgba(0,0,0,0.7)", color: T.white }}
          >
            {video.duration}
          </div>
        )}

        {/* Delete button - always visible */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
          style={{
            backgroundColor: "rgba(239,68,68,0.85)",
            color: T.white,
          }}
          title="Delete video"
        >
          {isDeleting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 p-3"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { e.stopPropagation(); cancelDelete(); }}
          >
            <div
              className="rounded-2xl p-4 text-center max-w-[180px]"
              style={{ backgroundColor: isDark ? "#1A1A1A" : "#FFFFFF", border: "2px solid #FECACA" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-xs font-bold mb-1" style={{ color: isDark ? "#FCA5A5" : "#991B1B" }}>Delete Video?</p>
              <p className="text-[10px] mb-3" style={{ color: T.textMuted }}>This cannot be undone</p>
              <div className="flex gap-2">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: T.cardBorder, color: T.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "#DC2626", color: "#FFF" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info + Actions */}
      <div className="p-3 sm:p-4" style={{ backgroundColor: T.cardBg }}>
        <h3
          className="font-bold text-sm truncate mb-2"
          style={{ color: T.text }}
          title={video.title}
        >
          {video.title}
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: T.textMuted }}>
            {formattedDate}
          </span>
          {video.scenesCount > 1 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: T.lightBlue, color: T.cyan }}
            >
              {video.scenesCount} scenes
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <a
            href={video.videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap"
            style={{ backgroundColor: T.dark, color: T.white }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </a>
          {video.provider !== "avatar" && (
            <button
              onClick={() => onPlay(video)}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: T.pink, color: T.white }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
          )}
          {video.provider === "avatar" && (
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap"
              style={{ backgroundColor: T.cyan, color: T.white }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Full Size
            </a>
          )}
          {onCaption && video.provider !== "avatar" && (
            <div className="w-full relative">
              <button
                onClick={() => setShowEditMenu(!showEditMenu)}
                className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: T.lime, color: T.dark }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                Captions
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ transform: showEditMenu ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showEditMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-20" style={{ backgroundColor: T.cardBg, border: `1.5px solid ${T.cardBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                    <button
                      onClick={() => { setShowEditMenu(false); onCaption(video); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:bg-gray-50"
                      style={{ color: T.text }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      Add Captions
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main VideoLibrary Component ─────────────────────────────────────────────

interface VideoLibraryProps {
  onViewCreate?: () => void;
  onCaptionVideo?: (videoUrl: string, videoId: string) => void;
  theme?: string;
}

export default function VideoLibrary({ onViewCreate, onCaptionVideo, theme }: VideoLibraryProps) {
  const T = theme === "dark" ? DC : C;
  const isDark = theme === "dark";
  const { authFetch, user } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Always load from localStorage first (persistent, works without DB)
      const userEmail = user?.email || "";
      const localVideos = userEmail ? loadVideosFromStorage(userEmail) : [];

      // Try API as secondary source (works when DB is available)
      let apiVideos: VideoItem[] = [];
      try {
        const res = await authFetch("/api/videos");
        if (res.ok) {
          const data = await res.json();
          apiVideos = (data.videos || []) as VideoItem[];
        }
      } catch {
        // API failed — use localStorage only
      }

      // Merge: API videos + localStorage videos (deduplicated)
      const merged = mergeVideos(apiVideos as StoredVideo[], localVideos as unknown as StoredVideo[]) as unknown as VideoItem[];
      setVideos(merged);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [authFetch, user?.email]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        // Always delete from localStorage
        const userEmail = user?.email || "";
        if (userEmail) deleteVideoFromStorage(userEmail, id);

        // Try API delete (works when DB is available)
        try {
          const res = await authFetch(`/api/videos/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: "Delete failed" }));
            throw new Error(errData.error || "Delete failed");
          }
        } catch {
          // API delete failed — localStorage delete already done, continue
        }

        setVideos((prev) => prev.filter((v) => v.id !== id));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        alert("Failed to delete video: " + msg);
      }
    },
    [authFetch, user?.email]
  );

  return (
    <div>
      {/* Video Modal */}
      {playingVideo && (
        <VideoModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
          theme={theme}
        />
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-xl sm:text-2xl font-black uppercase tracking-wide"
            style={{ color: T.text }}
          >
            My Video Library
          </h2>
          {!loading && videos.length > 0 && (
            <p className="text-xs mt-1" style={{ color: T.textMuted }}>
              {videos.length} video{videos.length !== 1 ? "s" : ""} saved
            </p>
          )}
        </div>
        {onViewCreate && (
          <button
            onClick={onViewCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: T.pink, color: T.white }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Video
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16">
          <div
            className="inline-block w-8 h-8 border-3 rounded-full animate-spin"
            style={{ borderColor: T.cardBorder, borderTopColor: T.pink }}
          />
          <p className="text-sm mt-4" style={{ color: T.textMuted }}>
            Loading your videos...
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: isDark ? "#2D1A1A" : "#FEF2F2", border: "2px solid #FECACA" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>
            Failed to load videos
          </p>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>
            {error}
          </p>
          <button
            onClick={fetchVideos}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all hover:scale-[1.02]"
            style={{ backgroundColor: "#DC2626", color: T.white }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && videos.length === 0 && (
        <div
          className="rounded-[28px] p-1"
          style={{ backgroundColor: T.lightPink }}
        >
          <div
            className="rounded-[24px] p-8 sm:p-12 text-center"
            style={{ backgroundColor: T.cardBg }}
          >
            <div className="text-5xl mb-4">🎬</div>
            <h3
              className="text-lg sm:text-xl font-bold uppercase tracking-wide mb-2"
              style={{ color: T.text }}
            >
              No Videos Yet
            </h3>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: T.textMuted }}>
              Your generated AI avatar videos will appear here. Create your first video to get started!
            </p>
            {onViewCreate && (
              <button
                onClick={onViewCreate}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: T.pink, color: T.white }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Your First Video
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Grid */}
      {!loading && !error && videos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={handleDelete}
              onPlay={setPlayingVideo}
              onCaption={onCaptionVideo ? (v) => onCaptionVideo(v.videoUrl, v.id) : undefined}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}
