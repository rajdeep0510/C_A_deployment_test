import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coach_id = searchParams.get("coach_id");
  const player_username = searchParams.get("player_username");
  const filename = searchParams.get("filename");

  if (!coach_id || !player_username || !filename) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("game_annotations")
    .select("*")
    .eq("coach_id", coach_id)
    .eq("player_username", player_username)
    .eq("filename", filename);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { coach_id, player_username, filename, move_index, note } = body;

  if (!coach_id || !player_username || !filename || move_index == null || !note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("game_annotations")
    .upsert(
      {
        coach_id,
        player_username,
        filename,
        move_index,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "coach_id,player_username,filename,move_index" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
