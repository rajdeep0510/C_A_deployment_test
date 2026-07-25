"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Lock, Check, X } from "lucide-react";

type MeResponse = {
  id: string;
  email: string;
  userType: "staff" | "player";
  onboarded: boolean;
  chessUsername: string | null;
  lichessUsername: string | null;
  activePlatform: string;
};

type PlayerRow = {
  chess_username: string | null;
  lichess_username: string | null;
  chess_username_changes: number;
  lichess_username_changes: number;
};

async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPlayerCounters(): Promise<PlayerRow | null> {
  const res = await fetch("/api/players/me", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [counters, setCounters] = useState<PlayerRow | null>(null);

  const [editing, setEditing] = useState<null | "chess.com" | "lichess">(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const reload = async () => {
    const [m, p] = await Promise.all([fetchMe(), fetchPlayerCounters()]);
    setMe(m);
    setCounters(p);
  };

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, []);

  const startEdit = (platform: "chess.com" | "lichess") => {
    setEditing(platform);
    setDraft(platform === "chess.com" ? me?.chessUsername ?? "" : me?.lichessUsername ?? "");
    setError("");
    setSuccessMsg("");
    setConfirming(false);
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/players/me/chess-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: editing, username: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update username");
        setSaving(false);
        return;
      }
      setSuccessMsg(`${editing} username updated. This can no longer be changed.`);
      setEditing(null);
      setConfirming(false);
      await reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#a1a1aa" }} />
      </div>
    );
  }

  if (!me || me.userType !== "player" || !counters) {
    return (
      <div style={{ padding: 32, color: "#a1a1aa" }}>
        This page is only available for players.
      </div>
    );
  }

  const rows: Array<{
    platform: "chess.com" | "lichess";
    label: string;
    value: string | null;
    changes: number;
  }> = [
    { platform: "chess.com", label: "Chess.com username", value: me.chessUsername, changes: counters.chess_username_changes },
    { platform: "lichess", label: "Lichess username", value: me.lichessUsername, changes: counters.lichess_username_changes },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f7f7f7", marginBottom: 8 }}>Account</h1>
      <p style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 24 }}>
        Signed in as <span style={{ color: "#f7f7f7" }}>{me.email}</span>
      </p>

      <section style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#f7f7f7", marginBottom: 4 }}>Linked chess accounts</h2>
        <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 20 }}>
          Each username can be changed <b>only once</b>. After that it is permanently locked.
        </p>

        {successMsg && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(29, 193, 137, 0.1)", border: "1px solid #1dc189", color: "#1dc189", fontSize: 13 }}>
            {successMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((row) => {
            const locked = row.changes >= 1;
            const isEditing = editing === row.platform;
            return (
              <div key={row.platform} style={{ padding: 16, background: "#1f1f1f", border: "1px solid #2a2a2a", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 15, color: "#f7f7f7", fontWeight: 500 }}>
                      {row.value ?? <span style={{ color: "#52525b" }}>Not linked</span>}
                    </div>
                  </div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(row.platform)}
                      disabled={locked}
                      title={locked ? "Already changed once" : "Edit (one-time)"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: locked ? "#1a1a1a" : "#2a2a2a",
                        color: locked ? "#52525b" : "#f7f7f7",
                        border: "1px solid #2a2a2a",
                        borderRadius: 6,
                        cursor: locked ? "not-allowed" : "pointer",
                      }}
                    >
                      {locked ? <Lock size={14} /> : <Pencil size={14} />}
                      {locked ? "Locked" : "Edit"}
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`New ${row.platform} username`}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        fontSize: 14,
                        background: "#161616",
                        border: "1px solid #2a2a2a",
                        borderRadius: 6,
                        color: "#f7f7f7",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {!confirming ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setConfirming(true)}
                          disabled={!draft.trim()}
                          style={{ flex: 1, padding: 10, background: "#1dc189", color: "#0f0f0f", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditing(null); setError(""); }}
                          style={{ padding: "10px 14px", background: "transparent", color: "#a1a1aa", border: "1px solid #2a2a2a", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", borderRadius: 6 }}>
                        <p style={{ color: "#f59e0b", fontSize: 13, margin: 0, marginBottom: 10 }}>
                          You can change your {row.platform} username <b>only once</b>. After this edit it will be permanently locked. Continue?
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={submitEdit}
                            disabled={saving}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#f59e0b", color: "#0f0f0f", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Yes, save and lock
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "transparent", color: "#a1a1aa", border: "1px solid #2a2a2a", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                          >
                            <X size={14} />
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                    {error && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
