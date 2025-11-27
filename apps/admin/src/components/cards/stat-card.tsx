import type { ReactNode } from "react";

type TrendVariant = "positive" | "negative" | "neutral";

interface StatCardProps {
  title: string;
  value: string;
  trend?: {
    label: string;
    variant?: TrendVariant;
  };
  icon?: ReactNode;
  action?: ReactNode;
}

const trendColor: Record<TrendVariant, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-muted-foreground",
};

// KPI tile with subtle hover and trend coloring
export function StatCard({ title, value, trend, icon, action }: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card/90 p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-accent/50">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/80 text-accent">
            {icon}
          </div>
        )}
      </div>
      <div className="relative mt-4 flex items-center justify-between text-xs">
        {trend ? (
          <span className={`font-medium ${trendColor[trend.variant ?? "neutral"]}`}>{trend.label}</span>
        ) : (
          <span className="text-muted-foreground">&nbsp;</span>
        )}
        {action ?? null}
      </div>
    </article>
  );
}
