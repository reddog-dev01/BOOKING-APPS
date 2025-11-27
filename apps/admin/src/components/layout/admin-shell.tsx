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

// Client shell hosting sidebar + topbar scaffolding
export function AdminShell({
  links,
  children,
  appName = "FleetOps",
  topbarTitle = "Dashboard",
  topbarSubtitle = "Giám sát vận hành theo thời gian thực.",
}: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar links={links} open={open} onOpenChange={setOpen} appName={appName} />
      <div className="flex flex-1 flex-col lg:ml-64">
        <Topbar title={topbarTitle} subtitle={topbarSubtitle} onMenuToggle={() => setOpen((prev) => !prev)} />
        <main className="flex-1 bg-gradient-to-b from-background via-background to-slate-50/70 px-4 pb-12 pt-6 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
