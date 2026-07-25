"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, User, Loader2, Building, GraduationCap, UserRound } from "lucide-react";

type Role = "player" | "coach" | "academy_owner";

const ROLE_META: Record<Role, { label: string; icon: React.ReactNode; description: string }> = {
  player: {
    label: "Player",
    icon: <UserRound size={18} />,
    description: "I want to train and get my games analyzed",
  },
  coach: {
    label: "Coach",
    icon: <GraduationCap size={18} />,
    description: "I train students under an academy",
  },
  academy_owner: {
    label: "Academy",
    icon: <Building size={18} />,
    description: "I run an academy with multiple coaches",
  },
};

export default function AccountSetupPage() {
  const router = useRouter();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const refreshProfile = async () => {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    setProfile(data);
    return data;
  };

  const [role, setRole] = useState<Role>("player");
  const [fullName, setFullName] = useState("");

  const [chessUsername, setChessUsername] = useState("");
  const [lichessUsername, setLichessUsername] = useState("");
  const [activePlatform, setActivePlatform] = useState<"chess.com" | "lichess">("chess.com");
  const [inviteCode, setInviteCode] = useState("");
  const [resolvedCoach, setResolvedCoach] = useState<{ coachId: string; coachName: string } | null>(null);
  const [inviteError, setInviteError] = useState("");

  const [academyName, setAcademyName] = useState("");
  const [academyCity, setAcademyCity] = useState("");
  const [academyDescription, setAcademyDescription] = useState("");

  const [academyInviteCode, setAcademyInviteCode] = useState("");
  const [resolvedAcademy, setResolvedAcademy] = useState<{ academyId: string; academyName: string } | null>(null);
  const [academyInviteError, setAcademyInviteError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const data = await refreshProfile();
      setProfileLoading(false);
      if (!data) { router.replace("/login"); return; }
      if (data.onboarded) { router.replace("/"); return; }
      if (data.fullName) setFullName((prev) => prev || data.fullName);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveInvite = async (code: string) => {
    setInviteError("");
    setResolvedCoach(null);
    if (!code.trim()) return;
    try {
      const res = await fetch(`/api/coaches/by-invite-code?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Invalid coach invite code");
        return;
      }
      setResolvedCoach({ coachId: data.coachId, coachName: data.coachName });
    } catch {
      setInviteError("Failed to check invite code");
    }
  };

  const resolveAcademyInvite = async (code: string) => {
    setAcademyInviteError("");
    setResolvedAcademy(null);
    if (!code.trim()) return;
    try {
      const res = await fetch(`/api/academies/by-invite-code?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setAcademyInviteError(data.error ?? "Invalid academy invite code");
        return;
      }
      setResolvedAcademy({ academyId: data.academyId, academyName: data.academyName });
    } catch {
      setAcademyInviteError("Failed to check invite code");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { type: role, fullName: fullName.trim() };

      if (role === "player") {
        if (!resolvedCoach) { setError("Enter a valid coach invite code"); setSubmitting(false); return; }
        if (!chessUsername && !lichessUsername) { setError("Enter your Chess.com or Lichess username"); setSubmitting(false); return; }
        payload.coachId = resolvedCoach.coachId;
        payload.chessUsername = chessUsername.trim() || undefined;
        payload.lichessUsername = lichessUsername.trim() || undefined;
        payload.activePlatform = activePlatform;
      } else if (role === "coach") {
        if (!resolvedAcademy) { setError("Enter a valid academy invite code"); setSubmitting(false); return; }
        payload.academyId = resolvedAcademy.academyId;
      } else if (role === "academy_owner") {
        if (!academyName.trim()) { setError("Academy name is required"); setSubmitting(false); return; }
        payload.academyName = academyName.trim();
        payload.academyCity = academyCity.trim() || undefined;
        payload.academyDescription = academyDescription.trim() || undefined;
      }

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Setup failed"); setSubmitting(false); return; }

      await refreshProfile();
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (profileLoading || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#a1a1aa" }} />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    background: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    color: "#f7f7f7",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#a1a1aa", letterSpacing: "0.02em" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "40px 32px", borderRadius: 12, background: "#161616", border: "1px solid #2a2a2a" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#1dc189", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Crown size={26} style={{ color: "#0f0f0f" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f7f7f7", marginBottom: 4 }}>Set up your account</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa" }}>Tell us who you are to get started</p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={labelStyle}>I am a…</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {(Object.keys(ROLE_META) as Role[]).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: "12px 8px",
                      background: active ? "#1dc189" : "#1f1f1f",
                      color: active ? "#0f0f0f" : "#f7f7f7",
                      border: active ? "1px solid #1dc189" : "1px solid #2a2a2a",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {ROLE_META[r].icon}
                    {ROLE_META[r].label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "#52525b", margin: 0 }}>{ROLE_META[role].description}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>Full name</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <User size={16} style={{ position: "absolute", left: 14, color: "#a1a1aa", pointerEvents: "none" }} />
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ ...inputStyle, paddingLeft: 42 }} />
            </div>
          </div>

          {role === "player" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Chess.com username</label>
                <input value={chessUsername} onChange={(e) => setChessUsername(e.target.value)} style={inputStyle} placeholder="optional if Lichess set" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Lichess username</label>
                <input value={lichessUsername} onChange={(e) => setLichessUsername(e.target.value)} style={inputStyle} placeholder="optional if Chess.com set" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Active platform</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["chess.com", "lichess"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActivePlatform(p)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        background: activePlatform === p ? "#1dc189" : "#1f1f1f",
                        color: activePlatform === p ? "#0f0f0f" : "#f7f7f7",
                        border: "1px solid #2a2a2a",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#f59e0b", margin: 0 }}>
                  Note: usernames can only be changed <b>once</b> after signup.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Coach invite code</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  onBlur={(e) => resolveInvite(e.target.value)}
                  style={inputStyle}
                  placeholder="ABCD-1234"
                  required
                />
                {resolvedCoach && (
                  <p style={{ fontSize: 12, color: "#1dc189", margin: 0 }}>Coach: {resolvedCoach.coachName}</p>
                )}
                {inviteError && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{inviteError}</p>}
              </div>
            </>
          )}

          {role === "coach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Academy invite code</label>
              <input
                value={academyInviteCode}
                onChange={(e) => setAcademyInviteCode(e.target.value.toUpperCase())}
                onBlur={(e) => resolveAcademyInvite(e.target.value)}
                style={inputStyle}
                placeholder="ABCD-1234"
                required
              />
              {resolvedAcademy && <p style={{ fontSize: 12, color: "#1dc189", margin: 0 }}>Academy: {resolvedAcademy.academyName}</p>}
              {academyInviteError && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{academyInviteError}</p>}
            </div>
          )}

          {role === "academy_owner" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Academy name</label>
                <input required value={academyName} onChange={(e) => setAcademyName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>City (optional)</label>
                <input value={academyCity} onChange={(e) => setAcademyCity(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Description (optional)</label>
                <textarea value={academyDescription} onChange={(e) => setAcademyDescription(e.target.value)} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
              </div>
            </>
          )}

          {error && (
            <div style={{ color: "#ef4444", fontSize: 13, background: "#1f1f1f", padding: "10px 14px", borderRadius: 8, border: "1px solid #2a2a2a" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: 13, fontSize: 15 }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Finish setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
