import type { ReactNode } from "react";
import { CarFront, FileText, LayoutDashboard, Settings } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/bookings", label: "Bookings", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/fleet", label: "Fleet", icon: <CarFront className="h-4 w-4" /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      links={NAV_ITEMS}
      appName="FleetOps Control"
      topbarTitle="Điều hành đặt xe"
      topbarSubtitle="Giám sát đơn, đội xe và chất lượng dịch vụ theo thời gian thực."
    >
      {children}
    </AdminShell>
  );
}
