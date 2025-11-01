// apps/web/components/BookingForm.tsx
"use client";

import Image from "next/image";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  useLayoutEffect,
  useCallback,
  useId,
} from "react";
import {
  CircleDot,
  MapPin,
  Plus,
  Repeat2,
  Minus,
  Plane,
  Route,
  CalendarClock,
  Info,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { createPortal } from "react-dom";

/* ====== API helpers & types (server) ====== */
import { fetchQuote, createBooking } from "../lib/api";
import type {
  QuoteRequestDto,
  QuoteResponse,
  CreateBookingRequestDto,
  DirectionDto,
} from "../lib/types";

import AddressInput, { type AddressValue } from "./AddressInput";
import { AIRPORTS } from "../lib/airports";

/* ================= Hook & Portal ================= */
function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width:${breakpointPx - 1}px)`);
    const on = () => setIsMobile(mql.matches);
    on();
    if (mql.addEventListener) {
      mql.addEventListener("change", on);
      return () => mql.removeEventListener("change", on);
    } else {
      // @ts-ignore Safari cũ
      mql.addListener(on);
      return () => {
        // @ts-ignore
        mql.removeListener(on);
      };
    }
  }, [breakpointPx]);
  return isMobile;
}

function Portal({ children }: { children: ReactNode }) {
  const elRef = useRef<HTMLElement | null>(null);
  if (!elRef.current && typeof document !== "undefined") {
    elRef.current = document.createElement("div");
  }
  useLayoutEffect(() => {
    const el = elRef.current!;
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);
  return elRef.current ? createPortal(children, elRef.current) : null;
}

/* ================= Types & Data ================= */
type TripType = "airport" | "road";
type Vehicle = { id: number; name: string; img: string; alt: string };

type Stop = { id: string; text: string; lat?: number; lng?: number };
const genId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

const VEHICLES: Vehicle[] = [
  { id: 2, name: "4 chỗ cốp rộng", img: "/vehicles/5seats.png", alt: "Xe 4 chỗ cốp rộng" },
  { id: 3, name: "7 chỗ", img: "/vehicles/7seats.png", alt: "Xe 7 chỗ" },
  { id: 1, name: "4 chỗ cốp nhỏ", img: "/vehicles/4seats.png", alt: "Xe 4 chỗ cốp nhỏ" },
  { id: 4, name: "16 chỗ", img: "/vehicles/16seats.png", alt: "Xe 16 chỗ" },
  { id: 6, name: "29 chỗ", img: "/vehicles/29seats.png", alt: "Xe 29 chỗ" },
  { id: 7, name: "45 chỗ", img: "/vehicles/45seats.png", alt: "Xe 45 chỗ" },
];

/* ================= UI tokens ================= */
const RING = "focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand-dark";
const RADIUS = "rounded-xl";
const CARD = `w-full ${RADIUS} border border-gray-300 bg-white shadow-sm ` + RING;
const CARD_BTN = CARD + " px-3 py-2.5 text-left min-w-0";
const CARD_MINH = "min-h-[56px]";
const INPUT_GROUP = CARD + " p-0 flex items-stretch min-w-0 overflow-hidden";
// Shared typography keeps address inputs modern and ensures copy fits comfortably inside the card.
const INPUT_TEXT_STYLE =
  "text-[15px] leading-6 font-medium tracking-tight text-slate-900 placeholder:text-slate-400 placeholder:font-normal";
const INPUT_FIELD = `w-full bg-transparent border-0 outline-none focus:ring-0 px-10 py-3 ${INPUT_TEXT_STYLE}`;
const INPUT_FIELD_COMPACT =
  `w-full bg-transparent border-0 outline-none focus:ring-0 px-3 py-3 ${INPUT_TEXT_STYLE}`;
const INPUT_RIGHT =
  "shrink-0 grid place-items-center w-12 border-l border-gray-300 rounded-r-xl transition-colors";

const VI_ADDRESS_COLLATOR =
  typeof Intl !== "undefined" && typeof Intl.Collator === "function"
    ? new Intl.Collator("vi", { sensitivity: "base", usage: "search", ignorePunctuation: true })
    : null;

const addressesMatch = (a: string, b: string) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (VI_ADDRESS_COLLATOR) {
    return VI_ADDRESS_COLLATOR.compare(a, b) === 0;
  }
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
};

/* ================= Consts & helpers ================= */
const NOIBAI = "Sân bay Nội Bài";
const fmtMoney = (n: number) => n.toLocaleString("vi-VN") + "đ";
const normalizePhone = (s: string) =>
  (s || "").replace(/\s+/g, "").replace(/^(?:\+84)(\d+)/, "0$1");

// Thông điệp lỗi chung cho giờ chờ
const WAIT_ERR_MSG =
  "Quý khách nhập sai giờ chờ. Vui lòng nhập số giờ ≥ 0 (ví dụ: 1; 1.5; 2).";

// parse: "", "01", "1.5", "1,5" → số ≥ 0; chuỗi trống ⇒ 0; sai định dạng/âm ⇒ null
const parseHoursLoose = (s: string): number | null => {
  if (s == null || s.trim() === "") return 0;
  const normalized = s.replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

/** FE fallback phí chờ:
 * - ≤1h: 0
 * - >1h: base = 30k
 * - Mỗi giờ full sau đó: +30k
 * - Lẻ: đúng 0.5h +20k; <0.5h +0; >0.5h +30k
 */
const calcWaitFee = (hours: number) => {
  if (!(hours > 1)) return 0;
  let fee = 30000;
  const extraBeyondSecond = hours - 2;
  if (extraBeyondSecond <= 0) return fee;

  const full = Math.floor(extraBeyondSecond);
  fee += full * 30000;

  const frac = extraBeyondSecond - full;
  if (frac === 0) return fee;
  if (frac === 0.5) return fee + 20000;
  if (frac < 0.5) return fee;
  return fee + 30000;
};

/** Gán giá trị cho cả object-ref và callback-ref an toàn */
function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as React.MutableRefObject<T | null>).current = value;
}

/* ====== BẢNG GIÁ DEMO theo loại xe (1 chiều) ====== */
const BASE_PRICE_BY_VEHICLE: Record<number, number> = {
  1: 200_000,
  2: 210_000,
  3: 260_000,
  4: 600_000,
  6: 1_200_000,
  7: 1_500_000,
};
const roundTo = (n: number, step = 1000) => Math.round(n / step) * step;

/** FE fallback tổng tiền */
function calcQuoteTotal(params: {
  vehicleTypeId: number;
  roundTrip: boolean;
  waitFee: number;
  vat: boolean;
}) {
  const { vehicleTypeId, roundTrip, waitFee, vat } = params;
  const base = BASE_PRICE_BY_VEHICLE[vehicleTypeId] ?? BASE_PRICE_BY_VEHICLE[2];
  let subtotal = base + (roundTrip ? base : 0) + waitFee;
  if (vat) subtotal *= 1.1;
  return roundTo(subtotal, 1000);
}

/* ================= VehicleDropdown ================= */
function VehicleDropdown({
  value,
  onChange,
  label = "Loại xe",
}: {
  value: number;
  onChange: (id: number) => void;
  label?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);

  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const setItemRef = (i: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[i] = el;
  };

  const selected = useMemo(() => VEHICLES.find((v) => v.id === value), [value]);

  // width theo trigger/viewport
  const [menuW, setMenuW] = useState(320);
  useEffect(() => {
    const measure = () => {
      const btnW = Math.round(btnRef.current?.getBoundingClientRect().width ?? 320);
      const vw = Math.max(320, window.innerWidth);
      setMenuW(Math.max(260, Math.min(btnW, vw - 16)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Outside click (mobile-safe)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [open]);

  // Focus item đang chọn khi mở
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, VEHICLES.findIndex((v) => v.id === value));
    setFocusIdx(idx < 0 ? 0 : idx);
    setTimeout(() => itemRefs.current[idx]?.focus(), 0);
  }, [open, value]);

  const onKeyDownBtn = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onKeyDownList = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = (focusIdx + 1) % VEHICLES.length;
      setFocusIdx(n);
      itemRefs.current[n]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const p = (focusIdx - 1 + VEHICLES.length) % VEHICLES.length;
      setFocusIdx(p);
      itemRefs.current[p]?.focus();
    }
  };

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
    btnRef.current?.focus();
  };

  // Toạ độ popover (Portal mobile)
  const [coords, setCoords] = useState({ left: 0, top: 0, width: 320 });
  const calcCoords = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;

    const vp = (window as any).visualViewport as VisualViewport | undefined;
    const vw = vp?.width ?? window.innerWidth;
    const offsetLeft = vp?.offsetLeft ?? 0;
    const offsetTop = vp?.offsetTop ?? 0;

    const w = Math.min(menuW, vw - 16);
    const left = Math.min(Math.max(8, r.left + offsetLeft), vw - w - 8);
    const top = r.bottom + offsetTop + 4;

    setCoords({ left, top, width: w });
  };
  useEffect(() => {
    if (!open || !isMobile) return;
    calcCoords();
    const onReposition = () => calcCoords();
    const vp = (window as any).visualViewport as VisualViewport | undefined;

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, { passive: true });
    vp?.addEventListener("resize", onReposition);
    vp?.addEventListener("scroll", onReposition);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition as any);
      vp?.removeEventListener("resize", onReposition);
      vp?.removeEventListener("scroll", onReposition);
    };
  }, [open, isMobile, menuW]);

  const LIST_FRAME = "overflow-auto overflow-x-auto max-h-[60vh] overscroll-contain";
  const ITEM_CLS =
    "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-brand/10 focus:bg-brand/10 focus:outline-none";
  const IMG_WRAPPER = "relative w-10 h-7 shrink-0";

  const ListUI = (
    <ul
      ref={listRef}
      role="listbox"
      tabIndex={-1}
      onKeyDown={onKeyDownList}
      className={`${RADIUS} border border-gray-300 bg-white shadow-xl ${LIST_FRAME}`}
      style={{ WebkitOverflowScrolling: "touch" as any }}
    >
      {VEHICLES.map((v, idx) => {
        const active = v.id === value;
        return (
          <li key={v.id}>
            <button
              ref={setItemRef(idx)}
              type="button"
              onClick={() => select(v.id)}
              role="option"
              aria-selected={active}
              className={`${ITEM_CLS} ${active ? "bg-brand/10" : ""}`}
            >
              <span className={IMG_WRAPPER}>
                <Image src={v.img} alt={v.alt} fill sizes="40px" className="object-contain" />
              </span>
              <span className="flex-1 leading-tight whitespace-nowrap truncate pr-4 min-w-0 text-[15px]">
                {v.name}
              </span>
              {active && <span className="text-brand font-semibold shrink-0">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative min-w-0 isolate">
      <label className="text-sm text-gray-700">{label}</label>

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDownBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${CARD_BTN} ${CARD_MINH}`}
        title={selected?.name}
      >
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={IMG_WRAPPER}>
              <Image
                src={selected?.img ?? "/vehicles/4seats.png"}
                alt={selected?.alt ?? "Loại xe"}
                fill
                sizes="40px"
                className="object-contain"
                priority
              />
            </span>
            <span className="font-medium text-gray-900 leading-tight whitespace-nowrap truncate min-w-0 text-[15px]">
              {selected?.name ?? "Chọn loại xe"}
            </span>
          </div>
          <span aria-hidden className="text-gray-500 ml-2 shrink-0">▾</span>
        </div>
      </button>

      {open &&
        (isMobile ? (
          <Portal>
            <div
              className="fixed z-[9999]"
              style={{
                left: coords.left,
                top: coords.top,
                width: coords.width,
                maxWidth: "calc(100vw - 16px)",
              }}
            >
              {ListUI}
            </div>
          </Portal>
        ) : (
          <div
            className="absolute z-[60] mt-1"
            style={{ width: `${menuW}px`, maxWidth: "calc(100vw - 16px)" }}
          >
            {ListUI}
          </div>
        ))}
    </div>
  );
}

