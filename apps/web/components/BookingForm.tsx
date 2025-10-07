"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDot, MapPin, Plus, Repeat2 } from "lucide-react";

/** ================= Types ================= */
type TripType = "airport" | "road";
type Vehicle = { id: number; name: string; img: string; alt: string };

/** ================= UI tokens ================= */
// Đổi ring/border về brand (xanh)
const RING = "focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand-dark";
const CARD = "w-full rounded-2xl border border-gray-300 bg-white shadow-sm " + RING;
const CARD_BTN = CARD + " px-3 py-2.5 text-left";
const ICON_SHELL = "absolute right-2 top-1/2 -translate-y-1/2";
const INPUT_GROUP = CARD + " p-0 overflow-hidden flex items-stretch"; // khung chung
const INPUT_FIELD = "w-full bg-transparent border-0 outline-none focus:ring-0 px-10 py-3"; // input trần
const INPUT_RIGHT = "shrink-0 grid place-items-center w-14 border-l border-gray-300"; // ô con bên phải
const CARD_MINH = "min-h-[60px]";
const ICON_BTN = `
  inline-flex items-center justify-center
  h-9 w-9 rounded-full
  bg-white border border-gray-300 text-gray-600
  hover:bg-gray-50 hover:text-brand
  focus:outline-none focus:ring-2 focus:ring-brand/40
`;

/** ================= Data ================== */
const VEHICLES: Vehicle[] = [
  { id: 2, name: "4 chỗ cốp rộng", img: "/vehicles/5seats.png",  alt: "Xe 4 chỗ cốp rộng" },
  { id: 3, name: "7 chỗ",          img: "/vehicles/7seats.png",  alt: "Xe 7 chỗ" },
  { id: 1, name: "4 chỗ cốp nhỏ",  img: "/vehicles/4seats.png",  alt: "Xe 4 chỗ cốp nhỏ" },
  { id: 4, name: "16 chỗ",         img: "/vehicles/16seats.png", alt: "Xe 16 chỗ" },
  { id: 6, name: "29 chỗ",         img: "/vehicles/29seats.png", alt: "Xe 29 chỗ" },
  { id: 7, name: "45 chỗ",         img: "/vehicles/45seats.png", alt: "Xe 45 chỗ" },
];

/** ============ Dropdown Loại xe (fix scroll + ARIA) ============ */
function VehicleDropdown({
  value,
  onChange,
  label = "Loại xe",
}: {
  value: number;
  onChange: (id: number) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number>(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Mảng ref item
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const setItemRef = (i: number) => (el: HTMLButtonElement | null) => { itemRefs.current[i] = el; };

  const selected = useMemo(() => VEHICLES.find((v) => v.id === value), [value]);

  // ✅ Đo chiều rộng nút để set chiều rộng menu >= 360px
  const [menuW, setMenuW] = useState<number>(360);
  useEffect(() => {
    const measure = () => setMenuW(Math.max(360, Math.round(btnRef.current?.getBoundingClientRect().width ?? 360)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = VEHICLES.findIndex((v) => v.id === value);
    const safe = idx < 0 ? 0 : idx;
    setFocusIdx(safe);
    setTimeout(() => itemRefs.current[safe]?.focus(), 0);
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
      const next = (focusIdx + 1) % VEHICLES.length;
      setFocusIdx(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (focusIdx - 1 + VEHICLES.length) % VEHICLES.length;
      setFocusIdx(prev);
      itemRefs.current[prev]?.focus();
    }
  };

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="relative">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative w-12 h-8 shrink-0">
              <Image
                src={selected?.img ?? "/vehicles/4seats.png"}
                alt={selected?.alt ?? "Loại xe"}
                fill
                sizes="48px"
                className="object-contain"
                priority
              />
            </span>
            {/* ✅ Không rơi chữ: một hàng + cắt bớt nếu dài */}
            <span className="font-medium text-gray-900 leading-tight whitespace-nowrap truncate">
              {selected?.name ?? "Chọn loại xe"}
            </span>
          </div>
          <span aria-hidden className="text-gray-500 ml-2">▾</span>
        </div>
      </button>

      {open && (
  <ul
    ref={listRef}
    role="listbox"
    tabIndex={-1}
    onKeyDown={onKeyDownList}
    // ⬇️ Hiển thị toàn bộ, không cuộn
     className="absolute z-50 mt-1 rounded-2xl border border-gray-300 bg-white shadow-xl overflow-hidden" 
    style={{ width: `${menuW}px`, maxHeight: "none" }}
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
            className={[
              "w-full px-4 py-3 flex items-center gap-4 text-left",
              "hover:bg-brand/10 focus:bg-brand/10 focus:outline-none",
              active ? "bg-brand/10" : "",
            ].join(" ")}
          >
            <span className="relative w-14 h-9 shrink-0">
              <Image src={v.img} alt={v.alt} fill sizes="56px" className="object-contain" />
            </span>
            <span className="flex-1 leading-tight whitespace-nowrap truncate pr-6">
              {v.name}
            </span>
            {active && <span className="text-brand font-semibold">✓</span>}
          </button>
        </li>
      );
    })}
  </ul>
)}

    </div>
  );
}

