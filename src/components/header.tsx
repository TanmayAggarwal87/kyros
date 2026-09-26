"use client";

import React from "react";
import {
  Search,
  FileSpreadsheet,
  History,
  CreditCard,
  Sun,
  Moon,
  Coins,
  Plus,
  PlayCircle,
  Sparkles,
  Layers,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClerkUserButton } from "@/components/auth/clerk-user-button";
import type { ActiveTab } from "@/lib/use-workflow-store";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  availableCredits: number;
  onQuickTopUp: () => void;
  hasActiveRun?: boolean;
}

/** Unique Geometric Data Matrix & Provenance Emblem for Kyros */
function KyrosLogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="kyrosGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="kyrosGradCore" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      {/* Outer Hexagonal Prism Frame */}
      <polygon
        points="18,2 32,10 32,26 18,34 4,26 4,10"
        fill="none"
        stroke="url(#kyrosGradPrimary)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Inner Data Node Network Connections */}
      <line x1="18" y1="2" x2="18" y2="13" stroke="url(#kyrosGradPrimary)" strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1="4" y1="10" x2="13" y2="18" stroke="url(#kyrosGradPrimary)" strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1="32" y1="10" x2="23" y2="18" stroke="url(#kyrosGradPrimary)" strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1="18" y1="34" x2="18" y2="23" stroke="url(#kyrosGradPrimary)" strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Central Diamond Provenance Core */}
      <polygon
        points="18,12 24,18 18,24 12,18"
        fill="url(#kyrosGradCore)"
        className="transition-transform duration-500 group-hover:rotate-45 transform-origin-center"
      />
      {/* 4 Corner Verified Node Dots */}
      <circle cx="18" cy="2" r="2" fill="#38BDF8" />
      <circle cx="32" cy="10" r="2" fill="#818CF8" />
      <circle cx="32" cy="26" r="2" fill="#38BDF8" />
      <circle cx="18" cy="34" r="2" fill="#818CF8" />
      <circle cx="4" cy="26" r="2" fill="#38BDF8" />
      <circle cx="4" cy="10" r="2" fill="#818CF8" />
    </svg>
  );
}

export function Header({
  activeTab,
  setActiveTab,
  availableCredits,
  onQuickTopUp,
  hasActiveRun,
}: HeaderProps) {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: "new", label: "New Research", icon: Search },
    { id: "run", label: "Active Run", icon: Activity, badge: hasActiveRun ? "Live" : undefined },
    { id: "dataset", label: "Dataset Explorer", icon: FileSpreadsheet },
    { id: "history", label: "History", icon: History },
    { id: "credits", label: "Credits & Ledger", icon: CreditCard },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-xl shadow-xs transition-colors">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Brand Logo & Emblem */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => setActiveTab("new")}
          >
            <div className="relative p-1.5 rounded-xl bg-gradient-to-tr from-indigo-950/80 via-background to-blue-950/80 border border-indigo-500/30 group-hover:border-indigo-500/60 shadow-md shadow-indigo-500/10 group-hover:shadow-indigo-500/25 transition-all duration-300">
              <KyrosLogoMark className="size-7" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground to-indigo-400 bg-clip-text text-transparent font-sans">
                  KYROS
                </span>
                <span className="text-[9.5px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Data Engine
                </span>
              </div>
              <span className="text-[10.5px] text-muted-foreground hidden sm:inline-block leading-none tracking-wide">
                Autonomous Sourced Datasets
              </span>
            </div>
          </div>
        </div>

        {/* Central Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border/60 backdrop-blur-md">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-background text-foreground shadow-sm font-bold border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-black animate-pulse">
                    <span className="size-1 rounded-full bg-black animate-ping" />
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section Controls */}
        <div className="flex items-center gap-3">
          {/* Credits Balance Pill */}
          <div
            onClick={() => setActiveTab("credits")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 transition-all cursor-pointer text-xs shadow-xs group"
            title="Kyros Research Credits — Click to manage"
          >
            <Coins className="size-3.5 text-amber-500 shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="font-bold font-mono text-foreground">
              ${availableCredits.toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground hidden lg:inline font-medium">Credits</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickTopUp();
              }}
              className="size-4 rounded-md bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 flex items-center justify-center transition-colors ml-0.5"
              title="Add $10 Credits"
            >
              <Plus className="size-2.5" />
            </button>
          </div>

          {/* Clerk User Profile */}
          <ClerkUserButton />

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-400" />}
          </Button>
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-border/60 gap-1.5 bg-card/80 backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                isActive
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
