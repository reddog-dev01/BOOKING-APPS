"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  CheckCircle2,
  ClipboardList,
  FileDown,
  LayoutDashboard,
  RefreshCcw,
  Settings as SettingsIcon,
} from "lucide-react";

import { AdminShell, type AdminNavItem } from "../../components/layout/admin-shell";
import {
  OperationTask,
  OperationsTaskboard,
} from "../../components/dashboard/operations-taskboard";

type SiteSetting = {
  vatOptions: number[];
  defaultVatPct: number;
  waitRatePerHour: number;
  roundTripWaitMinutes: number;
};

type VehicleType = {
  id: number;
  name: string;
  capacity: number;
  trunkSize: string | null;
  perKmVnd: number;
  isActive: boolean;
};

type ApiError = {
  message: string;
};

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELED" | "EXPIRED";
type TripType = "AIRPORT" | "ROAD";

type BookingListItem = {
  id: string;
  quoteId: string | null;
  customerName: string | null;
  phone: string | null;
  totalVnd: number;
  createdAt: string;
  startAt: string;
  status: BookingStatus;
  tripType: TripType;
  vehicleTypeName: string | null;
  fromText: string;
  toText: string;
};

type ListBookingsResponse = {
  items: BookingListItem[];
  hasMore: boolean;
  nextCursor?: string;
};

const TRIP_TYPE_LABEL: Record<TripType, string> = {
  AIRPORT: "Sân bay",
  ROAD: "Đường dài",
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Đang xử lý",
  CONFIRMED: "Đã xác nhận",
  CANCELED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

const STATUS_BADGE_CLASS: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "border border-brand/30 bg-brand/10 text-brand-dark",
  CANCELED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-slate-200 text-slate-700",
};

const NAVIGATION_ITEMS: AdminNavItem[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "bookings", label: "Đơn đặt chuyến", icon: ClipboardList },
  { id: "fleet", label: "Đội xe", icon: Car },
  { id: "settings", label: "Cấu hình", icon: SettingsIcon },
];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3006";

