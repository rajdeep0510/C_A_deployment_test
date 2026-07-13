import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.toUpperCase().trim();

  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const profile = await prisma.profiles.findFirst({
    where: { invite_code: code, role: "coach", status: "approved" },
    select: { id: true, full_name: true },
  });

  if (!profile) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  return NextResponse.json({ coachId: profile.id, coachName: profile.full_name });
}
