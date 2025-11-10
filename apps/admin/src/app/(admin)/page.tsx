import { StatCard } from "@/components/cards/stat-card";

const stats = [
  {
    title: "Total Users",
    value: "12,487",
    trend: { label: "+18% vs last month", variant: "positive" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-accent/10 p-2 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m22 21-2-4-2 4" />
        <path d="M20 17a2 2 0 0 1 0-4" />
      </svg>
    ),
  },
  {
    title: "Total Sales",
    value: "$284,900",
    trend: { label: "+12.4%", variant: "positive" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-emerald-500/10 p-2 text-emerald-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="12" x2="12" y1="1" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "Active Subscriptions",
    value: "1,284",
    trend: { label: "-3.2%", variant: "negative" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-amber-500/10 p-2 text-amber-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 4h14" />
        <path d="M5 8h14" />
        <path d="M5 12h14" />
        <path d="M5 16h14" />
        <path d="M7 20h10" />
      </svg>
    ),
  },
  {
    title: "Bounce Rate",
    value: "24.8%",
    trend: { label: "-1.1 pts", variant: "positive" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-rose-500/10 p-2 text-rose-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 3v18h18" />
        <path d="M20 9 9 20" />
        <path d="M12 20h8v-8" />
      </svg>
    ),
  },
] as const;

const latestUsers = [
  {
    name: "Nguyen Van A",
    email: "a.nguyen@example.com",
    role: "Dispatcher",
    status: "Active",
    createdAt: "2025-01-18 09:24",
  },
  {
    name: "Tran Thi B",
    email: "tran.b@example.com",
    role: "Driver",
    status: "Onboarding",
    createdAt: "2025-01-17 16:08",
  },
  {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    role: "Finance",
    status: "Active",
    createdAt: "2025-01-16 10:12",
  },
  {
    name: "Do Thi C",
    email: "do.c@example.com",
    role: "Support",
    status: "Inactive",
    createdAt: "2025-01-14 14:45",
  },
  {
    name: "Le Minh D",
    email: "le.d@example.com",
    role: "Operations",
    status: "Active",
    createdAt: "2025-01-13 08:02",
  },
];

const activities = [
  {
    title: "New enterprise booking",
    description: "Grab Holdings scheduled 12-seat van for VIP transfer.",
    time: "10 minutes ago",
    badge: "Priority",
  },
  {
    title: "Driver documents expiring",
    description: "3 drivers require license renewal within 14 days.",
    time: "35 minutes ago",
    badge: "Alert",
  },
  {
    title: "Subscription payment received",
    description: "Monthly retainer from VietTravel cleared via Stripe.",
    time: "1 hour ago",
    badge: "Revenue",
  },
  {
    title: "Incident resolved",
    description: "Flat tire report for Trip #HB234 closed by maintenance.",
    time: "Yesterday",
    badge: "Resolved",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-foreground">Dashboard</span>
        <span aria-hidden>/</span>
        <span className="text-muted-foreground">Real-time insight</span>
      </div>
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Latest Users</h2>
              <p className="text-sm text-muted-foreground">Recent operator accounts with access to dispatch tools.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              View all
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latestUsers.map((user) => (
                  <tr key={user.email} className="transition hover:bg-muted/40">
                    <td className="px-6 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-3 text-muted-foreground">{user.role}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          user.status === "Active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : user.status === "Onboarding"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{user.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <p className="text-sm text-muted-foreground">Operational signals for the last 24 hours.</p>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {activities.map((activity) => (
              <div key={activity.title} className="relative rounded-xl border border-border/60 bg-background/50 p-4">
                <div className="absolute -left-6 top-5 hidden h-3 w-3 rounded-full bg-accent lg:block" aria-hidden />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{activity.description}</p>
                <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {activity.badge}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Revenue vs Targets</h2>
              <p className="text-sm text-muted-foreground">Track performance of corporate vs retail bookings.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Download report
            </button>
          </div>
          <div className="h-64 rounded-xl border border-dashed border-border bg-muted/40" aria-hidden>
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart placeholder (connect BI or embed Metabase)
            </p>
          </div>
        </article>
        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Fleet Utilization</h2>
              <p className="text-sm text-muted-foreground">Monitor occupancy across your vehicle classes.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Manage fleet
            </button>
          </div>
          <div className="h-64 rounded-xl border border-dashed border-border bg-muted/40" aria-hidden>
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart placeholder (connect telemetry feed)
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