/* ================= OneFieldDateTime ================= */
function OneFieldDateTime({
  value,
  onChange,
  label = "Thời gian đi",
  minuteStep = 5,
  minDate,
  maxDate,
  minOffsetMinutes = 30,
  showError,
  triggerRef,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  minuteStep?: 1 | 5 | 10 | 15;
  minDate?: string;
  maxDate?: string;
  minOffsetMinutes?: number;
  showError?: boolean;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  type Phase = "date" | "hour" | "minute";
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("date");

  // committed value đang hiển thị
  const [committedDate, setCommittedDate] = useState("");
  const [committedHour, setCommittedHour] = useState<number | null>(null);
  const [committedMinute, setCommittedMinute] = useState<number | null>(null);

  // draft khi đang chọn trong panel
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [draftHour, setDraftHour] = useState<number | null>(null);
  const [draftMinute, setDraftMinute] = useState<number | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [triggerW, setTriggerW] = useState(320);

  const z2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
  const parseYMD = (s?: string | null) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    if (![y, m, d].every(Number.isFinite)) return null;
    return new Date(y, m - 1, d);
  };
  const resetDraft = () => {
    setDraftDate(null);
    setDraftHour(null);
    setDraftMinute(null);
    setPhase("date");
  };

  // đo width
  useEffect(() => {
    const measure = () => {
      const w = Math.round(btnRef.current?.getBoundingClientRect().width ?? 320);
      const vw = Math.max(320, window.innerWidth);
      setTriggerW(Math.max(240, Math.min(w, vw - 16)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // sync value
  useEffect(() => {
    if (!value) {
      setCommittedDate("");
      setCommittedHour(null);
      setCommittedMinute(null);
      return;
    }
    const [d, t] = value.split("T");
    setCommittedDate(d || "");
    if (t) {
      const [hh, mm] = t
        .slice(0, 5)
        .split(":")
        .map((x) => parseInt(x, 10));
      setCommittedHour(Number.isFinite(hh) ? hh : null);
      setCommittedMinute(Number.isFinite(mm) ? mm : null);
    } else {
      setCommittedHour(null);
      setCommittedMinute(null);
    }
  }, [value]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
      resetDraft();
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [open]);

  // calendar
  const now = new Date();
  const minDT = new Date(now.getTime() + Math.max(0, minOffsetMinutes) * 60 * 1000);
  const minDProp = parseYMD(minDate) ?? new Date(minDT.getFullYear(), minDT.getMonth(), minDT.getDate());
  const maxDProp = parseYMD(maxDate) ?? null;

  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [viewYM, setViewYM] = useState<{ y: number; m: number }>({ y: today.y, m: today.m });

  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYM.y, viewYM.m, 1));

  // Tuần bắt đầu Thứ 2
  const monthMatrix = useMemo(() => {
    const first = new Date(viewYM.y, viewYM.m, 1);
    const start = new Date(first);
    // 0=CN..6=T7 -> chuyển về offset Thứ 2=0
    const firstDay = first.getDay(); // 0..6 (CN..T7)
    const offset = (firstDay + 6) % 7; // Mon-first
    start.setDate(1 - offset);
    const weeks: { date: Date; inMonth: boolean }[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: { date: Date; inMonth: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        row.push({ date: cur, inMonth: cur.getMonth() === viewYM.m });
      }
      weeks.push(row);
    }
    return weeks;
  }, [viewYM]);

  const MINUTES = useMemo(() => {
    const s = Math.max(1, Math.min(15, minuteStep));
    const arr: number[] = [];
    for (let m = 0; m < 60; m += s) arr.push(m);
    return arr;
  }, [minuteStep]);

  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isDateDisabled = (d: Date) => {
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (minDProp && base < new Date(minDProp.getFullYear(), minDProp.getMonth(), minDProp.getDate())) return true;
    if (maxDProp && base > new Date(maxDProp.getFullYear(), maxDProp.getMonth(), maxDProp.getDate())) return true;
    return false;
  };

  const minMinuteOfDay = useMemo(() => {
    const dd = parseYMD(draftDate);
    if (!dd) return null;
    if (!(dd.getFullYear() === minDT.getFullYear() && dd.getMonth() === minDT.getMonth() && dd.getDate() === minDT.getDate())) return null;
    return minDT.getHours() * 60 + minDT.getMinutes();
  }, [draftDate]);

  const hourDisabled = (h: number) => !!(minMinuteOfDay && h * 60 + 59 < minMinuteOfDay);
  const minuteDisabled = (h: number | null, m: number) => !!(minMinuteOfDay && h !== null && h * 60 + m < minMinuteOfDay);

  const z2str = (n: number) => String(n).padStart(2, "0");
  const pretty = () => {
    if (!committedDate || committedHour === null || committedMinute === null) return "Thời gian đi";
    const [, m, d] = committedDate.split("-");
    return `${d}/${m} ${z2str(committedHour)}:${z2str(committedMinute)}`;
  };

  const openPicker = () => {
    setOpen((s) => !s);
    setPhase("date");
    resetDraft();
    setViewYM({ y: today.y, m: today.m });
  };
  const onPickDate = (d: Date) => {
    if (isDateDisabled(d)) return;
    const ymd = toYMD(d);
    setDraftDate(ymd);
    setPhase("hour");
    setDraftHour(sameDate(d, minDT) ? minDT.getHours() : null);
  };
  const onPickHour = (h: number) => {
    if (hourDisabled(h)) return;
    setDraftHour(h);
    setPhase("minute");
  };
  const onPickMinute = (m: number) => {
    if (minuteDisabled(draftHour, m)) return;
    setDraftMinute(m);
    const iso = `${draftDate}T${z2str(draftHour ?? 0)}:${z2str(m)}`;
    onChange(iso);
    setOpen(false);
    setCommittedDate(draftDate || "");
    setCommittedHour(draftHour);
    setCommittedMinute(m);
    resetDraft();
    btnRef.current?.focus();
  };

  // Toạ độ panel khi mobile
  const [panelPos, setPanelPos] = useState({ left: 0, top: 0, width: triggerW });
  const calcPanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vp = (window as any).visualViewport as VisualViewport | undefined;
    const vw = vp?.width ?? window.innerWidth;
    const offsetLeft = vp?.offsetLeft ?? 0;
    const offsetTop = vp?.offsetTop ?? 0;

    const width = Math.min(triggerW, vw - 16);
    const left = Math.min(Math.max(8, r.left + offsetLeft), vw - width - 8);
    const top = r.bottom + offsetTop + 4;

    setPanelPos({ left, top, width });
  };
  useEffect(() => {
    if (!open || !isMobile) return;
    calcPanel();
    const onReposition = () => calcPanel();
    const vp = (window as any).visualViewport as VisualViewport | undefined;

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, { passive: true });
    vp?.addEventListener("resize", onReposition);
    vp?.addEventListener("scroll", onReposition);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition as any);
      vp?.removeEventListener("resize", onReposition);
      vp?.removeEventListener("scroll", onReposition);
    };
  }, [open, triggerW, isMobile]);

  const FRAME = "overflow-auto overflow-x-auto max-h-[70vh] overscroll-contain";
  const NUM_BTN = "px-2.5 py-2 text-[14px] leading-none select-none bg-transparent border-0 focus:outline-none focus-visible:underline";
  const NUM_DISABLED = "text-gray-300 cursor-not-allowed";
  const NUM_NORMAL = "text-gray-800 hover:text-brand";
  const NUM_ACTIVE = "text-brand font-semibold";
  const NUM_TODAY = "text-brand";

  const PanelUI = (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Chọn thời gian đi"
      className={`${RADIUS} border border-gray-300 bg-white shadow-xl p-3 ${FRAME}`}
      style={{ WebkitOverflowScrolling: "touch" as any }}
    >
      {phase === "date" && (
        <div>
          <div className="flex items-center justify-between mb-2 min-w-0">
            <button
              type="button"
              className={`${NUM_BTN} ${NUM_NORMAL}`}
              aria-label="Tháng trước"
              onClick={() => {
                const { y, m } = viewYM;
                const prevM = m === 0 ? 11 : m - 1;
                const prevY = m === 0 ? y - 1 : y;
                if (!minDProp || new Date(y, m, 1) > new Date(minDProp.getFullYear(), minDProp.getMonth(), 1)) {
                  setViewYM({ y: prevY, m: prevM });
                }
              }}
            >
              ‹
            </button>
            <div className="font-semibold text-base truncate">{monthLabel}</div>
            <button
              type="button"
              className={`${NUM_BTN} ${NUM_NORMAL}`}
              aria-label="Tháng sau"
              onClick={() => {
                const { y, m } = viewYM;
                const nextM = m === 11 ? 0 : m + 1;
                const nextY = m === 11 ? y + 1 : y;
                if (!maxDProp || new Date(y, m, 1) < new Date(maxDProp.getFullYear(), maxDProp.getMonth(), 1)) {
                  setViewYM({ y: nextY, m: nextM });
                }
              }}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] text-gray-500 mb-1.5">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => (
              <div key={w} className="py-0.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {monthMatrix.flat().map(({ date: d, inMonth }, idx) => {
              const ymd = toYMD(d);
              const isToday =
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate();
              const isDraftSel = draftDate === ymd;
              const disabled = isDateDisabled(d) || !inMonth;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onPickDate(d)}
                  disabled={disabled}
                  className={[
                    "h-9 sm:h-10 relative flex items-center justify-center rounded-lg",
                    NUM_BTN,
                    disabled
                      ? NUM_DISABLED
                      : isDraftSel
                      ? NUM_ACTIVE
                      : isToday
                      ? NUM_TODAY
                      : NUM_NORMAL,
                  ].join(" ")}
                  aria-label={`Chọn ngày ${d.getDate()}`}
                >
                  {d.getDate()}
                  {isDraftSel && (
                    <span
                      className="absolute inset-0 rounded-lg ring-2 ring-brand pointer-events-none"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "hour" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <button type="button" className={`${NUM_BTN} ${NUM_NORMAL}`} onClick={() => setPhase("date")}>
              ← Ngày
            </button>
            <div className="text-xs text-gray-600">{draftDate}</div>
          </div>
          <div className="grid grid-cols-4 gap-0.5">
            {Array.from({ length: 24 }, (_, h) => h).map((h) => {
              const active = h === draftHour;
              const disabled = hourDisabled(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => onPickHour(h)}
                  disabled={disabled}
                  className={["text-center relative rounded", NUM_BTN, disabled ? NUM_DISABLED : active ? NUM_ACTIVE : NUM_NORMAL].join(" ")}
                  aria-label={`Chọn ${String(h).padStart(2, "0")} giờ`}
                >
                  {String(h).padStart(2, "0")}:00
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === "minute" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <button type="button" className={`${NUM_BTN} ${NUM_NORMAL}`} onClick={() => setPhase("hour")}>
              ← Giờ
            </button>
            <div className="text-xs text-gray-600">
              {draftDate} • {String(draftHour ?? 0).padStart(2, "0")}:__
            </div>
          </div>
          <div className="grid grid-cols-4 gap-0.5">
            {MINUTES.map((m) => {
              const active = m === draftMinute;
              const disabled = minuteDisabled(draftHour, m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onPickMinute(m)}
                  disabled={disabled}
                  className={["text-center relative rounded", NUM_BTN, disabled ? NUM_DISABLED : active ? NUM_ACTIVE : NUM_NORMAL].join(" ")}
                  aria-label={`Chọn phút ${String(m).padStart(2, "0")}`}
                >
                  {String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 text-right">Chọn phút là lưu & đóng ngay.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-w-0 isolate">
      <label className="text-sm text-gray-700">{label}</label>
      <button
        ref={(node) => {
          btnRef.current = node;
          setExternalRef(triggerRef, node);
        }}
        type="button"
        onClick={openPicker}
        className={`${CARD_BTN} ${CARD_MINH}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarClock className="h-5 w-5 text-brand shrink-0" aria-hidden />
          <div className="font-medium truncate text-gray-900 min-w-0 text-[15px]">{pretty()}</div>
          <span className="ml-auto text-gray-500 shrink-0" aria-hidden>
            ▾
          </span>
        </div>
      </button>

      {showError && !value && <p className="text-[12px] text-rose-600 mt-1" role="alert" aria-live="polite">Xin vui lòng chọn Thời gian đi.</p>}

      {open &&
        (isMobile ? (
          <Portal>
            <div
              className="fixed z-[9999]"
              style={{
                left: panelPos.left,
                top: panelPos.top,
                width: panelPos.width,
                maxWidth: "calc(100vw - 16px)",
              }}
            >
              {PanelUI}
            </div>
          </Portal>
        ) : (
          <div
            ref={popRef}
            className="absolute z-[60] mt-1"
            style={{ width: `${triggerW}px`, maxWidth: "calc(100vw - 16px)" }}
          >
            {PanelUI}
          </div>
        ))}
    </div>
  );
}

/* ================= ConfirmPriceModal (Backdrop/X/Esc CLOSE ngay + Focus Trap) ================= */
function ConfirmPriceModal({
  open,
  onClose,
  onConfirm,
  price,
  route,
  timeLabel,
  defaultPhone = "",
  defaultName = "",
  submitting = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: { phone: string; name: string }) => void;
  price: number;
  route: string;
  timeLabel: string;
  defaultPhone?: string;
  defaultName?: string;
  submitting?: boolean;
}) {
  const phoneRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const focusablesRef = useRef<HTMLElement[]>([]);

  // KHÔNG reset state khi đóng để giữ dữ liệu đã gõ
  const [phone, setPhone] = useState(defaultPhone);
  const [name, setName] = useState(defaultName);
  const [touched, setTouched] = useState(false);

  // cờ đang đóng modal để chặn onBlur bật touched
  const closingRef = useRef(false);

  const attemptClose = useCallback(() => {
    closingRef.current = true;
    onClose();
    setTimeout(() => {
      closingRef.current = false;
    }, 0);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Lấy focusable elements cho trap
    focusablesRef.current = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      ) ?? []
    );

    // Keydown handler: Esc để đóng, Tab để trap
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        attemptClose();
        return;
      }
      if (e.key !== "Tab" || focusablesRef.current.length === 0) return;
      const items = focusablesRef.current;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (i <= 0) {
          items[items.length - 1].focus();
          e.preventDefault();
        }
      } else {
        if (i === items.length - 1) {
          items[0].focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Focus SĐT khi mở
    const t = setTimeout(() => phoneRef.current?.focus({ preventScroll: true }), 50);

    // Outside click (capture)
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (modalRef.current && !modalRef.current.contains(t)) {
        attemptClose();
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);

    // Khóa scroll nền
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, attemptClose]);

  if (!open) return null;

  const p = normalizePhone(phone || "");
  const phoneValid = /^0\d{9,10}$/.test(p);
  const nameValid = (name || "").trim().length > 1;
  const canSubmit = phoneValid && nameValid && !submitting;

  return (
    <Portal>
      {/* overlay: click là đóng ngay */}
      <div className="fixed inset-0 z-[10000] bg-black/40" onMouseDown={attemptClose} aria-hidden />

      {/* modal layer */}
      <div role="dialog" aria-modal="true" aria-labelledby="modalTitle" className="fixed inset-0 z-[10001] grid place-items-center p-4">
        {/* container modal */}
        <div
          ref={modalRef}
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="bg-brand text-white px-4 py-3 flex items-center gap-2 relative">
            <Info className="h-5 w-5 shrink-0" aria-hidden />
            <h3 id="modalTitle" className="font-semibold tracking-wide">XÁC NHẬN THÔNG TIN</h3>

            {/* nút X đóng ngay bằng onMouseDown (tránh blur) */}
            <button
              type="button"
              aria-label="Đóng"
              onMouseDown={attemptClose}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
              title="Đóng"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* body */}
          <div className="p-4 space-y-3">
            <p className="text-center text-[15px] text-gray-700">
              Giá cước tạm tính, chưa bao gồm phí cầu đường phát sinh.
            </p>

            <div className="text-center">
              <div className="text-4xl font-extrabold text-orange-500 leading-tight">
                {fmtMoney(price)}
              </div>
            </div>

            <div className="text-sm text-gray-600 border-t pt-3">
              <div><b>Tuyến:</b> {route}</div>
              <div><b>Thời gian:</b> {timeLabel}</div>
              <div className="mt-1">Vui lòng đặt xe sớm để đảm bảo giá này.</div>
            </div>

            {/* form */}
            <div className="space-y-2 pt-1">
              <label className="block">
                <span className="text-sm text-gray-700">Điện thoại</span>
                <input
                  ref={phoneRef}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => { if (!closingRef.current) setTouched(true); }}
                  inputMode="tel"
                  placeholder="Ví dụ: 09xxxxxxxx"
                  className={`mt-1 w-full ${RADIUS} border bg-white shadow-sm px-3 py-2 ${RING} ${
                    touched && !phoneValid ? "border-rose-400" : "border-gray-300"
                  }`}
                  aria-invalid={touched && !phoneValid}
                />
                {touched && !phoneValid && (
                  <span className="text-[12px] text-rose-600" role="alert" aria-live="polite">SĐT không hợp lệ.</span>
                )}
              </label>

              <label className="block">
                <span className="text-sm text-gray-700">Họ và tên</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => { if (!closingRef.current) setTouched(true); }}
                  placeholder="Nhập họ tên"
                  className={`mt-1 w-full ${RADIUS} border bg-white shadow-sm px-3 py-2 ${RING} ${
                    touched && !nameValid ? "border-rose-400" : "border-gray-300"
                  }`}
                  aria-invalid={touched && !nameValid}
                />
                {touched && !nameValid && (
                  <span className="text-[12px] text-rose-600" role="alert" aria-live="polite">Vui lòng nhập họ tên.</span>
                )}
              </label>
            </div>
          </div>

          {/* footer */}
          <div className="px-4 pb-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onMouseDown={attemptClose}
              className={`px-4 py-2 ${RADIUS} border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-800`}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ phone, name })}
              disabled={!canSubmit}
              className={`px-4 py-2 ${RADIUS} text-white font-semibold shadow-sm ${
                canSubmit ? "bg-brand hover:bg-brand-dark" : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {submitting ? "Đang gửi..." : "XÁC NHẬN ĐẶT CHUYẾN"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ================= Main Form ================= */
export default function BookingForm() {
  const [tripType, setTripType] = useState<TripType>("airport");

  // From/to text + coords (AddressInput)
  const [from, setFrom] = useState("");
  const [fromLat, setFromLat] = useState<number | undefined>(undefined);
  const [fromLng, setFromLng] = useState<number | undefined>(undefined);

  const [to, setTo] = useState(NOIBAI);
  const [toLat, setToLat] = useState<number | undefined>(AIRPORTS.HAN.lat);
  const [toLng, setToLng] = useState<number | undefined>(AIRPORTS.HAN.lng);

  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicleTypeId, setVehicleTypeId] = useState<number>(2);
  const [startAt, setStartAt] = useState<string>(""); // yyyy-mm-ddTHH:MM
  const [roundTrip, setRoundTrip] = useState(false);
  const [vat, setVat] = useState(false);
  const [promo, setPromo] = useState<string>("");

  // Airport constraint: ô bị khóa = Nội Bài
  const [airportSide, setAirportSide] = useState<"from" | "to">("to");

  // Wait hours (chỉ khi 2 chiều)
  const [waitHours, setWaitHours] = useState<string>("");

  // UX flags
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitBooking, setSubmitBooking] = useState(false);
  const [quoting, setQuoting] = useState(false);

  // Quote snapshot (ưu tiên giá từ server)
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [lastDtoUsedForQuote, setLastDtoUsedForQuote] = useState<QuoteRequestDto | null>(null);

  const fromErrorMessageId = useId();
  const toErrorMessageId = useId();
  const sameRouteMessageId = useId();
  const routeStatusMessageId = useId();

  // Refs
  const stopRefs = useRef<(HTMLInputElement | null)[]>([]);
  const setStopRef = (i: number): React.RefCallback<HTMLInputElement> => (el) => {
    stopRefs.current[i] = el;
  };

  // Box refs (để scroll) + Input refs (để focus đúng ô)
  const fromBoxRef = useRef<HTMLDivElement>(null);
  const toBoxRef = useRef<HTMLDivElement>(null);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  const waitRef = useRef<HTMLInputElement>(null);
  const dtBtnRef = useRef<HTMLButtonElement | null>(null);

  // Cuộn vào giữa màn hình rồi focus input thật (fallback: querySelector)
  const scrollAndFocus = (boxEl: HTMLElement | null, focusEl: HTMLElement | null) => {
    if (!boxEl && !focusEl) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    boxEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = focusEl || (boxEl?.querySelector("input") as HTMLElement | null);
    setTimeout(() => target?.focus?.({ preventScroll: true }), 200);
  };

  // Lỗi inline
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  const sameRoute = trimmedFrom && trimmedTo ? addressesMatch(trimmedFrom, trimmedTo) : false;
  const fromErr = submitted && !from.trim() ? "Xin vui lòng nhập Điểm đi." : "";
  const toErr = submitted && !to.trim() ? "Xin vui lòng nhập Điểm đến." : "";
  const sameRouteWarning = sameRoute
    ? "Quý khách đang để điểm đi và điểm đến trùng nhau."
    : "";
  const startAtErr = submitted && !startAt ? "Xin vui lòng chọn Thời gian đi." : "";
  const waitErr = useMemo(() => {
    if (!submitted || !roundTrip) return "";
    const n = parseHoursLoose(waitHours ?? "");
    return n === null ? WAIT_ERR_MSG : "";
  }, [submitted, roundTrip, waitHours]);

  const addStop = () =>
    setStops((arr) => [...arr, { id: genId(), text: "", lat: undefined, lng: undefined }]);
  const updateStop = (i: number, v: AddressValue) =>
    setStops((arr) =>
      arr.map((s, idx) => (idx === i ? { ...s, text: v.text, lat: v.lat, lng: v.lng } : s)),
    );
  const removeStop = (i: number) => setStops((arr) => arr.filter((_, idx) => idx !== i));

  const swap = () => {
    const newFrom = to;
    const newFromLat = toLat;
    const newFromLng = toLng;
    const newTo = from;
    const newToLat = fromLat;
    const newToLng = fromLng;
    setFrom(newFrom); setFromLat(newFromLat); setFromLng(newFromLng);
    setTo(newTo);     setToLat(newToLat);     setToLng(newToLng);
    if (tripType === "airport") {
      setAirportSide((s) => (s === "to" ? "from" : "to"));
    }
  };

  // Phí chờ (FE fallback)
  const waitFee = useMemo(() => {
    if (!roundTrip) return 0;
    const n = parseHoursLoose(waitHours ?? "");
    if (n === null) return 0;
    return calcWaitFee(n);
  }, [roundTrip, waitHours]);

  const hasFromCoordinates =
    typeof fromLat === "number" && Number.isFinite(fromLat) &&
    typeof fromLng === "number" && Number.isFinite(fromLng);
  const hasToCoordinates =
    typeof toLat === "number" && Number.isFinite(toLat) &&
    typeof toLng === "number" && Number.isFinite(toLng);
  const routeReady = hasFromCoordinates && hasToCoordinates;

  const routeStatus = useMemo(() => {
    if (routeReady) {
      return {
        tone: "success" as const,
        title: "Sẵn sàng tính quãng đường",
        body:
          "Đã xác thực tọa độ cho cả điểm đi và điểm đến. Nhấn \"Kiểm Tra Giá\" để xem khoảng cách và chi phí chính xác.",
      };
    }

    if (!trimmedFrom && !trimmedTo) {
      return {
        tone: "neutral" as const,
        title: "Nhập địa chỉ để hệ thống tính km",
        body:
          "Vui lòng nhập điểm đi và điểm đến, sau đó chọn gợi ý có biểu tượng ghim để hệ thống tự động định vị.",
      };
    }

    const missingLabels: string[] = [];
    if (!hasFromCoordinates && trimmedFrom) missingLabels.push("điểm đi");
    if (!hasToCoordinates && trimmedTo) missingLabels.push("điểm đến");

    const body = missingLabels.length
      ? `Chưa xác định được tọa độ cho ${missingLabels.join(" và ")}. Hãy chọn địa chỉ từ gợi ý để hệ thống tính km.`
      : "Chọn địa chỉ từ gợi ý để hệ thống định vị và tính quãng đường chính xác.";

    return {
      tone: "warning" as const,
      title: "Chưa sẵn sàng tính quãng đường",
      body,
    };
  }, [routeReady, trimmedFrom, trimmedTo, hasFromCoordinates, hasToCoordinates]);

  const fromDescribedBy = [
    fromErr ? fromErrorMessageId : null,
    sameRoute ? sameRouteMessageId : null,
    routeStatusMessageId,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const toDescribedBy = [
    toErr ? toErrorMessageId : null,
    sameRoute ? sameRouteMessageId : null,
    routeStatusMessageId,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const routeStatusVisual = (() => {
    switch (routeStatus.tone) {
      case "success":
        return {
          container: "border-emerald-200 bg-emerald-50 text-emerald-700",
          icon: <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />,
        } as const;
      case "warning":
        return {
          container: "border-amber-200 bg-amber-50 text-amber-700",
          icon: <AlertTriangle aria-hidden className="h-4 w-4 text-amber-500" />,
        } as const;
      default:
        return {
          container: "border-slate-200 bg-slate-50 text-slate-600",
          icon: <Info aria-hidden className="h-4 w-4 text-slate-500" />,
        } as const;
    }
  })();

  // Đổi loại chuyến → ràng buộc
  const onChangeTripType = (t: TripType) => {
    if (t === tripType) return;
    setTripType(t);

    if (t === "airport") {
      setAirportSide("to");
      setTo(NOIBAI);
      setToLat(AIRPORTS.HAN.lat);
      setToLng(AIRPORTS.HAN.lng);
      if (from === NOIBAI) {
        setFrom("");
        setFromLat(undefined);
        setFromLng(undefined);
      }
      return;
    }

    // road: mở tự do, clear mọi giá trị "Nội Bài" fix cứng trước đó
    if (from === NOIBAI) {
      setFrom("");
      setFromLat(undefined);
      setFromLng(undefined);
    }
    if (to === NOIBAI) {
      setTo("");
      setToLat(undefined);
      setToLng(undefined);
    }
  };

  // Ép ràng buộc Nội Bài khi tab Sân bay
  useEffect(() => {
    if (tripType !== "airport") return;
    if (airportSide === "to") {
      if (to !== NOIBAI) setTo(NOIBAI);
      setToLat(AIRPORTS.HAN.lat);
      setToLng(AIRPORTS.HAN.lng);
      if (from === NOIBAI) {
        setFrom("");
        setFromLat(undefined);
        setFromLng(undefined);
      }
    } else {
      if (from !== NOIBAI) setFrom(NOIBAI);
      setFromLat(AIRPORTS.HAN.lat);
      setFromLng(AIRPORTS.HAN.lng);
      if (to === NOIBAI) {
        setTo("");
        setToLat(undefined);
        setToLng(undefined);
      }
    }
  }, [tripType, airportSide, from, to]);

  // Validate tổng
  const validate = () => {
    const errs: string[] = [];
    if (!from.trim()) errs.push("from");
    if (!to.trim()) errs.push("to");
    if (sameRoute) errs.push("sameRoute");
    if (!startAt) errs.push("startAt");
    if (stops.some((s) => !s.text.trim())) errs.push("stops");
    if (tripType === "airport") {
      const nbCount = [from, to].filter((x) => x === NOIBAI).length;
      if (nbCount !== 1) errs.push("nbRule");
    }
    if (roundTrip) {
      const n = parseHoursLoose(waitHours ?? "");
      if (n === null) errs.push("waitHours");
    }
    return errs;
  };

  const prettyTime = (iso: string) => {
    if (!iso) return "";
    const [d, t] = iso.split("T");
    const [, m, dd] = d.split("-");
    const hhmm = (t || "").slice(0, 5);
    return `${dd}/${m} ${hhmm}`;
  };

  const routeStr = `${from}${stops.length ? ` → ${stops.map((s) => s.text).join(" → ")}` : ""} → ${to}`;
  const priceTotalFallback = calcQuoteTotal({
    vehicleTypeId,
    roundTrip,
    waitFee,
    vat,
  });

  /* ====== ACTION: CHECK PRICE (QUOTE) ====== */
  const onCheckPrice = async () => {
    setSubmitted(true);
    const errs = validate();

    if (errs.length) {
      if (errs.includes("from")) return scrollAndFocus(fromBoxRef.current, fromInputRef.current);
      if (errs.includes("to")) return scrollAndFocus(toBoxRef.current, toInputRef.current);
      if (errs.includes("sameRoute")) return scrollAndFocus(toBoxRef.current, toInputRef.current);
      if (errs.includes("startAt")) return scrollAndFocus(dtBtnRef.current, dtBtnRef.current);
      if (errs.includes("waitHours")) return scrollAndFocus(waitRef.current, waitRef.current);
      if (errs.includes("nbRule")) return scrollAndFocus(fromBoxRef.current, fromInputRef.current);
      if (errs.includes("stops")) {
        const idx = stops.findIndex((s) => !s.text.trim());
        const el = stopRefs.current[idx];
        if (el) {
          (document.activeElement as HTMLElement | null)?.blur?.();
          requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => el.focus({ preventScroll: true }), 220);
          });
        }
      }
      return;
    }

    // Map UI -> DTO (một biến dto duy nhất)
    const dto: QuoteRequestDto = {
      tripType: tripType === "airport" ? "AIRPORT" : "ROAD",
      vehicleTypeId,
      startAt,
      roundTrip,
      withVat: vat,
      fromText: from,
      toText: to,
      fromLat,
      fromLng,
      toLat,
      toLng,
      couponCode: promo?.trim() || undefined,
    };
    if (tripType === "airport") {
      dto.airportCode = "HAN";
      dto.direction = (airportSide === "to" ? "to_airport" : "from_airport") as DirectionDto;
    }
    if (roundTrip) dto.waitHours = parseHoursLoose(waitHours || "0") ?? 0;

    try {
      setQuoting(true);
      const q = await fetchQuote(dto, { timeoutMs: 10_000 });
      setQuote(q);
      setLastDtoUsedForQuote(dto);
      setShowConfirm(true);
    } catch (e: any) {
      // Fallback: vẫn mở modal với giá FE để không chặn đặt xe
      setQuote(null);
      setLastDtoUsedForQuote(dto);
      setShowConfirm(true);
      alert(`Không tính được giá từ server, dùng giá tạm: ${e?.message || e}`);
    } finally {
      setQuoting(false);
    }
  };

  /* ====== ACTION: CONFIRM BOOKING ====== */
  const handleConfirm = async (payload: { phone: string; name: string }) => {
    if (!lastDtoUsedForQuote) return;
    try {
      setSubmitBooking(true);

      const body: CreateBookingRequestDto = {
        ...lastDtoUsedForQuote,
        stops: stops.map((s) => s.text).filter(Boolean),
        customerName: payload.name.trim(),
        phone: normalizePhone(payload.phone),
        // quoteId: quote?.id, // nếu BE trả về id; nếu chưa có thì bỏ
      };

      const idemKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      await createBooking(body, {
        headers: { "Idempotency-Key": idemKey },
        timeoutMs: 12_000,
      });

      setShowConfirm(false);
      alert("Đặt chuyến thành công! Cảm ơn bạn.");
    } catch (e: any) {
      alert(`Đặt chuyến thất bại: ${e?.message || e}`);
    } finally {
      setSubmitBooking(false);
    }
  };

  return (
    <div className="space-y-4 isolate">
      {/* Header */}
      <div className="w-full flex items-center min-w-0">
        <h2 className="hidden sm:block text-2xl font-extrabold tracking-wide text-gray-900 mr-auto">
          ĐẶT XE
        </h2>
        <div role="tablist" aria-label="Loại chuyến" className="flex items-center gap-6 mx-auto sm:mx-0 sm:ml-auto">
          <button
            type="button"
            role="tab"
            aria-selected={tripType === "airport"}
            onClick={() => onChangeTripType("airport")}
            className={[
              "inline-flex items-center gap-2 px-2 py-1 text-base transition min-w-0",
              "focus:outline-none focus-visible:underline",
              tripType === "airport" ? "text-brand font-semibold" : "text-gray-600 hover:text-brand",
            ].join(" ")}
            title="Sân bay"
          >
            <Plane className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">Sân bay</span>
          </button>
          <span aria-hidden className="h-6 w-px bg-gray-300" />
          <button
            type="button"
            role="tab"
            aria-selected={tripType === "road"}
            onClick={() => onChangeTripType("road")}
            className={[
              "inline-flex items-center gap-2 px-2 py-1 text-base transition min-w-0",
              "focus:outline-none focus-visible:underline",
              tripType === "road" ? "text-brand font-semibold" : "text-gray-600 hover:text-brand",
            ].join(" ")}
            title="Đường dài"
          >
            <Route className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">Đường dài</span>
          </button>
        </div>
      </div>

      {/* From */}
      <div>
        <label className="text-sm text-gray-700">Bạn đi từ:</label>
        <div className="mt-1 w-full">
          <div
            ref={fromBoxRef}
            tabIndex={-1}
            className={`${INPUT_GROUP} relative overflow-visible`}
            data-address-dropdown-parent
          >
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-brand">
              <CircleDot aria-hidden className="h-5 w-5" />
            </span>
            <div className="relative flex-1 min-w-0">
              <AddressInput
                value={from}
                placeholder="Điểm đi"
                disabled={tripType === "airport" && airportSide === "from"}
                inputClassName={INPUT_FIELD}
                inputRef={fromInputRef}
                inputProps={{
                  "aria-invalid": fromErr || sameRoute ? true : undefined,
                  "aria-describedby": fromDescribedBy,
                }}
                onChange={(v: { text: string; lat?: number; lng?: number }) => {
                  setFrom(v.text);
                  setFromLat(v.lat);
                  setFromLng(v.lng);
                }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                (e.currentTarget as HTMLButtonElement).blur();
                addStop();
              }}
              className={
                INPUT_RIGHT +
                " hover:bg-gray-50 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-brand/40"
              }
              aria-label="Thêm điểm dừng"
              title="Thêm điểm dừng"
            >
              <Plus className="h-5 w-5 text-rose-500" aria-hidden />
            </button>
          </div>
          {fromErr && (
            <p
              id={fromErrorMessageId}
              className="text-[12px] text-rose-600 mt-1"
              role="alert"
              aria-live="polite"
            >
              {fromErr}
            </p>
          )}
        </div>
      </div>

      {/* Stops */}
      {stops.length > 0 && (
        <div className="space-y-2">
          {stops.map((s, i) => {
            const showErr = submitted && !s.text.trim();
            const errId = `stopErr-${s.id}`;
            return (
              <div key={s.id} className="relative w-full">
                <div
                  className={`${INPUT_GROUP} relative overflow-visible`}
                  data-address-dropdown-parent
                >
                  <div className="relative flex-1 min-w-0">
                    <AddressInput
                      value={s.text}
                      placeholder={`Điểm dừng #${i + 1}`}
                      inputClassName={INPUT_FIELD_COMPACT}
                      inputRef={setStopRef(i)}
                      onChange={(v) => updateStop(i, v)}
                      inputProps={{
                        "aria-label": `Điểm dừng ${i + 1}`,
                        "aria-invalid": showErr || undefined,
                        "aria-describedby": showErr ? errId : undefined,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      (e.currentTarget as HTMLButtonElement).blur();
                      removeStop(i);
                    }}
                    className={
                      INPUT_RIGHT +
                      " hover:bg-gray-50 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-brand/40"
                    }
                    aria-label={`Xoá điểm dừng ${i + 1}`}
                    title="Xoá điểm dừng"
                  >
                    <Minus className="h-5 w-5 text-rose-500" aria-hidden />
                  </button>
                </div>
                {showErr && (
                  <p id={errId} className="text-[12px] text-rose-600 mt-1" role="alert" aria-live="polite">
                    Xin vui lòng nhập Điểm dừng #{i + 1}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* To + swap */}
      <div>
        <label className="text-sm text-gray-700">Bạn muốn đến:</label>
        <div className="mt-1 w-full">
          <div
            ref={toBoxRef}
            tabIndex={-1}
            className={`${INPUT_GROUP} relative overflow-visible`}
            data-address-dropdown-parent
          >
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
              <MapPin aria-hidden className="h-5 w-5 text-red-600" />
            </span>
            <div className="relative flex-1 min-w-0">
              <AddressInput
                value={to}
                placeholder="Điểm đến"
                disabled={tripType === "airport" && airportSide === "to"}
                inputClassName={INPUT_FIELD}
                inputRef={toInputRef}
                inputProps={{
                  "aria-invalid": toErr || sameRoute ? true : undefined,
                  "aria-describedby": toDescribedBy,
                }}
                onChange={(v: { text: string; lat?: number; lng?: number }) => {
                  setTo(v.text);
                  setToLat(v.lat);
                  setToLng(v.lng);
                }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                (e.currentTarget as HTMLButtonElement).blur();
                swap();
              }}
              className={
                INPUT_RIGHT +
                " hover:bg-gray-50 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-brand/40"
              }
              aria-label="Đảo chiều điểm đi/đến"
              title="Đảo chiều điểm đi/đến"
            >
              <Repeat2 className="h-5 w-5 text-brand" aria-hidden />
            </button>
          </div>
          {toErr && (
            <p
              id={toErrorMessageId}
              className="text-[12px] text-rose-600 mt-1"
              role="alert"
              aria-live="polite"
            >
              {toErr}
            </p>
          )}
          {sameRouteWarning && (
            <p
              id={sameRouteMessageId}
              className="mt-1 flex items-start gap-2 text-[12px] text-amber-700"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 text-amber-500" />
              <span>{sameRouteWarning}</span>
            </p>
          )}
        </div>
      </div>

      <div
        id={routeStatusMessageId}
        className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-3 text-[13px] leading-5 ${routeStatusVisual.container}`}
        role="status"
        aria-live="polite"
      >
        <span className="mt-0.5">{routeStatusVisual.icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[13px] leading-5">{routeStatus.title}</span>
          <span className="block text-[12px] leading-5 text-current">{routeStatus.body}</span>
        </span>
      </div>

      {/* Switches row */}
      <div className="flex items-center gap-2 flex-nowrap overflow-hidden">
        {/* 2 chiều */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none shrink-0 whitespace-nowrap">
          <span className="relative inline-flex h-6 w-10 items-center">
            <input
              type="checkbox"
              checked={roundTrip}
              onChange={(e) => setRoundTrip(e.target.checked)}
              className="peer sr-only"
              role="switch"
              aria-checked={roundTrip}
            />
            <span aria-hidden className="absolute inset-0 rounded-full transition bg-gray-300 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-checked:bg-brand" />
            <span aria-hidden className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
          </span>
          <span className={roundTrip ? "text-brand font-semibold" : "text-gray-700"}>2 chiều</span>
        </label>

        {/* VAT */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none shrink-0 whitespace-nowrap">
          <span className="relative inline-flex h-6 w-10 items-center">
            <input
              type="checkbox"
              checked={vat}
              onChange={(e) => setVat(e.target.checked)}
              className="peer sr-only"
              role="switch"
              aria-checked={vat}
              title="Hóa đơn VAT chỉ xuất trong ngày"
            />
            <span aria-hidden className="absolute inset-0 rounded-full transition bg-gray-300 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-checked:bg-brand" />
            <span aria-hidden className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
          </span>
          <span className={vat ? "text-brand font-semibold" : "text-gray-700"}>VAT</span>
        </label>

        {/* Promo */}
        <div className="flex-1 min-w-0">
          <label className="sr-only" htmlFor="promo">Mã giảm giá</label>
          <input
            id="promo"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Mã giảm giá"
            className={`w-full ${RADIUS} border border-gray-300 bg-white shadow-sm px-3 py-2 ${RING}`}
            inputMode="text"
            autoCapitalize="characters"
            aria-label="Mã giảm giá"
          />
        </div>
      </div>

      {/* Wait hours (only when roundTrip) */}
      {roundTrip && (
        <div className="grid grid-cols-1 gap-2">
          <div className="min-w-0">
            <label htmlFor="waitHours" className="text-sm text-gray-700">Thời gian chờ</label>
            <input
              ref={waitRef}
              id="waitHours"
              value={waitHours}
              onChange={(e) => setWaitHours(e.target.value)}
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              className={`w-full ${RADIUS} border border-gray-300 bg-white shadow-sm px-3 py-2 ${RING}`}
              aria-invalid={!!waitErr}
              aria-describedby="waitHoursHelp"
            />
            {submitted && waitErr ? (
              <p className="text-[12px] text-rose-600 mt-1" role="alert" aria-live="polite">{waitErr}</p>
            ) : (
              <p id="waitHoursHelp" className="text-[12px] text-gray-600 mt-1">
                Phí chờ: <b>{fmtMoney(waitFee)}</b>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loại xe + Thời gian đi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <VehicleDropdown value={vehicleTypeId} onChange={setVehicleTypeId} />
        <OneFieldDateTime
          value={startAt}
          onChange={(v) => setStartAt(v)}
          showError={!!startAtErr}
          triggerRef={dtBtnRef}
        />
      </div>

      {/* CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCheckPrice}
          disabled={quoting}
          className={`w-full ${quoting ? "bg-gray-400" : "bg-brand hover:bg-brand-dark"} text-white font-semibold text-lg py-3 ${RADIUS} shadow-sm`}
        >
          {quoting ? "Đang tính giá..." : "Kiểm Tra Giá →"}
        </button>
      </div>

      {/* Modal xác nhận giá */}
      <ConfirmPriceModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        submitting={submitBooking || quoting}
        price={quote?.totalVnd ?? priceTotalFallback}
        route={routeStr}
        timeLabel={prettyTime(startAt)}
      />
    </div>
  );
}
