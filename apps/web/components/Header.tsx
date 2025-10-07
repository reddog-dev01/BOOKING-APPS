"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** ---------------------- Navigation model ---------------------- */
const NAV = [
  { href: "/", label: "Trang chủ" },
  {
    label: "Dịch vụ",
    children: [
      { href: "/noi-bai-ha-noi", label: "Nội Bài ⇄ Hà Nội" },
      { href: "/noi-bai-di-tinh", label: "Nội Bài đi tỉnh" },
      { href: "/ha-noi-di-tinh", label: "Hà Nội đi tỉnh" },
      { href: "/xe-du-lich", label: "Xe du lịch" },
    ],
  },
  { href: "/bang-gia", label: "Bảng giá" },
  { href: "/khuyen-mai", label: "Khuyến mãi" },
  {
    label: "Kinh nghiệm",
    children: [
      { href: "/cam-nang", label: "Cẩm nang" },
      { href: "/tin-tuc", label: "Tin tức" },
      { href: "/san-bay-cac-nuoc", label: "Sân bay các nước" },
    ],
  },
  {
    label: "Chương trình",
    children: [
      { href: "/tro-thanh-tai-xe", label: "Trở thành tài xế" },
      { href: "/tro-thanh-dai-ly", label: "Trở thành đại lý" },
      { href: "/chinh-sach-affiliate", label: "Chính sách Affiliate" },
    ],
  },
  { href: "/ve-chung-toi", label: "Về chúng tôi" },
  { href: "/lien-he", label: "Liên hệ" },
] as const;

/** --------------------------- Icons ---------------------------- */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.05 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.77.66 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.17a2 2 0 0 1 2.11-.45c.83.32 1.7.54 2.6.66A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

/** ------------------------- Component -------------------------- */
export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* ===== Top notice bar (CTA) ===== */}
      <div className="relative">
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-4 py-1">
              <span className="text-sm sm:text-base md:text-lg font-extrabold uppercase tracking-wider drop-shadow-sm leading-tight">
                <span className="hidden sm:inline">GỌI NGAY ĐỂ ĐẶT XE</span>
                <span className="inline sm:hidden">TAXI NỘI BÀI GIÁ TỐT</span>
              </span>

              <div className="flex justify-center items-center gap-1 sm:gap-3 mt-1 sm:mt-0">
                <PhoneIcon className="h-5 w-5 md:h-6 md:w-6 opacity-95" />
                <a
                  href="tel:0855951536"
                  className="inline-flex items-center h-9 sm:h-10 rounded-full bg-white text-emerald-700/95 px-3 sm:px-4 text-base sm:text-lg font-extrabold tabular-nums shadow-sm hover:shadow-md leading-tight"
                >
                  0855.951.536
                </a>
                <span className="text-white/80 text-xs sm:text-sm font-medium leading-tight">hoặc</span>
                <a
                  href="tel:0915588508"
                  className="inline-flex items-center h-9 sm:h-10 rounded-full bg-amber-300 text-slate-900 px-3 sm:px-4 text-base sm:text-lg font-extrabold tabular-nums shadow-sm hover:shadow-md leading-tight"
                >
                  091.5588.508
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main bar ===== */}
      <div
        className={`border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 transition-shadow ${
          scrolled ? "shadow-sm" : "shadow-none"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between overflow-visible">
            {/* Logo (to hơn trên mobile) */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3" aria-label="Trang chủ">
                <Image
                  src="/logo.svg"
                  alt="Taxi Nội Bài"
                  width={180}
                  height={48}
                  priority
                  className="h-12 w-auto sm:h-9"
                />
              </Link>
            </div>

            {/* Desktop nav (giữ lg, co chữ + không wrap) */}
            <nav className="hidden lg:flex items-center gap-1 overflow-visible" aria-label="Chính">
              {NAV.map((item, idx) => (
                <div key={idx} className="relative group">
                  {"children" in item ? (
                    <>
                      <button
                        className="px-2.5 lg:px-2.5 xl:px-3 py-2 text-[14px] lg:text-[14px] xl:text-[15px] leading-tight font-medium text-gray-700 hover:text-emerald-700 inline-flex items-center gap-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 hover:bg-emerald-50/70 transition whitespace-nowrap"
                        aria-haspopup="true"
                        aria-expanded="false"
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.172l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" />
                        </svg>
                      </button>
                      <div className="pointer-events-none absolute left-0 top-full pt-2 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition z-30">
                        <div className="min-w-[220px] rounded-2xl border bg-white shadow-xl p-2">
                          {(item.children || []).map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-300 outline-none transition whitespace-nowrap"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={`relative px-2.5 lg:px-2.5 xl:px-3 py-2 text-[14px] lg:text-[14px] xl:text-[15px] leading-tight font-medium rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300 whitespace-nowrap ${
                        isActive(item.href)
                          ? "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 z-10"
                          : "text-gray-700 hover:text-emerald-700 hover:bg-emerald-50/70"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            {/* Hotline + Mobile button */}
            <div className="flex items-center gap-2">
              {/* <a
                href="tel:0915588508"
                className="hidden md:inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-10 px-4 text-sm font-semibold tabular-nums shadow-sm hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-300/40 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition whitespace-nowrap"
                aria-label="Gọi hotline 091 5588 508"
              >
                <PhoneIcon className="h-5 w-5" />
                <span className="font-bold">091 5588 508</span>
              </a> */}
              <button
                onClick={() => setOpen(true)}
                className="inline-flex lg:hidden items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition"
              >
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Mở menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Mobile drawer ===== */}
      <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={open ? "false" : "true"}>
        {/* overlay */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        {/* panel */}
        <div
          className={`absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-xl transition-transform ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 h-14 border-b">
            <Image
              src="/logo.svg"
              alt="Taxi Nội Bài"
              width={160}
              height={40}
              className="h-9 w-auto"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg border hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition"
              aria-label="Đóng menu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-2 py-2 divide-y" aria-label="Chính (di động)">
            {NAV.map((item, idx) => (
              <div key={idx} className="py-1">
                {"children" in item ? (
                  <details className="group">
                    <summary className="flex items-center justify-between rounded-lg px-2 py-3 text-base font-medium text-gray-800 hover:bg-gray-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition">
                      <span>{item.label}</span>
                      <svg viewBox="0 0 20 20" className="h-5 w-5 transition group-open:rotate-180" fill="currentColor" aria-hidden="true">
                        <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.172l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" />
                      </svg>
                    </summary>
                    <div className="pl-2 pb-2">
                      {(item.children || []).map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            isActive(child.href)
                              ? "text-emerald-800 bg-emerald-50"
                              : "text-gray-700 hover:bg-emerald-50"
                          }`}
                          aria-current={isActive(child.href) ? "page" : undefined}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-2 py-3 text-base font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                      isActive(item.href) ? "text-emerald-800 bg-emerald-50" : "text-gray-800 hover:bg-gray-50"
                    }`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            {/* Hotline mobile */}
            <div className="pt-2 px-2">
              <a
                href="tel:02477778888"
                className="flex items-center gap-3 rounded-xl bg-emerald-50 text-emerald-800 h-11 px-4 font-extrabold tabular-nums ring-1 ring-emerald-200 hover:ring-emerald-300 hover:bg-emerald-100 active:scale-[0.98] transition"
              >
                <PhoneIcon className="h-5 w-5" /> 024.7777.8888
              </a>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
