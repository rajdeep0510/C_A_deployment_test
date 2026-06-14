"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/PlayerContext";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = usePlayer();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isStaff = identifier.includes("@");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isStaff) {
      await handleStaffLogin();
    } else {
      await handlePlayerLogin();
    }
  };

  const handlePlayerLogin = async () => {
    const uname = identifier.trim().toLowerCase();
    if (!uname) { setLoading(false); return; }

    const { data, error: fetchError } = await supabase
      .from("players")
      .select("*")
      .eq("chess_username", uname)
      .single();

    setLoading(false);

    if (fetchError || !data) {
      setError("Username not found. Please register first.");
      return;
    }

    const session = {
      chess_username: data.chess_username,
      full_name: data.full_name,
      coach_id: data.coach_id,
      status: data.status,
    };

    if (data.status === "pending") {
      localStorage.setItem("playerSession", JSON.stringify(session));
      router.push("/pending");
    } else if (data.status === "rejected") {
      setError("Your registration was rejected by your coach. Please contact them.");
    } else if (data.status === "approved") {
      refreshSession(session);
      const hasGames = !!localStorage.getItem("recentGames");
      router.push(hasGames ? "/dashboard" : "/onboarding");
    }
  };

  const handleStaffLogin = async () => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", data.user!.id)
      .single();

    setLoading(false);

    if (profileError || !profile) {
      setError("Account record not found. Please contact your administrator.");
      return;
    }

    if (profile?.role === "admin") {
      router.push("/admin/dashboard");
    } else if (profile?.role === "academy_owner") {
      router.push(profile.status === "pending" ? "/academy/pending" : "/academy/dashboard");
    } else {
      router.push(profile?.status === "pending" ? "/coach/pending" : "/coach/dashboard");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: isStaff
          ? "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.1) 0%, transparent 65%)"
          : "radial-gradient(circle at 50% 40%, rgba(29,193,137,0.1) 0%, transparent 65%)",
        transition: "background 0.4s ease",
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{ width: "100%", maxWidth: "400px", padding: "40px 32px" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: isStaff
                ? "linear-gradient(135deg, #6366f1, #818cf8)"
                : "linear-gradient(135deg, #10b981, #34d399)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              margin: "0 auto 14px",
              boxShadow: isStaff
                ? "0 6px 20px rgba(99,102,241,0.3)"
                : "0 6px 20px rgba(16,185,129,0.3)",
              transition: "all 0.3s ease",
            }}
          >
            {isStaff ? "♛" : "♟"}
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
            Chess Advisor
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {isStaff ? "Sign in to your staff account" : "Enter your Chess.com username to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label">Chess.com Username or Email</label>
            <input
              className="input-field"
              type="text"
              placeholder="username or you@example.com"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          {/* Password field — only shown for staff (email) */}
          {isStaff && (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              <label className="input-label">Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
            </div>
          )}

          {error && (
            <div
              style={{
                color: "var(--danger)",
                fontSize: "13px",
                background: "rgba(239,68,68,0.08)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "15px",
              fontWeight: "600",
              background: isStaff ? "#6366f1" : "var(--accent-color)",
              color: "#fff",
              borderRadius: "12px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: isStaff
                ? "0 4px 14px rgba(99,102,241,0.3)"
                : "0 4px 14px rgba(16,185,129,0.3)",
              transition: "all 0.3s ease",
            }}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isStaff
              ? "Sign In"
              : "Continue as Player"}
          </button>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
            New here?{" "}
            <Link href="/register" style={{ color: isStaff ? "#6366f1" : "var(--accent-color)", fontWeight: "600" }}>
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