const TRUNK_SIZE_LABEL: Record<string, string> = {
  SMALL: "Cốp nhỏ",
  LARGE: "Cốp rộng",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function parseVatOptions(input: string): number[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number.parseInt(item, 10))
        .filter((value) => Number.isFinite(value) && value >= 0),
    ),
  ).sort((a, b) => a - b);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const hint =
      "Không thể kết nối tới API. Hãy kiểm tra rằng dịch vụ API và Postgres đang chạy (ví dụ: `docker compose up -d db` và `pnpm --filter api dev`).";
    const message = error instanceof Error ? `${error.message}. ${hint}` : hint;
    throw new Error(message);
  }

  const text = await res.text();
  if (!res.ok) {
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as Partial<ApiError>;
      if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      // ignore JSON parse error, use raw text
    }
    if (!message || message.trim().startsWith("<")) {
      message = `Request failed with status ${res.status}`;
    }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export default function DashboardPage() {
  const [settings, setSettings] = useState<SiteSetting | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    vatOptionsInput: "0,8,10",
    defaultVatPct: 10,
    waitRatePerHour: 60000,
    roundTripWaitMinutes: 90,
  });
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [vehicleDrafts, setVehicleDrafts] = useState<Record<number, { perKmVnd: number; isActive: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingVehicleId, setSavingVehicleId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [bookingsHasMore, setBookingsHasMore] = useState(false);
  const [bookingsCursor, setBookingsCursor] = useState<string | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [dateTo, setDateTo] = useState("");

  const vatOptions = useMemo(
    () => parseVatOptions(settingsForm.vatOptionsInput),
    [settingsForm.vatOptionsInput],
  );

  useEffect(() => {
    if (vatOptions.length === 0) {
      return;
    }
    if (!vatOptions.includes(settingsForm.defaultVatPct)) {
      setSettingsForm((prev) => ({
        ...prev,
        defaultVatPct: vatOptions[0],
      }));
    }
  }, [vatOptions, settingsForm.defaultVatPct]);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const [settingResponse, vehicleResponse] = await Promise.all([
          requestJson<SiteSetting>("/settings"),
          requestJson<VehicleType[]>("/vehicles?activeOnly=false"),
        ]);
        setSettings(settingResponse);
        setSettingsForm({
          vatOptionsInput: settingResponse.vatOptions.join(","),
          defaultVatPct: settingResponse.defaultVatPct,
          waitRatePerHour: settingResponse.waitRatePerHour,
          roundTripWaitMinutes: settingResponse.roundTripWaitMinutes,
        });
        setVehicles(vehicleResponse);
        setVehicleDrafts(
          vehicleResponse.reduce((acc, vehicle) => {
            acc[vehicle.id] = {
              perKmVnd: vehicle.perKmVnd,
              isActive: vehicle.isActive,
            };
            return acc;
          }, {} as Record<number, { perKmVnd: number; isActive: boolean }>),
        );
      } catch (err) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : "Không thể tải dữ liệu ban đầu");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const loadBookings = useCallback(
    async (options?: { cursor?: string; append?: boolean }) => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchFilter.trim()) {
        params.set("search", searchFilter.trim());
      }
      if (dateFrom) {
        params.set("startDateFrom", `${dateFrom}T00:00:00Z`);
      }
      if (dateTo) {
        params.set("startDateTo", `${dateTo}T23:59:59Z`);
      }
      if (options?.cursor) {
        params.set("cursor", options.cursor);
      }

      try {
        if (!options?.append) {
          setBookingsLoading(true);
        }
        setBookingsError(null);
        const response = await requestJson<ListBookingsResponse>(`/bookings?${params.toString()}`);
        setBookings((prev) => (options?.append ? [...prev, ...response.items] : response.items));
        setBookingsHasMore(response.hasMore);
        setBookingsCursor(response.nextCursor ?? null);
      } catch (err) {
        console.error(err);
        setBookingsError(err instanceof Error ? err.message : "Không thể tải danh sách chuyến đi");
      } finally {
        setBookingsLoading(false);
      }
    },
    [statusFilter, searchFilter, dateFrom, dateTo],
  );

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchFilter(searchInput.trim());
    setDateFrom(dateFromInput);
    setDateTo(dateToInput);
    setTimeout(() => loadBookings(), 0);
  };

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setSearchInput("");
    setSearchFilter("");
    setDateFromInput("");
    setDateFrom("");
    setDateToInput("");
    setDateTo("");
    setTimeout(() => loadBookings(), 0);
  };

  const handleLoadMoreBookings = () => {
    if (!bookingsHasMore || !bookingsCursor) {
      return;
    }
    loadBookings({ cursor: bookingsCursor, append: true });
  };

  const handleRefreshBookings = () => {
    loadBookings();
  };

  const handleDownloadExcel = async () => {
    try {
      setExportingExcel(true);
      setBookingsError(null);
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchFilter.trim()) {
        params.set("search", searchFilter.trim());
      }
      if (dateFrom) {
        params.set("startDateFrom", `${dateFrom}T00:00:00Z`);
      }
      if (dateTo) {
        params.set("startDateTo", `${dateTo}T23:59:59Z`);
      }
      const url = `${API_BASE_URL}/bookings/export?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Tải Excel thất bại (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : `bookings-${new Date().toISOString().slice(0, 10)}.xls`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      setBookingsError(err instanceof Error ? err.message : "Không thể xuất Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const bookingMetrics = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((item) => item.status === "PENDING").length;
    const confirmed = bookings.filter((item) => item.status === "CONFIRMED").length;
    const revenue = bookings.reduce((acc, item) => acc + item.totalVnd, 0);
    const average = total > 0 ? Math.round(revenue / total) : 0;
    return { total, pending, confirmed, revenue, average };
  }, [bookings]);

  const operationsTasks = useMemo<OperationTask[]>(() => {
    const newest = bookings[0] ?? null;
    return [
      {
        id: "intake",
        summary: "Bước 1",
        title: "Tiếp nhận & xác nhận yêu cầu",
        body: (
          <>
            <p>
              Gọi lại cho khách trong 5 phút để xác nhận lịch trình, giá dự kiến và phương thức thanh toán.
            </p>
            {newest ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Đơn mới nhất ({formatDateTime(newest.createdAt)})
                </p>
                <div className="mt-2 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Khách</span>
                    <span>{newest.customerName ?? "--"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Điện thoại</span>
                    <span>{newest.phone ?? "--"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Khởi hành</span>
                    <span>{formatDateTime(newest.startAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Tuyến</span>
                    <span className="text-right">{newest.fromText} → {newest.toText}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Giá tạm tính</span>
                    <span>{formatCurrency(newest.totalVnd)}đ</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Chưa có đơn nào được lọc. Hãy bấm "Làm mới" hoặc thay đổi bộ lọc bên trên.
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Đảm bảo thông tin hành khách và hành trình trùng khớp với dữ liệu trên bảng.</li>
              <li>Ghi chú lại yêu cầu đặc biệt (ghế trẻ em, hành lý, hóa đơn VAT...).</li>
              <li>Nếu khách yêu cầu điều chỉnh, cập nhật lại báo giá và gửi email xác nhận.</li>
            </ul>
          </>
        ),
      },
      {
        id: "dispatch",
        summary: "Bước 2",
        title: "Điều phối tài xế & phương tiện",
        body: (
          <>
            <p>
              Lọc danh sách tài xế phù hợp theo loại xe và khu vực xuất phát, ưu tiên tài xế có đánh giá cao.
            </p>
            <ul className="list-decimal space-y-1 pl-5 text-sm">
              <li>Kiểm tra tình trạng xe trên mục "Đội xe" trước khi phân công.</li>
              <li>
                Gửi thông tin chuyến đi qua ứng dụng điều hành hoặc Zalo nội bộ, yêu cầu tài xế xác nhận trong 10 phút.
              </li>
              <li>
                Cập nhật trạng thái đơn sang <span className="font-semibold text-emerald-600">CONFIRMED</span> khi tài xế đã nhận chuyến.
              </li>
            </ul>
            <p className="text-sm text-slate-600">
              Hiện có {bookingMetrics.pending} đơn cần xác nhận và {bookingMetrics.confirmed} đơn đã khóa lịch.
            </p>
          </>
        ),
      },
      {
        id: "monitor",
        summary: "Bước 3",
        title: "Giám sát hành trình & chốt doanh thu",
        body: (
          <>
            <p>
              Theo dõi chuyến đi theo thời gian thực, đảm bảo tài xế cập nhật trạng thái xuất phát, đón khách và hoàn thành.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Ghi nhận chi phí phát sinh (cao tốc, cầu đường) để xuất hóa đơn chính xác.</li>
              <li>
                Sau khi hoàn thành, đối soát doanh thu: trung bình mỗi đơn hiện đạt {formatCurrency(bookingMetrics.average)}đ.
              </li>
              <li>Sử dụng chức năng xuất Excel để gửi báo cáo cuối ngày cho kế toán.</li>
            </ul>
            <p className="text-sm text-slate-600">
              Báo cáo Excel sẽ bám bộ lọc hiện tại, phù hợp để tổng hợp nhanh các chuyến đã hoàn tất.
            </p>
          </>
        ),
      },
    ];
  }, [bookings, bookingMetrics]);

  const latestBooking = useMemo(() => bookings[0] ?? null, [bookings]);

  const handleSettingsChange = (field: string, value: string | number) => {
    setSettingsForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSettings(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const parsedVat = vatOptions;
      if (parsedVat.length === 0) {
        throw new Error("Cần nhập ít nhất một mức VAT");
      }

      const payload = {
        vatOptions: parsedVat,
        defaultVatPct: settingsForm.defaultVatPct,
        waitRatePerHour: settingsForm.waitRatePerHour,
        roundTripWaitMinutes: settingsForm.roundTripWaitMinutes,
      };

      const updated = await requestJson<SiteSetting>("/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setSettings(updated);
      setStatusMessage("Đã lưu cấu hình thuế và thời gian chờ");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Không thể lưu cấu hình");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleVehicleDraftChange = (
    id: number,
    field: "perKmVnd" | "isActive",
    value: number | boolean,
  ) => {
    setVehicleDrafts((prev) => ({
      ...prev,
      [id]: {
        perKmVnd: field === "perKmVnd" ? Number(value) : prev[id]?.perKmVnd ?? 0,
        isActive: field === "isActive" ? Boolean(value) : prev[id]?.isActive ?? true,
      },
    }));
  };

  const handleSaveVehicle = async (vehicle: VehicleType) => {
    const draft = vehicleDrafts[vehicle.id];
    if (!draft) {
      return;
    }
    setSavingVehicleId(vehicle.id);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        perKmVnd: draft.perKmVnd,
        isActive: draft.isActive,
      };

      await requestJson<VehicleType>(`/vehicles/${vehicle.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setVehicles((prev) =>
        prev.map((item) => (item.id === vehicle.id ? { ...item, ...payload } : item)),
      );
      setStatusMessage(`Đã lưu cấu hình cho ${vehicle.name}`);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Không thể lưu cấu hình xe");
    } finally {
      setSavingVehicleId(null);
    }
  };

  return (
    <AdminShell
      title="Bảng điều hành"
      description="Quản lý đơn đặt chuyến, đội xe và cấu hình giá."
      navItems={NAVIGATION_ITEMS}
    >
      <section id="overview" className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Tổng quan vận hành</h2>
          <p className="text-sm text-slate-500">
            Nắm trạng thái đơn mới nhất, quy trình xử lý và các chỉ số chính của đội vận hành.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-6 text-brand-dark shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/80">
                  Bạn đã đặt chuyến thành công
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-brand-dark">{latestBooking ? latestBooking.customerName ?? "--" : "Chưa có đơn"}</h3>
              </div>
              <CheckCircle2 className="h-8 w-8 text-brand-dark" aria-hidden />
            </div>
            {latestBooking ? (
              <dl className="mt-6 grid gap-3 text-sm text-brand-dark/90 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Mã đơn</dt>
                  <dd className="mt-1 break-all text-base font-medium">{latestBooking.id}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Trạng thái</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[latestBooking.status]}`}>
                      {STATUS_LABEL[latestBooking.status]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Khởi hành</dt>
                  <dd className="mt-1 text-base font-medium">{formatDateTime(latestBooking.startAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Giá tạm tính</dt>
                  <dd className="mt-1 text-base font-medium">{formatCurrency(latestBooking.totalVnd)}đ</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Lộ trình</dt>
                  <dd className="mt-1 text-base font-medium">
                    {latestBooking.fromText} → {latestBooking.toText}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-wide text-xs text-brand-dark/70">Liên hệ</dt>
                  <dd className="mt-1 text-base font-medium">
                    {latestBooking.customerName ?? "Ẩn danh"} • {latestBooking.phone ?? "--"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-6 text-sm text-brand-dark/80">
                Hiện chưa có chuyến nào được hiển thị. Sử dụng bộ lọc ở mục "Đơn đặt chuyến" để tải dữ liệu mới nhất.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Chỉ số nhanh</h3>
            <dl className="mt-4 grid gap-4 text-sm text-slate-600">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Đơn hiển thị</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{bookingMetrics.total}</dd>
                <p className="text-xs text-slate-500">Theo bộ lọc hiện tại</p>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Đang xử lý</dt>
                <dd className="mt-1 text-2xl font-semibold text-amber-600">{bookingMetrics.pending}</dd>
                <p className="text-xs text-slate-500">Chưa được điều hành xác nhận</p>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Đã xác nhận</dt>
                <dd className="mt-1 text-2xl font-semibold text-brand-dark">{bookingMetrics.confirmed}</dd>
                <p className="text-xs text-slate-500">Sẵn sàng điều xe</p>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Doanh thu hiển thị</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(bookingMetrics.revenue)}đ</dd>
                <p className="text-xs text-slate-500">
                  {bookingMetrics.average > 0
                    ? `Trung bình ${formatCurrency(bookingMetrics.average)}đ/đơn`
                    : "Chưa có dữ liệu để tính trung bình"}
                </p>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Quy trình vận hành</h3>
              <p className="text-sm text-slate-500">Mở từng bước để theo dõi checklist triển khai.</p>
            </div>
          </div>
          <div className="mt-4">
            <OperationsTaskboard tasks={operationsTasks} />
          </div>
        </div>
      </section>

      <section id="bookings" className="space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Đơn đặt chuyến</h2>
            <p className="text-sm text-slate-500">
              Theo dõi tối đa 20 đơn theo bộ lọc. Dùng Excel để gửi báo cáo cho kế toán.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshBookings}
              disabled={bookingsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${bookingsLoading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={exportingExcel || bookingsLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <FileDown className="h-4 w-4" />
              <span>{exportingExcel ? "Đang xuất..." : "Xuất Excel"}</span>
            </button>
          </div>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <form onSubmit={handleFilterSubmit} className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tìm kiếm</label>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tên khách, số điện thoại hoặc mã báo giá"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "ALL" | BookingStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PENDING">Đang xử lý</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  <option value="CANCELED">Đã hủy</option>
                  <option value="EXPIRED">Hết hạn</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Từ ngày</label>
                <input
                  type="date"
                  value={dateFromInput}
                  onChange={(event) => setDateFromInput(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Đến ngày</label>
                <input
                  type="date"
                  value={dateToInput}
                  onChange={(event) => setDateToInput(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-5 flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Áp dụng
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
                >
                  Xóa lọc
                </button>
              </div>
            </form>
          </div>

          {bookingsError ? (
            <div className="border-b border-slate-200 bg-rose-50 px-6 py-3 text-sm text-rose-600" role="alert">
              {bookingsError}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left">Thời gian đặt</th>
                  <th className="px-6 py-3 text-left">Khách hàng</th>
                  <th className="px-6 py-3 text-left">Loại chuyến</th>
                  <th className="px-6 py-3 text-left">Lộ trình</th>
                  <th className="px-6 py-3 text-left">Khởi hành</th>
                  <th className="px-6 py-3 text-left">Trạng thái</th>
                  <th className="px-6 py-3 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bookingsLoading && bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      Đang tải danh sách chuyến...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      Chưa có đơn đặt chuyến nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="align-middle">
                      <td className="px-6 py-3 text-slate-600">{formatDateTime(booking.createdAt)}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{booking.customerName ?? "Ẩn danh"}</span>
                          <span className="text-xs text-slate-500">{booking.phone ?? "--"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{TRIP_TYPE_LABEL[booking.tripType]}</span>
                          <span className="text-xs text-slate-500">{booking.vehicleTypeName ?? "--"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span>{booking.fromText}</span>
                          <span className="text-xs text-slate-500">→ {booking.toText}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{formatDateTime(booking.startAt)}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[booking.status]}`}
                        >
                          {STATUS_LABEL[booking.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(booking.totalVnd)}đ
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            <span>Đang hiển thị {bookings.length} đơn.</span>
            {bookingsHasMore && (
              <button
                type="button"
                onClick={handleLoadMoreBookings}
                disabled={bookingsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tải thêm
              </button>
            )}
          </div>
        </div>
      </section>

      <section id="fleet" className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Đội xe & giá cước</h2>
          <p className="text-sm text-slate-500">
            Cập nhật giá/km và trạng thái hoạt động cho từng loại xe. Giá sẽ được dùng khi tính phí quãng đường.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {settings ? (
            <p className="text-xs text-slate-500">
              VAT mặc định: <strong>{settings.defaultVatPct}%</strong> • Giờ chờ hai chiều: {formatCurrency(settings.waitRatePerHour)}đ/h
            </p>
          ) : null}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Loại xe</th>
                  <th className="px-4 py-3">Sức chứa</th>
                  <th className="px-4 py-3">Cốp</th>
                  <th className="px-4 py-3">Giá / km (VND)</th>
                  <th className="px-4 py-3">Kích hoạt</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {vehicles.map((vehicle) => {
                  const draft = vehicleDrafts[vehicle.id] ?? {
                    perKmVnd: vehicle.perKmVnd,
                    isActive: vehicle.isActive,
                  };
                  const isDirty =
                    draft.perKmVnd !== vehicle.perKmVnd || draft.isActive !== vehicle.isActive;
                  return (
                    <tr key={vehicle.id} className="align-middle">
                      <td className="px-4 py-3 font-medium text-slate-900">{vehicle.name}</td>
                      <td className="px-4 py-3 text-slate-600">{vehicle.capacity} khách</td>
                      <td className="px-4 py-3 text-slate-600">
                        {vehicle.trunkSize ? TRUNK_SIZE_LABEL[vehicle.trunkSize] ?? vehicle.trunkSize : "--"}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step={500}
                          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                          value={draft.perKmVnd}
                          onChange={(event) =>
                            handleVehicleDraftChange(vehicle.id, "perKmVnd", Number(event.target.value))
                          }
                          disabled={savingVehicleId === vehicle.id || loading}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            checked={draft.isActive}
                            onChange={(event) =>
                              handleVehicleDraftChange(vehicle.id, "isActive", event.target.checked)
                            }
                            disabled={savingVehicleId === vehicle.id || loading}
                          />
                          Hoạt động
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveVehicle(vehicle)}
                          disabled={!isDirty || savingVehicleId === vehicle.id || loading || draft.perKmVnd <= 0}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {savingVehicleId === vehicle.id ? "Đang lưu..." : "Lưu"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {loading && (
              <p className="px-4 py-3 text-sm text-slate-500">Đang tải dữ liệu xe...</p>
            )}
          </div>
        </div>
      </section>

      <section id="settings" className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Cấu hình hệ thống</h2>
          <p className="text-sm text-slate-500">Điều chỉnh VAT, thời gian chờ và ghi chú triển khai.</p>
        </header>

        {statusMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <form onSubmit={handleSubmitSettings} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Thuế & thời gian chờ</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cập nhật các thông số được áp dụng cho tính giá và báo giá hai chiều.
            </p>

            <div className="mt-6 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Mức VAT cho phép (nhập số, cách nhau bởi dấu phẩy)
                </span>
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.vatOptionsInput}
                  onChange={(event) => handleSettingsChange("vatOptionsInput", event.target.value)}
                  placeholder="0,8,10"
                  disabled={savingSettings || loading}
                  autoComplete="off"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">VAT mặc định</span>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.defaultVatPct}
                  onChange={(event) => handleSettingsChange("defaultVatPct", Number(event.target.value))}
                  disabled={savingSettings || loading || vatOptions.length === 0}
                >
                  {vatOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Giá giờ chờ (VND)</span>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.waitRatePerHour}
                  onChange={(event) => handleSettingsChange("waitRatePerHour", Number(event.target.value))}
                  disabled={savingSettings || loading}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Thời gian chờ khứ hồi mặc định (phút)</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.roundTripWaitMinutes}
                  onChange={(event) => handleSettingsChange("roundTripWaitMinutes", Number(event.target.value))}
                  disabled={savingSettings || loading}
                />
              </label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings || loading}
                className="inline-flex items-center justify-center rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {savingSettings ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
              {settings ? (
                <p className="text-xs text-slate-500">
                  VAT hiện tại: {settings.vatOptions.join(", ")} • Chờ: {settings.roundTripWaitMinutes} phút
                </p>
              ) : null}
            </div>
          </form>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Ghi chú triển khai</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Đảm bảo chạy <code className="rounded bg-slate-100 px-1 py-0.5">pnpm prisma:migrate:deploy</code> và
                <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">pnpm db:seed</code> trước khi khởi chạy API production.
              </li>
              <li>
                Thiết lập biến môi trường <code className="rounded bg-slate-100 px-1 py-0.5">DATABASE_URL</code> và
                <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">PLACES_API_KEY</code> để bật gợi ý địa điểm.
              </li>
              <li>
                Booking form sẽ gửi dữ liệu toạ độ (lat/lng) dựa trên lựa chọn địa điểm. Khoảng cách được tính bằng Haversine trong API.
              </li>
              <li>
                Nếu chọn chuyến hai chiều, API sẽ áp dụng thời gian chờ mặc định và giá theo cấu hình ở đây.
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </AdminShell>
  );
}
