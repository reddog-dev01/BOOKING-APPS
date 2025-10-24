// apps/web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./(styles)/globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Đặt xe sân bay — Nhanh & Giá tốt",
  description: "Giá trọn gói | 1 chiều/2 chiều | VAT | Hỗ trợ 24/7",
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Đặt xe sân bay",
    telephone: "0969xxxxxx",
    areaServed: "Hà Nội, Nội Bài",
    url: "http://localhost:3000",
  };

  return (
    <html lang="vi">
      <body className="min-h-screen bg-gray-50">
        <Header />

        {/* JSON-LD SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {children}
        <Footer />

        {/* Google Maps JS (Places) – cần cho AddressInput */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
