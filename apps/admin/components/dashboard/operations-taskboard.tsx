"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type OperationTask = {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
};

export function OperationsTaskboard({ tasks }: { tasks: OperationTask[] }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(
    tasks[0]?.id ?? null,
  );

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Không có quy trình nào khả dụng.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const isOpen = openTaskId === task.id;
        return (
          <section
            key={task.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition"
          >
            <h3>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-expanded={isOpen}
                onClick={() => setOpenTaskId(isOpen ? null : task.id)}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                    {task.summary}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {task.title}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" aria-hidden />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" aria-hidden />
                )}
              </button>
            </h3>
            <div
              className={`border-t border-slate-200 bg-slate-50/60 px-5 transition-[max-height] duration-300 ease-in-out ${
                isOpen ? "max-h-[800px] py-5" : "max-h-0 overflow-hidden"
              }`}
            >
              <div className="space-y-3 text-sm text-slate-700">{task.body}</div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
