"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";

export type SidebarLink = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

interface SidebarProps {
  links: SidebarLink[];
  appName?: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

// Collapsible sidebar with responsive hamburger toggle
export function Sidebar({ links, appName = "FleetOps", open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    if (!pathname) return "";
    return links.reduce((closest, link) => {
      if (pathname.startsWith(link.href)) {
        if (!closest || link.href.length > closest.length) {
          return link.href;
        }
      }
      return closest;
    }, "");
  }, [links, pathname]);

  return (
    <aside
      id="admin-sidebar"
      className="relative flex w-64 shrink-0 flex-col border-r border-border bg-card text-card-foreground transition-all duration-300 max-lg:absolute max-lg:z-50 max-lg:h-full max-lg:-translate-x-full max-lg:shadow-xl data-[open=true]:max-lg:translate-x-0 lg:fixed lg:inset-y-0 lg:h-screen lg:overflow-y-auto"
      data-open={open}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</span>
          <p className="text-lg font-semibold">{appName}</p>
        </div>
        <button
          type="button"
          className="hidden rounded-md border border-border p-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground max-lg:inline-flex"
          onClick={() => onOpenChange(false)}
          aria-label="Close navigation"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
        <ul className="mt-4 space-y-1">
          {links.map((link) => {
            const isActive = activeHref === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => onOpenChange(false)}
                >
                  {link.icon}
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} FleetOps Mobility</p>
        <p>Secured operations dashboard</p>
      </div>
    </aside>
  );
}
