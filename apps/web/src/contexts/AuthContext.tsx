"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CoachProfile = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: "admin" | "academy_owner" | "coach";
  academy_id: string | null;
  status: "pending" | "approved" | "rejected";
};

type AuthContextType = {
  user: any;
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
  const [user, setUser] = useState<any>(null);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, role, academy_id, status")
        .eq("id", userId)
        .single();
      setCoachProfile(data ?? null);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setCoachProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Hydrate from existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setCoachProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await fetchProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
