import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have expired (jobs are kept for 60 minutes)." }, { status: 404 });
  }
  return NextResponse.json(job);
}
