"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function CoachPendingPage() {
  const router = useRouter();
  const { user, coachProfile, refreshProfile } = useAuth();
  const [academyName, setAcademyName] = useState("");
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (coachProfile?.status === "approved") { router.push("/coach/dashboard"); return; }
    if (coachProfile?.academy_id) {
      supabase
        .from("academies")
        .select("name")
        .eq("id", coachProfile.academy_id)
        .single()
        .then(({ data }) => { if (data) setAcademyName(data.name); });
    }
  }, [user, coachProfile, router]);

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    setStatusMsg("");
    const { data } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    if (data?.status === "approved") {
      await refreshProfile();
      router.push("/coach/dashboard");
    } else if (data?.status === "rejected") {
      setChecking(false);
      setStatusMsg("Your coach account was rejected by the academy.");
    } else {
      setChecking(false);
      setStatusMsg("Still pending — the academy hasn't approved you yet.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(circle at 50% 40%, rgba(245,158,11,0.08) 0%, transparent 65%)",
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{ width: "100%", maxWidth: "460px", padding: "48px 36px", textAlign: "center" }}
      >
        <div style={{ fontSize: "56px", marginBottom: "20px" }}>⏳</div>

        <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "12px" }}>
          Pending Academy Approval
        </h1>

        <p style={{ color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "8px" }}>
          Your coach account has been created and is waiting for approval.
        </p>

        {academyName && (
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
            Waiting on{" "}
            <strong style={{ color: "var(--accent-color)" }}>{academyName}</strong>{" "}
            to review your request.
          </p>
        )}

        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "28px",
          }}
        >
          <p style={{ fontSize: "13px", color: "var(--warning)", fontWeight: "600" }}>
            Registered as: <code style={{ fontFamily: "monospace" }}>{user?.email}</code>
          </p>
        </div>

        {statusMsg && (
          <div
            style={{
              color: statusMsg.includes("rejected") ? "var(--danger)" : "var(--text-secondary)",
              fontSize: "13px",
              background: "var(--surface-1)",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              marginBottom: "20px",
            }}
          >
            {statusMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="btn btn-primary"
            style={{ padding: "12px", fontSize: "15px" }}
            onClick={checkStatus}
            disabled={checking}
          >
            {checking ? "Checking..." : "🔄 Check Approval Status"}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: "12px", fontSize: "14px" }}
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
