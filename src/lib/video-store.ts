// ─── Client-side Video Library Persistence (localStorage) ────────────────
// Videos are stored per-user, keyed by email, so they persist across
// refresh, login/logout, and page navigation — all on the same browser.
//
// IMPORTANT: localStorage is a BACKUP/cache only. The database (via /api/videos)
// is the PRIMARY storage. localStorage ensures videos are still visible
// when the DB is temporarily unavailable.

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
    // Don't add duplicates (check by videoUrl AND id)
    const alreadyExists = existing.some((v) => v.videoUrl === video.videoUrl || v.id === video.id);
    if (alreadyExists) {
      // Update existing entry if we have a DB ID now (replace local_ ID)
      const updated = existing.map((v) =>
        (v.videoUrl === video.videoUrl || v.id === video.id)
          ? { ...v, ...video }
          : v
      );
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }
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
 * Merge API (database) videos with localStorage videos (deduplicate by id AND videoUrl).
 * When the same video exists in both API and localStorage, the API version
 * takes precedence (has the correct DB ID) unless localStorage has a different
 * videoUrl (e.g. after caption update).
 */
export function mergeVideos(apiVideos: StoredVideo[], localVideos: StoredVideo[]): StoredVideo[] {
  // Build a map of API videos by id and by URL (API is primary source)
  const apiById = new Map<string, StoredVideo>();
  const apiByUrl = new Map<string, StoredVideo>();
  for (const v of apiVideos) {
    apiById.set(v.id, v);
    if (v.videoUrl) apiByUrl.set(v.videoUrl, v);
  }

  // Build a map of local videos by URL (for detecting caption-updated URLs)
  const localByUrl = new Map<string, StoredVideo>();
  for (const v of localVideos) {
    if (v.videoUrl) localByUrl.set(v.videoUrl, v);
  }

  // Start with all API videos (they have correct DB IDs)
  const result = new Map<string, StoredVideo>();
  for (const v of apiVideos) {
    result.set(v.id, v);
  }

  // Add local videos that are NOT in API (these are only in localStorage)
  for (const v of localVideos) {
    // Skip if this video's URL already exists in API (same video, already have DB version)
    if (apiByUrl.has(v.videoUrl)) continue;
    // Skip if this video's ID already exists in API
    if (apiById.has(v.id)) continue;
    // This is a local-only video — add it
    result.set(v.id, v);
  }

  // Sort newest first
  const merged = Array.from(result.values());
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}
