import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  let query = supabaseAdmin
    .from("analysis_jobs")
    .select("status")
    .eq("username", username);

  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });

  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const row of data ?? []) {
    const s = row.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }
  const total = counts.pending + counts.processing + counts.completed + counts.failed;
  const done = counts.completed + counts.failed;

  return NextResponse.json({ ...counts, total, done });
}
