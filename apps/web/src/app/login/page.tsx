"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Crown, Lock, Mail, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const { refreshSession } = usePlayer();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [needsReset, setNeedsReset] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [justVerified, setJustVerified] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    if (searchParams.get("verified") === "1") setJustVerified(true);
    if (searchParams.get("ready") === "1") setJustRegistered(true);
    const googleError = searchParams.get("google_error");
    if (googleError) setError(`Google sign-in failed: ${googleError}`);
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
      const body: Record<string, string> = { id: id.trim(), password };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      if (res.status === 403 && data.error === "PASSWORD_SETUP_REQUIRED") {
        router.push(`/set-password?id=${encodeURIComponent(data.id ?? id.trim().toLowerCase())}`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        setLoading(false);
        return;
      }

      await Promise.all([refreshProfile(), refreshSession()]);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const target = data.redirectTo || "/dashboard";
      if (appUrl && (window.location.hostname.startsWith("auth.") || target.startsWith("http"))) {
        window.location.href = target.startsWith("http") ? target : `${appUrl}${target}`;
      } else {
        router.push(target);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: id.trim() }),
      });
      if (!res.ok) throw new Error("resend failed");
      setResendDone(true);
    } catch {
      setError("Could not resend the verification email. Please try again.");
    } finally {
      setResendLoading(false);
    }
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
      }}
    >
      <div
        className={styles.card}
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
            className={styles.logoIcon}
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
          <p style={{ fontSize: "14px", color: "#a1a1aa" }}>Sign in to your account</p>
        </div>

        {justVerified && (
          <div
            className={styles.alert}
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

        {justRegistered && (
          <div
            className={styles.alert}
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
            Account ready! Sign in with your email and password.
          </div>
        )}

        <a
          href="/api/auth/google/start"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#f7f7f7",
            background: "#1f1f1f",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.5 34.7 26.9 36 24 36c-5.3 0-9.8-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.5 35.5 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
          <span style={{ fontSize: "11px", color: "#52525b", letterSpacing: "0.08em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ID field */}
          <div className={styles.fieldRow} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
              Email
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Mail size={16} style={{ position: "absolute", left: "14px", color: "#a1a1aa", pointerEvents: "none" }} />
              <input
                type="email"
                placeholder="email@example.com"
                value={id}
                onChange={(e) => { setId(e.target.value); clearAlerts(); }}
                disabled={loading}
                autoComplete="email"
                required
                style={{ ...inputStyle, paddingLeft: "42px" }}
              />
            </div>
            <p style={{ fontSize: "11px", color: "#52525b", margin: 0 }}>
              Enter the email you registered with
            </p>
          </div>

          {/* Password */}
          <div className={styles.passwordField} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                  onChange={(e) => { setPassword(e.target.value); clearAlerts(); }}
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
            <div className={styles.alert} style={{ color: "#ef4444", fontSize: "13px", background: "#1f1f1f", padding: "10px 14px", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
              {error}
            </div>
          )}

          {unverified && (
            <div className={styles.alert} style={{ fontSize: "13px", background: "#1f1f1f", padding: "12px 14px", borderRadius: "8px", border: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "8px" }}>
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
            <div className={styles.alert} style={{ fontSize: "13px", background: "#1f1f1f", padding: "12px 14px", borderRadius: "8px", border: "1px solid #2a2a2a", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ color: "#f59e0b" }}>Your account was migrated. Please set a new password to continue.</span>
              <Link
                href="/forgot-password"
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
            {loading ? <span className={styles.spinner} /> : "Sign In"}
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
