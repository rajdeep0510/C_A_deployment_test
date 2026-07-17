import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteAcademyCascade } from "@/lib/auth-utils";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: academyId } = await params;

  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  await deleteAcademyCascade(academyId);
  return NextResponse.json({ message: "Academy deleted successfully" });
}
