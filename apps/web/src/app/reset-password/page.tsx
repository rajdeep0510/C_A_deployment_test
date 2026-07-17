"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CheckCircle, XCircle } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      setError("This reset link has expired or already been used. Please request a new one.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#0f0f0f" }}>
        <div style={{ width: "100%", maxWidth: "420px", padding: "48px 36px", borderRadius: "12px", background: "#161616", border: "1px solid #2a2a2a", textAlign: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <XCircle size={26} style={{ color: "#0f0f0f" }} />
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", color: "#f7f7f7", marginBottom: "12px" }}>
            Invalid link
          </h1>
          <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: "1.6", marginBottom: "28px" }}>
            This reset link is missing or malformed. Please request a new one.
          </p>
          <Link href="/forgot-password" className="btn btn-primary" style={{ display: "inline-block", padding: "12px 28px", textDecoration: "none" }}>
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#0f0f0f" }}>
      <div style={{ width: "100%", maxWidth: "420px", padding: "48px 36px", borderRadius: "12px", background: "#161616", border: "1px solid #2a2a2a", textAlign: "center" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            background: done ? "#1dc189" : "#161616",
            border: done ? "none" : "1px solid #2a2a2a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          {done
            ? <CheckCircle size={26} style={{ color: "#0f0f0f" }} />
            : <Lock size={26} style={{ color: "#a1a1aa" }} />}
        </div>

        {done ? (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", color: "#f7f7f7", marginBottom: "12px" }}>
              Password updated
            </h1>
            <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: "1.6" }}>
              Your password has been set. Redirecting you to login…
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "20px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", color: "#f7f7f7", marginBottom: "8px" }}>
              Set a new password
            </h1>
            <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: "1.6", marginBottom: "28px" }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
                  New password
                </label>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="input"
                  style={{ padding: "12px 16px", fontSize: "15px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="input"
                  style={{ padding: "12px 16px", fontSize: "15px" }}
                />
              </div>

              {error && (
                <p style={{ fontSize: "13px", color: "#ef4444" }}>{error}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "13px", fontSize: "15px", marginTop: "4px" }}
                disabled={loading || !password || !confirm}
              >
                {loading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto" }} /> : "Reset Password"}
              </button>
            </form>

            <p style={{ marginTop: "24px", fontSize: "13px", color: "#a1a1aa" }}>
              Remembered it?{" "}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
