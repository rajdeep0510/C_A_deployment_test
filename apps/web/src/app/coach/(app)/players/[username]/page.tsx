"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import CoachHeader from "@/components/CoachHeader";
import Loader from "@/components/Loader";
import ChartRadar from "@/components/ChartRadar";
import ChartLine from "@/components/ChartLine";
import ChartPie from "@/components/ChartPie";
import OpeningTable from "@/components/OpeningTable";
import PatternGrid from "@/components/PatternGrid";
import TimeAnalysisCard from "@/components/TimeAnalysisCard";
import {
  getReport,
  getTrainingPlan,
  getStats,
  fetchGames,
  batchAnalyze,
  getOpenings,
} from "@/services/api";
import { Calendar, Swords, Search, Loader2 } from "lucide-react";

type Section =
  | "overview"
  | "performance"
  | "openings"
  | "mistakes"
  | "training"
  | "games";

const MOVE_QUALITY_COLORS: Record<string, string> = {
  Brilliant: "#6366f1",
  Best: "#10b981",
  Excellent: "#22d3ee",
  Good: "#3b82f6",
  Inaccuracy: "#f59e0b",
  Mistake: "#f97316",
  Blunder: "#ef4444",
};

const PUZZLE_DESCRIPTIONS: Record<string, string> = {
  "Piece Safety":
    "Identify and defend hanging or undefended pieces before the opponent exploits them.",
  Forks:
    "Practise recognising knight and pawn forks — moves that attack two pieces simultaneously.",
  Pins: "Find pinned pieces and learn when to exploit a pin or break out of one.",
  Skewers: "Attack a high-value piece to win the one behind it after it moves.",
  "Discovered Attacks":
    "Move one piece to reveal an attack from another — a powerful hidden tactic.",
  "Back Rank Mate": "Spot back-rank weaknesses and learn to protect the king.",
  "Endgame Fundamentals":
    "Master king and pawn endings, Lucena position, and basic rook endings.",
  "Mixed Tactics":
    "A broad set of tactical motifs to sharpen overall calculation.",
  "Tactical Combinations":
    "Multi-move combinations involving sacrifice and material wins.",
};

function buildMoveQualityData(dist: Record<string, number> | undefined) {
  if (!dist) return [];
  return Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: MOVE_QUALITY_COLORS[name] || "#888",
    }));
}

function buildOpeningRows(perf: any) {
  if (!perf) return [];
  if (Array.isArray(perf)) {
    return perf.map((d: any) => ({
      name: d.opening_name || d.name || d.opening || "Unknown",
      eco: d.eco_code || d.eco,
      wins: d.wins ?? d.win ?? 0,
      losses: d.losses ?? d.loss ?? 0,
      draws: d.draws ?? d.draw ?? 0,
      accuracy: d.avg_accuracy != null ? parseFloat(d.avg_accuracy) : undefined,
      mistake_rate:
        d.mistake_rate != null ? parseFloat(d.mistake_rate) : undefined,
    }));
  }
  return Object.entries(perf as Record<string, any>).map(([id, data]) => {
    const name = id.includes(":")
      ? id.split(":").slice(1).join(":").trim()
      : id;
    const eco = id.includes(":") ? id.split(":")[0].trim() : undefined;
    const d = data?.combined ?? data?.by_color?.white ?? data;
    return {
      name,
      eco,
      wins: d?.wins ?? 0,
      losses: d?.losses ?? 0,
      draws: d?.draws ?? 0,
      accuracy:
        d?.avg_accuracy != null ? parseFloat(d.avg_accuracy) : undefined,
      mistake_rate:
        d?.mistake_rate != null ? parseFloat(d.mistake_rate) : undefined,
    };
  });
}

function winRatePct(
  wr: any,
): { pct: number; w: number; l: number; d: number } | undefined {
  if (!wr) return undefined;
  const w = wr.wins ?? wr.win ?? 0;
  const l = wr.losses ?? wr.loss ?? 0;
  const d = wr.draws ?? wr.draw ?? 0;
  const t = w + l + d;
  if (t === 0) return undefined;
  return { pct: Math.round((w / t) * 100), w, l, d };
}

