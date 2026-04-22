import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import { getAuthUser } from "@/lib/auth-server";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Verify the requesting user owns this job
  let requestingUserId: string | undefined;
  try {
    const authUser = await getAuthUser(req);
    if (authUser) {
      requestingUserId = authUser.id;
    }
  } catch {
    // If auth fails, proceed without userId check (backward compat)
  }

  const job = getJob(jobId, requestingUserId);
  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have expired (jobs are kept for 60 minutes)." }, { status: 404 });
  }
  return NextResponse.json(job);
}
