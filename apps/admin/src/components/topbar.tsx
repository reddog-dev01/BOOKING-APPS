"use client";

import { useState } from "react";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

// Responsive top navigation with search, notifications, and profile actions
export function Topbar({ title, subtitle }: TopbarProps) {
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-72">
            <label htmlFor="admin-search" className="sr-only">
              Search
            </label>
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search bookings, riders, vehicles"
              className="w-full rounded-lg border border-border bg-background/80 px-4 py-2 text-sm shadow-inner outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <div className="flex items-center gap-3 lg:justify-end">
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
              aria-label="View notifications"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute right-1 top-1 inline-flex h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            </button>
            <details className="group relative inline-flex">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-background px-2 py-1 pr-3 text-sm font-medium text-foreground transition hover:bg-muted">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">
                  AD
                </span>
                Alex Dispatch
                <svg
                  className="h-4 w-4 transition group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="absolute right-0 top-12 w-56 rounded-xl border border-border bg-card p-3 text-sm shadow-xl">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Signed in as
                </p>
                <p className="px-2 py-1 font-medium">alex.dispatch@fleetops.vn</p>
                <div className="my-2 border-t border-border" />
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Profile
                  <span aria-hidden>→</span>
                </button>
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Sign out
                  <span aria-hidden>↩</span>
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
