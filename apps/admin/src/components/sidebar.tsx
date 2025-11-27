"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";

export type SidebarLink = {
  href: string;
  label: string;
  icon?: ReactNode;
};

interface SidebarProps {
  links: SidebarLink[];
  appName?: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

// Fixed sidebar for admin navigation with mobile overlay support
export function Sidebar({ links, appName = "FleetOps", open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();

  const normalizedLinks = useMemo(
    () =>
      links.map((link) => ({
        ...link,
        active:
          pathname === link.href ||
          (pathname?.startsWith(link.href) && link.href !== "/admin" ? true : pathname === link.href),
      })),
    [links, pathname],
  );

  const handleClose = () => onOpenChange(false);

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/95 px-4 py-4 shadow-xl backdrop-blur-lg transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Điều hướng quản trị"
      >
        <div className="flex items-center justify-between px-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
              <span className="text-lg font-bold">FO</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-card-foreground">{appName}</span>
              <span className="text-xs text-muted-foreground">Operations console</span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            onClick={handleClose}
            aria-label="Đóng menu điều hướng"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-2 overflow-y-auto">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Điều hướng</p>
          <ul className="mt-2 space-y-1">
            {normalizedLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={handleClose}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    link.active
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {link.icon ? (
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs ${
                        link.active ? "border-accent-foreground/20 bg-accent-foreground/10" : "border-border bg-card"
                      }`}
                    >
                      {link.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border px-2 pt-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} FleetOps Mobility</p>
          <p className="mt-0.5">Bảng điều hành nội bộ</p>
        </div>
      </aside>
    </>
  );
}
