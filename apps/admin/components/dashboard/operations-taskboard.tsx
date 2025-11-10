"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

export type OperationTask = {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
};

type TaskState = Record<string, boolean>;

export function OperationsTaskboard({ tasks }: { tasks: OperationTask[] }) {
  const initialExpanded = useMemo<TaskState>(() => {
    return tasks.reduce<TaskState>((acc, task, index) => {
      acc[task.id] = index === 0;
      return acc;
    }, {});
  }, [tasks]);

  const [expanded, setExpanded] = useState<TaskState>(initialExpanded);
  const [completed, setCompleted] = useState<TaskState>({});

  useEffect(() => {
    setExpanded(initialExpanded);
  }, [initialExpanded]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Không có quy trình nào khả dụng.
      </div>
    );
  }

  const toggleExpanded = (taskId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [taskId]: !prev?.[taskId],
    }));
  };

  const toggleCompleted = (taskId: string) => {
    setCompleted((prev) => ({
      ...prev,
      [taskId]: !prev?.[taskId],
    }));
  };

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => {
        const isOpen = expanded?.[task.id] ?? false;
        const isDone = completed?.[task.id] ?? false;
        const panelId = `${task.id}-panel`;
        const controlId = `${task.id}-control`;

        return (
          <section
            key={task.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-brand/40"
          >
            <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-dark">
                  {index + 1}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {task.summary}
                  </p>
                  <h3 id={controlId} className="mt-1 text-lg font-semibold text-slate-900">
                    {task.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleCompleted(task.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/40"
                    aria-describedby={`${panelId}-hint`}
                  />
                  Đánh dấu xong
                </label>

                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-labelledby={controlId}
                  onClick={() => toggleExpanded(task.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-brand/10 hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {isOpen ? "Thu gọn" : "Xem chi tiết"}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </div>
            </div>

            <div
              id={panelId}
              role="region"
              aria-labelledby={controlId}
              data-state={isOpen ? "open" : "collapsed"}
              className={`border-t border-slate-200 bg-slate-50/60 transition-[max-height] duration-300 ease-in-out ${
                isOpen ? "max-h-[900px]" : "max-h-0 overflow-hidden"
              }`}
            >
              <div className="space-y-3 px-5 py-5 text-sm text-slate-700">
                <p id={`${panelId}-hint`} className="text-xs uppercase tracking-wide text-slate-400">
                  {isDone ? "Đã đánh dấu hoàn tất" : "Đang xử lý"}
                </p>
                <div className="space-y-3 leading-relaxed">{task.body}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
