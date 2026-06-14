"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/Loader";

export default function AcademyAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, coachProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (coachProfile?.role === "admin") { router.push("/admin/dashboard"); return; }
    if (coachProfile?.role === "coach") { router.push("/coach/dashboard"); return; }
    if (coachProfile?.status === "pending") { router.push("/academy/pending"); return; }
    if (coachProfile?.status === "rejected") { router.push("/login"); return; }
  }, [user, coachProfile, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader message="Loading academy dashboard..." />
      </div>
    );
  }

  if (!user || coachProfile?.role !== "academy_owner" || coachProfile?.status !== "approved") return null;

  return <>{children}</>;
}
