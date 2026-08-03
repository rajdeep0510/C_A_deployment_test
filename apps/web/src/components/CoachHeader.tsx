"use client";
import { useState, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  Users, GraduationCap, Shield, LogOut, Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsPanel from "./SettingsPanel";
import "./Header.css";

const ROLE_META = {
  admin:          { label: "Admin",   logo: "♛", color: "#6366f1", lightColor: "#4338ca" },
  academy_owner:  { label: "Academy", logo: "🏫", color: "#f59e0b", lightColor: "#b45309" },
  coach:          { label: "Coach",   logo: "♛", color: "#6366f1", lightColor: "#4338ca" },
} as const;

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function CoachHeader() {
  const pathname = usePathname();
  const { coachProfile, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Animation refs
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndicatorRef = useRef<HTMLDivElement>(null);
  const bottomInnerRef = useRef<HTMLDivElement>(null);
  const bottomTabRefs = useRef<(HTMLElement | null)[]>([]);
  const bottomIndicatorRef = useRef<HTMLDivElement>(null);

  if (!coachProfile) return null;

  const meta = ROLE_META[coachProfile.role] ?? ROLE_META.coach;

  const navItems = [
    { name: "My Players", path: "/coach/dashboard", matchPrefixes: ["/coach/dashboard", "/coach/players"], icon: <Users size={14} /> },
    ...(coachProfile.role === "academy_owner" ? [{ name: "My Academy", path: "/academy/dashboard", matchPrefixes: ["/academy"], icon: <GraduationCap size={14} /> }] : []),
    ...(coachProfile.role === "admin" ? [{ name: "Admin", path: "/admin/dashboard", matchPrefixes: ["/admin"], icon: <Shield size={14} /> }] : []),
  ];

  const bottomNavItems = [
    { name: "Players", path: "/coach/dashboard", matchPrefixes: ["/coach/dashboard", "/coach/players"], icon: <Users size={20} /> },
    ...(coachProfile.role === "academy_owner" ? [{ name: "Academy", path: "/academy/dashboard", matchPrefixes: ["/academy"], icon: <GraduationCap size={20} /> }] : []),
    ...(coachProfile.role === "admin" ? [{ name: "Admin", path: "/admin/dashboard", matchPrefixes: ["/admin"], icon: <Shield size={20} /> }] : []),
    { name: "Settings", path: null, matchPrefixes: [], icon: <Settings size={20} /> },
  ];

  const activeIndex = navItems.findIndex((item) =>
    item.matchPrefixes.some((p) => pathname.startsWith(p))
  );
  const activeBottomIndex = settingsOpen
    ? bottomNavItems.findIndex((item) => item.path === null)
    : bottomNavItems.findIndex((item) =>
        item.path ? item.matchPrefixes.some((p) => pathname.startsWith(p)) : false
      );

  useLayoutEffect(() => {
    if (!coachProfile || !activeIndicatorRef.current) return;
    if (activeIndex < 0) {
      gsap.to(activeIndicatorRef.current, { opacity: 0, duration: 0.2 });
      return;
    }
    const target = linkRefs.current[activeIndex];
    if (!target) return;
    const reduced = prefersReduced();
    gsap.to(activeIndicatorRef.current, {
      opacity: 1,
      x: target.offsetLeft,
      width: target.offsetWidth,
      height: target.offsetHeight,
      duration: reduced ? 0 : 0.35,
      ease: "power3.out",
    });
  }, [activeIndex, coachProfile]);

  useLayoutEffect(() => {
    if (!coachProfile || !bottomIndicatorRef.current || !bottomInnerRef.current) return;
    if (activeBottomIndex < 0) {
      gsap.to(bottomIndicatorRef.current, { opacity: 0, duration: 0.2 });
      return;
    }
    const target = bottomTabRefs.current[activeBottomIndex];
    if (!target) return;
    const reduced = prefersReduced();
    gsap.to(bottomIndicatorRef.current, {
      opacity: 1,
      x: target.offsetLeft + 8,
      width: target.offsetWidth - 16,
      duration: reduced ? 0 : 0.35,
      ease: "power3.out",
    });
  }, [activeBottomIndex, coachProfile]);

  return (
    <>
      <header className="header-bar">
        <div className="header-inner">
          {/* Brand */}
          <Link href="/coach/dashboard" className="header-brand" aria-label="Chess Advisor coach portal">
            <div className="brand-mark" aria-hidden="true">
              <span className="brand-knight" style={{ color: meta.color }}>{meta.logo}</span>
            </div>
            <span className="brand-text">
              Chess Advisor{" "}
              <span
                style={{
                  fontSize: "11px",
                  color: meta.color,
                  fontWeight: "700",
                  background: `${meta.color}18`,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  marginLeft: "4px",
                }}
              >
                {meta.label}
              </span>
            </span>
          </Link>

          {/* Center desktop navigation */}
          <nav className="header-nav" aria-label="Coach navigation">
            <div
              className="nav-pill"
              ref={activeIndicatorRef}
              aria-hidden="true"
              style={{ opacity: 0 }}
            />
            {navItems.map((item, i) => {
              const isActive = i === activeIndex;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`nav-link${isActive ? " active" : ""}`}
                  ref={(el) => { linkRefs.current[i] = el; }}
                >
                  {item.icon}
                  <span className="nav-link-label">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="header-actions">
            <button
              className={`header-action-btn${settingsOpen ? " active" : ""}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <Settings size={15} />
            </button>
            <button
              className="header-action-btn"
              onClick={signOut}
              aria-label="Log Out"
              title="Log Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userType="coach"
        username={coachProfile.full_name}
        email={coachProfile.email}
        role={coachProfile.role}
        onLogout={signOut}
      />

      {/* Mobile bottom navigation bar */}
      <nav className="bottom-nav" aria-label="Coach mobile navigation">
        <div className="bottom-nav-inner" ref={bottomInnerRef}>
          <div
            className="bottom-pill"
            ref={bottomIndicatorRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
          />
          {bottomNavItems.map((item, i) => {
            const isActive = i === activeBottomIndex;
            return item.path ? (
              <Link
                key={item.name}
                href={item.path}
                className={`bottom-nav-tab${isActive ? " active" : ""}`}
                ref={(el) => { bottomTabRefs.current[i] = el; }}
              >
                <span className="bottom-tab-icon-wrap">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ) : (
              <button
                key={item.name}
                type="button"
                className={`bottom-nav-tab${isActive ? " active" : ""}`}
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                ref={(el) => { bottomTabRefs.current[i] = el; }}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