/** ===== OneFieldDateTime — numbers-only, selected-day boxed, reset on close ===== */
function OneFieldDateTime({
  value, onChange,
  label = "Thời gian đi",
  minuteStep = 5,
  minDate, maxDate,
  minOffsetMinutes = 30,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  minuteStep?: 1 | 5 | 10 | 15;
  minDate?: string;
  maxDate?: string;
  minOffsetMinutes?: number;
}) {
  type Phase = "date" | "hour" | "minute";

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("date");

  // committed
  const [committedDate, setCommittedDate] = useState<string>("");
  const [committedHour, setCommittedHour] = useState<number | null>(null);
  const [committedMinute, setCommittedMinute] = useState<number | null>(null);

  // draft
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [draftHour, setDraftHour] = useState<number | null>(null);
  const [draftMinute, setDraftMinute] = useState<number | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [triggerW, setTriggerW] = useState(320);

  const z2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toYMD = (d: Date) => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
  const parseYMD = (s?: string | null) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    if (![y, m, d].every(Number.isFinite)) return null;
    return new Date(y, m - 1, d);
  };
  const resetDraft = () => { setDraftDate(null); setDraftHour(null); setDraftMinute(null); setPhase("date"); };

  useEffect(() => {
    const measure = () => setTriggerW(Math.max(280, Math.round(btnRef.current?.getBoundingClientRect().width ?? 320)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!value) { setCommittedDate(""); setCommittedHour(null); setCommittedMinute(null); return; }
    const [d, t] = value.split("T");
    setCommittedDate(d || "");
    if (t) {
      const [hh, mm] = t.slice(0, 5).split(":").map((x) => parseInt(x, 10));
      setCommittedHour(Number.isFinite(hh) ? hh : null);
      setCommittedMinute(Number.isFinite(mm) ? mm : null);
    } else { setCommittedHour(null); setCommittedMinute(null); }
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) { setOpen(false); resetDraft(); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); resetDraft(); btnRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // calendar
  const now = new Date();
  const minDT = new Date(now.getTime() + Math.max(0, minOffsetMinutes) * 60 * 1000);
  const minDProp = parseYMD(minDate) ?? new Date(minDT.getFullYear(), minDT.getMonth(), minDT.getDate());
  const maxDProp = parseYMD(maxDate) ?? null;

  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [viewYM, setViewYM] = useState<{ y: number; m: number }>({ y: today.y, m: today.m });

  const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" })
    .format(new Date(viewYM.y, viewYM.m, 1));

  const monthMatrix = useMemo(() => {
    const first = new Date(viewYM.y, viewYM.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
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
    const arr: number[] = []; for (let m = 0; m < 60; m += s) arr.push(m); return arr;
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
    if (!sameDate(dd, minDT)) return null;
    return minDT.getHours() * 60 + minDT.getMinutes();
  }, [draftDate]);

  const hourDisabled = (h: number) => !!(minMinuteOfDay && h * 60 + 59 < minMinuteOfDay);
  const minuteDisabled = (h: number | null, m: number) => !!(minMinuteOfDay && h !== null && h * 60 + m < minMinuteOfDay);

  const pretty = () => {
    if (!committedDate || committedHour === null || committedMinute === null) return "Thời gian đi";
    const [y, m, d] = committedDate.split("-");
    return `${d}/${m} ${z2(committedHour)}:${z2(committedMinute)}`;
  };

  const openPicker = () => { setOpen((s) => !s); setPhase("date"); resetDraft(); setViewYM({ y: today.y, m: today.m }); };

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
    const iso = `${draftDate}T${z2(draftHour ?? 0)}:${z2(m)}`;
    onChange(iso);
    setOpen(false);
    setCommittedDate(draftDate || "");
    setCommittedHour(draftHour);
    setCommittedMinute(m);
    resetDraft();
    btnRef.current?.focus();
  };

  const canPrev = !minDProp || new Date(viewYM.y, viewYM.m, 1) > new Date(minDProp.getFullYear(), minDProp.getMonth(), 1);
  const canNext = !maxDProp || new Date(viewYM.y, viewYM.m, 1) < new Date(maxDProp.getFullYear(), maxDProp.getMonth(), 1);

  const NUM_BTN = "px-3 py-2 sm:py-3 text-base sm:text-lg leading-none select-none bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-brand/40 rounded";
  const NUM_DISABLED = "text-gray-300 cursor-not-allowed";
  const NUM_NORMAL = "text-gray-800 hover:text-brand";
  const NUM_ACTIVE = "text-brand font-semibold";
  const NUM_TODAY  = "text-brand";

  return (
    <div className="relative">
      <label className="text-sm text-gray-700">{label}</label>

      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className={`${CARD_BTN} ${CARD_MINH}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg width="18" height="18" viewBox="0 0 24 24" className="text-brand shrink-0" aria-hidden>
            <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v4H4V4h3V2zM4 10h16v10H4z"/>
          </svg>
          <span className="font-medium truncate text-gray-900">{pretty()}</span>
          <span className="ml-auto text-gray-500" aria-hidden>▾</span>
        </div>
      </button>

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Chọn thời gian đi"
          className="absolute z-50 mt-1 rounded-2xl border border-gray-300 bg-white shadow-xl p-4"
          style={{ width: `${triggerW}px` }}
        >
          {phase === "date" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => canPrev && setViewYM(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
                  disabled={!canPrev}
                  className={`${NUM_BTN} ${canPrev ? NUM_NORMAL : NUM_DISABLED}`}
                  aria-label="Tháng trước"
                >‹</button>
                <div className="font-semibold text-lg">{monthLabel}</div>
                <button
                  type="button"
                  onClick={() => canNext && setViewYM(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
                  disabled={!canNext}
                  className={`${NUM_BTN} ${canNext ? NUM_NORMAL : NUM_DISABLED}`}
                  aria-label="Tháng sau"
                >›</button>
              </div>

              <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-2">
                {["CN","T2","T3","T4","T5","T6","T7"].map((w) => <div key={w} className="py-1">{w}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {monthMatrix.flat().map(({ date: d, inMonth }, idx) => {
                  const ymd = toYMD(d);
                  const isToday = d.getFullYear() === today.y && d.getMonth() === today.m && d.getDate() === today.d;
                  const isDraftSel = draftDate === ymd;
                  const disabled = isDateDisabled(d) || !inMonth;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onPickDate(d)}
                      disabled={disabled}
                      className={[
                        "h-10 sm:h-12 relative flex items-center justify-center",
                        NUM_BTN,
                        disabled ? NUM_DISABLED : isDraftSel ? NUM_ACTIVE : isToday ? NUM_TODAY : NUM_NORMAL
                      ].join(" ")}
                      aria-label={`Chọn ngày ${d.getDate()}`}
                    >
                      {d.getDate()}
                      {isDraftSel && (
                        <span className="absolute inset-0 rounded-xl ring-2 ring-brand pointer-events-none" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "hour" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button type="button" className={`${NUM_BTN} ${NUM_NORMAL}`} onClick={() => setPhase("date")}>← Ngày</button>
                <div className="text-sm text-gray-600">{draftDate}</div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                  const active = h === draftHour;
                  const disabled = hourDisabled(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onPickHour(h)}
                      disabled={disabled}
                      className={[
                        "text-center relative",
                        NUM_BTN,
                        disabled ? NUM_DISABLED : active ? NUM_ACTIVE : NUM_NORMAL
                      ].join(" ")}
                      aria-label={`Chọn ${z2(h)} giờ`}
                    >
                      {z2(h)}:00
                      {active && <span className="absolute inset-x-2 -bottom-1 h-[2px] rounded" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "minute" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button type="button" className={`${NUM_BTN} ${NUM_NORMAL}`} onClick={() => setPhase("hour")}>← Giờ</button>
                <div className="text-sm text-gray-600">{draftDate} • {z2(draftHour ?? 0)}:__</div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MINUTES.map((m) => {
                  const active = m === draftMinute;
                  const disabled = minuteDisabled(draftHour, m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onPickMinute(m)}
                      disabled={disabled}
                      className={[
                        "text-center relative",
                        NUM_BTN,
                        disabled ? NUM_DISABLED : active ? NUM_ACTIVE : NUM_NORMAL
                      ].join(" ")}
                      aria-label={`Chọn phút ${z2(m)}`}
                    >
                      {z2(m)}
                      {active && <span className="absolute inset-x-4 -bottom-1 h-[2px] rounded" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 text-right">Chọn phút là lưu & đóng ngay.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** ================= Main Form ================= */
export default function BookingForm() {
  const [tripType, setTripType] = useState<TripType>("airport");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("Sân bay Nội Bài");
  const [stops, setStops] = useState<string[]>([]);
  const [vehicleTypeId, setVehicleTypeId] = useState<number>(2);
  const [startAt, setStartAt] = useState<string>(""); // yyyy-mm-ddTHH:MM
  const [roundTrip, setRoundTrip] = useState(false);
  const [vat, setVat] = useState(false);

  const selectedVehicle = useMemo(
    () => VEHICLES.find((v) => v.id === vehicleTypeId),
    [vehicleTypeId]
  );

  const addStop = () => setStops((arr) => [...arr, ""]);
  const updateStop = (i: number, v: string) => setStops((arr) => arr.map((s, idx) => (idx === i ? v : s)));
  const removeStop = (i: number) => setStops((arr) => arr.filter((_, idx) => idx !== i));

  const swap = () => {
    setFrom((prev) => {
      setTo(prev);
      return to;
    });
  };

  const validate = () => {
    const errs: string[] = [];
    if (!from.trim()) errs.push("Vui lòng nhập Điểm đi.");
    if (!to.trim()) errs.push("Vui lòng nhập Điểm đến.");
    if (!startAt) errs.push("Vui lòng chọn Thời gian đi.");
    return errs;
  };

  const onCheckPrice = () => {
    const errs = validate();
    if (errs.length) return alert(errs.join("\n"));
    alert(
      [
        "[DEMO] Kiểm tra giá",
        `Loại: ${tripType === "airport" ? "Sân bay" : "Đường dài"}`,
        `Tuyến: ${from} ${stops.length ? `→ ${stops.join(" → ")}` : ""} → ${to}`,
        `Xe: ${selectedVehicle?.name}`,
        `Thời gian: ${startAt}`,
        `2 chiều: ${roundTrip ? "Có" : "Không"} | VAT: ${vat ? "Có" : "Không"}`,
      ].join("\n")
    );
  };

  const onChangeTripType = (t: TripType) => {
    setTripType(t);
    if (t === "airport" && !to.trim()) setTo("Sân bay Nội Bài");
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex rounded-full bg-gray-100 p-1" role="tablist" aria-label="Loại chuyến">
        <button
          type="button"
          role="tab"
          aria-selected={tripType === "airport"}
          onClick={() => onChangeTripType("airport")}
          className={`px-3 py-1.5 text-sm rounded-full ${tripType === "airport" ? "bg-brand text-white" : "text-gray-700"}`}
        >
          Sân bay
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tripType === "road"}
          onClick={() => onChangeTripType("road")}
          className={`px-3 py-1.5 text-sm rounded-full ${tripType === "road" ? "bg-brand text-white" : "text-gray-700"}`}
        >
          Đường dài
        </button>
      </div>

      {/* From */}
      <div>
        <label className="text-sm text-gray-700">Bạn đi từ:</label>
        <div className="mt-1 flex items-center gap-2">
          <div className="relative w-full">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand">
  <CircleDot aria-hidden className="h-5 w-5" />
</span>

<input
  className={`${CARD} pl-10 pr-14 py-3`}  // ⬅ pr-14
  placeholder="Điểm đi"
  value={from}
  onChange={(e) => setFrom(e.target.value)}
  aria-label="Điểm đi"
/>

<button
  type="button"
  onClick={addStop}
  className={ICON_SHELL}                      // ⬅ căn giữa theo Y
  aria-label="Thêm điểm dừng"
  title="Thêm điểm dừng"
>
  <span className={ICON_BTN}>
    <Plus className="h-5 w-5" aria-hidden />
  </span>
</button>


          </div>
        </div>
      </div>

      {/* Stops */}
      {stops.length > 0 && (
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div key={i} className="relative">
              <input
                className={`${CARD} px-3 py-3`}
                placeholder={`Điểm dừng #${i + 1}`}
                value={s}
                onChange={(e) => updateStop(i, e.target.value)}
                aria-label={`Điểm dừng ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                aria-label={`Xoá điểm dừng ${i + 1}`}
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}

      {/* To + swap */}
      <div>
        <label className="text-sm text-gray-700">Bạn muốn đến:</label>
        <div className="mt-1 flex items-center gap-2">
          <div className="relative w-full">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
  <MapPin aria-hidden className="h-5 w-5 text-red-600" />
</span>


<input
  className={`${CARD} pl-10 pr-14 py-3`}  // ⬅ pr-14
  placeholder="Điểm đến"
  value={to}
  onChange={(e) => setTo(e.target.value)}
  aria-label="Điểm đến"
/>

<button
  type="button"
  onClick={swap}
  className={ICON_SHELL}
  title="Đảo chiều điểm đi/đến"
  aria-label="Đảo chiều điểm đi/đến"
>
  <span className={ICON_BTN}>
    <Repeat2 className="h-5 w-5" aria-hidden />
  </span>
</button>


          </div>
        </div>
      </div>

      {/* Loại xe + Thời gian đi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <VehicleDropdown value={vehicleTypeId} onChange={setVehicleTypeId} />
        <OneFieldDateTime value={startAt} onChange={setStartAt} />
      </div>

      {/* Switches */}
      {/* Switches */}
<div className="grid grid-cols-2 gap-3">
  {/* 2 chiều */}
  <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
    <span className="relative inline-flex h-6 w-10 items-center">
      {/* input ẩn + peer để điều khiển màu/knob */}
      <input
        type="checkbox"
        checked={roundTrip}
        onChange={(e) => setRoundTrip(e.target.checked)}
        className="peer sr-only"
        role="switch"
        aria-checked={roundTrip}
      />
      {/* track */}
      <span
        aria-hidden
        className="
          absolute inset-0 rounded-full transition
          bg-gray-300
          peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40
          peer-checked:bg-brand
        "
      />
      {/* knob */}
      <span
        aria-hidden
        className="
          absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition
          peer-checked:translate-x-4
        "
      />
    </span>
    2 chiều
  </label>

  {/* VAT */}
  <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
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
      <span
        aria-hidden
        className="
          absolute inset-0 rounded-full transition
          bg-gray-300
          peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40
          peer-checked:bg-brand
        "
      />
      <span
        aria-hidden
        className="
          absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition
          peer-checked:translate-x-4
        "
      />
    </span>
    VAT
  </label>
</div>


      {/* CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCheckPrice}
          className="w-full bg-brand text-white font-semibold text-lg py-3 rounded-2xl shadow-sm hover:bg-brand-dark"
        >
          Kiểm Tra Giá →
        </button>
      </div>
    </div>
  );
}
