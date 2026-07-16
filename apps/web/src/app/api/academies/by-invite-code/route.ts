import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.toUpperCase().trim();

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const academy = await prisma.academies.findUnique({
    where: { invite_code: code },
    select: { id: true, name: true, status: true },
  });

  if (!academy || academy.status !== "approved") {
    return NextResponse.json({ error: "Invalid or inactive academy code" }, { status: 404 });
  }

  return NextResponse.json({ academyId: academy.id, academyName: academy.name });
}
