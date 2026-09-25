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
    { id: "run", label: "Active Run", icon: PlayCircle, badge: hasActiveRun ? "Active" : undefined },
    { id: "dataset", label: "Dataset Explorer", icon: FileSpreadsheet },
    { id: "history", label: "History", icon: History },
    { id: "credits", label: "Credits & Ledger", icon: CreditCard },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => setActiveTab("new")}
          >
            <div className="size-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-sm tracking-wider">
              K
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-foreground">Kyros</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                  Data Engine
                </span>
              </div>
              <span className="text-[10.5px] text-muted-foreground hidden sm:inline-block leading-none">
                Autonomous Sourced Datasets
              </span>
            </div>
          </div>
        </div>

        {/* Central Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2.5">
          {/* Credits Balance Pill */}
          <div
            onClick={() => setActiveTab("credits")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted/60 transition-all cursor-pointer text-xs shadow-xs"
            title="Kyros Research Credits"
          >
            <Coins className="size-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold font-mono text-foreground">
              ${availableCredits.toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground hidden lg:inline">Credits</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickTopUp();
              }}
              className="size-4 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors ml-0.5"
              title="Add $10 Credits"
            >
              <Plus className="size-2.5" />
            </button>
          </div>

          {/* Clerk Authentication & User Profile */}
          <ClerkUserButton />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-border/60 gap-1 bg-card/60">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
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
