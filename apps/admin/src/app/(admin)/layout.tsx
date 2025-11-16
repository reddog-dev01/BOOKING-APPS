import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/fleet", label: "Fleet" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      links={NAV_ITEMS.map((item) => ({
        ...item,
        icon: (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15V6" />
            <path d="M18 9h3" />
            <path d="M10 6v12" />
            <path d="M7 9h3" />
            <path d="M3 12v6" />
            <path d="M0 15h6" />
          </svg>
        ),
      }))}
      appName="FleetOps Control"
      topbarTitle="Điều hành đặt xe"
      topbarSubtitle="Giám sát đơn, đội xe và trải nghiệm khách hàng theo thời gian thực."
    >
      {children}
    </AdminShell>
  );
}
