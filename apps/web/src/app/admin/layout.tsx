"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/Loader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, coachProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (coachProfile && coachProfile.role !== "admin") {
      if (coachProfile.role === "academy_owner") router.push("/academy/dashboard");
      else router.push("/coach/dashboard");
    }
  }, [user, coachProfile, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader message="Loading admin panel..." />
      </div>
    );
  }

  if (!user || coachProfile?.role !== "admin") return null;

  return <>{children}</>;
}
