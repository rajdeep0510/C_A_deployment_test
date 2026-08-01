"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  LayoutDashboard, Target, Activity, Puzzle,
  Layers, Bell, Settings,
} from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import SettingsPanel from "./SettingsPanel";
import "./Header.css";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", matchPrefixes: ["/dashboard", "/games", "/analysis"], icon: <LayoutDashboard size={14} /> },
  { name: "Report",    path: "/report",    matchPrefixes: ["/report"],         icon: <Activity size={14} /> },
  { name: "Training",  path: "/training-plan", matchPrefixes: ["/training-plan"], icon: <Target size={14} /> },
  { name: "Puzzles",   path: "/puzzles",   matchPrefixes: ["/puzzles"],        icon: <Puzzle size={14} /> },
  { name: "Batch",     path: "/batch",     matchPrefixes: ["/batch"],          icon: <Layers size={14} /> },
];

const BOTTOM_NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} />, matchPrefixes: ["/dashboard", "/games", "/analysis"] },
  { name: "Puzzles",   path: "/puzzles",   icon: <Puzzle size={20} />,          matchPrefixes: ["/puzzles"] },
  { name: "Report",    path: "/report",    icon: <Activity size={20} />,        matchPrefixes: ["/report"] },
  { name: "Training",  path: "/training-plan", icon: <Target size={20} />,      matchPrefixes: ["/training-plan"] },
  { name: "Settings",  path: null,         icon: <Settings size={20} />,        matchPrefixes: [] },
];

