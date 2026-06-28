"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Loader from "@/components/Loader";
import { usePlayer } from "@/contexts/PlayerContext";
import { createBatchJob, getBatchJob, getBatchJobs } from "@/services/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const QUALITY_COLOR: Record<string, string> = {
  Brilliant: "#a855f7",
  Best: "var(--success)",
  Excellent: "#34d399",
  Good: "#6ee7b7",
  Book: "#60a5fa",
  Forced: "#94a3b8",
  Inaccuracy: "#fbbf24",
  Mistake: "#f97316",
  Blunder: "var(--danger)",
};

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: "14px", fontWeight: "700", textTransform: "uppercase",
      letterSpacing: "0.8px", color: "var(--text-secondary)", margin: "0 0 16px",
    }}>
      {children}
    </h2>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass-card" style={{ textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: "800", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function QualityBar({ distribution }: { distribution: Record<string, number> }) {
  const order = ["Brilliant", "Best", "Excellent", "Good", "Book", "Forced", "Inaccuracy", "Mistake", "Blunder"];
  const total = order.reduce((s, k) => s + (distribution[k] ?? 0), 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {order.filter(k => (distribution[k] ?? 0) > 0).map(k => {
        const count = distribution[k] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "90px", fontSize: "12px", color: "var(--text-secondary)", flexShrink: 0 }}>{k}</div>
            <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: QUALITY_COLOR[k] || "#888", borderRadius: "4px" }} />
            </div>
            <div style={{ width: "40px", textAlign: "right", fontSize: "12px", fontWeight: "600" }}>{count}</div>
            <div style={{ width: "36px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)" }}>{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

function OpeningTable({ rows, columns }: {
  rows: any[];
  columns: { key: string; label: string; fmt?: (v: any) => string }[];
}) {
  if (!rows?.length) return <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No data available.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: "left", padding: "6px 12px", borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--glass-border)" }}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: "8px 12px", color: "var(--text-primary)" }}>
                  {c.fmt ? c.fmt(row[c.key]) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function BatchPage() {
  const router = useRouter();
  const { chessUsername, isApproved, loading: playerLoading } = usePlayer();

  const [games, setGames] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [pastJobs, setPastJobs] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load games from localStorage + check existing jobs on mount
  useEffect(() => {
    if (playerLoading) return;
    if (!chessUsername || !isApproved) { router.push("/login"); return; }

    const stored = localStorage.getItem("recentGames");
    if (stored) {
      try { setGames(JSON.parse(stored)); } catch {}
    }

    getBatchJobs(chessUsername)
      .then(jobs => {
        const inProgress = jobs.find(j => j.status === "pending" || j.status === "processing");
        const completed = jobs.find(j => j.status === "completed");
        if (inProgress) {
          setActiveJob(inProgress);
          startPolling(inProgress.id);
        } else if (completed) {
          setActiveJob(completed);
        }
        setPastJobs(jobs.filter(j => j.status === "completed" || j.status === "failed").slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [chessUsername, isApproved, playerLoading, router]);

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await getBatchJob(jobId);
        setActiveJob(job);
        if (job.status === "completed" || job.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          getBatchJobs(chessUsername!).then(jobs =>
            setPastJobs(jobs.filter(j => j.status === "completed" || j.status === "failed").slice(0, 5))
          ).catch(() => {});
        }
      } catch {}
    }, 5000);
  }

  async function handleStart() {
    if (!chessUsername || games.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const urls = games.map((g: any) => g.filename).filter(Boolean);
      const job = await createBatchJob(chessUsername, urls);
      setActiveJob(job);
      startPolling(job.id);
    } catch (e: any) {
      setError(e.message || "Failed to start batch analysis.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleViewPast(job: any) {
    setActiveJob(job);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (playerLoading || pageLoading) {
    return (
      <>
        <Header />
        <div className="flex-center" style={{ minHeight: "60vh" }}>
          <Loader message="Loading..." />
        </div>
      </>
    );
  }

  const result = activeJob?.result;
  const isRunning = activeJob?.status === "pending" || activeJob?.status === "processing";
  const isFailed = activeJob?.status === "failed";
  const isDone = activeJob?.status === "completed" && result;

  return (
    <>
      <Header />
      <main className="container animate-fade-in" style={{ paddingTop: "40px", paddingBottom: "80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", margin: "0 0 8px" }}>Batch Analysis</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Analyze all your loaded games at once. Gets blunders, time pressure patterns, and opening insights — server-side using the full Stockfish engine.
          </p>
        </div>

        {/* Trigger panel — show when no job is running or done */}
        {!isRunning && (
          <div className="glass-card" style={{ marginBottom: "32px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
                  {games.length} game{games.length !== 1 ? "s" : ""} ready to analyze
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {games.length === 0
                    ? "Go to the dashboard and load some games first."
                    : "The Python worker will fetch PGNs and analyze each game. Results appear here when done."}
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleStart}
                disabled={submitting || games.length === 0}
                style={{ padding: "12px 28px", fontSize: "15px", flexShrink: 0 }}
              >
                {submitting ? "Starting…" : `Analyze ${games.length} Games`}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: "14px", color: "var(--danger)", fontSize: "13px", background: "rgba(239,68,68,0.08)", padding: "10px 14px", borderRadius: "8px" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* In-progress state */}
        {isRunning && (
          <div className="glass-card" style={{ marginBottom: "32px", padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚙️</div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 8px" }}>
              Analysis in progress
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: "0 0 8px", fontSize: "14px" }}>
              The worker is analyzing your games. This typically takes 1–5 minutes depending on game count.
            </p>
            <p style={{ color: "var(--text-secondary)", margin: "0 0 24px", fontSize: "13px" }}>
              You can close this tab — the analysis runs on the server. Come back to see results.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(29,193,137,0.08)", border: "1px solid rgba(29,193,137,0.2)", borderRadius: "12px", padding: "10px 20px" }}>
              <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid var(--accent-color)", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: "13px", color: "var(--accent-color)", fontWeight: "600" }}>
                Status: {activeJob.status}
              </span>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="glass-card" style={{ marginBottom: "32px", padding: "24px", borderColor: "var(--danger)" }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--danger)", marginBottom: "6px" }}>Analysis failed</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              The worker encountered an error. This usually means a PGN could not be fetched from Chess.com or Lichess. Try again or load different games.
            </div>
            <button className="btn btn-primary" onClick={handleStart} disabled={submitting || games.length === 0}>
              {submitting ? "Starting…" : "Try Again"}
            </button>
          </div>
        )}

        {/* Results */}
        {isDone && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

            {/* Summary row */}
            <section>
              <SectionHeader>Summary — {result.total_analyzed} games analyzed</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "16px" }}>
                <StatBox label="Avg Accuracy" value={`${result.average_accuracy}%`} />
                <StatBox
                  label="Blunders"
                  value={result.move_quality_distribution?.Blunder ?? 0}
                  sub="total across all games"
                />
                <StatBox
                  label="Mistakes"
                  value={result.move_quality_distribution?.Mistake ?? 0}
                />
                <StatBox
                  label="Inaccuracies"
                  value={result.move_quality_distribution?.Inaccuracy ?? 0}
                />
                {result.openings?.repertoire?.unique_openings != null && (
                  <StatBox
                    label="Unique Openings"
                    value={result.openings.repertoire.unique_openings}
                  />
                )}
              </div>
            </section>

            {/* Blunders & Mistakes */}
            <section>
              <SectionHeader>Move Quality Distribution</SectionHeader>
              <div className="glass-card">
                <QualityBar distribution={result.move_quality_distribution ?? {}} />

                {/* Worst blunders table */}
                {(result.move_breakdown?.Blunder?.length > 0 || result.move_breakdown?.Mistake?.length > 0) && (
                  <div style={{ marginTop: "24px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "12px", color: "var(--text-secondary)" }}>
                      Worst moves
                    </div>
                    <OpeningTable
                      rows={[
                        ...(result.move_breakdown?.Blunder ?? []).slice(0, 5).map((m: any) => ({ ...m, label: "Blunder" })),
                        ...(result.move_breakdown?.Mistake ?? []).slice(0, 3).map((m: any) => ({ ...m, label: "Mistake" })),
                      ]}
                      columns={[
                        { key: "label", label: "Type" },
                        { key: "game", label: "Game" },
                        { key: "move_num", label: "#" },
                        { key: "san", label: "Move" },
                        { key: "best_move", label: "Best" },
                        { key: "phase", label: "Phase" },
                        { key: "cp_loss", label: "CP Loss", fmt: v => v != null ? v.toFixed(1) : "—" },
                      ]}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Time Pressure */}
            {result.time_analysis && (
              <section>
                <SectionHeader>Time Pressure</SectionHeader>
                <div className="glass-card">
                  {result.time_analysis.games_with_time_data === 0 ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                      No clock data found in these games (clock data is only available in PGN files that include it).
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
                        <StatBox
                          label="Games w/ Time Pressure"
                          value={`${result.time_analysis.games_with_time_pressure}/${result.time_analysis.games_with_time_data}`}
                          sub={`${result.time_analysis.time_pressure_pct}% of games`}
                        />
                        <StatBox
                          label="Avg Rush Moves/Game"
                          value={result.time_analysis.avg_time_pressure_moves_per_game}
                          sub="moves under 5s"
                        />
                      </div>

                      {result.time_analysis.phase_avg_time && (
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Avg seconds per move by phase
                          </div>
                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            {(["opening", "middlegame", "endgame"] as const).map(phase => {
                              const val = result.time_analysis.phase_avg_time[phase];
                              return (
                                <div key={phase} style={{ background: "var(--surface-2)", borderRadius: "10px", padding: "12px 18px", textAlign: "center" }}>
                                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "capitalize", marginBottom: "4px" }}>{phase}</div>
                                  <div style={{ fontSize: "22px", fontWeight: "700" }}>{val != null ? `${val}s` : "—"}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Opening Repertoire */}
            {result.openings?.performance?.by_opening?.length > 0 && (
              <section>
                <SectionHeader>Opening Repertoire</SectionHeader>
                <div className="glass-card">
                  <OpeningTable
                    rows={result.openings.performance.by_opening}
                    columns={[
                      { key: "opening", label: "Opening" },
                      { key: "games_played", label: "Games" },
                      { key: "win_rate", label: "Win Rate", fmt: v => `${v}%` },
                      { key: "avg_accuracy", label: "Avg Accuracy", fmt: v => `${v}%` },
                    ]}
                  />
                </div>
              </section>
            )}

            {/* Weak Openings */}
            {result.openings?.mistakes?.worst_openings?.length > 0 && (
              <section>
                <SectionHeader>Problem Openings</SectionHeader>
                <div className="glass-card">
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 14px" }}>
                    Openings where you make the most mistakes in the opening phase.
                  </p>
                  <OpeningTable
                    rows={result.openings.mistakes.worst_openings}
                    columns={[
                      { key: "opening", label: "Opening" },
                      { key: "games", label: "Games" },
                      { key: "errors", label: "Opening Errors" },
                      { key: "error_rate", label: "Errors/Game", fmt: v => v?.toFixed(2) },
                    ]}
                  />
                </div>
              </section>
            )}

            {/* Phase accuracy */}
            {result.phase_performance && (
              <section>
                <SectionHeader>Accuracy by Phase</SectionHeader>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {(["opening", "middlegame", "endgame"] as const).map(phase => (
                    <div key={phase} className="glass-card" style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "capitalize", marginBottom: "6px" }}>{phase}</div>
                      <div style={{ fontSize: "28px", fontWeight: "800" }}>{result.phase_performance[phase] ?? 0}%</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Run again */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "8px" }}>
              <button
                className="btn btn-secondary"
                onClick={handleStart}
                disabled={submitting || games.length === 0}
              >
                {submitting ? "Starting…" : "Re-analyze"}
              </button>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Analyzed on {fmtDate(activeJob.created_at)}
              </span>
            </div>
          </div>
        )}

        {/* Past analyses */}
        {pastJobs.length > 1 && (
          <div style={{ marginTop: "40px" }}>
            <SectionHeader>Past Analyses</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pastJobs.map(job => (
                <div
                  key={job.id}
                  className="glass-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", cursor: "pointer", opacity: activeJob?.id === job.id ? 0.6 : 1 }}
                  onClick={() => handleViewPast(job)}
                >
                  <div style={{ fontSize: "13px" }}>
                    {job.result?.total_analyzed ?? "?"} games &mdash; {fmtDate(job.created_at)}
                  </div>
                  <div style={{ fontSize: "12px", color: job.status === "completed" ? "var(--success)" : "var(--danger)", fontWeight: "600", textTransform: "capitalize" }}>
                    {job.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  );
}
