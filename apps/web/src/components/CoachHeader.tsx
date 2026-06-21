"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LogOut, Shield, GraduationCap, UserMinus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "./ThemeToggle";
import SettingsPanel from "./SettingsPanel";
import "./Header.css";

const ROLE_META = {
  admin:          { label: "Admin",   logo: "♛", color: "#6366f1" },
  academy_owner:  { label: "Academy", logo: "🏫", color: "#f59e0b" },
  coach:          { label: "Coach",   logo: "♛", color: "#6366f1" },
} as const;

export default function CoachHeader() {
  const pathname = usePathname();
  const { coachProfile, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!coachProfile) return null;

  async function handleRemoveAccount() {
    if (!confirm("Are you sure you want to remove your account entirely? This action cannot be undone.")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/auth/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await signOut();
    } catch (e) {
      console.error(e);
      alert("Failed to remove account.");
    }
  }

  const meta = ROLE_META[coachProfile.role] ?? ROLE_META.coach;

  return (
    <header className="header-glass" style={{ borderBottom: `2px solid ${meta.color}22` }}>
      <div className="container flex-between header-inner">
        <div className="header-brand">
          <span className="brand-logo" style={{ color: meta.color }}>
            {meta.logo}
          </span>
          <span className="brand-text">
            Chess Advisor{" "}
            <span
              style={{
                fontSize: "12px",
                color: meta.color,
                fontWeight: "700",
                background: `${meta.color}18`,
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              {meta.label}
            </span>
          </span>
        </div>

        <nav className="header-nav">
          <Link
            href="/coach/dashboard"
            className={`nav-link ${pathname.startsWith("/coach/dashboard") || pathname.startsWith("/coach/players") ? "active" : ""}`}
          >
            <Users size={18} />
            My Players
          </Link>
          {coachProfile.role === "academy_owner" && (
            <Link
              href="/academy/dashboard"
              className={`nav-link ${pathname.startsWith("/academy") ? "active" : ""}`}
            >
              <GraduationCap size={18} />
              My Academy
            </Link>
          )}
          {coachProfile.role === "admin" && (
            <Link
              href="/admin/dashboard"
              className={`nav-link ${pathname.startsWith("/admin") ? "active" : ""}`}
            >
              <Shield size={18} />
              Admin
            </Link>
          )}
        </nav>

        <div className="header-user">
          <ThemeToggle />
          <span className="user-name clickable" onClick={() => setSettingsOpen(true)}>
            {coachProfile.full_name}
          </span>
          <button className="btn-logout" title="Remove Account" onClick={handleRemoveAccount} style={{ color: "var(--danger)" }}>
            <UserMinus size={16} />
          </button>
          <button className="btn-logout" title="Log Out" onClick={signOut}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userType="coach"
        username={coachProfile.full_name}
        email={coachProfile.email}
        role={coachProfile.role}
      />
    </header>
  );
}
