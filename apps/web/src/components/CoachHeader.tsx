"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LogOut, Shield, GraduationCap, UserMinus, X } from "lucide-react";
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
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

          {/* Desktop nav */}
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

          {/* Desktop user area */}
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

          {/* Mobile hamburger */}
          <button
            className={`hamburger-btn ${drawerOpen ? "open" : ""}`}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
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

      {/* Mobile drawer overlay */}
      <div
        className={`mobile-drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
      />

      {/* Mobile drawer */}
      <div className={`mobile-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span style={{ fontSize: "20px", color: meta.color }}>{meta.logo}</span>
            Chess Advisor
          </div>
          <button className="mobile-drawer-close" onClick={closeDrawer}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", background: "var(--surface-1)", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{meta.label}</span>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{coachProfile.full_name}</span>
        </div>

        <Link
          href="/coach/dashboard"
          className={`nav-link ${pathname.startsWith("/coach/dashboard") ? "active" : ""}`}
          onClick={closeDrawer}
        >
          <Users size={18} /> My Players
        </Link>

        {coachProfile.role === "academy_owner" && (
          <Link
            href="/academy/dashboard"
            className={`nav-link ${pathname.startsWith("/academy") ? "active" : ""}`}
            onClick={closeDrawer}
          >
            <GraduationCap size={18} /> My Academy
          </Link>
        )}

        {coachProfile.role === "admin" && (
          <Link
            href="/admin/dashboard"
            className={`nav-link ${pathname.startsWith("/admin") ? "active" : ""}`}
            onClick={closeDrawer}
          >
            <Shield size={18} /> Admin
          </Link>
        )}

        <div className="mobile-drawer-divider" />

        <div className="mobile-drawer-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ThemeToggle />
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Toggle theme</span>
          </div>
          <button
            className="mobile-drawer-logout"
            onClick={() => { signOut(); closeDrawer(); }}
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
