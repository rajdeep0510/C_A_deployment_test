"use client";
import { useState, useEffect } from "react";
import { Trophy, RefreshCw } from "lucide-react";
import { getRushLeaderboard } from "@/services/api";

type Entry = {
  username:   string;
  score:      number;
  played_at?: string;
};

type Props = {
  duration:        180 | 300;
  currentUsername: string;
  compact?:        boolean;  // true = top 5, no player rank footer
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function RushLeaderboard({ duration, currentUsername, compact }: Props) {
  const [period,      setPeriod]      = useState<"week" | "all">("week");
  const [entries,     setEntries]     = useState<Entry[]>([]);
  const [playerRank,  setPlayerRank]  = useState<number | null>(null);
  const [playerBest,  setPlayerBest]  = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);

  useEffect(() => { load(); }, [duration, period]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const limit = compact ? 5 : 10;
      const data = await getRushLeaderboard(duration, period, limit, currentUsername);
      setEntries(data.leaderboard || []);
      setPlayerRank(data.player_rank ?? null);
      setPlayerBest(data.player_best ?? null);
    } catch {
      setError(true);
      setEntries([]);
    }
    setLoading(false);
  }

  const isMe = (u: string) => u.toLowerCase() === currentUsername.toLowerCase();

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <Trophy size={15} color="#f59e0b" />
          <span style={{ fontWeight: 700, fontSize: "14px" }}>
            Leaderboard · {duration === 180 ? "3 min" : "5 min"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {(["week", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "4px 12px", borderRadius: "20px", cursor: "pointer",
                fontSize: "12px", fontWeight: 600,
                background: period === p ? "#f59e0b" : "transparent",
                color:      period === p ? "#fff"    : "var(--text-secondary)",
                border:     `1px solid ${period === p ? "#f59e0b" : "rgba(0,0,0,0.12)"}`,
                transition: "all 0.15s",
              }}
            >
              {p === "week" ? "This week" : "All time"}
            </button>
          ))}
          <button
            onClick={load}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "2px" }}
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)", fontSize: "13px" }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "16px", color: "var(--danger)", fontSize: "13px" }}>
          Could not load scores.
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)", fontSize: "13px" }}>
          No scores yet — be the first!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {entries.map((entry, idx) => {
            const rank = idx + 1;
            const me   = isMe(entry.username);
            return (
              <div
                key={entry.username}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 12px", borderRadius: "9px",
                  background: me ? "rgba(245,158,11,0.1)" : idx % 2 === 0 ? "rgba(0,0,0,0.025)" : "transparent",
                  border:     me ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                }}
              >
                {/* Rank */}
                <span style={{
                  fontWeight: 800, fontSize: "13px", minWidth: "26px",
                  color: rank <= 3 ? "#f59e0b" : "var(--text-secondary)",
                }}>
                  {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}
                </span>

                {/* Username */}
                <span style={{ flex: 1, fontWeight: me ? 700 : 500, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.username}
                  {me && (
                    <span style={{ marginLeft: "6px", fontSize: "10px", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.05em" }}>
                      YOU
                    </span>
                  )}
                </span>

                {/* Score */}
                <span style={{
                  fontWeight: 800, fontSize: "17px",
                  color: me ? "#f59e0b" : rank === 1 ? "#1dc189" : "var(--text-primary)",
                }}>
                  {entry.score}
                </span>
              </div>
            );
          })}

          {/* Player outside top N */}
          {!compact && playerRank !== null && playerBest !== null && (
            <>
              <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "11px", padding: "4px 0", letterSpacing: "0.1em" }}>
                · · ·
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "9px 12px", borderRadius: "9px",
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              }}>
                <span style={{ fontWeight: 800, fontSize: "13px", minWidth: "26px", color: "var(--text-secondary)" }}>
                  #{playerRank}
                </span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: "14px" }}>
                  {currentUsername}
                  <span style={{ marginLeft: "6px", fontSize: "10px", color: "#f59e0b", fontWeight: 700 }}>YOU</span>
                </span>
                <span style={{ fontWeight: 800, fontSize: "17px", color: "#f59e0b" }}>{playerBest}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
