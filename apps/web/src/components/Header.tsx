"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Activity, LogOut, Puzzle } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import ThemeToggle from "./ThemeToggle";
import SettingsPanel from "./SettingsPanel";
import "./Header.css";

export default function Header() {
  const pathname = usePathname();
  const { chessUsername, logout } = usePlayer();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!chessUsername) return null;

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={18} />,
    },
    { name: "Report", path: "/report", icon: <Activity size={18} /> },
    { name: "Training", path: "/training-plan", icon: <Target size={18} /> },
    { name: "Puzzles", path: "/puzzles", icon: <Puzzle size={18} /> },
  ];

  return (
    <header className="header-glass">
      <div className="container flex-between header-inner">
        <div className="header-brand">
          <span className="brand-logo">♞</span>
          <span className="brand-text">Chess Advisor</span>
        </div>

        <nav className="header-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-link ${pathname === item.path ? "active" : ""}`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="header-user">
          <ThemeToggle />
          <span className="user-name clickable" onClick={() => setSettingsOpen(true)}>
            {chessUsername}
          </span>
          <button className="btn-logout" title="Log Out" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userType="player"
        username={chessUsername}
      />
    </header>
  );
}
