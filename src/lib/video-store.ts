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
 * Merge API videos with localStorage videos (deduplicate by videoUrl).
 * API videos take precedence (they have the canonical ID).
 */
export function mergeVideos(apiVideos: StoredVideo[], localVideos: StoredVideo[]): StoredVideo[] {
  const apiUrls = new Set(apiVideos.map((v) => v.videoUrl));
  // Add local videos that are NOT in the API response
  const uniqueLocals = localVideos.filter((v) => !apiUrls.has(v.videoUrl));
  // Combine and sort by createdAt descending
  const merged = [...apiVideos, ...uniqueLocals];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}
