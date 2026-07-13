import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  const profiles = await prisma.profiles.findMany({
    select: { id: true, email: true, full_name: true },
  });
  const existingUsers = await prisma.app_users.findMany({ select: { id: true } });
  const existingIds = new Set(existingUsers.map((u) => u.id));

  const unmigrated = profiles.filter((p) => !existingIds.has(p.id));

  if (unmigrated.length === 0) {
    return NextResponse.json({ migrated: 0, failed: 0, details: [] });
  }

  const results: { email: string; status: "ok" | "error"; error?: string }[] = [];

  for (const profile of unmigrated) {
    try {
      // Create app_users row with same ID so the FK in profiles is satisfied
      await prisma.app_users.create({
        data: {
          id: profile.id,
          email: profile.email,
          password_hash: "[MIGRATED]",
          email_verified: true,
        },
      });

      const rawToken = await createPasswordResetToken(profile.id);
      await sendPasswordResetEmail(profile.email, rawToken, profile.full_name);

      results.push({ email: profile.email, status: "ok" });
    } catch (err: any) {
      results.push({ email: profile.email, status: "error", error: err?.message });
    }
  }

  const migrated = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ migrated, failed, details: results });
}
