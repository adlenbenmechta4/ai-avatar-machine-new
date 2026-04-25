// ─── Client-side Video Library Persistence (localStorage) ────────────────
// Videos are stored per-user, keyed by email, so they persist across
// refresh, login/logout, and page navigation — all on the same browser.

export interface StoredVideo {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: string | null;
  scenesCount: number;
  provider: string;
  createdAt: string;
}

const STORAGE_PREFIX = "video_library_";

/**
 * Get the localStorage key for a given user email.
 */
function getKey(email: string): string {
  return `${STORAGE_PREFIX}${email.toLowerCase().trim()}`;
}

/**
 * Save a video to the user's localStorage library.
 */
export function saveVideoToStorage(email: string, video: StoredVideo): void {
  if (typeof window === "undefined") return;
  try {
    const key = getKey(email);
    const existing = loadVideosFromStorage(email);
    // Don't add duplicates (check by videoUrl)
    const alreadyExists = existing.some((v) => v.videoUrl === video.videoUrl);
    if (alreadyExists) return;
    // Prepend (newest first)
    const updated = [video, ...existing];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn("[video-store] Failed to save video:", err);
  }
}

/**
 * Load all videos from the user's localStorage library.
 */
export function loadVideosFromStorage(email: string): StoredVideo[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getKey(email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn("[video-store] Failed to load videos:", err);
    return [];
  }
}

/**
 * Delete a video from the user's localStorage library by ID.
 */
export function deleteVideoFromStorage(email: string, videoId: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getKey(email);
    const existing = loadVideosFromStorage(email);
    const updated = existing.filter((v) => v.id !== videoId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn("[video-store] Failed to delete video:", err);
  }
}

/**
 * Update a video's URL in localStorage by ID.
 * Used when captions are added to a video — the captioned URL replaces the original.
 */
export function updateVideoUrlInStorage(email: string, videoId: string, newUrl: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getKey(email);
    const existing = loadVideosFromStorage(email);
    const updated = existing.map((v) => (v.id === videoId ? { ...v, videoUrl: newUrl } : v));
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn("[video-store] Failed to update video URL:", err);
  }
}

/**
 * Merge API videos with localStorage videos (deduplicate by id).
 * When the same video exists in both API and localStorage, the localStorage
 * version takes precedence because it may have an updated URL (e.g. after captions).
 */
export function mergeVideos(apiVideos: StoredVideo[], localVideos: StoredVideo[]): StoredVideo[] {
  const apiIds = new Set(apiVideos.map((v) => v.id));
  // Build a map of local videos by id (most recent first in array)
  const localById = new Map<string, StoredVideo>();
  for (const v of localVideos) {
    if (!localById.has(v.id)) localById.set(v.id, v);
  }
  // Keep API videos that DON'T exist in localStorage
  const uniqueApis = apiVideos.filter((v) => !localById.has(v.id));
  // Combine: local versions (have precedence) + API-only videos
  const merged = [...Array.from(localById.values()), ...uniqueApis];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}
