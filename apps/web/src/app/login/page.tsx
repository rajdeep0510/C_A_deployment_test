"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/PlayerContext";
import { Crown, User, Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = usePlayer();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [linkHovered, setLinkHovered] = useState(false);

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

  const InputIcon = isStaff ? Mail : User;

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
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px 32px",
          borderRadius: "24px",
          border: "1px solid " + (isStaff ? "rgba(99, 102, 241, 0.2)" : "rgba(29, 193, 137, 0.2)"),
          boxShadow: isStaff
            ? "0 20px 40px rgba(99, 102, 241, 0.05), var(--glass-shadow)"
            : "0 20px 40px rgba(29, 193, 137, 0.05), var(--glass-shadow)",
          transition: "border-color 0.4s ease, box-shadow 0.4s ease",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              border: "1px solid " + (isStaff ? "rgba(99, 102, 241, 0.3)" : "rgba(29, 193, 137, 0.3)"),
              padding: "5px",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: isStaff
                ? "0 8px 24px rgba(99, 102, 241, 0.15)"
                : "0 8px 24px rgba(29, 193, 137, 0.15)",
              transition: "all 0.4s ease",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "14px",
                background: isStaff
                  ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                  : "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.2)",
              }}
            >
              {isStaff ? (
                <Crown size={28} style={{ color: "#fff" }} />
              ) : (
                <User size={28} style={{ color: "#fff" }} />
              )}
            </div>
          </div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "800",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            Chess Advisor
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            {isStaff ? "Sign in to your staff account" : "Enter your Chess.com username to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="input-label">Chess.com Username or Email</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <InputIcon
                size={18}
                style={{
                  position: "absolute",
                  left: "16px",
                  color: isStaff ? "#818cf8" : "var(--accent-color)",
                  opacity: 0.7,
                  pointerEvents: "none",
                  transition: "all 0.3s ease",
                }}
              />
              <input
                className="input-field"
                type="text"
                placeholder="username or you@example.com"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                }}
                disabled={loading}
                autoComplete="username"
                required
                style={{
                  paddingLeft: "46px",
                  border:
                    focusedField === "identifier"
                      ? isStaff
                        ? "1px solid #6366f1"
                        : "1px solid var(--accent-color)"
                      : "1px solid var(--input-border)",
                  boxShadow:
                    focusedField === "identifier"
                      ? isStaff
                        ? "0 0 0 3px rgba(99, 102, 241, 0.15)"
                        : "0 0 0 3px rgba(29, 193, 137, 0.15)"
                      : "none",
                  transition: "all 0.3s ease",
                }}
                onFocus={() => setFocusedField("identifier")}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>

          {/* Password field — animated height & opacity reveal */}
          <div
            style={{
              maxHeight: isStaff ? "100px" : "0px",
              opacity: isStaff ? 1 : 0,
              marginTop: isStaff ? "16px" : "0px",
              overflow: "hidden",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <label className="input-label">Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: "16px",
                  color: "#818cf8",
                  opacity: 0.7,
                  pointerEvents: "none",
                }}
              />
              <input
                className="input-field"
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required={isStaff}
                style={{
                  paddingLeft: "46px",
                  paddingRight: "46px",
                  border:
                    focusedField === "password"
                      ? "1px solid #6366f1"
                      : "1px solid var(--input-border)",
                  boxShadow:
                    focusedField === "password"
                      ? "0 0 0 3px rgba(99, 102, 241, 0.15)"
                      : "none",
                  transition: "all 0.3s ease",
                }}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  background: "none",
                  border: "none",
                  padding: "4px",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  borderRadius: "6px",
                  transition: "color 0.2s ease",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

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
              padding: "14px",
              fontSize: "15px",
              fontWeight: "600",
              background: isStaff
                ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                : "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              borderRadius: "12px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
              boxShadow: isStaff
                ? "0 4px 14px rgba(99,102,241,0.25)"
                : "0 4px 14px rgba(16,185,129,0.25)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            disabled={loading}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = isStaff
                ? "0 6px 20px rgba(99,102,241,0.35)"
                : "0 6px 20px rgba(16,185,129,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = isStaff
                ? "0 4px 14px rgba(99,102,241,0.25)"
                : "0 4px 14px rgba(16,185,129,0.25)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isStaff ? "Sign In" : "Continue as Player"}
                <span style={{ fontSize: "16px" }}>→</span>
              </>
            )}
          </button>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
            New here?{" "}
            <Link
              href="/register"
              style={{
                color: isStaff ? "#818cf8" : "var(--accent-color)",
                fontWeight: "600",
                position: "relative",
                transition: "color 0.3s ease",
              }}
              onMouseEnter={() => setLinkHovered(true)}
              onMouseLeave={() => setLinkHovered(false)}
            >
              Register
              <span
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  left: "0",
                  width: linkHovered ? "100%" : "0%",
                  height: "1px",
                  backgroundColor: isStaff ? "#818cf8" : "var(--accent-color)",
                  transition: "width 0.3s ease",
                }}
              />
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
