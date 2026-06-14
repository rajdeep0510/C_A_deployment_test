"use client";
import { createContext, useContext, useEffect, useState } from "react";

type PlayerSession = {
  chess_username: string;
  full_name: string;
  coach_id: string;
  status: "pending" | "approved" | "rejected";
};

type PlayerContextType = {
  chessUsername: string | null;
  fullName: string | null;
  coachId: string | null;
  status: string | null;
  isApproved: boolean;
  loading: boolean;
  logout: () => void;
  refreshSession: (session: PlayerSession) => void;
};

const PlayerContext = createContext<PlayerContextType>({
  chessUsername: null,
  fullName: null,
  coachId: null,
  status: null,
  isApproved: false,
  loading: true,
  logout: () => {},
  refreshSession: () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Migrate old chessUsername key if it exists
    const oldKey = localStorage.getItem("chessUsername");
    const newKey = localStorage.getItem("playerSession");
    if (oldKey && !newKey) {
      localStorage.removeItem("chessUsername");
    }

    const raw = localStorage.getItem("playerSession");
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(JSON.parse(raw));
      } catch {
        localStorage.removeItem("playerSession");
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem("playerSession");
    localStorage.removeItem("recentGames");
    localStorage.removeItem("chessUsername");
    setSession(null);
    window.location.href = "/login";
  };

  const refreshSession = (newSession: PlayerSession) => {
    localStorage.setItem("playerSession", JSON.stringify(newSession));
    setSession(newSession);
  };

  return (
    <PlayerContext.Provider
      value={{
        chessUsername: session?.chess_username ?? null,
        fullName: session?.full_name ?? null,
        coachId: session?.coach_id ?? null,
        status: session?.status ?? null,
        isApproved: session?.status === "approved",
        loading,
        logout,
        refreshSession,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
