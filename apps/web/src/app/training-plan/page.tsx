"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Loader from "@/components/Loader";
import { usePlayer } from "@/contexts/PlayerContext";
import { getTrainingPlan } from "@/services/api";
import { Clock } from "lucide-react";

const PUZZLE_DESCRIPTIONS: Record<string, string> = {
  "Piece Safety":
    "Identify and defend hanging or undefended pieces before your opponent exploits them.",
  Forks:
    "Practise recognising knight and pawn forks — moves that attack two pieces simultaneously.",
  Pins: "Find pinned pieces and learn when to exploit a pin or break out of one.",
  Skewers:
    "Attack a high-value piece to win the piece behind it after it moves.",
  "Discovered Attacks":
    "Move one piece to reveal an attack from another — a powerful hidden tactic.",
  "Back Rank Mate":
    "Spot back-rank weaknesses and learn to protect your own king.",
  "Endgame Fundamentals":
    "Master king and pawn endgames, Lucena position, and basic rook endings.",
  "Mixed Tactics":
    "A broad set of tactical motifs to sharpen your overall calculation.",
  "Tactical Combinations":
    "Multi-move combinations involving sacrifice and material win sequences.",
};

function PuzzleThemeCard({ theme }: { theme: string }) {
  const desc =
    PUZZLE_DESCRIPTIONS[theme] ||
    "Work through positions featuring this specific tactical or strategic motif.";
  return (
    <div
      style={{
        padding: "18px 20px",
        background: "var(--surface-1)",
        borderRadius: "10px",
        border: "1px solid var(--glass-border)",
        borderTop: "3px solid #6366f1",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ fontWeight: "700", fontSize: "15px", color: "#6366f1" }}>
        🧩 {theme}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: "1.6",
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function StudyFocusRow({ tip }: { tip: any }) {
  const isHigh = tip.priority === "High";
  const isMed = tip.priority === "Medium" || tip.priority === "Moderate";
  const color = isHigh
    ? "var(--danger)"
    : isMed
      ? "var(--warning)"
      : "var(--accent-color)";
  const bg = isHigh
    ? "rgba(239,68,68,0.08)"
    : isMed
      ? "rgba(245,158,11,0.08)"
      : "rgba(29,193,137,0.08)";
  return (
    <div
      style={{
        padding: "16px",
        background: "var(--surface-1)",
        borderRadius: "8px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: "700", fontSize: "16px" }}>{tip.topic}</span>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 10px",
            borderRadius: "20px",
            fontWeight: "700",
            background: bg,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          {tip.priority} Priority
        </span>
      </div>
      <p
        style={{
          color: "var(--text-secondary)",
          margin: 0,
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      >
        {tip.message}
      </p>
    </div>
  );
}

function OpeningAdjCard({ adj }: { adj: any }) {
  const isHigh = adj.priority === "High";
  const color = isHigh ? "var(--danger)" : "var(--accent-color)";
  const bg = isHigh ? "rgba(239,68,68,0.08)" : "rgba(29,193,137,0.08)";
  const name = adj.opening || adj.topic || adj.name || "Opening";
  const suggestion = adj.suggestion || adj.message || adj.advice || "";
  return (
    <div
      style={{
        padding: "16px",
        background: "var(--surface-1)",
        borderRadius: "8px",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: "700", fontSize: "16px" }}>{name}</span>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 10px",
            borderRadius: "20px",
            fontWeight: "700",
            background: bg,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          {adj.priority || "Medium"} Priority
        </span>
      </div>
      {suggestion && (
        <p
          style={{
            color: "var(--text-secondary)",
            margin: 0,
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {suggestion}
        </p>
      )}
    </div>
  );
}

export default function TrainingPlanPage() {
  const router = useRouter();
  const { chessUsername, isApproved, loading: playerLoading } = usePlayer();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (playerLoading) return;
    if (!chessUsername || !isApproved) {
      router.push("/login");
      return;
    }

    getTrainingPlan(chessUsername)
      .then(setPlan)
      .catch((e) => {
        console.error(e);
        alert(
          "Failed to load training plan. Ensure you have run Batch Analysis first.",
        );
      })
      .finally(() => setLoading(false));
  }, [chessUsername, isApproved, playerLoading, router]);

  if (!chessUsername) return null;

  return (
    <>
      <Header />
      <main
        className="container animate-fade-in"
        style={{ paddingTop: "40px", paddingBottom: "60px" }}
      >
        <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
          Personalized Training Plan
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
          Custom study guide based on your recent mistakes and weaknesses.
        </p>

        {loading ? (
          <Loader message="Generating your training plan..." />
        ) : plan ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "32px" }}
          >
            {/* Overall Strategy */}
            <div
              className="glass-card"
              style={{
                padding: "32px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  Overall Strategy
                </h3>
                <h2
                  style={{
                    fontSize: "24px",
                    color: "var(--warning)",
                    fontWeight: "bold",
                    margin: 0,
                  }}
                >
                  {plan.overall_strategy}
                </h2>
                {plan.strategy_description && (
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      margin: "10px 0 0",
                      fontSize: "14px",
                      lineHeight: "1.6",
                    }}
                  >
                    {plan.strategy_description}
                  </p>
                )}
              </div>
              <div
                style={{
                  padding: "16px 20px",
                  background: "rgba(245,158,11,0.06)",
                  borderRadius: "12px",
                  border: "1px solid rgba(245,158,11,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <Clock size={24} color="var(--warning)" />
                <div>
                  <div
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    Daily Commitment
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "var(--warning)",
                    }}
                  >
                    {plan.estimated_training_time || "1 hour per day"}
                  </div>
                </div>
              </div>
            </div>

            {/* Study Focus */}
            <div className="glass-card" style={{ padding: "32px" }}>
              <h3
                style={{
                  marginBottom: "24px",
                  fontSize: "20px",
                  color: "var(--accent-color)",
                }}
              >
                Study Focus Areas
              </h3>
              {plan.study_focus?.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {plan.study_focus.map((tip: any, idx: number) => (
                    <StudyFocusRow key={idx} tip={tip} />
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)" }}>
                  No specific study focus suggestions needed. Keep doing what
                  you&apos;re doing!
                </p>
              )}
            </div>

            {/* Opening Adjustments — ALL openings shown */}
            <div className="glass-card" style={{ padding: "32px" }}>
              <h3 style={{ marginBottom: "8px", fontSize: "20px" }}>
                Opening Repertoire Adjustments
              </h3>
              {plan.opening_adjustments?.length > 0 ? (
                <>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      marginBottom: "20px",
                      fontSize: "14px",
                    }}
                  >
                    {plan.opening_adjustments.length} opening
                    {plan.opening_adjustments.length > 1 ? "s" : ""} flagged for
                    attention:
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    {plan.opening_adjustments.map((adj: any, idx: number) => (
                      <OpeningAdjCard key={idx} adj={adj} />
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                  Your current opening choices look solid and well-played!
                </p>
              )}
            </div>

            {/* Puzzle Themes — rich cards */}
            {plan.recommended_puzzle_themes?.length > 0 && (
              <div className="glass-card" style={{ padding: "32px" }}>
                <h3 style={{ marginBottom: "8px", fontSize: "20px" }}>
                  Recommended Puzzle Themes
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    marginBottom: "20px",
                    fontSize: "14px",
                  }}
                >
                  Solving puzzles on these themes will directly target your most
                  common tactical errors:
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {plan.recommended_puzzle_themes.map(
                    (theme: string, idx: number) => (
                      <PuzzleThemeCard key={idx} theme={theme} />
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="glass"
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            Training plan is unavailable. Please go back to Dashboard and run
            Batch Analysis.
          </div>
        )}
      </main>
    </>
  );
}
