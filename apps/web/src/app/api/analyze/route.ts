import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnalysisAuth, inflightAnalysisJobCount, MAX_INFLIGHT_JOBS_PER_USER } from "@/lib/analysis-security";

export async function POST(request: NextRequest) {
  const guard = await requireAnalysisAuth(request, "analyze:create");
  if (guard.response) return guard.response;

  try {
    const { username, filename } = await request.json();

    if (!username || !filename) {
      return NextResponse.json({ error: "Username and filename are required" }, { status: 400 });
    }

    // Per-user job quota: reject new jobs when the user already has a lot of
    // in-flight (pending/processing) analysis work queued.
    const inflight = await inflightAnalysisJobCount(username);
    if (inflight >= MAX_INFLIGHT_JOBS_PER_USER) {
      return NextResponse.json(
        { error: `Too many in-flight analyses. Wait for existing jobs to finish (limit ${MAX_INFLIGHT_JOBS_PER_USER}).` },
        { status: 429 }
      );
    }

    const existing = await prisma.analysis_jobs.findFirst({
      where: { username, filename, status: "completed" },
      orderBy: { created_at: "desc" },
    });
    if (existing) return NextResponse.json(existing);

    const job = await prisma.analysis_jobs.create({
      data: { username, filename, status: "pending" },
    });

    return NextResponse.json(job);
  } catch (err) {
    console.error("Unexpected error in analysis API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAnalysisAuth(request, "analyze:patch");
  if (guard.response) return guard.response;

  try {
    const { jobId, status, result } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = await prisma.analysis_jobs.update({
      where: { id: jobId },
      data: { status, result: result ?? undefined, updated_at: new Date() },
    });

    return NextResponse.json(job);
  } catch (err) {
    console.error("Unexpected error in PATCH analysis API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAnalysisAuth(request, "analyze:delete");
  if (guard.response) return guard.response;

  try {
    const { username, filename } = await request.json();
    if (!username || !filename) {
      return NextResponse.json({ error: "Username and filename are required" }, { status: 400 });
    }
    await prisma.analysis_jobs.deleteMany({
      where: { username, filename },
    });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Unexpected error in DELETE analysis API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAnalysisAuth(request, "analyze:get", {
    perIp: 60,
    perUser: 120,
  });
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const jobId = searchParams.get("jobId");
  const filename = searchParams.get("filename");

  if (jobId) {
    const job = await prisma.analysis_jobs.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json(null);
    return NextResponse.json(job);
  }

  if (username && filename) {
    const job = await prisma.analysis_jobs.findFirst({
      where: { username, filename, status: "completed" },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(job ?? null);
  }

  if (username) {
    const jobs = await prisma.analysis_jobs.findMany({
      where: { username },
      orderBy: { created_at: "desc" },
      take: 10,
    });
    return NextResponse.json(jobs);
  }

  return NextResponse.json({ error: "Username or jobId required" }, { status: 400 });
}
