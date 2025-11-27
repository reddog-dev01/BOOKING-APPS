"use client";

import { Bell, Menu, Search, User } from "lucide-react";
import { useState } from "react";

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void;
}

// Sticky top bar keeps context (title, search, user) visible during scroll
export function Topbar({ title, subtitle, onMenuToggle }: TopbarProps) {
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-gradient-to-r from-background/95 via-background to-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-4">
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:bg-muted lg:hidden"
            aria-label="Mở điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FleetOps Admin</p>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{title}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Live
              </span>
            </div>
            {subtitle ? <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm hover:bg-muted/70 sm:flex">
            <Search className="h-4 w-4" />
            <input
              type="search"
              placeholder="Tìm booking, khách hoặc tài xế..."
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Ctrl + K</span>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted/80"
            aria-label="Thông báo"
          >
            <Bell className="h-4 w-4" />
            <span className="sr-only">Thông báo</span>
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-500 text-[11px] font-semibold text-white">
              <User className="h-4 w-4" />
            </span>
            <div className="hidden text-left leading-tight sm:block">
              <span className="block text-xs">Admin</span>
              <span className="block text-[11px] text-muted-foreground">Operations</span>
            </div>
          </div>

          <form action="/admin/logout" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
            >
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
