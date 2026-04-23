"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  loadVideosFromStorage,
  deleteVideoFromStorage,
  type StoredVideo,
} from "@/lib/video-store";

// ─── Colors (matching PodcastMachineView) ────────────────────────────────

const C = {
  pink: "#E461AD",
  gold: "#C9A96E",
  cyan: "#16B1DE",
  dark: "#0A0A0A",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  lightPink: "#F9E4EE",
  lightCyan: "#E8F8FD",
  white: "#FFFFFF",
  cream: "#FFF8F0",
};

// ─── Types ──────────────────────────────────────────────────────────────

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

interface PodcastVideoLibraryProps {
  user?: { email?: string } | null;
  onViewCreate?: () => void;
  onEditVideo?: (videoUrl: string) => void;
  onCaptionVideo?: (videoUrl: string) => void;
}

// ─── Video Modal ────────────────────────────────────────────────────────

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#000", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", color: C.white }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Video */}
        <video
          ref={videoRef}
          src={video.videoUrl}
          controls
          autoPlay
          className="w-full"
          playsInline
          style={{ maxHeight: "80vh" }}
        />

        {/* Bottom info bar */}
        <div className="flex items-center justify-between p-4" style={{ backgroundColor: "#111" }}>
          <div>
            <h3 className="font-bold text-sm text-white truncate" style={{ maxWidth: "300px" }} title={video.title}>
              {video.title}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
              AI Podcast Video
              {video.duration ? ` · ${video.duration}` : ""}
            </p>
          </div>
          <a
            href={video.videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{ backgroundColor: C.cyan, color: C.white }}
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

// ─── Video Card ──────────────────────────────────────────────────────────

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
        borderColor: "#E5E7EB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.cyan;
        e.currentTarget.style.boxShadow = `0 8px 30px ${C.cyan}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video overflow-hidden cursor-pointer"
        style={{ backgroundColor: "#111" }}
        onClick={() => onPlay(video)}
      >
        <video
          src={video.videoUrl}
          className="w-full h-full object-cover"
          preload="metadata"
          playsInline
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Play icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-115"
            style={{ backgroundColor: "rgba(22, 177, 222, 0.9)", boxShadow: "0 4px 20px rgba(22, 177, 222, 0.4)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Podcast badge */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: C.cyan, color: C.white }}
        >
          Podcast
        </div>

        {/* Delete button - always visible */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "rgba(239,68,68,0.85)", color: C.white }}
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
              style={{ backgroundColor: "#FFFFFF", border: "2px solid #FECACA" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-xs font-bold mb-1" style={{ color: "#991B1B" }}>Delete Video?</p>
              <p className="text-[10px] mb-3" style={{ color: C.textMuted }}>This cannot be undone</p>
              <div className="flex gap-2">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "#E5E7EB", color: C.textMuted }}
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
      <div className="p-3 sm:p-4" style={{ backgroundColor: C.white }}>
        <h3
          className="font-bold text-sm truncate mb-2"
          style={{ color: C.text }}
          title={video.title}
        >
          {video.title}
        </h3>

        <span className="text-xs" style={{ color: C.textMuted }}>
          {formattedDate}
        </span>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <a
            href={video.videoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97]"
            style={{ backgroundColor: C.dark, color: C.white }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </a>
          <button
            onClick={() => onPlay(video)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
            style={{ backgroundColor: C.cyan, color: C.white }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>
          {(onEdit || onCaption) && (
            <div className="relative flex-1">
              <button
                onClick={() => setShowEditMenu(!showEditMenu)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
                style={{ backgroundColor: C.gold, color: C.white }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ transform: showEditMenu ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showEditMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-20" style={{ backgroundColor: C.white, border: "1.5px solid #E5E7EB", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
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
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function PodcastVideoLibrary({ user, onViewCreate, onEditVideo, onCaptionVideo }: PodcastVideoLibraryProps) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  const fetchVideos = useCallback(() => {
    setLoading(true);
    try {
      const userEmail = user?.email || "";
      const allVideos: VideoItem[] = userEmail
        ? loadVideosFromStorage(userEmail)
            .filter((v: StoredVideo) => v.provider === "podcast")
            .map((v: StoredVideo) => ({
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
      setVideos(allVideos);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDelete = useCallback(
    (id: string) => {
      const userEmail = user?.email || "";
      if (userEmail) deleteVideoFromStorage(userEmail, id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    },
    [user?.email]
  );

  return (
    <div>
      {/* Video Modal */}
      {playingVideo && (
        <VideoModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-xl sm:text-2xl font-black uppercase tracking-wide"
            style={{ color: C.text }}
          >
            My Podcast Library
          </h2>
          {!loading && videos.length > 0 && (
            <p className="text-xs mt-1" style={{ color: C.textMuted }}>
              {videos.length} video{videos.length !== 1 ? "s" : ""} saved
            </p>
          )}
        </div>
        {onViewCreate && (
          <button
            onClick={onViewCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: C.cyan, color: C.white }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Podcast
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16">
          <div
            className="inline-block w-8 h-8 border-3 rounded-full animate-spin"
            style={{ borderColor: "#E5E7EB", borderTopColor: C.cyan }}
          />
          <p className="text-sm mt-4" style={{ color: C.textMuted }}>
            Loading your podcast videos...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && videos.length === 0 && (
        <div className="rounded-[28px] p-1" style={{ backgroundColor: C.lightCyan }}>
          <div className="rounded-[24px] p-8 sm:p-12 text-center" style={{ backgroundColor: C.white }}>
            <div className="text-5xl mb-4">🎙️</div>
            <h3
              className="text-lg sm:text-xl font-bold uppercase tracking-wide mb-2"
              style={{ color: C.text }}
            >
              No Podcast Videos Yet
            </h3>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: C.textMuted }}>
              Your generated AI podcast videos will appear here. Create your first podcast to get started!
            </p>
            {onViewCreate && (
              <button
                onClick={onViewCreate}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: C.cyan, color: C.white }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Your First Podcast
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Grid */}
      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={handleDelete}
              onPlay={setPlayingVideo}
              onEdit={onEditVideo ? (video) => onEditVideo(video.videoUrl) : undefined}
              onCaption={onCaptionVideo ? (video) => onCaptionVideo(video.videoUrl) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
