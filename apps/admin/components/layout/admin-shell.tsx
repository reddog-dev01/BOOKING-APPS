"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";

export type AdminNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type AdminShellProps = {
  title: string;
  description?: string;
  navItems: AdminNavItem[];
  children: ReactNode;
};

/**
 * Responsive admin layout with a persistent sidebar on desktop and a hamburger menu on mobile.
 * Keeps navigation consistent across dashboard pages and highlights the active section.
 */
export function AdminShell({ title, description, navItems, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(navItems[0]?.id ?? "");

  // Observe section visibility to highlight the current nav item while scrolling.
  useEffect(() => {
    if (navItems.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        threshold: [0.4],
        rootMargin: "-120px 0px -55% 0px", // Bias towards sections near the top of the viewport.
      },
    );

    navItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [navItems]);

  const handleNavigate = useCallback(
    (itemId: string) => {
      const element = document.getElementById(itemId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveId(itemId);
      setSidebarOpen(false);
    },
    [],
  );

  const renderedNavItems = useMemo(
    () =>
      navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavigate(item.id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand/50 ${
              isActive
                ? "bg-brand/10 text-brand-dark shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      }),
    [activeId, handleNavigate, navItems],
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Thanh điều hướng quản trị"
      >
        <div className="flex items-center justify-between px-1 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-dark">Booking Ops</p>
            <p className="text-lg font-semibold text-slate-900">Admin Center</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu điều hướng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto pb-6">
          {renderedNavItems}
        </nav>

        <footer className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Trợ giúp</p>
          <p>Liên hệ đội vận hành nếu cần cấp quyền bổ sung hoặc điều chỉnh cấu hình hệ thống.</p>
        </footer>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/50 lg:hidden"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
                {description ? (
                  <p className="text-sm text-slate-500">{description}</p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
