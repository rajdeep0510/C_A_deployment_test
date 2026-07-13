import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const jobs = await prisma.analysis_jobs.findMany({
    where: {
      username,
      ...(since ? { created_at: { gte: new Date(since) } } : {}),
    },
    select: { status: true },
  });

  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const row of jobs) {
    const s = row.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }
  const total = counts.pending + counts.processing + counts.completed + counts.failed;
  const done = counts.completed + counts.failed;

  return NextResponse.json({ ...counts, total, done });
}
