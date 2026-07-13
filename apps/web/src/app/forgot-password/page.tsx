"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--ground, #0f0f0f)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "48px 36px",
          borderRadius: "12px",
          background: "#161616",
          border: "1px solid #2a2a2a",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            background: "#1dc189",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          {sent ? <CheckCircle size={26} style={{ color: "#0f0f0f" }} /> : <Mail size={26} style={{ color: "#0f0f0f" }} />}
        </div>

        {sent ? (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", color: "#f7f7f7", marginBottom: "12px" }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: "1.6", marginBottom: "28px" }}>
              If an account with that email exists, we sent a password reset link. The link expires in 1 hour.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: "inline-block", padding: "12px 28px", textDecoration: "none" }}>
              Back to Login
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", color: "#f7f7f7", marginBottom: "8px" }}>
              Forgot your password?
            </h1>
            <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: "1.6", marginBottom: "28px" }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="input"
                style={{ padding: "12px 16px", fontSize: "15px" }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "13px", fontSize: "15px" }}
                disabled={loading || !email}
              >
                {loading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto" }} /> : "Send Reset Link"}
              </button>
            </form>

            <p style={{ marginTop: "24px", fontSize: "13px", color: "#a1a1aa" }}>
              Remember it?{" "}
              <Link href="/login" style={{ color: "#1dc189", fontWeight: "600" }}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
