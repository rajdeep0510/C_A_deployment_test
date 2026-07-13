"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Crown, Lock, Mail, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [needsReset, setNeedsReset] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "1") setJustVerified(true);
  }, [searchParams]);

  const clearAlerts = () => {
    setError("");
    setUnverified(false);
    setNeedsReset(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.status === 403 && data.error === "EMAIL_NOT_VERIFIED") {
        setUnverified(true);
        setLoading(false);
        return;
      }

      if (res.status === 403 && data.error === "PASSWORD_RESET_REQUIRED") {
        setNeedsReset(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setResendLoading(false);
    setResendDone(true);
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: "15px",
    background: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    color: "#f7f7f7",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0f0f0f",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px 32px",
          borderRadius: "12px",
          background: "#161616",
          border: "1px solid #2a2a2a",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "#1dc189",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Crown size={26} style={{ color: "#0f0f0f" }} />
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "700",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.02em",
              color: "#f7f7f7",
              marginBottom: "4px",
            }}
          >
            Chess Advisor
          </h1>
          <p style={{ fontSize: "14px", color: "#a1a1aa" }}>
            Sign in to your account
          </p>
        </div>

        {justVerified && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#1dc189",
              fontSize: "13px",
              background: "#161616",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #2a2a2a",
              marginBottom: "16px",
            }}
          >
            <CheckCircle size={16} />
            Email verified! You can now sign in.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
              Email
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Mail size={16} style={{ position: "absolute", left: "14px", color: "#a1a1aa", pointerEvents: "none" }} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearAlerts(); }}
                disabled={loading}
                autoComplete="email"
                required
                style={{ ...inputStyle, paddingLeft: "42px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: "12px", color: "#1dc189", fontWeight: "500" }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock size={16} style={{ position: "absolute", left: "14px", color: "#a1a1aa", pointerEvents: "none" }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
                style={{ ...inputStyle, paddingLeft: "42px", paddingRight: "42px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "12px", background: "none", border: "none", padding: "4px", color: "#a1a1aa", display: "flex", alignItems: "center", cursor: "pointer", borderRadius: "6px" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ color: "#ef4444", fontSize: "13px", background: "#1f1f1f", padding: "10px 14px", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
              {error}
            </div>
          )}

          {unverified && (
            <div style={{ fontSize: "13px", background: "#1f1f1f", padding: "12px 14px", borderRadius: "8px", border: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ color: "#f59e0b" }}>Please verify your email before signing in.</span>
              {resendDone ? (
                <span style={{ color: "#1dc189", fontSize: "12px" }}>Verification email sent — check your inbox.</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{ alignSelf: "flex-start", background: "none", border: "1px solid #3a3a3a", color: "#a1a1aa", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: "600", cursor: resendLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {resendLoading && <Loader2 size={12} className="animate-spin" />}
                  Resend verification email
                </button>
              )}
            </div>
          )}

          {needsReset && (
            <div style={{ fontSize: "13px", background: "#1f1f1f", padding: "12px 14px", borderRadius: "8px", border: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ color: "#f59e0b" }}>Your account was migrated. Please set a new password to continue.</span>
              <Link
                href={`/forgot-password`}
                style={{ alignSelf: "flex-start", fontSize: "12px", fontWeight: "600", color: "#1dc189", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "4px 10px" }}
              >
                Set new password →
              </Link>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "13px", fontSize: "15px" }}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto" }} /> : "Sign In"}
          </button>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#a1a1aa" }}>
            New here?{" "}
            <Link href="/register" style={{ color: "#1dc189", fontWeight: "600" }}>
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
