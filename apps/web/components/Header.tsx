"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** ================= Brand tokens (Tailwind utility aliases) ================= */
const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-6";
// Dùng brand làm focus ring, không dùng emerald nữa
const RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45";
const GLASS = "bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60";

/** --------------------------- Navigation model --------------------------- */
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

/** ------------------------------ Icons ------------------------------ */
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

/** ---------------------------- Component ---------------------------- */
export default function Header() {
  // Mobile drawer
  const [open, setOpen] = useState(false);
  // Desktop: shadow on scroll
  const [scrolled, setScrolled] = useState(false);
  // Desktop dropdown (keyboard + hover)
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
  const isParentActive = (children?: readonly { href: string; label: string }[]) =>
    !!children?.some((c) => pathname?.startsWith(c.href));

  // Scroll listener (passive + rAF throttle)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 8);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile drawer: scroll-lock, Escape, focus trap, return focus
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        // simple focus trap
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // focus first focusable
    setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 0);

    document.addEventListener("keydown", keyHandler);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", keyHandler);
      openerRef.current?.focus();
    };
  }, [open]);

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Desktop dropdown helpers
  const openMenu = (i: number) => setOpenIdx(i);
  const closeMenu = () => setOpenIdx(null);
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openMenu(i);
    }
    if (e.key === "Escape") {
      closeMenu();
      (e.currentTarget as HTMLButtonElement).focus();
    }
  };

  return (
    <header className="sticky top-0 z-50">
      {/* ===== Top notice bar (CTA) – GIỮ NGUYÊN NHƯ CŨ, CHỈ ĐỔI MÀU BRAND ===== */}
      <div className="relative">
        <div className="bg-gradient-to-r from-brand via-brand-dark to-brand text-white">
          <div className={CONTAINER}>
            <div className="flex flex-col sm:flex-row items-center justify-center text-center gap-1 sm:gap-4 py-1">
              <span className="text-sm sm:text-base md:text-lg font-extrabold uppercase tracking-wider drop-shadow-sm leading-tight">
                <span className="hidden sm:inline">GỌI NGAY ĐỂ ĐẶT XE</span>
                <span className="inline sm:hidden">TAXI NỘI BÀI GIÁ TỐT</span>
              </span>

              <div className="flex justify-center items-center gap-1 sm:gap-3 mt-1 sm:mt-0">
                <PhoneIcon className="h-5 w-5 md:h-6 md:w-6 opacity-95" />
                {/* Nút gọi 1 */}
                <a
                  href="tel:0855951536"
                  className="inline-flex items-center h-9 sm:h-10 rounded-full bg-white text-brand-dark px-3 sm:px-4 text-base sm:text-lg font-extrabold tabular-nums shadow-sm hover:shadow-md leading-tight"
                >
                  0855.951.536
                </a>
                <span className="text-white/80 text-xs sm:text-sm font-medium leading-tight">hoặc</span>
                {/* Nút gọi 2 (nhấn mạnh khác màu nhẹ) */}
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
      <div className={`${GLASS} border-b transition-shadow ${scrolled ? "shadow-sm" : "shadow-none"}`}>
        <div className={CONTAINER}>
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3" aria-label="Trang chủ">
              <Image
                src="/logo.svg"
                alt="Taxi Nội Bài"
                width={180}
                height={48}
                priority={pathname === "/"}
                sizes="(min-width:1024px) 180px, 40vw"
                className="h-10 sm:h-9 w-auto"
              />
            </Link>

            {/* Desktop nav (ARIA + keyboard) */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Chính" role="menubar">
              {NAV.map((item, idx) => {
                const hasChildren = "children" in item;
                const parentActive = hasChildren ? isParentActive(item.children) : false;

                return (
                  <div
                    key={idx}
                    className="relative group"
                    onMouseEnter={() => hasChildren && openMenu(idx)}
                    onMouseLeave={() => hasChildren && closeMenu()}
                  >
                    {hasChildren ? (
                      <>
                        <button
                          role="menuitem"
                          aria-haspopup="true"
                          aria-expanded={openIdx === idx}
                          onKeyDown={(e) => onMenuKeyDown(e, idx)}
                          onFocus={() => openMenu(idx)}
                          className={`px-2.5 xl:px-3 py-2 text-[14px] xl:text-[15px] font-medium rounded-lg transition ${RING} inline-flex items-center gap-1 ${
                            parentActive
                              ? "text-brand-dark bg-brand/10 ring-1 ring-brand/30"
                              : "text-gray-700 hover:text-brand-dark"
                          }`}
                        >
                          <span className="whitespace-nowrap">{item.label}</span>
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.172l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" />
                          </svg>
                          {/* hover underline */}
                          <span className="pointer-events-none absolute left-2 right-2 -bottom-0.5 h-[2px] scale-x-0 bg-brand-dark rounded-full transition-transform duration-300 group-hover:scale-x-100" />
                        </button>

                        <div
                          role="menu"
                          aria-label={item.label}
                          className={`absolute left-0 top-full pt-2 z-30 transition ${
                            openIdx === idx ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                          }`}
                        >
                          <div className="min-w-[220px] rounded-2xl border bg-white shadow-xl p-2">
                            {(item.children || []).map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="block rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-brand/10 hover:text-brand-dark focus:bg-brand/10 focus:text-brand-dark outline-none transition whitespace-nowrap"
                                role="menuitem"
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
                        role="menuitem"
                        className={`relative px-2.5 xl:px-3 py-2 text-[14px] xl:text-[15px] font-medium rounded-lg transition ${RING} whitespace-nowrap ${
                          isActive(item.href)
                            ? "text-brand-dark bg-brand/10 ring-1 ring-brand/30"
                            : "text-gray-700 hover:text-brand-dark hover:bg-brand/10"
                        }`}
                      >
                        {item.label}
                        {/* hover underline */}
                        <span className="pointer-events-none absolute left-2 right-2 -bottom-0.5 h-[2px] scale-x-0 bg-brand-dark rounded-full transition-transform duration-300 group-hover:scale-x-100" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Right actions (KHÔNG hiển thị hotline desktop) */}
            <div className="flex items-center gap-2">
              {/* Only mobile menu button */}
              <button
                ref={openerRef}
                onClick={() => setOpen(true)}
                className={`inline-flex lg:hidden items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 transition ${RING}`}
                aria-label="Mở menu"
                aria-haspopup="dialog"
                aria-expanded={open}
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
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          className={`absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-xl transition-transform overscroll-contain ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 h-14 border-b">
            <Image src="/logo.svg" alt="Taxi Nội Bài" width={160} height={40} className="h-9 w-auto" />
            <button onClick={() => setOpen(false)} className={`p-2 rounded-lg border hover:bg-gray-50 transition ${RING}`} aria-label="Đóng menu">
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-2 py-2 divide-y" aria-label="Chính (di động)">
            {NAV.map((item, idx) => (
              <div key={idx} className="py-1">
                {"children" in item ? (
                  <details className="group">
                    <summary
                      className={`flex items-center justify-between rounded-lg px-2 py-3 text-base font-medium text-gray-800 cursor-pointer transition ${RING}`}
                    >
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
                          className={`block rounded-lg px-3 py-2 text-sm transition outline-none ${RING} ${
                            isActive(child.href) ? "text-brand-dark bg-brand/10" : "text-gray-700 hover:bg-brand/10 hover:text-brand-dark"
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
                    className={`block rounded-lg px-2 py-3 text-base font-medium transition outline-none ${RING} ${
                      isActive(item.href) ? "text-brand-dark bg-brand/10" : "text-gray-800 hover:bg-gray-50"
                    }`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            {/* Hotline mobile (giữ, chỉ đổi màu brand nhạt) */}
            <div className="pt-2 px-2">
              <a
                href="tel:02477778888"
                className="flex items-center gap-3 rounded-xl bg-brand/10 text-brand-dark h-11 px-4 font-extrabold tabular-nums ring-1 ring-brand/30 hover:ring-brand/40 hover:bg-brand/15 active:scale-[0.98] transition"
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
