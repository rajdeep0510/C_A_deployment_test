import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { username, filename } = await request.json();

    if (!username || !filename) {
      return NextResponse.json({ error: "Username and filename are required" }, { status: 400 });
    }

    // Create an analysis job in the analysis_jobs table
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .insert({
        username,
        filename,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating analysis job:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error in analysis API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const jobId = searchParams.get("jobId");

  if (jobId) {
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (username) {
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Username or jobId required" }, { status: 400 });
}
