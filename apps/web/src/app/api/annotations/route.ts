import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coach_id = searchParams.get("coach_id");
  const player_username = searchParams.get("player_username");
  const filename = searchParams.get("filename");

  if (!coach_id || !player_username || !filename) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const rows = await prisma.game_annotations.findMany({
    where: { coach_id, player_username, filename },
  });

  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { coach_id, player_username, filename, move_index, note } = body;

  if (!coach_id || !player_username || !filename || move_index == null || !note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const row = await prisma.game_annotations.upsert({
    where: { coach_id_player_username_filename_move_index: { coach_id, player_username, filename, move_index } },
    update: { note, updated_at: new Date() },
    create: { coach_id, player_username, filename, move_index, note },
  });

  return NextResponse.json(row);
}
