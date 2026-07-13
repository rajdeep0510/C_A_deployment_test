"use client";
import { createContext, useContext, useEffect, useState } from "react";

type CoachProfile = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: "admin" | "academy_owner" | "coach";
  academy_id: string | null;
  status: "pending" | "approved" | "rejected";
  invite_code: string | null;
};

type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  coachProfile: CoachProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  coachProfile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        setCoachProfile(null);
        return;
      }
      const data = await res.json();
      if (data.userType !== "staff") {
        setUser(null);
        setCoachProfile(null);
        return;
      }
      setUser({ id: data.id, email: data.email, emailVerified: data.emailVerified });
      setCoachProfile({
        id: data.id,
        email: data.email,
        full_name: data.fullName,
        created_at: "",
        role: data.role,
        academy_id: data.academyId,
        status: data.status,
        invite_code: data.inviteCode,
      });
    } catch {
      setUser(null);
      setCoachProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMe();
  }, []);

  const refreshProfile = async () => {
    await fetchMe();
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCoachProfile(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, coachProfile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
