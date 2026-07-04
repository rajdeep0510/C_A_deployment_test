"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Loader from "@/components/Loader";
import { usePlayer } from "@/contexts/PlayerContext";
import { createBatchJob, getBatchJob, getBatchJobs } from "@/services/api";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

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
  const jobStartRef = useRef<number | null>(null);

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
      jobStartRef.current = Date.now();
      startPolling(job.id);
    } catch (e: any) {
      setError(e.message || "Failed to start batch analysis.");
    } finally {
      setSubmitting(false);
    }
  }

  // All derived values before early return
  const result = activeJob?.result;
  const isRunning = activeJob?.status === "pending" || activeJob?.status === "processing";
  const isFailed = activeJob?.status === "failed";
  const isDone = activeJob?.status === "completed" && result;

  const gamesDone   = activeJob?.games_done  ?? 0;
  const gamesTotal  = activeJob?.games_total ?? 0;
  const currentGame = activeJob?.current_game ?? null;
  const progressPct = gamesTotal > 0 ? Math.round((gamesDone / gamesTotal) * 100) : 0;

  const etaLabel = useMemo(() => {
    if (!isRunning || gamesDone < 2 || !jobStartRef.current) return null;
    const elapsed = (Date.now() - jobStartRef.current) / 1000;
    const avgPerGame = elapsed / gamesDone;
    const remaining = Math.round(avgPerGame * (gamesTotal - gamesDone));
    if (remaining <= 0) return null;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
  }, [isRunning, gamesDone, gamesTotal]);

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

  return (
    <>
      <Header />
      <main className="container animate-fade-in page-content-mobile" style={{ paddingTop: "40px", paddingBottom: "80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", margin: "0 0 8px" }}>Batch Analysis</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Analyze all your loaded games at once using the full Stockfish engine — server-side, so you can close this tab.
          </p>
        </div>

        {/* Trigger panel */}
        {!isRunning && !isDone && (
          <div className="glass-card" style={{ marginBottom: "32px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
                  {games.length} game{games.length !== 1 ? "s" : ""} ready to analyze
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {games.length === 0
                    ? "Go to the dashboard and load some games first."
                    : "The Python worker will fetch PGNs and run Stockfish on each game. Results appear in the Report section when done."}
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
          <div className="glass-card" style={{ marginBottom: "32px", padding: "24px 28px" }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "14px", height: "14px", border: "2px solid var(--accent-color)", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: "15px", fontWeight: "700" }}>Analyzing your games</span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Safe to close this tab — analysis runs on the server
              </span>
            </div>

            {currentGame && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentGame}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--surface-2, rgba(255,255,255,0.06))", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: gamesTotal > 0 ? `${progressPct}%` : "0%",
                  background: "var(--accent-color)",
                  borderRadius: "4px",
                  transition: "width 0.5s ease",
                }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-color)", minWidth: "36px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {gamesTotal > 0 ? `${progressPct}%` : "—"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {gamesTotal > 0
                  ? `${gamesDone} of ${gamesTotal} game${gamesTotal !== 1 ? "s" : ""}`
                  : "Fetching games…"}
              </span>
              {etaLabel && <span>{etaLabel}</span>}
            </div>
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

        {/* Done — send to report */}
        {isDone && (
          <div className="glass-card" style={{ marginBottom: "32px", padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
              <CheckCircle size={32} color="var(--success)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontSize: "17px", fontWeight: "700", marginBottom: "4px" }}>
                  Analysis complete
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {result.total_analyzed} game{result.total_analyzed !== 1 ? "s" : ""} analyzed
                  {" · "}avg accuracy {result.average_accuracy}%
                  {" · "}analyzed {fmtDate(activeJob.created_at)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => router.push("/report")}
                style={{ padding: "10px 24px" }}
              >
                View Full Report
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleStart}
                disabled={submitting || games.length === 0}
              >
                {submitting ? "Starting…" : "Re-analyze"}
              </button>
            </div>
          </div>
        )}

        {/* Past analyses */}
        {pastJobs.length > 0 && (
          <div style={{ marginTop: isDone ? "8px" : "0" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", margin: "0 0 12px" }}>
              Past Analyses
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pastJobs.map(job => (
                <div
                  key={job.id}
                  className="glass-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px" }}
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
