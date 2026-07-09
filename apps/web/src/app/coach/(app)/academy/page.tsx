"use client";
import { useEffect, useState } from "react";
import CoachHeader from "@/components/CoachHeader";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Users } from "lucide-react";

type AcademyInfo = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  status: string;
  created_at: string;
};

type CoachRow = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  playerCount: number;
};

export default function CoachAcademyPage() {
  const { coachProfile } = useAuth();
  const [academy, setAcademy] = useState<AcademyInfo | null>(null);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coachProfile?.academy_id) { setLoading(false); return; }
    loadAcademy(coachProfile.academy_id);
  }, [coachProfile]);

  async function loadAcademy(academyId: string) {
    setLoading(true);

    const [{ data: academyData }, { data: coachesData }, { data: playersData }] = await Promise.all([
      supabase.from("academies").select("*").eq("id", academyId).single(),
      supabase.from("profiles").select("id, full_name, email, created_at").eq("academy_id", academyId).eq("role", "coach").eq("status", "approved"),
      supabase.from("players").select("coach_id").eq("status", "approved"),
    ]);

    setAcademy(academyData ?? null);

    const enriched: CoachRow[] = (coachesData ?? []).map((c) => ({
      ...c,
      playerCount: (playersData ?? []).filter((p) => p.coach_id === c.id).length,
    }));
    setCoaches(enriched);
    setLoading(false);
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--text-secondary)",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = { padding: "12px 16px", fontSize: "13px", borderTop: "1px solid var(--border-subtle)" };

  return (
    <>
      <CoachHeader />
      <main className="container animate-fade-in page-content-mobile" style={{ paddingTop: "40px", paddingBottom: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "700", margin: 0 }}>My Academy</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>Your academy overview</p>
          </div>
        </div>

        {loading ? (
          <Loader message="Loading academy..." />
        ) : !academy ? (
          <div className="glass" style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
            You are not associated with any academy.
          </div>
        ) : (
          <>
            {/* Academy info card */}
            <div className="glass-card" style={{ padding: "24px 28px", marginBottom: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "700", marginBottom: "6px" }}>🏫 {academy.name}</div>
                  {academy.city && <div style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "4px" }}>📍 {academy.city}</div>}
                  {academy.description && <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px", maxWidth: "520px" }}>{academy.description}</div>}
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div className="glass-card" style={{ padding: "16px 24px", textAlign: "center", minWidth: "100px" }}>
                    <div style={{ fontSize: "28px", fontWeight: "800", color: "#f59e0b" }}>{coaches.length}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", marginTop: "4px" }}>Coaches</div>
                  </div>
                  <div className="glass-card" style={{ padding: "16px 24px", textAlign: "center", minWidth: "100px" }}>
                    <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--success)" }}>{coaches.reduce((s, c) => s + c.playerCount, 0)}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", marginTop: "4px" }}>Players</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coaches table */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Users size={18} color="var(--text-secondary)" />
              <span style={{ fontWeight: "600", fontSize: "15px" }}>Coaches in this Academy</span>
            </div>
            <div className="glass-card" style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Coach", "Email", "Players", "Joined"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coaches.length === 0 ? (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "var(--text-secondary)" }}>No coaches yet.</td></tr>
                  ) : coaches.map((c) => (
                    <tr key={c.id}>
                      <td style={tdStyle}><strong>{c.full_name}</strong></td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{c.email}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{c.playerCount}</td>
                      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
