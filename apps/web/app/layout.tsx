// apps/web/app/layout.tsx
import type { Metadata, Viewport } from "next";
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

      </body>
    </html>
  );
}
