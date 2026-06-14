"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/PlayerContext";

export default function PendingPage() {
  const router = useRouter();
  const { refreshSession } = usePlayer();
  const [session, setSession] = useState<any>(null);
  const [coachName, setCoachName] = useState("");
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("playerSession");
    if (!raw) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.status === "approved") {
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(parsed);

    // Fetch coach name
    if (parsed.coach_id) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", parsed.coach_id)
        .single()
        .then(({ data }) => {
          if (data) setCoachName(data.full_name);
        });
    }
  }, [router]);

  const checkStatus = async () => {
    if (!session) return;
    setChecking(true);
    setStatusMsg("");

    const { data, error } = await supabase
      .from("players")
      .select("status")
      .eq("chess_username", session.chess_username)
      .single();

    setChecking(false);

    if (error || !data) {
      setStatusMsg("Could not check status. Please try again.");
      return;
    }

    if (data.status === "approved") {
      const updated = { ...session, status: "approved" };
      refreshSession(updated);
      router.push("/onboarding");
    } else if (data.status === "rejected") {
      setStatusMsg("Your registration was rejected by your coach.");
    } else {
      setStatusMsg("Still pending — your coach hasn't approved you yet.");
    }
  };

  const cancel = () => {
    localStorage.removeItem("playerSession");
    router.push("/login");
  };

  if (!session) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 50% 40%, rgba(245, 158, 11, 0.08) 0%, transparent 65%)",
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "48px 36px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "56px", marginBottom: "20px" }}>⏳</div>

        <h1
          style={{
            fontSize: "24px",
            fontWeight: "700",
            marginBottom: "12px",
            color: "var(--text-primary)",
          }}
        >
          Waiting for Approval
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            lineHeight: "1.6",
            marginBottom: "8px",
          }}
        >
          Hi{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {session.full_name}
          </strong>
          , your account is pending approval.
        </p>

        {coachName && (
          <p
            style={{
              color: "var(--text-secondary)",
              lineHeight: "1.6",
              marginBottom: "28px",
            }}
          >
            Waiting on{" "}
            <strong style={{ color: "var(--accent-color)" }}>
              {coachName}
            </strong>{" "}
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
          <p
            style={{
              fontSize: "13px",
              color: "var(--warning)",
              fontWeight: "600",
            }}
          >
            Your Chess.com username:{" "}
            <code style={{ fontFamily: "monospace" }}>
              {session.chess_username}
            </code>
          </p>
        </div>

        {statusMsg && (
          <div
            style={{
              color: statusMsg.includes("rejected")
                ? "var(--danger)"
                : "var(--text-secondary)",
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
            onClick={cancel}
          >
            Cancel & Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