export default function CoachPlayerView({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const router = useRouter();
  const { username } = use(params);
  const { coachProfile } = useAuth();

  const [player, setPlayer] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [quickOpenings, setQuickOpenings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("overview");

  // Games tab state
  const [games, setGames] = useState<any[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [platform, setPlatform] = useState<"chess.com" | "lichess">(
    "chess.com",
  );
  const [gameLimit, setGameLimit] = useState(10);

  // Batch analysis state
  const [batchStep, setBatchStep] = useState<"idle" | "fetching" | "analyzing">(
    "idle",
  );
  const [batchLimit, setBatchLimit] = useState(10);
  const [batchDone, setBatchDone] = useState(false);
  const [batchError, setBatchError] = useState("");
  const batchLoading = batchStep !== "idle";

  useEffect(() => {
    if (!coachProfile || !username) return;
    async function load() {
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("chess_username", username)
        .eq("coach_id", coachProfile.id)
        .single();
      if (!playerData) {
        router.push("/coach/dashboard");
        return;
      }
      setPlayer(playerData);
      const [reportRes, planRes, statsRes, openingsRes] =
        await Promise.allSettled([
          getReport(username),
          getTrainingPlan(username),
          getStats(username),
          getOpenings(username),
        ]);
      if (reportRes.status === "fulfilled") setReportData(reportRes.value);
      if (planRes.status === "fulfilled") setPlan(planRes.value);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (
        openingsRes.status === "fulfilled" &&
        Array.isArray(openingsRes.value)
      )
        setQuickOpenings(openingsRes.value);
      setLoading(false);
    }
    load();
  }, [coachProfile, username, router]);

  const handleLoadGames = async () => {
    setGamesLoading(true);
    try {
      const data = await fetchGames(platform, username, gameLimit);
      setGames(Array.isArray(data) ? data : (data.games ?? []));
      setGamesLoaded(true);
    } catch (e) {
      console.error(e);
      alert(
        "Failed to fetch games. Make sure the backend is running and the player has games on that platform.",
      );
    } finally {
      setGamesLoading(false);
    }
  };

  const handleBatchAnalyze = async () => {
    setBatchStep("fetching");
    setBatchError("");
    setBatchDone(false);
    try {
      // Step 1: download games from the chess platform and save them to disk
      const fetched = await fetchGames(platform, username, batchLimit);
      const saved = Array.isArray(fetched) ? fetched : (fetched?.games ?? []);
      if (saved.length === 0) {
        setBatchError(
          `No games found for "${username}" on ${platform === "chess.com" ? "Chess.com" : "Lichess"}. ` +
            `Check that the username is correct and has played games on this platform.`,
        );
        setBatchStep("idle");
        return;
      }

      // Step 2: run Stockfish analysis on the downloaded games
      setBatchStep("analyzing");
      await batchAnalyze(username, saved.length);
      setBatchDone(true);
      setBatchStep("idle");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setBatchError(
        e?.message || "Something went wrong. Make sure the backend is running.",
      );
      setBatchStep("idle");
    }
  };

  if (loading || !player)
    return (
      <>
        <CoachHeader />
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader message={`Loading ${username}'s data…`} />
        </div>
      </>
    );

  const TABS: { key: Section; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "performance", label: "Performance" },
    { key: "openings", label: "Openings" },
    { key: "mistakes", label: "Mistakes & Patterns" },
    { key: "training", label: "Training Plan" },
    { key: "games", label: "Games" },
  ];

  const noData = (msg: string) => (
    <div
      className="glass"
      style={{
        padding: "40px",
        textAlign: "center",
        color: "var(--text-secondary)",
      }}
    >
      {msg}
    </div>
  );

  const batchPanel = (
    <div
      className="glass-card"
      style={{
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "24px",
      }}
    >
      <div style={{ fontSize: "52px", lineHeight: 1 }}>♟</div>
      <div>
        <h3 style={{ fontSize: "20px", marginBottom: "10px" }}>
          No Analysis Data Yet
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
            maxWidth: "440px",
            lineHeight: "1.6",
          }}
        >
          Choose a platform, select how many games to pull, then click the
          button. Games are fetched automatically — no prior setup needed.
          Stockfish then evaluates every move and generates the full report,
          opening stats, pattern detection, and training plan.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "340px",
        }}
      >
        <label
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            fontWeight: "600",
            textAlign: "left",
          }}
        >
          Platform
        </label>
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--surface-1)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {(["chess.com", "lichess"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: "7px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                background: platform === p ? "rgba(255,255,255,0.9)" : "transparent",
                color: platform === p ? "#111" : "var(--text-secondary)",
                transition: "all 0.2s",
              }}
            >
              {p === "chess.com" ? "Chess.com" : "Lichess"}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "340px",
        }}
      >
        <label
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            fontWeight: "600",
            textAlign: "left",
          }}
        >
          Games to Analyze —{" "}
          <span style={{ color: "#6366f1" }}>{batchLimit}</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            1
          </span>
          <input
            type="range"
            min={1}
            max={50}
            value={batchLimit}
            onChange={(e) => setBatchLimit(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#6366f1", cursor: "pointer" }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            50
          </span>
          <input
            type="number"
            min={1}
            max={50}
            value={batchLimit}
            onChange={(e) =>
              setBatchLimit(Math.min(50, Math.max(1, Number(e.target.value))))
            }
            style={{
              width: "54px",
              padding: "5px 8px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: "600",
              textAlign: "center",
            }}
          />
        </div>
      </div>

      <button
        onClick={handleBatchAnalyze}
        disabled={batchLoading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "13px 36px",
          borderRadius: "10px",
          fontSize: "15px",
          fontWeight: "700",
          background: "rgba(255,255,255,0.9)",
          color: "#111",
          border: "none",
          cursor: batchLoading ? "not-allowed" : "pointer",
          opacity: batchLoading ? 0.75 : 1,
          transition: "all 0.2s",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}
      >
        {batchLoading ? (
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <span>⚙</span>
        )}
        {batchStep === "fetching"
          ? `Fetching ${batchLimit} games from ${platform === "chess.com" ? "Chess.com" : "Lichess"}…`
          : batchStep === "analyzing"
            ? "Analyzing with Stockfish… this may take a minute"
            : `Fetch & Analyze ${batchLimit} Games`}
      </button>

      {batchDone && (
        <p
          style={{
            color: "var(--success)",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          ✓ Analysis complete — reloading page…
        </p>
      )}
      {batchError && (
        <p style={{ color: "var(--danger)", fontSize: "13px" }}>{batchError}</p>
      )}
    </div>
  );

  return (
    <>
      <CoachHeader />
      <main
        className="container animate-fade-in"
        style={{ paddingTop: "40px", paddingBottom: "60px" }}
      >
        {/* Back + player header */}
        <button
          onClick={() => router.push("/coach/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-secondary)",
            fontSize: "14px",
            fontWeight: "500",
            marginBottom: "24px",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div
          className="flex-between"
          style={{ marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}
        >
          <div>
            <h1 style={{ fontSize: "32px", marginBottom: "4px" }}>
              {player.full_name}
            </h1>
            <p
              style={{
                color: "var(--accent-color)",
                fontWeight: "600",
                fontSize: "16px",
              }}
            >
              @{player.chess_username}
            </p>
          </div>
          {reportData?.report?.period_summary && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  padding: "8px 16px",
                  background: "rgba(29,193,137,0.1)",
                  border: "1px solid rgba(29,193,137,0.2)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "var(--accent-color)",
                }}
              >
                {parseFloat(
                  reportData.report.period_summary.overall_avg_accuracy,
                ).toFixed(1)}
                % accuracy
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                }}
              >
                {reportData.report.period_summary.games_analyzed} games
              </div>
            </div>
          )}
        </div>

        {/* Tab pill */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--surface-1)",
            padding: "4px",
            borderRadius: "12px",
            marginBottom: "32px",
            border: "1px solid var(--border-subtle)",
            flexWrap: "wrap",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveSection(t.key)}
              style={{
                padding: "8px 20px",
                borderRadius: "9px",
                fontSize: "14px",
                fontWeight: "600",
                background: activeSection === t.key ? "rgba(255,255,255,0.9)" : "transparent",
                color:
                  activeSection === t.key ? "#111" : "var(--text-secondary)",
                transition: "all 0.2s ease",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeSection === "overview" &&
          (!reportData ? (
            batchPanel
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              {/* Stats strip */}
              {reportData.report?.period_summary && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {[
                    {
                      label: "Games Analyzed",
                      value: reportData.report.period_summary.games_analyzed,
                      color: "var(--text-primary)",
                    },
                    {
                      label: "Avg Accuracy",
                      value: `${parseFloat(reportData.report.period_summary.overall_avg_accuracy).toFixed(1)}%`,
                      color: "var(--accent-color)",
                    },
                    {
                      label: "Win Rate",
                      value: stats
                        ? (() => {
                            const wr = winRatePct(stats.win_rate);
                            return wr ? `${wr.pct}%` : "—";
                          })()
                        : "—",
                      color: "var(--success)",
                    },
                    {
                      label: "Momentum",
                      value: reportData.report.period_summary.current_momentum,
                      color: (
                        reportData.report.period_summary.current_momentum || ""
                      )
                        .toLowerCase()
                        .includes("improv")
                        ? "var(--success)"
                        : "var(--text-primary)",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="glass-card"
                      style={{ padding: "16px 20px" }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          marginBottom: "6px",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{ fontSize: "22px", fontWeight: "800", color }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Charts */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                  gap: "24px",
                }}
              >
                <div className="glass-card">
                  <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                    Phase Performance
                  </h3>
                  <ChartRadar
                    data={
                      reportData.visuals?.phase_radar?.labels
                        ? reportData.visuals.phase_radar.labels.map(
                            (l: string, i: number) => ({
                              subject: l,
                              score: reportData.visuals.phase_radar.data[i],
                            }),
                          )
                        : []
                    }
                    dataKey="score"
                  />
                </div>
                <div className="glass-card">
                  <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                    Accuracy Over Time
                  </h3>
                  <ChartLine
                    data={
                      reportData.visuals?.accuracy_over_time?.labels
                        ? reportData.visuals.accuracy_over_time.labels.map(
                            (l: string, i: number) => ({
                              date: l,
                              accuracy:
                                reportData.visuals.accuracy_over_time.data[i],
                            }),
                          )
                        : []
                    }
                    dataKey="accuracy"
                    xAxisKey="date"
                  />
                </div>
              </div>

              {/* Cohort benchmark */}
              {reportData.benchmarks && (
                <div
                  className="glass-card"
                  style={{
                    padding: "24px",
                    display: "flex",
                    gap: "24px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, var(--accent-color), #2563eb)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "18px",
                      flexShrink: 0,
                    }}
                  >
                    {reportData.benchmarks.percentile_estimate}%
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        marginBottom: "4px",
                      }}
                    >
                      Cohort:{" "}
                      <strong
                        style={{
                          color: "var(--text-primary)",
                          textTransform: "capitalize",
                        }}
                      >
                        {reportData.benchmarks.cohort}
                      </strong>{" "}
                      · Accuracy gap:{" "}
                      <strong
                        style={{
                          color:
                            (reportData.benchmarks.comparison?.gap ?? 0) >= 0
                              ? "var(--success)"
                              : "var(--danger)",
                        }}
                      >
                        {(reportData.benchmarks.comparison?.gap ?? 0) >= 0
                          ? "+"
                          : ""}
                        {parseFloat(
                          reportData.benchmarks.comparison?.gap ?? 0,
                        ).toFixed(1)}
                        %
                      </strong>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {reportData.benchmarks.insight}
                    </p>
                  </div>
                </div>
              )}

              {/* Top action items */}
              {reportData.report?.top_action_items?.length > 0 && (
                <div className="glass-card">
                  <h3
                    style={{
                      marginBottom: "16px",
                      fontSize: "17px",
                      color: "var(--warning)",
                    }}
                  >
                    Top Action Items for Coach
                  </h3>
                  <ul
                    style={{
                      paddingLeft: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      margin: 0,
                    }}
                  >
                    {reportData.report.top_action_items.map(
                      (item: string, i: number) => (
                        <li
                          key={i}
                          style={{
                            fontSize: "14px",
                            color: "var(--text-secondary)",
                            lineHeight: "1.5",
                          }}
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              {reportData.report?.strengths_weaknesses && (
                <div className="glass-card">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "24px",
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          color: "var(--success)",
                          marginBottom: "12px",
                          fontSize: "15px",
                        }}
                      >
                        Strengths
                      </h4>
                      <ul
                        style={{
                          paddingLeft: "18px",
                          color: "var(--text-secondary)",
                          lineHeight: "1.7",
                          margin: 0,
                        }}
                      >
                        {(
                          reportData.report.strengths_weaknesses.strengths || []
                        ).map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4
                        style={{
                          color: "var(--danger)",
                          marginBottom: "12px",
                          fontSize: "15px",
                        }}
                      >
                        Weaknesses
                      </h4>
                      <ul
                        style={{
                          paddingLeft: "18px",
                          color: "var(--text-secondary)",
                          lineHeight: "1.7",
                          margin: 0,
                        }}
                      >
                        {(
                          reportData.report.strengths_weaknesses.weaknesses ||
                          []
                        ).map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* ── TAB 2: PERFORMANCE ── */}
        {activeSection === "performance" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "28px" }}
          >
            {/* Win rate by color */}
            {stats?.win_rate && (
              <div className="glass-card">
                <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                  Win Rate by Color
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {(["white", "black"] as const).map((color) => {
                    const d =
                      stats.win_rate[`as_${color}`] || stats.win_rate[color];
                    if (!d) return null;
                    const wr = winRatePct(d);
                    if (!wr) return null;
                    return (
                      <div
                        key={color}
                        style={{
                          padding: "16px",
                          background: "var(--surface-1)",
                          borderRadius: "10px",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "4px",
                              background: color === "white" ? "#eee" : "#333",
                              color: color === "white" ? "#111" : "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "bold",
                              fontSize: "11px",
                            }}
                          >
                            {color === "white" ? "W" : "B"}
                          </div>
                          <span
                            style={{
                              fontWeight: "600",
                              textTransform: "capitalize",
                            }}
                          >
                            As {color}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: "800",
                            color: "var(--success)",
                            marginBottom: "6px",
                          }}
                        >
                          {wr.pct}%
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            fontSize: "13px",
                            marginBottom: "10px",
                          }}
                        >
                          <span style={{ color: "var(--success)" }}>
                            {wr.w}W
                          </span>
                          <span style={{ color: "var(--danger)" }}>
                            {wr.l}L
                          </span>
                          <span style={{ color: "var(--warning)" }}>
                            {wr.d}D
                          </span>
                        </div>
                        <div
                          style={{
                            height: "5px",
                            borderRadius: "3px",
                            background: "var(--surface-2)",
                            overflow: "hidden",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              width: `${(wr.w / (wr.w + wr.l + wr.d)) * 100}%`,
                              background: "var(--success)",
                            }}
                          />
                          <div
                            style={{
                              width: `${(wr.d / (wr.w + wr.l + wr.d)) * 100}%`,
                              background: "var(--warning)",
                            }}
                          />
                          <div
                            style={{
                              width: `${(wr.l / (wr.w + wr.l + wr.d)) * 100}%`,
                              background: "var(--danger)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Move quality pie */}
            {reportData &&
              (reportData.visuals?.mistake_distribution ||
                reportData.move_breakdown) && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                    Move Quality Distribution
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "24px",
                      alignItems: "center",
                    }}
                  >
                    <ChartPie
                      data={buildMoveQualityData(
                        reportData.visuals?.mistake_distribution?.data
                          ? Object.fromEntries(
                              (
                                reportData.visuals.mistake_distribution
                                  .labels || []
                              ).map((l: string, i: number) => [
                                l,
                                reportData.visuals.mistake_distribution.data[i],
                              ]),
                            )
                          : reportData.move_breakdown,
                      )}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {Object.entries(MOVE_QUALITY_COLORS).map(([q, color]) => {
                        const val = reportData.move_breakdown?.[q] ?? 0;
                        if (!val) return null;
                        return (
                          <div
                            key={q}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "4px 0",
                              borderBottom: "1px solid var(--glass-border)",
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "13px",
                              }}
                            >
                              <span
                                style={{
                                  width: "9px",
                                  height: "9px",
                                  borderRadius: "50%",
                                  background: color,
                                  display: "inline-block",
                                }}
                              />
                              {q}
                            </span>
                            <span
                              style={{
                                fontWeight: "700",
                                color,
                                fontSize: "14px",
                              }}
                            >
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            {/* Phase accuracy bars */}
            {reportData?.visuals?.phase_radar && (
              <div className="glass-card">
                <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                  Phase Accuracy
                </h3>
                {(reportData.visuals.phase_radar.labels || []).map(
                  (phase: string, i: number) => {
                    const pct = reportData.visuals.phase_radar.data[i] ?? 0;
                    return (
                      <div key={phase} style={{ marginBottom: "12px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {phase}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: "700" }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: "7px",
                            borderRadius: "4px",
                            background: "var(--surface-2)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(pct, 100)}%`,
                              background:
                                pct >= 70
                                  ? "var(--success)"
                                  : pct >= 50
                                    ? "var(--warning)"
                                    : "var(--danger)",
                              borderRadius: "4px",
                              transition: "width 0.6s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}

            {/* Time analysis */}
            {reportData?.time_analysis && (
              <div className="glass-card">
                <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                  Time Management
                </h3>
                <TimeAnalysisCard
                  avg_time_per_move={
                    reportData.time_analysis.average_time_per_move
                  }
                  phase_breakdown={
                    reportData.time_analysis.phase_time_breakdown
                  }
                  time_pressure_risk={
                    reportData.time_analysis.time_pressure_risk
                  }
                  think_move_count={
                    reportData.time_analysis.think_moves?.length ??
                    reportData.time_analysis.think_move_count
                  }
                />
              </div>
            )}

            {!reportData && !stats && batchPanel}
          </div>
        )}

        {/* ── TAB 3: OPENINGS ── */}
        {activeSection === "openings" &&
          (!reportData?.openings && quickOpenings.length === 0 ? (
            batchPanel
          ) : !reportData?.openings && quickOpenings.length > 0 ? (
            <div
              className="glass-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <h3 style={{ fontSize: "17px", margin: 0 }}>
                  Opening Performance
                </h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                  }}
                >
                  <thead style={{ background: "var(--surface-1)" }}>
                    <tr>
                      {[
                        "Opening",
                        "Games",
                        "Wins",
                        "Losses",
                        "Draws",
                        "Accuracy",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            fontWeight: "600",
                            textAlign: h === "Opening" ? "left" : "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...quickOpenings]
                      .sort((a, b) => b.games - a.games)
                      .map((o, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: "1px solid var(--glass-border)",
                          }}
                        >
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontWeight: "600" }}>{o.name}</div>
                            {o.eco && (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {o.eco}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                              fontWeight: "700",
                            }}
                          >
                            {o.games}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "var(--success)",
                            }}
                          >
                            {o.wins}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "var(--danger)",
                            }}
                          >
                            {o.losses}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                              fontWeight: "700",
                              color: "var(--warning)",
                            }}
                          >
                            {o.draws}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                            }}
                          >
                            {o.accuracy != null ? (
                              <span
                                style={{
                                  fontWeight: "700",
                                  color:
                                    o.accuracy >= 70
                                      ? "var(--success)"
                                      : o.accuracy >= 50
                                        ? "var(--warning)"
                                        : "var(--danger)",
                                }}
                              >
                                {o.accuracy.toFixed(1)}%
                                {o.analyzed < o.games && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--text-secondary)",
                                      fontWeight: "400",
                                      marginLeft: "4px",
                                    }}
                                  >
                                    ({o.analyzed}/{o.games})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                  fontStyle: "italic",
                                }}
                              >
                                <Loader2
                                  size={12}
                                  style={{
                                    animation: "spin 1.5s linear infinite",
                                  }}
                                />{" "}
                                Calculating…
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              {/* Opening performance table */}
              <div className="glass-card">
                <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                  Opening Performance
                </h3>
                <OpeningTable
                  openings={buildOpeningRows(
                    reportData.openings?.performance?.combined ??
                      reportData.openings?.performance,
                  )}
                />
              </div>

              {/* Opening recommendations */}
              {reportData.openings?.recommendations?.length > 0 && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "16px", fontSize: "17px" }}>
                    Opening Recommendations
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {reportData.openings.recommendations.map(
                      (rec: any, i: number) => {
                        const typeColor =
                          rec.type === "Strength"
                            ? "var(--success)"
                            : rec.type === "Study"
                              ? "var(--warning)"
                              : "var(--accent-color)";
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "14px 16px",
                              borderLeft: `4px solid ${typeColor}`,
                              background: `${typeColor}0d`,
                              borderRadius: "0 8px 8px 0",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                color: typeColor,
                                marginBottom: "4px",
                                textTransform: "uppercase",
                              }}
                            >
                              {rec.type}
                            </div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "var(--text-secondary)",
                                lineHeight: "1.5",
                              }}
                            >
                              {rec.message}
                            </p>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* Opponent opening losses */}
              {reportData.openings?.opponent_losses && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "16px", fontSize: "17px" }}>
                    Openings This Player Loses To Most
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {(Array.isArray(
                      reportData.openings.opponent_losses.by_loss_count,
                    )
                      ? reportData.openings.opponent_losses.by_loss_count
                      : []
                    )
                      .slice(0, 5)
                      .map((item: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "var(--surface-1)",
                            borderRadius: "8px",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <span style={{ fontSize: "14px", fontWeight: "600" }}>
                            {item.opening || item.name || item}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              color: "var(--danger)",
                              fontWeight: "700",
                            }}
                          >
                            {item.losses ?? item.loss_count ?? "?"} losses
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* ── TAB 4: MISTAKES & PATTERNS ── */}
        {activeSection === "mistakes" &&
          (!reportData ? (
            batchPanel
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              {/* Error rate strip */}
              {reportData.mistake_frequency && (
                <div>
                  <h3 style={{ fontSize: "17px", marginBottom: "16px" }}>
                    Error Rates (avg per game)
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "14px",
                    }}
                  >
                    {[
                      {
                        label: "Blunders / game",
                        key: "blunders_per_game",
                        color: "var(--danger)",
                      },
                      {
                        label: "Mistakes / game",
                        key: "mistakes_per_game",
                        color: "var(--warning)",
                      },
                      {
                        label: "Inaccuracies / game",
                        key: "inaccuracies_per_game",
                        color: "#f59e0b",
                      },
                      {
                        label: "Errors / 10 moves",
                        key: "errors_per_10_moves",
                        color: "var(--text-secondary)",
                      },
                    ].map(({ label, key, color }) => {
                      const val =
                        reportData.mistake_frequency[key] ??
                        reportData.mistake_frequency?.avg?.[key];
                      if (val == null) return null;
                      return (
                        <div
                          key={key}
                          className="glass-card"
                          style={{ padding: "16px" }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-secondary)",
                              textTransform: "uppercase",
                              marginBottom: "6px",
                            }}
                          >
                            {label}
                          </div>
                          <div
                            style={{
                              fontSize: "24px",
                              fontWeight: "800",
                              color,
                            }}
                          >
                            {parseFloat(val).toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths & weaknesses */}
              {reportData.report?.strengths_weaknesses && (
                <div className="glass-card">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "24px",
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          color: "var(--success)",
                          marginBottom: "12px",
                        }}
                      >
                        Strengths
                      </h4>
                      <ul
                        style={{
                          paddingLeft: "18px",
                          color: "var(--text-secondary)",
                          lineHeight: "1.7",
                          margin: 0,
                        }}
                      >
                        {(
                          reportData.report.strengths_weaknesses.strengths || []
                        ).map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4
                        style={{ color: "var(--danger)", marginBottom: "12px" }}
                      >
                        Weaknesses
                      </h4>
                      <ul
                        style={{
                          paddingLeft: "18px",
                          color: "var(--text-secondary)",
                          lineHeight: "1.7",
                          margin: 0,
                        }}
                      >
                        {(
                          reportData.report.strengths_weaknesses.weaknesses ||
                          []
                        ).map((w: string, i: number) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Pattern grid */}
              {reportData.patterns && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "20px", fontSize: "17px" }}>
                    Pattern Analysis
                  </h3>
                  <PatternGrid
                    tactical={
                      reportData.patterns.tactical?.tactical_summary ||
                      reportData.patterns.tactical
                    }
                    positional={
                      reportData.patterns.positional?.positional_summary ||
                      reportData.patterns.positional
                    }
                    endgame={
                      reportData.patterns.endgame?.endgame_summary ||
                      reportData.patterns.endgame
                    }
                    time_pressure={
                      reportData.patterns.time_pressure
                        ?.time_pressure_summary ||
                      reportData.patterns.time_pressure
                    }
                  />
                  {reportData.patterns.critical_weaknesses?.length > 0 && (
                    <div style={{ marginTop: "20px" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "var(--text-secondary)",
                          textTransform: "uppercase",
                          marginBottom: "10px",
                        }}
                      >
                        Critical Weaknesses
                      </div>
                      <ul
                        style={{
                          paddingLeft: "18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          margin: 0,
                        }}
                      >
                        {reportData.patterns.critical_weaknesses.map(
                          (w: string, i: number) => (
                            <li
                              key={i}
                              style={{
                                fontSize: "14px",
                                color: "var(--text-secondary)",
                                lineHeight: "1.5",
                              }}
                            >
                              {w}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

        {/* ── TAB 5: TRAINING PLAN ── */}
        {activeSection === "training" &&
          (!plan ? (
            batchPanel
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* Strategy header */}
              <div
                className="glass-card"
                style={{
                  padding: "28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    Overall Strategy
                  </h3>
                  <h2
                    style={{
                      fontSize: "22px",
                      color: "var(--warning)",
                      fontWeight: "bold",
                      margin: 0,
                    }}
                  >
                    {plan.overall_strategy}
                  </h2>
                </div>
                <div
                  style={{
                    padding: "14px 18px",
                    background: "rgba(245,158,11,0.06)",
                    borderRadius: "12px",
                    border: "1px solid rgba(245,158,11,0.15)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <Clock size={20} color="var(--warning)" />
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Daily Commitment
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: "var(--warning)",
                      }}
                    >
                      {plan.estimated_training_time || "1 hour per day"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Study focus — ALL items */}
              {plan.study_focus?.length > 0 && (
                <div className="glass-card">
                  <h3
                    style={{
                      marginBottom: "18px",
                      fontSize: "17px",
                      color: "var(--accent-color)",
                    }}
                  >
                    Study Focus Areas
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {plan.study_focus.map((tip: any, idx: number) => {
                      const isHigh = tip.priority === "High";
                      const color = isHigh ? "var(--danger)" : "var(--warning)";
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "14px 16px",
                            background: "var(--surface-1)",
                            borderRadius: "8px",
                            borderLeft: `4px solid ${color}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "6px",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{ fontWeight: "700", fontSize: "15px" }}
                            >
                              {tip.topic}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 10px",
                                borderRadius: "20px",
                                fontWeight: "700",
                                background: isHigh
                                  ? "rgba(239,68,68,0.1)"
                                  : "rgba(245,158,11,0.1)",
                                color,
                              }}
                            >
                              {tip.priority} Priority
                            </span>
                          </div>
                          <p
                            style={{
                              color: "var(--text-secondary)",
                              margin: 0,
                              fontSize: "13px",
                              lineHeight: "1.5",
                            }}
                          >
                            {tip.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opening adjustments — ALL */}
              {plan.opening_adjustments?.length > 0 && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "18px", fontSize: "17px" }}>
                    Opening Repertoire Adjustments
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {plan.opening_adjustments.map((adj: any, idx: number) => {
                      const isHigh = adj.priority === "High";
                      const color = isHigh
                        ? "var(--danger)"
                        : "var(--accent-color)";
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "14px 16px",
                            background: "var(--surface-1)",
                            borderRadius: "8px",
                            borderLeft: `4px solid ${color}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "6px",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{ fontWeight: "700", fontSize: "15px" }}
                            >
                              {adj.opening ||
                                adj.topic ||
                                adj.name ||
                                "Opening"}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 10px",
                                borderRadius: "20px",
                                fontWeight: "700",
                                background: isHigh
                                  ? "rgba(239,68,68,0.1)"
                                  : "rgba(29,193,137,0.1)",
                                color,
                              }}
                            >
                              {adj.priority || "Medium"} Priority
                            </span>
                          </div>
                          {(adj.suggestion || adj.message) && (
                            <p
                              style={{
                                color: "var(--text-secondary)",
                                margin: 0,
                                fontSize: "13px",
                                lineHeight: "1.5",
                              }}
                            >
                              {adj.suggestion || adj.message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Puzzle theme cards */}
              {plan.recommended_puzzle_themes?.length > 0 && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: "8px", fontSize: "17px" }}>
                    Recommended Puzzle Themes
                  </h3>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      marginBottom: "18px",
                      fontSize: "13px",
                    }}
                  >
                    Solving these themes targets the player&apos;s most common
                    tactical errors:
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {plan.recommended_puzzle_themes.map(
                      (theme: string, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: "16px 18px",
                            background: "var(--surface-1)",
                            borderRadius: "10px",
                            border: "1px solid var(--glass-border)",
                            borderTop: "3px solid rgba(255,255,255,0.6)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "700",
                              fontSize: "14px",
                              color: "var(--text-primary)",
                              marginBottom: "6px",
                            }}
                          >
                            🧩 {theme}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              lineHeight: "1.5",
                            }}
                          >
                            {PUZZLE_DESCRIPTIONS[theme] ||
                              "Work through positions featuring this specific tactical or strategic motif."}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* ── TAB 6: GAMES ── */}
        {activeSection === "games" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            {/* Controls card */}
            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "17px", marginBottom: "20px" }}>
                Load Player Games
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                {/* Platform selector */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Platform
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      background: "var(--surface-1)",
                      padding: "4px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {(["chess.com", "lichess"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        style={{
                          padding: "7px 18px",
                          borderRadius: "7px",
                          fontSize: "13px",
                          fontWeight: "600",
                          border: "none",
                          cursor: "pointer",
                          background:
                            platform === p ? "rgba(255,255,255,0.9)" : "transparent",
                          color:
                            platform === p ? "#111" : "var(--text-secondary)",
                          transition: "all 0.2s",
                        }}
                      >
                        {p === "chess.com" ? "Chess.com" : "Lichess"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Limit input */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Number of Games{" "}
                    <span style={{ color: "var(--accent-color)" }}>
                      {gameLimit}
                    </span>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      1
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={gameLimit}
                      onChange={(e) => setGameLimit(Number(e.target.value))}
                      style={{
                        width: "180px",
                        accentColor: "#6366f1",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      50
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={gameLimit}
                      onChange={(e) =>
                        setGameLimit(
                          Math.min(50, Math.max(1, Number(e.target.value))),
                        )
                      }
                      style={{
                        width: "56px",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    />
                  </div>
                </div>

                {/* Load button */}
                <button
                  onClick={handleLoadGames}
                  disabled={gamesLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 24px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "700",
                    background: "rgba(255,255,255,0.9)",
                    color: "#111",
                    border: "none",
                    cursor: gamesLoading ? "not-allowed" : "pointer",
                    opacity: gamesLoading ? 0.7 : 1,
                    transition: "opacity 0.2s",
                    alignSelf: "flex-end",
                  }}
                >
                  {gamesLoading ? (
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <Search size={16} />
                  )}
                  {gamesLoading ? `Fetching ${gameLimit} games…` : "Load Games"}
                </button>
              </div>

              {gamesLoaded && !gamesLoading && (
                <p
                  style={{
                    marginTop: "14px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    margin: "14px 0 0",
                  }}
                >
                  {games.length > 0
                    ? `${games.length} game${games.length > 1 ? "s" : ""} loaded from ${platform === "chess.com" ? "Chess.com" : "Lichess"}.`
                    : "No games found. The player may not have games on this platform."}
                </p>
              )}
            </div>

            {/* Game grid */}
            {games.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "18px",
                }}
              >
                {games.map((game, i) => {
                  const resultLower = (game.result || "").toLowerCase();
                  const resultColor = resultLower.includes("stalemate")
                    ? "#60a5fa"
                    : resultLower.includes("resign")
                      ? "#facc15"
                      : resultLower.includes("win")
                        ? "var(--success)"
                        : "var(--danger)";
                  const dateStr = game.end_time
                    ? new Date(game.end_time * 1000).toLocaleDateString()
                    : game.date || "";
                  return (
                    <div
                      key={i}
                      className="glass-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "3px 10px",
                            borderRadius: "20px",
                            background: "rgba(255,255,255,0.1)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-subtle)",
                            textTransform: "uppercase",
                          }}
                        >
                          {game.platform || platform}
                        </span>
                        {dateStr && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <Calendar size={13} /> {dateStr}
                          </div>
                        )}
                      </div>

                      {/* Players */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "20px" }}>♙</span>
                          <span
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color:
                                game.white === username
                                  ? "var(--accent-color)"
                                  : "var(--text-primary)",
                            }}
                          >
                            {game.white}
                          </span>
                        </div>
                        <Swords
                          size={16}
                          color="var(--text-secondary)"
                          style={{ flexShrink: 0 }}
                        />
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color:
                                game.black === username
                                  ? "var(--accent-color)"
                                  : "var(--text-primary)",
                              textAlign: "right",
                            }}
                          >
                            {game.black}
                          </span>
                          <span style={{ fontSize: "20px" }}>♟</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "10px",
                          borderTop: "1px solid var(--glass-border)",
                        }}
                      >
                        <div style={{ fontSize: "13px" }}>
                          Result:{" "}
                          <span
                            style={{ fontWeight: "700", color: resultColor }}
                          >
                            {game.result || "Unknown"}
                          </span>
                        </div>
                        {game.filename && (
                          <a
                            href={`/coach/players/${username}/analysis/${encodeURIComponent(game.filename)}`}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: "rgba(255,255,255,0.9)",
                              color: "#111",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            Analyze
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