const PLAYER_ROUTE_PREFIXES = [
  "/dashboard",
  "/analysis",
  "/batch",
  "/games",
  "/openings",
  "/puzzles",
  "/report",
  "/training-plan",
];

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Header() {
  const pathname = usePathname();
  const { activeUsername, logout } = usePlayer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coachNotes, setCoachNotes] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Animation refs
  const barRef = useRef<HTMLElement>(null);
  const brandTextRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndicatorRef = useRef<HTMLDivElement>(null);
  const bottomInnerRef = useRef<HTMLDivElement>(null);
  const bottomTabRefs = useRef<(HTMLElement | null)[]>([]);
  const bottomIndicatorRef = useRef<HTMLDivElement>(null);

  const isCollapsedRef = useRef(false);

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.matchPrefixes.some((p) => pathname.startsWith(p))
  );
  const activeBottomIndex = settingsOpen
    ? BOTTOM_NAV_ITEMS.findIndex((item) => item.path === null)
    : BOTTOM_NAV_ITEMS.findIndex((item) =>
        item.path ? item.matchPrefixes.some((p) => pathname.startsWith(p)) : false
      );

  // Entrance animation — float down from top
  useLayoutEffect(() => {
    if (!activeUsername || !barRef.current) return;
    if (prefersReduced()) return;
    gsap.fromTo(
      barRef.current,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }
    );
  }, [activeUsername]);

  // Collapse handler for scrolling (hides text, shows only icons)
  const applyCollapseState = (collapse: boolean) => {
    if (!barRef.current) return;
    const reduced = prefersReduced();
    const duration = reduced ? 0 : 0.4;
    const ease = "power3.out";

    const labels = labelRefs.current.filter(Boolean) as HTMLSpanElement[];
    const targetWidth = collapse
      ? Math.min(440, window.innerWidth - 32)
      : Math.min(1140, window.innerWidth - 32);

    if (collapse) {
      barRef.current.classList.add("scrolled");
    } else {
      barRef.current.classList.remove("scrolled");
    }

    gsap.to(barRef.current, { width: targetWidth, duration, ease });

    if (brandTextRef.current) {
      gsap.to(brandTextRef.current, {
        maxWidth: collapse ? 0 : 200,
        opacity: collapse ? 0 : 1,
        marginLeft: collapse ? -6 : 0,
        duration,
        ease,
      });
    }

    if (labels.length > 0) {
      gsap.to(labels, {
        maxWidth: collapse ? 0 : 200,
        opacity: collapse ? 0 : 1,
        marginLeft: collapse ? -4 : 0,
        duration,
        ease,
        onUpdate: () => {
          // Snap active indicator during collapse animation
          const target = linkRefs.current[activeIndex];
          if (target && activeIndicatorRef.current) {
            gsap.set(activeIndicatorRef.current, {
              x: target.offsetLeft,
              width: target.offsetWidth,
            });
          }
        },
      });
    }
  };

  // Scroll event listener
  useEffect(() => {
    if (!activeUsername) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const shouldCollapse = window.scrollY > 40;
        if (shouldCollapse !== isCollapsedRef.current) {
          isCollapsedRef.current = shouldCollapse;
          applyCollapseState(shouldCollapse);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeUsername, activeIndex]);

  useEffect(() => {
    if (!activeUsername) return;
    const stored = localStorage.getItem(`coachNotesDismissed_${activeUsername}`);
    if (stored) {
      try { setDismissedIds(new Set(JSON.parse(stored))); } catch {}
    }
    fetch("/api/player/coach-notes")
      .then((r) => r.json())
      .then(({ notes }) => { if (Array.isArray(notes)) setCoachNotes(notes); })
      .catch(() => {});
  }, [activeUsername]);

  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotif]);

  // Slide desktop active pill indicator
  useLayoutEffect(() => {
    if (!activeUsername || !activeIndicatorRef.current) return;
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
      duration: reduced ? 0 : 0.4,
      ease: "power3.out",
    });
  }, [activeIndex, activeUsername]);

  // Slide mobile bottom nav indicator
  useLayoutEffect(() => {
    if (!activeUsername || !bottomIndicatorRef.current || !bottomInnerRef.current) return;
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
      duration: reduced ? 0 : 0.4,
      ease: "power3.out",
    });
  }, [activeBottomIndex, activeUsername]);

  const undismissed = coachNotes.filter((n) => !dismissedIds.has(n.id));

  const handleNoteClick = (note: any) => {
    const next = new Set(dismissedIds);
    next.add(note.id);
    setDismissedIds(next);
    localStorage.setItem(`coachNotesDismissed_${activeUsername}`, JSON.stringify([...next]));
    setShowNotif(false);
    window.location.href = `/analysis/${encodeURIComponent(note.filename)}?annotation=${note.move_index}`;
  };

  const isPlayerRoute = PLAYER_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
  if (!activeUsername || !isPlayerRoute) return null;

  return (
    <>
      <header className="header-bar" ref={barRef}>
        <div className="header-inner">
          {/* Brand */}
          <Link href="/dashboard" className="header-brand" aria-label="Chess Advisor home">
            <div className="brand-mark" aria-hidden="true">
              <span className="brand-knight">♞</span>
            </div>
            <span className="brand-text" ref={brandTextRef}>Chess Advisor</span>
          </Link>

          {/* Desktop center nav */}
          <nav className="header-nav" aria-label="Main navigation">
            <div
              className="nav-pill"
              ref={activeIndicatorRef}
              aria-hidden="true"
              style={{ opacity: 0 }}
            />
            {NAV_ITEMS.map((item, i) => {
              const isActive = i === activeIndex;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`nav-link${isActive ? " active" : ""}`}
                  ref={(el) => { linkRefs.current[i] = el; }}
                >
                  {item.icon}
                  <span
                    className="nav-link-label"
                    ref={(el) => { labelRefs.current[i] = el; }}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="header-actions">
            <div ref={notifRef} className="notif-anchor">
              <button
                className={`header-action-btn${showNotif ? " active" : ""}`}
                onClick={() => setShowNotif((v) => !v)}
                aria-label={undismissed.length > 0 ? `${undismissed.length} unread coach note${undismissed.length !== 1 ? "s" : ""}` : "Coach notes"}
                aria-expanded={showNotif}
                aria-haspopup="true"
              >
                <Bell size={15} />
                {undismissed.length > 0 && (
                  <span className="header-action-badge" aria-hidden="true">{undismissed.length}</span>
                )}
              </button>

              {showNotif && (
                <div className="notif-dropdown" role="menu" aria-label="Coach notes">
                  <div className="notif-dropdown-header">Notifications</div>
                  {undismissed.length === 0 ? (
                    <div className="notif-empty">
                      <span className="notif-empty-text">All caught up</span>
                    </div>
                  ) : (
                    <div className="notif-dropdown-list">
                      {undismissed.map((note) => (
                        <button
                          key={note.id}
                          className="notif-item"
                          onClick={() => handleNoteClick(note)}
                          role="menuitem"
                        >
                          <span className="notif-item-meta">Move {note.move_index + 1}</span>
                          <span className="notif-item-text">
                            {note.note.length > 90 ? note.note.slice(0, 90) + "…" : note.note}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className={`header-action-btn${settingsOpen ? " active" : ""}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </header>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userType="player"
        username={activeUsername}
        onLogout={logout}
      />

      {/* Bottom nav (mobile only) */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <div className="bottom-nav-inner" ref={bottomInnerRef}>
          <div
            className="bottom-pill"
            ref={bottomIndicatorRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
          />
          {BOTTOM_NAV_ITEMS.map((item, i) => {
            const isActive = i === activeBottomIndex;
            const hasBadge = item.name === "Dashboard" && undismissed.length > 0;

            return item.path ? (
              <Link
                key={item.name}
                href={item.path}
                className={`bottom-nav-tab${isActive ? " active" : ""}`}
                ref={(el) => { bottomTabRefs.current[i] = el; }}
              >
                <span className="bottom-tab-icon-wrap">
                  {item.icon}
                  {hasBadge && <span className="bottom-tab-badge" aria-hidden="true" />}
                </span>
                <span>{item.name}</span>
              </Link>
            ) : (
              <button
                key={item.name}
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
