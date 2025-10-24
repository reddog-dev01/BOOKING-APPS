"use client";

import { useEffect, useMemo, useState } from "react";

type SiteSetting = {
  vatOptions: number[];
  defaultVatPct: number;
  waitRatePerHour: number;
  roundTripWaitMinutes: number;
  mapProvider: string;
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3001";

const TRUNK_SIZE_LABEL: Record<string, string> = {
  SMALL: "Cốp nhỏ",
  LARGE: "Cốp rộng",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function parseVatOptions(input: string): number[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number.parseInt(item, 10))
        .filter((value) => Number.isFinite(value) && value >= 0)
    )
  ).sort((a, b) => a - b);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

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
    mapProvider: "google",
  });
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [vehicleDrafts, setVehicleDrafts] = useState<Record<number, { perKmVnd: number; isActive: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingVehicleId, setSavingVehicleId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vatOptions = useMemo(
    () => parseVatOptions(settingsForm.vatOptionsInput),
    [settingsForm.vatOptionsInput]
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
          mapProvider: settingResponse.mapProvider,
        });
        setVehicles(vehicleResponse);
        setVehicleDrafts(
          vehicleResponse.reduce((acc, vehicle) => {
            acc[vehicle.id] = {
              perKmVnd: vehicle.perKmVnd,
              isActive: vehicle.isActive,
            };
            return acc;
          }, {} as Record<number, { perKmVnd: number; isActive: boolean }>)
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
        mapProvider: settingsForm.mapProvider,
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
    value: number | boolean
  ) => {
    setVehicleDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSaveVehicle = async (vehicle: VehicleType) => {
    const draft = vehicleDrafts[vehicle.id];
    if (!draft) return;
    const payload = {
      perKmVnd: draft.perKmVnd,
      isActive: draft.isActive,
    };

    setSavingVehicleId(vehicle.id);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const updated = await requestJson<VehicleType>(`/vehicles/${vehicle.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setVehicles((prev) =>
        prev.map((item) => (item.id === vehicle.id ? { ...item, ...updated } : item))
      );
      setStatusMessage(`Đã cập nhật giá cho ${vehicle.name}`);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể cập nhật giá cho loại xe"
      );
    } finally {
      setSavingVehicleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:px-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Booking Platform
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Bảng điều khiển cấu hình giá sân bay
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Thiết lập VAT, thời gian chờ và giá theo km cho từng loại xe. Các cấu hình này sẽ
            được booking form sử dụng khi tính giá chuyến đi sân bay.
          </p>
          <p className="text-xs text-slate-500">
            API base: <span className="font-mono">{API_BASE_URL}</span>
          </p>
        </header>

        {statusMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={handleSubmitSettings}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-slate-900">Thuế & thời gian chờ</h2>
            <p className="mt-1 text-sm text-slate-500">
              Điều chỉnh danh sách VAT, VAT mặc định và chi phí giờ chờ cho chuyến hai chiều.
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
                  disabled={savingSettings || vatOptions.length === 0 || loading}
                >
                  {vatOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}%
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Giá giờ chờ (VND/giờ)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.waitRatePerHour}
                  onChange={(event) => handleSettingsChange("waitRatePerHour", Number(event.target.value))}
                  disabled={savingSettings || loading}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Thời gian chờ mặc định cho chuyến hai chiều (phút)
                </span>
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

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Nhà cung cấp bản đồ</span>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={settingsForm.mapProvider}
                  onChange={(event) => handleSettingsChange("mapProvider", event.target.value)}
                  disabled={savingSettings || loading}
                >
                  <option value="google">Google Maps</option>
                  <option value="manual">Tự nhập toạ độ</option>
                </select>
                <span className="text-xs text-slate-500">
                  Khi chọn Google Maps cần thiết lập biến môi trường <code>GOOGLE_MAPS_API_KEY</code> cho API.
                </span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={savingSettings || loading}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {savingSettings ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </form>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Hướng dẫn triển khai</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Đảm bảo chạy lệnh <code className="rounded bg-slate-100 px-1 py-0.5">pnpm prisma:migrate:deploy</code> và
                <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">pnpm db:seed</code> trước khi khởi chạy API production.
              </li>
              <li>
                Thiết lập biến môi trường <code className="rounded bg-slate-100 px-1 py-0.5">DATABASE_URL</code> cho PostgreSQL và
                <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">GOOGLE_MAPS_API_KEY</code> để bật gợi ý địa điểm.
              </li>
              <li>
                Booking form sẽ gửi dữ liệu toạ độ (lat/lng) dựa trên lựa chọn địa điểm. Khoảng cách được tính bằng Haversine trong API.
              </li>
              <li>
                Nếu chọn chuyến hai chiều, API sẽ áp dụng thời gian chờ mặc định và giá theo cấu hình ở đây.
              </li>
            </ul>
          </aside>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Giá theo loại xe</h2>
              <p className="text-sm text-slate-500">
                Cập nhật giá/km và trạng thái hoạt động cho từng loại xe. Giá sẽ được dùng khi tính phí quãng đường.
              </p>
            </div>
            {settings && (
              <p className="text-xs text-slate-500">
                VAT mặc định hiện tại: <strong>{settings.defaultVatPct}%</strong> • Giờ chờ: {formatCurrency(settings.waitRatePerHour)}đ/h
              </p>
            )}
          </div>

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
                          disabled={
                            !isDirty || savingVehicleId === vehicle.id || loading || draft.perKmVnd <= 0
                          }
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
        </section>
      </div>
    </div>
  );
}