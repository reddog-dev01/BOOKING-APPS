"use client";

import { useState, useTransition } from "react";
import type { VehicleTypeDto } from "../page";
import { getApiBaseUrl } from "../../../lib/config";

type VehicleRowState = VehicleTypeDto & {
  perKmInput: string;
  isSaving: boolean;
  message: string | null;
  error: string | null;
};

const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function VehicleRatesManager({ vehicles }: { vehicles: VehicleTypeDto[] }) {
  const [rows, setRows] = useState<VehicleRowState[]>(() =>
    vehicles.map((vehicle) => ({
      ...vehicle,
      perKmInput: vehicle.perKmVnd.toString(),
      isSaving: false,
      message: null,
      error: null,
    })),
  );
  const [isPending, startTransition] = useTransition();

  const updateRow = (id: number, updater: (row: VehicleRowState) => VehicleRowState) => {
    setRows((current) => current.map((row) => (row.id === id ? updater(row) : row)));
  };

  const handleSave = (row: VehicleRowState) => {
    const perKmVnd = Number.parseInt(row.perKmInput, 10);

    if (Number.isNaN(perKmVnd) || perKmVnd <= 0) {
      updateRow(row.id, (state) => ({ ...state, error: "Giá mỗi km phải lớn hơn 0", message: null }));
      return;
    }

    updateRow(row.id, (state) => ({ ...state, isSaving: true, error: null, message: null }));

    startTransition(async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/vehicles/types/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perKmVnd,
            isActive: row.isActive,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = payload?.error?.message;
          throw new Error(message ?? "Không cập nhật được giá xe");
        }

        updateRow(row.id, (state) => ({
          ...state,
          perKmVnd,
          perKmInput: perKmVnd.toString(),
          isSaving: false,
          message: "Đã lưu",
          error: null,
        }));
      } catch (err) {
        updateRow(row.id, (state) => ({
          ...state,
          isSaving: false,
          error: err instanceof Error ? err.message : "Lỗi không xác định",
          message: null,
        }));
      }
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-700">Loại xe</th>
            <th className="px-4 py-3 font-medium text-slate-700">Sức chứa</th>
            <th className="px-4 py-3 font-medium text-slate-700">Giá / km (VND)</th>
            <th className="px-4 py-3 font-medium text-slate-700">Trạng thái</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-4 text-slate-900">
                <div className="font-semibold">{row.name}</div>
                <div className="flex gap-2 text-xs text-slate-500">
                  <span>ID: {row.id}</span>
                  <span>Mã: {row.code}</span>
                </div>
              </td>
              <td className="px-4 py-4 text-slate-600">{row.capacity} khách</td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    value={row.perKmInput}
                    onChange={(event) =>
                      updateRow(row.id, (state) => ({ ...state, perKmInput: event.target.value, message: null }))
                    }
                  />
                  <span className="text-xs text-slate-500">Hiện tại: {formatCurrency(row.perKmVnd)}đ</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(event) =>
                      updateRow(row.id, (state) => ({
                        ...state,
                        isActive: event.target.checked,
                        message: null,
                      }))
                    }
                  />
                  {row.isActive ? "Đang bật" : "Tạm tắt"}
                </label>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleSave(row)}
                    disabled={row.isSaving || isPending}
                  >
                    {row.isSaving ? "Đang lưu..." : "Lưu giá"}
                  </button>
                  {row.message && <span className="text-xs text-emerald-600">{row.message}</span>}
                  {row.error && <span className="text-xs text-red-600">{row.error}</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}