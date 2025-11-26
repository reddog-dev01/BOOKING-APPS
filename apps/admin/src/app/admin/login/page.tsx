import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const AUTH_COOKIE = "admin-auth";

async function authenticate(formData: FormData) {
  "use server";

  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString().trim() ?? "";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  if (!email || !password) {
    redirect(`/admin/login?error=missing&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  cookies().set(AUTH_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });

  redirect(redirectTo);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const showError = resolvedSearchParams?.error === "missing";
  const redirectTo = resolvedSearchParams?.redirectTo || "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2v6" />
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">FleetOps Admin</p>
            <h1 className="text-2xl font-semibold text-foreground">Đăng nhập bảng điều hành</h1>
            <p className="text-sm text-muted-foreground">Truy cập để giám sát đơn, đội xe và SLA realtime.</p>
          </div>
        </div>

        {showError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
            Vui lòng nhập đầy đủ email và mật khẩu.
          </p>
        ) : null}

        <form action={authenticate} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="dispatch@fleetops.vn"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm shadow-inner outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm shadow-inner outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-105"
          >
            Đăng nhập
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} FleetOps</span>
          <Link href="/admin" className="font-medium text-accent hover:underline">
            Quay lại dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
