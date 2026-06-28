import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { username, game_urls } = await request.json();

    if (!username || !Array.isArray(game_urls) || game_urls.length === 0) {
      return NextResponse.json(
        { error: "username and game_urls[] are required" },
        { status: 400 }
      );
    }

    // If there's already a pending/processing job for this user, return it
    const { data: existing } = await supabaseAdmin
      .from("batch_jobs")
      .select("id, status, created_at, game_urls")
      .eq("username", username)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) return NextResponse.json(existing);

    const { data, error } = await supabaseAdmin
      .from("batch_jobs")
      .insert({ username, game_urls, status: "pending" })
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
      .select("id, username, status, created_at, result")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  return NextResponse.json({ error: "jobId or username required" }, { status: 400 });
}
