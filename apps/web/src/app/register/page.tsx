"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tab = "player" | "coach" | "academy";

const TAB_META = {
  player:  { label: "♟ Player",   color: "var(--accent-color)", shadow: "rgba(29,193,137,0.3)",  bg: "linear-gradient(135deg,#10b981,#34d399)" },
  coach:   { label: "👨‍🏫 Coach",    color: "#6366f1",             shadow: "rgba(99,102,241,0.3)",  bg: "linear-gradient(135deg,#6366f1,#818cf8)" },
  academy: { label: "🏫 Academy",  color: "#f59e0b",             shadow: "rgba(245,158,11,0.3)",  bg: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
} as const;

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ color: "var(--danger)", fontSize: "13px", background: "rgba(239,68,68,0.08)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
      {message}
    </div>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "player";
  const [tab, setTab] = useState<Tab>(initialTab);

  // ── Player state ──
  const [pFullName, setPFullName] = useState("");
  const [pUsername, setPUsername] = useState("");
  const [pCoachId, setPCoachId] = useState("");
  const [coaches, setCoaches] = useState<{ id: string; full_name: string }[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState("");

  // ── Coach state ──
  const [cFullName, setCFullName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cConfirm, setCConfirm] = useState("");
  const [cAcademyId, setCAcademyId] = useState("");
  const [academies, setAcademies] = useState<{ id: string; name: string }[]>([]);
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState("");

  // ── Academy state ──
  const [aName, setAName] = useState("");
  const [aCity, setACity] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aFullName, setAFullName] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aPassword, setAPassword] = useState("");
  const [aConfirm, setAConfirm] = useState("");
  const [aLoading, setALoading] = useState(false);
  const [aError, setAError] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").eq("role", "coach").eq("status", "approved").order("full_name")
      .then(({ data }) => { if (data) setCoaches(data); });
    supabase.from("academies").select("id, name").eq("status", "approved").order("name")
      .then(({ data }) => { if (data) setAcademies(data); });
  }, []);

  // ── Player submit ──
  const handlePlayerSubmit = async (e) => {
    e.preventDefault();
    setPError("");
    if (!pFullName.trim() || !pUsername.trim() || !pCoachId) { setPError("Please fill in all fields."); return; }
    setPLoading(true);

    const { data: existing } = await supabase.from("players").select("id, status").eq("chess_username", pUsername.trim().toLowerCase()).single();
    if (existing) {
      setPError(existing.status === "approved"
        ? "This username is already registered and approved. Go to login."
        : "This username is already registered and pending approval.");
      setPLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("players").insert({
      chess_username: pUsername.trim().toLowerCase(),
      full_name: pFullName.trim(),
      coach_id: pCoachId,
      status: "pending",
    });

    if (insertError) { setPError(insertError.message); setPLoading(false); return; }

    localStorage.setItem("playerSession", JSON.stringify({
      chess_username: pUsername.trim().toLowerCase(),
      full_name: pFullName.trim(),
      coach_id: pCoachId,
      status: "pending",
    }));
    router.push("/pending");
  };

  // ── Coach submit ──
  const handleCoachSubmit = async (e) => {
    e.preventDefault();
    setCError("");
    if (cPassword !== cConfirm) { setCError("Passwords do not match."); return; }
    if (cPassword.length < 8) { setCError("Password must be at least 8 characters."); return; }
    setCLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cEmail,
      password: cPassword,
      options: { data: { full_name: cFullName.trim() } },
    });

    if (signUpError || !data.user) { setCError(signUpError?.message ?? "Sign up failed."); setCLoading(false); return; }
    if (data.user?.identities?.length === 0) {
      setCError("This email is already registered. Please log in instead.");
      setCLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: cEmail.trim(),
      full_name: cFullName.trim(),
      role: "coach",
      academy_id: cAcademyId || null,
      status: cAcademyId ? "pending" : "approved",
    });

    if (profileError) {
      setCError(profileError.message || "Failed to create profile.");
      setCLoading(false);
      return;
    }

    setCLoading(false);
    router.push(cAcademyId ? "/coach/pending" : "/login");
  };

  // ── Academy submit ──
  const handleAcademySubmit = async (e) => {
    e.preventDefault();
    setAError("");
    if (aPassword !== aConfirm) { setAError("Passwords do not match."); return; }
    if (aPassword.length < 8) { setAError("Password must be at least 8 characters."); return; }
    if (!aName.trim()) { setAError("Academy name is required."); return; }
    setALoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: aEmail,
      password: aPassword,
      options: { data: { full_name: aFullName.trim() } },
    });

    if (signUpError || !data.user) { setAError(signUpError?.message ?? "Sign up failed."); setALoading(false); return; }
    if (data.user?.identities?.length === 0) {
      setAError("This email is already registered. Please log in instead.");
      setALoading(false);
      return;
    }

    const { data: academy, error: academyError } = await supabase.from("academies").insert({
      name: aName.trim(),
      city: aCity.trim() || null,
      description: aDesc.trim() || null,
      owner_id: data.user.id,
      status: "pending",
    }).select().single();

    if (academyError || !academy) { setAError(academyError?.message ?? "Failed to create academy."); setALoading(false); return; }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: aEmail.trim(),
      full_name: aFullName.trim(),
      role: "academy_owner",
      academy_id: academy.id,
      status: "pending",
    });

    if (profileError) {
      setAError(profileError.message || "Failed to create profile.");
      setALoading(false);
      return;
    }

    setALoading(false);
    router.push("/academy/pending");
  };

  const meta = TAB_META[tab];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: tab === "player"
          ? "radial-gradient(circle at 50% 40%, rgba(29,193,137,0.1) 0%, transparent 65%)"
          : tab === "academy"
          ? "radial-gradient(circle at 50% 40%, rgba(245,158,11,0.1) 0%, transparent 65%)"
          : "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.1) 0%, transparent 65%)",
      }}
    >
      <div className="glass animate-fade-in" style={{ width: "100%", maxWidth: "480px", padding: "40px 32px" }}>

        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "60px", height: "60px", borderRadius: "16px", background: meta.bg,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px",
            margin: "0 auto 14px", boxShadow: `0 6px 20px ${meta.shadow}`, transition: "all 0.3s ease",
          }}>
            {tab === "player" ? "♟" : tab === "academy" ? "🏫" : "♛"}
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)" }}>Create Account</h1>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "4px", background: "var(--surface-1)", padding: "4px",
          borderRadius: "10px", marginBottom: "28px", border: "1px solid var(--border-subtle)",
        }}>
          {(Object.keys(TAB_META) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "8px 4px", borderRadius: "7px", fontSize: "12px", fontWeight: "600",
                background: tab === t ? TAB_META[t].color : "transparent",
                color: tab === t ? "#fff" : "var(--text-secondary)",
                border: "none", cursor: "pointer", transition: "all 0.2s ease",
              }}
            >
              {TAB_META[t].label}
            </button>
          ))}
        </div>

        {/* ── Player Form ── */}
        {tab === "player" && (
          <form onSubmit={handlePlayerSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="input-label">Full Name</label>
              <input className="input-field" type="text" placeholder="Your full name" value={pFullName} onChange={(e) => setPFullName(e.target.value)} disabled={pLoading} required />
            </div>
            <div>
              <label className="input-label">Chess.com Username</label>
              <input className="input-field" type="text" placeholder="Your Chess.com username" value={pUsername} onChange={(e) => setPUsername(e.target.value)} disabled={pLoading} required />
            </div>
            <div>
              <label className="input-label">Select Your Coach</label>
              <select className="input-field" value={pCoachId} onChange={(e) => setPCoachId(e.target.value)} disabled={pLoading || coaches.length === 0} required>
                <option value="">{coaches.length === 0 ? "Loading coaches..." : "— Select a coach —"}</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            {pError && <ErrorBox message={pError} />}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px", fontSize: "15px" }} disabled={pLoading}>
              {pLoading ? "Registering..." : "Register & Request Approval"}
            </button>
          </form>
        )}

        {/* ── Coach Form ── */}
        {tab === "coach" && (
          <form onSubmit={handleCoachSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="input-label">Full Name</label>
              <input className="input-field" type="text" placeholder="Your full name" value={cFullName} onChange={(e) => setCFullName(e.target.value)} disabled={cLoading} required />
            </div>
            <div>
              <label className="input-label">Email Address</label>
              <input className="input-field" type="email" placeholder="you@example.com" value={cEmail} onChange={(e) => setCEmail(e.target.value)} disabled={cLoading} required />
            </div>
            <div>
              <label className="input-label">Password</label>
              <input className="input-field" type="password" placeholder="At least 8 characters" value={cPassword} onChange={(e) => setCPassword(e.target.value)} disabled={cLoading} required />
            </div>
            <div>
              <label className="input-label">Confirm Password</label>
              <input className="input-field" type="password" placeholder="Repeat your password" value={cConfirm} onChange={(e) => setCConfirm(e.target.value)} disabled={cLoading} required />
            </div>
            <div>
              <label className="input-label">Join an Academy (optional)</label>
              <select className="input-field" value={cAcademyId} onChange={(e) => setCAcademyId(e.target.value)} disabled={cLoading}>
                <option value="">— Independent Coach (no academy) —</option>
                {academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {cAcademyId && (
                <p style={{ fontSize: "12px", color: "var(--warning)", marginTop: "6px" }}>
                  Your account will be pending until the academy approves you.
                </p>
              )}
            </div>
            {cError && <ErrorBox message={cError} />}
            <button type="submit" style={{ width: "100%", padding: "12px", fontSize: "15px", fontWeight: "600", background: "#6366f1", color: "#fff", borderRadius: "12px", border: "none", cursor: cLoading ? "not-allowed" : "pointer", opacity: cLoading ? 0.7 : 1, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" }} disabled={cLoading}>
              {cLoading ? "Creating Account..." : "Create Coach Account"}
            </button>
          </form>
        )}

        {/* ── Academy Form ── */}
        {tab === "academy" && (
          <form onSubmit={handleAcademySubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Academy details section */}
            <div style={{ padding: "14px 16px", borderRadius: "10px", background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Academy Details</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label className="input-label">Academy Name *</label>
                  <input className="input-field" type="text" placeholder="e.g. Grand Chess Academy" value={aName} onChange={(e) => setAName(e.target.value)} disabled={aLoading} required />
                </div>
                <div>
                  <label className="input-label">City (optional)</label>
                  <input className="input-field" type="text" placeholder="e.g. Mumbai" value={aCity} onChange={(e) => setACity(e.target.value)} disabled={aLoading} />
                </div>
                <div>
                  <label className="input-label">Description (optional)</label>
                  <textarea className="input-field" placeholder="Brief description..." value={aDesc} onChange={(e) => setADesc(e.target.value)} disabled={aLoading} rows={2} style={{ resize: "vertical" }} />
                </div>
              </div>
            </div>
            {/* Owner account section */}
            <div style={{ padding: "14px 16px", borderRadius: "10px", background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Owner Account</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label className="input-label">Your Full Name *</label>
                  <input className="input-field" type="text" placeholder="Your full name" value={aFullName} onChange={(e) => setAFullName(e.target.value)} disabled={aLoading} required />
                </div>
                <div>
                  <label className="input-label">Email Address *</label>
                  <input className="input-field" type="email" placeholder="you@example.com" value={aEmail} onChange={(e) => setAEmail(e.target.value)} disabled={aLoading} required />
                </div>
                <div>
                  <label className="input-label">Password *</label>
                  <input className="input-field" type="password" placeholder="At least 8 characters" value={aPassword} onChange={(e) => setAPassword(e.target.value)} disabled={aLoading} required />
                </div>
                <div>
                  <label className="input-label">Confirm Password *</label>
                  <input className="input-field" type="password" placeholder="Repeat your password" value={aConfirm} onChange={(e) => setAConfirm(e.target.value)} disabled={aLoading} required />
                </div>
              </div>
            </div>
            {aError && <ErrorBox message={aError} />}
            <button type="submit" style={{ width: "100%", padding: "12px", fontSize: "15px", fontWeight: "600", background: "#f59e0b", color: "#fff", borderRadius: "12px", border: "none", cursor: aLoading ? "not-allowed" : "pointer", opacity: aLoading ? 0.7 : 1, boxShadow: "0 4px 14px rgba(245,158,11,0.3)" }} disabled={aLoading}>
              {aLoading ? "Registering Academy..." : "Register Academy"}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "var(--text-secondary)" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: meta.color, fontWeight: "600" }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
