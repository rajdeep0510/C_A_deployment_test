import { NextResponse } from "next/server";
import { registerStaffUser, registerPlayerUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, email, password, fullName } = body;

  if (!type || !email || !password || !fullName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    if (type === "player") {
      const { chessUsername, coachId } = body;
      if (!chessUsername || !coachId) {
        return NextResponse.json({ error: "Missing chessUsername or coachId" }, { status: 400 });
      }
      const { user, rawVerificationToken } = await registerPlayerUser({
        email, password, fullName, chessUsername, coachId,
      });
      await sendVerificationEmail(email, rawVerificationToken, fullName);
      return NextResponse.json({ message: "Check your email to verify your account" }, { status: 201 });
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
    if (err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "This email is already registered. Please log in instead." }, { status: 409 });
    }
    if (err.message === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "This username is already registered." }, { status: 409 });
    }
    console.error("[signup]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
