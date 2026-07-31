import { NextResponse } from "next/server";
import { registerStaffUser, registerPlayerUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// Best-effort in-memory registration throttling.
const SIGNUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SIGNUP_MAX_PER_IP = 5; // registrations per IP
const SIGNUP_MAX_PER_EMAIL = 3; // registrations per email

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, email, password, fullName } = body;

  if (!type || !email || !fullName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Players do not set a password at registration (they claim one via
  // /set-password on first login). Only staff registrations require one.
  if (type !== "player" && (!password || password.length < 8)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const ipAddress = getClientIp(request);
  const emailLower = email.toLowerCase().trim();

  if (isRateLimited(`signup:ip:${ipAddress ?? "unknown"}`, SIGNUP_MAX_PER_IP, SIGNUP_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }
  if (isRateLimited(`signup:email:${emailLower}`, SIGNUP_MAX_PER_EMAIL, SIGNUP_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many registration attempts for this email. Please try again later." },
      { status: 429 }
    );
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
      const result = await registerPlayerUser({ email, fullName, chessUsername, lichessUsername, activePlatform, coachId });
      if (result.preApproved) {
        return NextResponse.json({ preApproved: true, message: "Your account is ready! You can now log in with your chess username and password." }, { status: 201 });
      }
      return NextResponse.json({ message: "Registration submitted. Your coach will review and approve your request." }, { status: 201 });
    }

    if (type === "coach" || type === "academy_owner") {
      const { academyId, academyName, academyCity, academyDescription } = body;
      if (type === "academy_owner" && !academyName) {
        return NextResponse.json({ error: "Academy name is required" }, { status: 400 });
      }
      const { user, rawVerificationToken } = await registerStaffUser({
        email, password, fullName, role: type, academyId, academyName, academyCity, academyDescription,
      });
      await sendVerificationEmail(email, rawVerificationToken, fullName);
      return NextResponse.json({ message: "Check your email to verify your account" }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    if (err.message === "EMAIL_TAKEN" || err.message === "USERNAME_TAKEN") {
      // Anti-enumeration: return the same generic success response as a fresh
      // registration so an attacker cannot tell whether the email/username
      // already exists. (Matches the forgot-password / resend-verification pattern.)
      return NextResponse.json(
        { message: type === "player" ? "Registration submitted." : "Check your email to verify your account" },
        { status: 201 }
      );
    }
    console.error("[signup]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
