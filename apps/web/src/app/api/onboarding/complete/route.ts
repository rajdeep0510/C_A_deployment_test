import { NextResponse } from "next/server";
import {
  requireAuth,
  createStaffProfileFor,
  createPlayerRecordFor,
  createEmailVerificationToken,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const user = session.app_user;

  // Reject if the user has already completed onboarding.
  if (user.profile || user.player) {
    return NextResponse.json({ error: "Already onboarded" }, { status: 409 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, fullName } = body;

  if (!type || !fullName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    if (type === "player") {
      const { chessUsername, lichessUsername, activePlatform, coachId } = body;
      if (!coachId) {
        return NextResponse.json({ error: "Missing coachId" }, { status: 400 });
      }
      if (!chessUsername && !lichessUsername) {
        return NextResponse.json({ error: "Enter your Chess.com or Lichess username" }, { status: 400 });
      }
      await createPlayerRecordFor(user.id, {
        email: user.email,
        fullName,
        chessUsername,
        lichessUsername,
        activePlatform,
        coachId,
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (type === "coach" || type === "academy_owner") {
      const { academyId, academyName, academyCity, academyDescription } = body;
      if (type === "academy_owner" && !academyName) {
        return NextResponse.json({ error: "Academy name is required" }, { status: 400 });
      }
      await createStaffProfileFor(user.id, {
        email: user.email,
        fullName,
        role: type,
        academyId,
        academyName,
        academyCity,
        academyDescription,
      });

      // Google users already have email_verified=true; password users completing onboarding
      // late (shouldn't happen, but handle it) still get the standard verification email.
      if (!user.email_verified) {
        try {
          const rawToken = await createEmailVerificationToken(user.id);
          await sendVerificationEmail(user.email, rawToken, fullName);
        } catch (e) {
          console.error("[onboarding] failed to send verification email", e);
        }
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    if (err.message === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "This username is already registered." }, { status: 409 });
    }
    if (err.message === "USERNAME_REQUIRED") {
      return NextResponse.json({ error: "Enter your Chess.com or Lichess username" }, { status: 400 });
    }
    // Prisma unique-constraint on profiles.id or players.user_id → user already had a row (race).
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Already onboarded" }, { status: 409 });
    }
    console.error("[onboarding]", err);
    return NextResponse.json({ error: "Onboarding failed. Please try again." }, { status: 500 });
  }
}
