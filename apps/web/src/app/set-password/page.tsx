"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import styles from "../login/login.module.css";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const { refreshSession } = usePlayer();

  const id = (searchParams.get("id") ?? "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id) {
      setError("Missing username. Please return to the login page.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not set password. Please try again.");
        setLoading(false);
        return;
      }

      await Promise.all([refreshProfile(), refreshSession()]);
      router.push(data.redirectTo ?? "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
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
            Set your password
          </h1>
          <p style={{ fontSize: "14px", color: "#a1a1aa" }}>
            {id ? <>Signing in as <span style={{ color: "#f7f7f7", fontWeight: 500 }}>{id}</span></> : "Choose a password to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className={styles.passwordField} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
              New password
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock size={16} style={{ position: "absolute", left: "14px", color: "#a1a1aa", pointerEvents: "none" }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
                minLength={8}
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

          <div className={styles.passwordField} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: "500", color: "#a1a1aa", letterSpacing: "0.02em" }}>
              Confirm password
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock size={16} style={{ position: "absolute", left: "14px", color: "#a1a1aa", pointerEvents: "none" }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
                minLength={8}
                style={{ ...inputStyle, paddingLeft: "42px" }}
              />
            </div>
          </div>

          {error && (
            <div className={styles.alert} style={{ color: "#ef4444", fontSize: "13px", background: "#1f1f1f", padding: "10px 14px", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "13px", fontSize: "15px" }}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : "Set password & sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
