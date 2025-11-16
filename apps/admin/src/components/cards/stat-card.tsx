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
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

// Generic stat card for KPI display across the dashboard
export function StatCard({ title, value, trend, icon, action }: StatCardProps) {
  return (
    <article className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        {icon ? <div className="text-accent-foreground">{icon}</div> : null}
      </div>
      <div className="flex items-center justify-between text-sm">
        {trend ? (
          <span className={`font-medium ${trendColor[trend.variant ?? "neutral"]}`}>
            {trend.label}
          </span>
        ) : (
          <span className="text-muted-foreground">&nbsp;</span>
        )}
        {action ?? null}
      </div>
    </article>
  );
}
