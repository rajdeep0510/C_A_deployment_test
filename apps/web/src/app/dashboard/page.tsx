"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import GameCard from "@/components/GameCard";
import Loader from "@/components/Loader";
import { usePlayer } from "@/contexts/PlayerContext";
import { getStats, fetchGames } from "@/services/api";
import { Play, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

function MomentumBadge({ momentum }: { momentum: string }) {
  const lower = (momentum || "").toLowerCase();
  const isUp = lower.includes("improv");
  const isDown = lower.includes("declin");
  const color = isUp
    ? "var(--success)"
    : isDown
      ? "var(--danger)"
      : "var(--warning)";
  const bg = isUp
    ? "rgba(16,185,129,0.1)"
    : isDown
      ? "rgba(239,68,68,0.1)"
      : "rgba(245,158,11,0.1)";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "20px",
        background: bg,
        color,
        fontSize: "12px",
        fontWeight: "700",
        border: `1px solid ${color}33`,
      }}
    >
      <Icon size={12} />
      {momentum}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { chessUsername, isApproved, loading: playerLoading } = usePlayer();
  const [stats, setStats] = useState<any>(null);
  const [realStats, setRealStats] = useState<any>(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFetchPanel, setShowFetchPanel] = useState(false);
  const [fetchPlatform, setFetchPlatform] = useState("chess.com");
  const [fetchLimit, setFetchLimit] = useState(10);
  const [fetchMode, setFetchMode] = useState<"append" | "replace">("append");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (playerLoading) return;
    if (!chessUsername || !isApproved) {
      router.push("/login");
      return;
    }

    const storedGames = localStorage.getItem("recentGames");
    if (storedGames) setGames(JSON.parse(storedGames));

    const STATS_CACHE_VERSION = "v2";
    const statsKey = `stats_${chessUsername}_${STATS_CACHE_VERSION}`;
    const realStatsKey = `realStats_${chessUsername}_${STATS_CACHE_VERSION}`;

    // Show cached stats immediately so the dashboard renders without a loader
    const cachedStats = localStorage.getItem(statsKey);
    if (cachedStats) {
      try {
        setStats(JSON.parse(cachedStats));
        setLoading(false);
      } catch {}
    }
    const cachedRealStats = localStorage.getItem(realStatsKey);
    if (cachedRealStats) {
      try { setRealStats(JSON.parse(cachedRealStats)); } catch {}
    }

    // Re-fetch in background and update cache
    getStats(chessUsername)
      .then((s) => {
        setStats(s);
        if (s) localStorage.setItem(statsKey, JSON.stringify(s));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`/api/chess-com/${chessUsername}/stats`)
      .then((r) => r.json())
      .then((s) => {
        setRealStats(s);
        localStorage.setItem(realStatsKey, JSON.stringify(s));
      })
      .catch(console.error);
  }, [chessUsername, isApproved, playerLoading, router]);

  const handleLoadGames = async (e: React.FormEvent) => {
    e.preventDefault();
    setFetching(true);
    setFetchError("");
    try {
      const newGames = await fetchGames(fetchPlatform, chessUsername, fetchLimit);
      setGames((prev: any[]) => {
        let merged: any[];
        if (fetchMode === "replace") {
          merged = newGames;
        } else {
          const existingUrls = new Set(prev.map((g: any) => g.filename));
          merged = [...prev, ...newGames.filter((g: any) => !existingUrls.has(g.filename))];
        }
        localStorage.setItem("recentGames", JSON.stringify(merged));
        return merged;
      });
      setShowFetchPanel(false);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch games.");
    } finally {
      setFetching(false);
    }
  };

  if (!chessUsername) return null;

  return (
    <>
      <Header />
      <main
        className="container animate-fade-in"
        style={{ paddingTop: "40px", paddingBottom: "60px" }}
      >
        <div className="flex-between" style={{ marginBottom: "32px" }}>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <h1 style={{ fontSize: "32px", margin: 0 }}>
                Welcome, {chessUsername}
              </h1>
              {stats?.momentum && <MomentumBadge momentum={stats.momentum} />}
            </div>
            <p style={{ color: "var(--text-secondary)" }}>
              Here&apos;s an overview of your recent performance.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/batch")}
            style={{ padding: "12px 24px", fontSize: "15px" }}
          >
            <Play size={18} fill="currentColor" />
            Batch Analysis
          </button>
        </div>

        {loading ? (
          <Loader message="Loading dashboard..." />
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "32px" }}
          >
            {/* ── Overall Stats ── */}
            {realStats && (() => {
              const formats = [
                { key: "chess_rapid",  label: "Rapid",  icon: "⏱" },
                { key: "chess_blitz",  label: "Blitz",  icon: "⚡" },
                { key: "chess_bullet", label: "Bullet", icon: "🔫" },
                { key: "chess_daily",  label: "Daily",  icon: "📅" },
              ].filter(({ key }) => realStats[key]?.record);

              if (formats.length === 0) return null;

              let totalWins = 0, totalLosses = 0, totalDraws = 0;
              formats.forEach(({ key }) => {
                totalWins   += realStats[key].record.win;
                totalLosses += realStats[key].record.loss;
                totalDraws  += realStats[key].record.draw;
              });
              const totalGames = totalWins + totalLosses + totalDraws;
              const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

              return (
                <section>
                  <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Stats by Time Control (Chess.com)
                  </h2>

                  {/* Per-time-control cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                    {formats.map(({ key, label, icon }) => {
                      const { record, last } = realStats[key];
                      const games = record.win + record.loss + record.draw;
                      const wr = games > 0 ? Math.round((record.win / games) * 100) : 0;
                      return (
                        <div key={key} className="glass-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "18px" }}>{icon}</span>
                              <span style={{ fontSize: "14px", fontWeight: "700" }}>{label}</span>
                            </div>
                            {last?.rating && (
                              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-color)" }}>
                                {last.rating}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "26px", fontWeight: "800", marginBottom: "4px" }}>
                            {games.toLocaleString()}
                            <span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-secondary)", marginLeft: "6px" }}>games</span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--success)", fontWeight: "600", marginBottom: "8px" }}>
                            {wr}% win rate
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                            <span style={{ color: "var(--success)" }}>{record.win}W</span>
                            <span style={{ color: "var(--danger)" }}>{record.loss}L</span>
                            <span style={{ color: "var(--warning)" }}>{record.draw}D</span>
                          </div>
                          <div style={{ marginTop: "10px", height: "4px", borderRadius: "2px", background: "var(--surface-2)", overflow: "hidden", display: "flex" }}>
                            <div style={{ width: `${games > 0 ? (record.win / games) * 100 : 0}%`, background: "var(--success)" }} />
                            <div style={{ width: `${games > 0 ? (record.draw / games) * 100 : 0}%`, background: "var(--warning)" }} />
                            <div style={{ width: `${games > 0 ? (record.loss / games) * 100 : 0}%`, background: "var(--danger)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All-formats summary row */}
                  <div className="glass-card" style={{ display: "flex", gap: "32px", alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>All Formats</div>
                      <div style={{ fontSize: "28px", fontWeight: "800" }}>{totalGames.toLocaleString()} <span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-secondary)" }}>games</span></div>
                    </div>
                    <div style={{ width: "1px", height: "40px", background: "var(--glass-border)", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Overall Win Rate</div>
                      <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--success)" }}>{overallWinRate}%</div>
                    </div>
                    <div style={{ width: "1px", height: "40px", background: "var(--glass-border)", flexShrink: 0 }} />
                    <div style={{ display: "flex", gap: "20px" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "2px" }}>Wins</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--success)" }}>{totalWins.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "2px" }}>Losses</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--danger)" }}>{totalLosses.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "2px" }}>Draws</div>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--warning)" }}>{totalDraws.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* ── Win Rate by Color (computed from loaded games) ── */}
            {games.length > 0 && (() => {
              const colorStats = { white: { wins: 0, losses: 0, draws: 0 }, black: { wins: 0, losses: 0, draws: 0 } };
              const userLower = chessUsername.toLowerCase();
              const WHITE_LOSS = new Set(["checkmated", "resigned", "timeout", "abandoned", "loss"]);
              const DRAW_R = new Set(["stalemate", "insufficient", "agreed", "repetition", "timevsinsufficient", "50move", "1/2-1/2"]);
              (games as any[]).forEach((g) => {
                const isWhite = (g.white || "").toLowerCase() === userLower;
                const side = colorStats[isWhite ? "white" : "black"];
                const r = (g.result || "").toLowerCase().trim();
                if (r === "1-0" || r === "white") {
                  isWhite ? side.wins++ : side.losses++;
                } else if (r === "0-1" || r === "black") {
                  isWhite ? side.losses++ : side.wins++;
                } else if (r === "win") {
                  // Old Chess.com format: stored as white's result — "win" means white won
                  isWhite ? side.wins++ : side.losses++;
                } else if (WHITE_LOSS.has(r)) {
                  // Old Chess.com format: white lost
                  isWhite ? side.losses++ : side.wins++;
                } else if (DRAW_R.has(r)) {
                  side.draws++;
                } else {
                  side.draws++;
                }
              });
              const total = games.length;

              return (
                <section>
                  <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Win Rate by Color
                  </h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px", marginTop: 0 }}>
                    Based on your {total} loaded game{total !== 1 ? "s" : ""}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                    {(["white", "black"] as const).map((color) => {
                      const { wins, losses, draws } = colorStats[color];
                      const sideTotal = wins + losses + draws;
                      const pct = sideTotal > 0 ? Math.round((wins / sideTotal) * 100) : 0;
                      return (
                        <div key={color} className="glass-card">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "4px", background: color === "white" ? "#eee" : "#333", color: color === "white" ? "#111" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
                              {color === "white" ? "W" : "B"}
                            </div>
                            <span style={{ fontWeight: "600", textTransform: "capitalize" }}>As {color}</span>
                            <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-secondary)" }}>{sideTotal} games</span>
                          </div>
                          <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--success)", marginBottom: "8px" }}>{pct}%</div>
                          <div style={{ display: "flex", gap: "14px", fontSize: "13px" }}>
                            <span style={{ color: "var(--success)" }}>{wins}W</span>
                            <span style={{ color: "var(--danger)" }}>{losses}L</span>
                            <span style={{ color: "var(--warning)" }}>{draws}D</span>
                          </div>
                          {sideTotal > 0 && (
                            <div style={{ marginTop: "10px", height: "5px", borderRadius: "3px", background: "var(--surface-2)", overflow: "hidden", display: "flex" }}>
                              <div style={{ width: `${(wins / sideTotal) * 100}%`, background: "var(--success)" }} />
                              <div style={{ width: `${(draws / sideTotal) * 100}%`, background: "var(--warning)" }} />
                              <div style={{ width: `${(losses / sideTotal) * 100}%`, background: "var(--danger)" }} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {stats?.accuracy != null && (
                      <div className="glass-card">
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Avg Accuracy</div>
                        <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--accent-color)" }}>{parseFloat(stats.accuracy).toFixed(1)}%</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>From analyzed games</div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* ── Recent Games ── */}
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: 0,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  Recent Games {games.length > 0 && <span style={{ fontWeight: 400, fontSize: "13px" }}>({games.length})</span>}
                </h2>
                <button
                  onClick={() => { setShowFetchPanel((v) => !v); setFetchError(""); }}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", fontSize: "13px" }}
                >
                  <RefreshCw size={14} />
                  Load Games
                  {showFetchPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showFetchPanel && (
                <div
                  className="glass-card"
                  style={{ marginBottom: "20px", padding: "20px" }}
                >
                  <form onSubmit={handleLoadGames} style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "140px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Platform</label>
                      <select
                        className="input-field"
                        value={fetchPlatform}
                        onChange={(e) => setFetchPlatform(e.target.value)}
                        style={{ padding: "8px 12px", fontSize: "13px" }}
                      >
                        <option value="chess.com">Chess.com</option>
                        <option value="lichess">Lichess</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "100px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Count (max 50)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={fetchLimit}
                        onChange={(e) => setFetchLimit(Math.min(50, Math.max(1, Number(e.target.value))))}
                        min={1}
                        max={50}
                        style={{ padding: "8px 12px", fontSize: "13px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mode</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {(["append", "replace"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFetchMode(m)}
                            style={{
                              padding: "8px 14px",
                              fontSize: "12px",
                              fontWeight: "600",
                              borderRadius: "8px",
                              border: `1px solid ${fetchMode === m ? "var(--accent-color)" : "var(--glass-border)"}`,
                              background: fetchMode === m ? "rgba(29,193,137,0.12)" : "transparent",
                              color: fetchMode === m ? "var(--accent-color)" : "var(--text-secondary)",
                              cursor: "pointer",
                              textTransform: "capitalize",
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={fetching}
                      style={{ padding: "8px 20px", fontSize: "13px", whiteSpace: "nowrap" }}
                    >
                      {fetching ? "Fetching…" : "Fetch Games"}
                    </button>
                  </form>
                  {fetchError && (
                    <div style={{ marginTop: "12px", color: "var(--danger)", fontSize: "13px", background: "rgba(239,68,68,0.08)", padding: "10px 14px", borderRadius: "8px" }}>
                      {fetchError}
                    </div>
                  )}
                  <p style={{ margin: "12px 0 0", fontSize: "12px", color: "var(--text-secondary)" }}>
                    <strong>Append</strong> adds new games to your existing list (duplicates skipped). <strong>Replace</strong> replaces the list entirely.
                  </p>
                </div>
              )}

              {games.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "20px",
                  }}
                >
                  {games.map((g, i) => (
                    <GameCard key={i} game={g} username={chessUsername} />
                  ))}
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
                  No recent games found. Use the <strong>Load Games</strong> button above to fetch your games.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
