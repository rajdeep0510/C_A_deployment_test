import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const academies = await prisma.academies.findMany({
    where: { status: "approved" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(academies);
}
