import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetOps Admin",
  description: "Operations console for managing bookings and fleet performance.",
};

// Root layout wires global font + theming for the admin shell
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
