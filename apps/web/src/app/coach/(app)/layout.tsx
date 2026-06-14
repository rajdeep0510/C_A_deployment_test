"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/Loader";

export default function CoachAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, coachProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (!coachProfile) { router.push("/login"); return; }
    const status = coachProfile?.status;
    if (status === "pending") { router.push("/coach/pending"); return; }
    if (status === "rejected") { router.push("/login"); return; }
  }, [user, coachProfile, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader message="Loading coach dashboard..." />
      </div>
    );
  }

  if (!user || !coachProfile || coachProfile?.status === "pending" || coachProfile?.status === "rejected") return null;

  return <>{children}</>;
}
