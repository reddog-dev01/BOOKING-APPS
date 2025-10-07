"use client";
/**
 * Carousel ảnh nhẹ, không dùng thư viện.
 * - Auto-play (pause khi hover/đang kéo)
 * - Kéo chuột / vuốt tay
 * - Nút Prev/Next + chấm điều hướng
 */
import { useEffect, useRef, useState } from "react";

type Img = { src: string; alt?: string };

export default function BannerCarousel({
  images,
  heightClass = "h-64",
  autoplayMs = 5000,
}: {
  images: Img[];
  heightClass?: string;
  autoplayMs?: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // auto-play
  useEffect(() => {
    if (paused || images.length <= 1) return;
    const id = setInterval(() => goTo(index + 1), autoplayMs);
    return () => clearInterval(id);
  }, [index, paused, autoplayMs, images.length]);

  // chuyển tới ảnh
  function goTo(i: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const n = images.length;
    const next = (i + n) % n;
    const child = vp.children[next] as HTMLElement | undefined;
    if (child) {
      vp.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
      setIndex(next);
    }
  }

  // theo dõi scroll → update index
  function onScroll() {
    const vp = viewportRef.current;
    if (!vp) return;
    const w = vp.clientWidth;
    const i = Math.round(vp.scrollLeft / w);
    if (i !== index) setIndex(i);
  }

  // drag state
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  // chuột
  function onMouseDown(e: React.MouseEvent) {
    const vp = viewportRef.current; if (!vp) return;
    dragging.current = true; setPaused(true);
    startX.current = e.clientX; startScroll.current = vp.scrollLeft;
  }
  function onMouseMove(e: React.MouseEvent) {
    const vp = viewportRef.current; if (!vp || !dragging.current) return;
    const dx = e.clientX - startX.current;
    vp.scrollLeft = startScroll.current - dx;
  }
  function onMouseUpLeave() {
    dragging.current = false;
    setPaused(false);
  }

  // cảm ứng
  function onTouchStart(e: React.TouchEvent) {
    const vp = viewportRef.current; if (!vp) return;
    setPaused(true); dragging.current = true;
    startX.current = e.touches[0].clientX; startScroll.current = vp.scrollLeft;
  }
  function onTouchMove(e: React.TouchEvent) {
    const vp = viewportRef.current; if (!vp || !dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    vp.scrollLeft = startScroll.current - dx;
  }
  function onTouchEnd() {
    dragging.current = false;
    setPaused(false);
  }

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className={`w-full ${heightClass} rounded-2xl overflow-hidden border bg-white
                    flex snap-x snap-mandatory scroll-smooth
                    overflow-x-auto no-scrollbar select-none`}
        onScroll={onScroll}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={onMouseUpLeave}   // ✅ dùng đúng onMouseLeave
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="Banner khuyến mãi"
      >
        {images.map((img, i) => (
          <div key={i} className="min-w-full snap-center relative" role="group" aria-label={`${i + 1} / ${images.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt ?? `banner ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
          </div>
        ))}
      </div>

      {/* Prev / Next */}
      <button
        type="button"
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-md"
        onClick={() => goTo(index - 1)}
        aria-label="Ảnh trước"
      >‹</button>
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white px-2 py-1 rounded-md"
        onClick={() => goTo(index + 1)}
        aria-label="Ảnh tiếp"
      >›</button>

      {/* Dots */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            aria-label={`Chuyển tới ảnh ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full border border-white ${index === i ? "bg-white" : "bg-white/40 hover:bg-white/70"}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
