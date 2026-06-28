import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { username, filename } = await request.json();

    if (!username || !filename) {
      return NextResponse.json({ error: "Username and filename are required" }, { status: 400 });
    }

    // Return existing completed job instead of creating a duplicate
    const { data: existing } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("username", username)
      .eq("filename", filename)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) return NextResponse.json(existing);

    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .insert({ username, filename, status: "pending" })
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

export async function PATCH(request: NextRequest) {
  try {
    const { jobId, status, result } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .update({ status, result })
      .eq("id", jobId)
      .select()
      .single();

    if (error) {
      console.error("Error updating analysis job:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error in PATCH analysis API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const jobId = searchParams.get("jobId");
  const filename = searchParams.get("filename");

  if (jobId) {
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (username && filename) {
    const { data, error } = await supabaseAdmin
      .from("analysis_jobs")
      .select("*")
      .eq("username", username)
      .eq("filename", filename)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? null);
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
