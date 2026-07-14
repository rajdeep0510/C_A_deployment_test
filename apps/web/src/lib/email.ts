import nodemailer from "nodemailer";

const FROM = `Chess Advisor <${process.env.SMTP_USER ?? "no-reply@chessadvisor.in"}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chessadvisor.com";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail(email: string, rawToken: string, fullName: string) {
  const link = `${APP_URL}/verify-email?token=${rawToken}`;
  try {
    await createTransport().sendMail({
      from: FROM,
      to: email,
      subject: "Verify your Chess Advisor account",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#10b981">Chess Advisor</h2>
          <p>Hi ${fullName},</p>
          <p>Thanks for registering. Click the button below to verify your email address:</p>
          <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Verify Email
          </a>
          <p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
          <p style="color:#999;font-size:12px">Or copy this URL: ${link}</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[email] Failed to send verification email to", email, err);
  }
}

export async function sendPlayerApprovalEmail(email: string, rawToken: string, fullName: string) {
  const link = `${APP_URL}/verify-email?token=${rawToken}`;
  try {
    await createTransport().sendMail({
      from: FROM,
      to: email,
      subject: "Your Chess Advisor account has been approved!",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#10b981">Chess Advisor</h2>
          <p>Hi ${fullName},</p>
          <p>Great news! Your coach has approved your registration. Click the button below to verify your email and access your account:</p>
          <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Access Chess Advisor
          </a>
          <p style="color:#666;font-size:13px">This link expires in 24 hours.</p>
          <p style="color:#999;font-size:12px">Or copy this URL: ${link}</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[email] Failed to send player approval email to", email, err);
  }
}

export async function sendPasswordResetEmail(email: string, rawToken: string, fullName: string) {
  const link = `${APP_URL}/reset-password?token=${rawToken}`;
  try {
    await createTransport().sendMail({
      from: FROM,
      to: email,
      subject: "Reset your Chess Advisor password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#10b981">Chess Advisor</h2>
          <p>Hi ${fullName},</p>
          <p>We received a request to reset your password. Click below to set a new one:</p>
          <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[email] Failed to send password reset email to", email, err);
  }
}
