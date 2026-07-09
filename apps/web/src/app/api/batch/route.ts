import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { username, game_urls, time_class } = await request.json();

    if (!username || !Array.isArray(game_urls) || game_urls.length === 0) {
      return NextResponse.json(
        { error: "username and game_urls[] are required" },
        { status: 400 }
      );
    }

    // If there's already a pending/processing job for this user + same time_class, return it
    let existingQuery = supabaseAdmin
      .from("batch_jobs")
      .select("id, status, created_at, game_urls, time_class")
      .eq("username", username)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);

    existingQuery = time_class
      ? existingQuery.eq("time_class", time_class)
      : existingQuery.is("time_class", null);

    const { data: existing } = await existingQuery.single();
    if (existing) return NextResponse.json(existing);

    const { data, error } = await supabaseAdmin
      .from("batch_jobs")
      .insert({ username, game_urls, status: "pending", time_class: time_class || null })
      .select()
      .single();

    if (error) {
      console.error("Error creating batch job:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error in POST /api/batch:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const username = searchParams.get("username");

  if (jobId) {
    const { data, error } = await supabaseAdmin
      .from("batch_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (username) {
    const { data, error } = await supabaseAdmin
      .from("batch_jobs")
      .select("id, username, status, created_at, time_class, result")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return a lightweight summary — strip the full result blob so the response
    // stays small (the report page fetches the full result separately when needed)
    const summary = (data ?? []).map(j => ({
      id: j.id,
      username: j.username,
      status: j.status,
      created_at: j.created_at,
      time_class: j.time_class ?? null,
      summary: j.result
        ? { total_analyzed: j.result.total_analyzed, average_accuracy: j.result.average_accuracy }
        : null,
    }));

    return NextResponse.json(summary);
  }

  return NextResponse.json({ error: "jobId or username required" }, { status: 400 });
}
