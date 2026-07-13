import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const profile = await prisma.profiles.findFirst({
    where: { id, role: "coach" },
    select: { full_name: true },
  });

  if (!profile) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  return NextResponse.json({ coachName: profile.full_name });
}
