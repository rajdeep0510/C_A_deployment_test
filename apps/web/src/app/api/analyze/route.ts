import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { username, filename } = await request.json();

    if (!username || !filename) {
      return NextResponse.json({ error: "Username and filename are required" }, { status: 400 });
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
