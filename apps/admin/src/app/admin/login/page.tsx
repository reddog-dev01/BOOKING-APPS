import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "admin-auth";
const EIGHT_HOURS_IN_SECONDS = 60 * 60 * 8;

type SearchParams = {
  error?: string;
  redirectTo?: string;
};

// Server action: validates credentials, sets an HttpOnly cookie, and redirects to the dashboard.
async function authenticate(formData: FormData) {
  "use server";

  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString().trim() ?? "";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  // Guard against empty submissions to avoid empty-session cookies.
  if (!email || !password) {
    redirect(`/admin/login?error=missing&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // Validate against env-driven credentials to avoid hardcoded secrets.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const isValid =
    adminEmail &&
    adminPassword &&
    email.toLowerCase() === adminEmail.toLowerCase() &&
    password === adminPassword;

  if (!isValid) {
    redirect(`/admin/login?error=invalid&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // Issue a short-lived, path-scoped, HttpOnly session flag for admin routes only.
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/admin",
    maxAge: EIGHT_HOURS_IN_SECONDS,
  });

  redirect(redirectTo);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  // Await the dynamic search params to satisfy Next.js requirements for async route data.
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirectTo || "/admin";
  const errorType = resolvedSearchParams?.error;

  let errorMessage: string | null = null;
  if (errorType === "missing") {
    errorMessage = "Vui lòng nhập đầy đủ email và mật khẩu.";
  } else if (errorType === "invalid") {
    errorMessage = "Thông tin đăng nhập không chính xác.";
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      {/* Soft glows for depth without external assets. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-8 md:grid-cols-[1.2fr,1fr]">
        {/* Left narrative column for context and trust signals. */}
        <div className="hidden flex-col justify-between rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl md:flex">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              FleetOps Realtime Control
            </div>
            <h1 className="text-3xl font-semibold text-slate-50">Bảng điều hành đội xe & đơn hàng thời gian thực.</h1>
            <p className="text-sm text-slate-300/80">
              Theo dõi đơn, trạng thái tài xế, SLA và cảnh báo sự cố trên một dashboard duy nhất dành cho quản trị viên được ủy quyền.
            </p>
          </div>

          <div className="mt-8 space-y-4 text-xs text-slate-300/80">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[11px] font-semibold text-slate-100">
                24/7
              </div>
              <div>
                <p className="font-medium text-slate-100">Giám sát thời gian thực</p>
                <p className="text-[11px] text-slate-300/80">Cập nhật trạng thái đơn, vị trí xe & cảnh báo chậm SLA tức thì.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-200">
                SOC
              </div>
              <div>
                <p className="font-medium text-slate-100">Bảo mật & phân quyền</p>
                <p className="text-[11px] text-slate-300/80">Chỉ admin nội bộ được phép truy cập, phiên đăng nhập hết hạn tự động.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-[11px] text-slate-400">
            <span>© {new Date().getFullYear()} FleetOps</span>
            <span className="opacity-70">Internal use only · Logged & audited</span>
          </div>
        </div>

        {/* Right column: interactive login card. */}
        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-7 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <svg
                    className="h-5 w-5"
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">FleetOps Admin</p>
                  <p className="text-sm font-medium text-slate-50">Đăng nhập bảng điều hành</p>
                </div>
              </div>

              <Link href="/" className="text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:underline">
                Về trang chủ
              </Link>
            </div>

            <p className="mb-4 text-xs text-slate-400">
              Chỉ sử dụng tài khoản do FleetOps cấp. Mọi hoạt động đăng nhập sẽ được ghi log.
            </p>

            {errorMessage ? (
              <p className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
                {errorMessage}
              </p>
            ) : null}

            <form action={authenticate} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-slate-200">
                  Email đăng nhập
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="dispatch@fleetops.vn"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-slate-200">
                    Mật khẩu
                  </label>
                  <span className="text-[11px] text-slate-400">Liên hệ IT nếu quên mật khẩu</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-accent focus:ring-2 focus:ring-accent/40"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition hover:translate-y-[0.5px] hover:brightness-105 active:translate-y-[1px]"
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

            <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
              <span>© {new Date().getFullYear()} FleetOps</span>
              <Link href="/admin" className="font-medium text-accent hover:underline">
                Vào dashboard (nếu đã đăng nhập)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
