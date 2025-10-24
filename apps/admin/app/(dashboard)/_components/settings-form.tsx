"use client";

import { useMemo, useState, useTransition } from "react";
import type { SiteSetting } from "../page";
import { getApiBaseUrl } from "../../../lib/config";

type FormState = {
  vatOptionsInput: string;
  defaultVatPct: number;
  waitRatePerHour: number;
};

const formatVatOptions = (options: number[]) => options.join(", ");

const parseVatOptions = (input: string) =>
  input
    .split(/[,\s]+/)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => !Number.isNaN(value));

export default function SettingsForm({ initialSettings }: { initialSettings: SiteSetting }) {
  const [formState, setFormState] = useState<FormState>({
    vatOptionsInput: formatVatOptions(initialSettings.vatOptions),
    defaultVatPct: initialSettings.defaultVatPct,
    waitRatePerHour: initialSettings.waitRatePerHour,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const vatOptions = useMemo(() => parseVatOptions(formState.vatOptionsInput), [formState.vatOptionsInput]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!vatOptions.includes(formState.defaultVatPct)) {
      setError("VAT mặc định phải nằm trong danh sách lựa chọn");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vatOptions,
            defaultVatPct: formState.defaultVatPct,
            waitRatePerHour: formState.waitRatePerHour,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = (payload as { error?: { message?: string } })?.error?.message;
          throw new Error(message ?? "Không cập nhật được cài đặt");
        }

        setMessage("Đã lưu cấu hình VAT & thời gian chờ");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi không xác định");
      }
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Danh sách VAT (%)</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={formState.vatOptionsInput}
            onChange={(event) => setFormState((prev) => ({ ...prev, vatOptionsInput: event.target.value }))}
            placeholder="Ví dụ: 0, 8, 10"
          />
          <span className="text-xs text-slate-500">Phân tách bằng dấu phẩy hoặc khoảng trắng.</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">VAT mặc định</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={formState.defaultVatPct}
            onChange={(event) => setFormState((prev) => ({ ...prev, defaultVatPct: Number(event.target.value) }))}
          >
            {vatOptions.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Đơn giá thời gian chờ (VND/giờ)</span>
          <input
            type="number"
            min={0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={formState.waitRatePerHour}
            onChange={(event) => setFormState((prev) => ({ ...prev, waitRatePerHour: Number(event.target.value) }))}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
        >
          {isPending ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        {message && <span className="text-sm text-emerald-600">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
