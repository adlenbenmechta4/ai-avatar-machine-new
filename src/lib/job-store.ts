// ─── In-Memory Job Store for Background Pipeline ─────────────────────
export interface SceneState {
  frameProgress: number;
  frameDone: boolean;
  videoProgress: number;
  videoDone: boolean;
  frameUrl: string;
  videoUrl: string;
  error: string;
  taskId: string;   // KIE video taskId — avoid duplicate submissions on retry
  frameTaskId: string; // KIE frame taskId — avoid duplicate submissions on retry
}

export interface JobState {
  id: string;
  userId: string;     // Owner of this job — prevents cross-user data mixing
  status: "running" | "done" | "error";
  step: number;        // 0=upload, 1=frames/avatar, 2=videos, 3=merge, 4=done
  message: string;
  scenes: SceneState[];
  mergeProgress: number;
  finalVideoUrl: string;
  finalFrameUrls: string[];
  finalVideoUrls: string[];
  error: string;
  createdAt: number;
  updatedAt: number;
  logs: string[];
  provider: string;    // "kie" or "heygen"
}

const jobs = new Map<string, JobState>();

// Note: On Vercel serverless, jobs are per-instance and won't persist across cold starts.
// The SSE streaming is the primary communication channel; this store is for /api/status fallback.
// Cleanup is handled on read (lazy cleanup below).

export function createJob(id: string, sceneCount: number, provider: string, userId: string = "anonymous"): JobState {
  const job: JobState = {
    id,
    userId,
    status: "running",
    step: 0,
    message: "Starting pipeline...",
    scenes: Array.from({ length: sceneCount }, () => ({
      frameProgress: 0, frameDone: false, videoProgress: 0, videoDone: false,
      frameUrl: "", videoUrl: "", error: "", taskId: "", frameTaskId: "",
    })),
    mergeProgress: 0,
    finalVideoUrl: "",
    finalFrameUrls: [],
    finalVideoUrls: [],
    error: "",
    logs: [],
    provider,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string, requestingUserId?: string): JobState | undefined {
  // Lazy cleanup: remove jobs older than 60 minutes
  const now = Date.now();
  for (const [jobId, job] of jobs) {
    if (now - job.createdAt > 60 * 60 * 1000) {
      jobs.delete(jobId);
    }
  }
  const job = jobs.get(id);
  // Security: verify requesting user owns this job
  if (job && requestingUserId && job.userId && job.userId !== "anonymous" && requestingUserId !== job.userId) {
    return undefined; // Don't expose another user's job
  }
  return job;
}

export function updateJob(id: string, update: Partial<JobState>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, update, { updatedAt: Date.now() });
}

export function updateScene(id: string, index: number, update: Partial<SceneState>): void {
  const job = jobs.get(id);
  if (!job || !job.scenes[index]) return;
  Object.assign(job.scenes[index], update);
  job.updatedAt = Date.now();
}

export function setJobError(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.error = error;
  job.updatedAt = Date.now();
}

export function setJobDone(id: string, finalVideoUrl: string, frameUrls: string[], videoUrls: string[]): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.step = 4;
  job.message = "Video ready!";
  job.finalVideoUrl = finalVideoUrl;
  job.finalFrameUrls = frameUrls;
  job.finalVideoUrls = videoUrls;
  job.mergeProgress = 100;
  job.updatedAt = Date.now();
}

export function addJobLog(id: string, msg: string): void {
  const job = jobs.get(id);
  if (!job) return;
  const ts = new Date().toLocaleTimeString();
  job.logs.push(`[${ts}] ${msg}`);
  // Keep max 200 logs to prevent memory issues
  if (job.logs.length > 200) {
    job.logs = job.logs.slice(-150);
  }
  job.updatedAt = Date.now();
}
