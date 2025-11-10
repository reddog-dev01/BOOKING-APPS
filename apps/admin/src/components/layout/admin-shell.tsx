"use client";

import { useState } from "react";
import type { SidebarLink } from "@/components/sidebar";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

interface AdminShellProps {
  links: SidebarLink[];
  children: React.ReactNode;
  appName?: string;
  topbarTitle?: string;
  topbarSubtitle?: string;
}

// Client wrapper toggles sidebar visibility while keeping layout declarative
export function AdminShell({
  links,
  children,
  appName,
  topbarTitle = "Bảng điều hành",
  topbarSubtitle = "Quản lý toàn bộ chuyến đi và đội xe.",
}: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar links={links} open={open} onOpenChange={setOpen} appName={appName} />
      <button
        type="button"
        className="fixed left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition hover:bg-muted lg:hidden"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls="admin-sidebar"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
      </button>
      <div className="flex flex-1 flex-col">
        <Topbar title={topbarTitle} subtitle={topbarSubtitle} />
        <main className="flex-1 bg-background px-6 pb-12 pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
