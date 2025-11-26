import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "admin-auth";
const EIGHT_HOURS_IN_SECONDS = 60 * 60 * 8;

type SearchParams = {
  error?: string;
  redirectTo?: string;
};

// Server action: validates env-based admin credentials and issues a scoped session cookie.
async function authenticate(formData: FormData) {
  "use server";

  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString().trim() ?? "";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  if (!email || !password) {
    redirect(`/admin/login?error=missing&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

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

  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // avoid secure cookie issues on localhost
    path: "/admin",
    maxAge: EIGHT_HOURS_IN_SECONDS,
  });

  redirect(redirectTo);
}

function getErrorMessage(errorType?: string): string | null {
  if (errorType === "missing") return "Vui lòng nhập đầy đủ email và mật khẩu.";
  if (errorType === "invalid") return "Email hoặc mật khẩu không chính xác.";
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirectTo || "/admin";
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute right-10 top-32 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute inset-x-8 bottom-10 h-px bg-gradient-to-r from-transparent via-accent/25 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid gap-8 md:grid-cols-[1.1fr,1fr] items-center">
          <div className="hidden h-full flex-col justify-between rounded-3xl border border-border/60 bg-white/70 p-8 shadow-xl backdrop-blur-xl md:flex">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                FLEETOPS ADMIN
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900">Đăng nhập bảng điều hành</h1>
                <p className="text-sm text-muted-foreground">
                  Chỉ sử dụng tài khoản do FleetOps cấp. Mọi hoạt động đăng nhập sẽ được ghi log và kiểm tra quyền truy cập.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-700">
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-900">Giám sát đơn & đội xe</p>
                  <p className="text-xs text-muted-foreground">Theo dõi trạng thái đơn, vị trí tài xế và SLA theo thời gian thực.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-900">Cảnh báo & ưu tiên</p>
                  <p className="text-xs text-muted-foreground">Nhận cảnh báo chậm trễ, tắc đường và ưu tiên tuyến quan trọng.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-900">Bảo mật & phân quyền</p>
                  <p className="text-xs text-muted-foreground">Chỉ admin nội bộ được cấp quyền, mọi phiên đăng nhập được ghi nhật ký.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>© {currentYear} FleetOps</span>
              <Link href="/" className="font-medium text-accent hover:underline">
                Về trang chủ
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-[460px] rounded-3xl border border-border bg-white/95 p-6 shadow-2xl backdrop-blur-xl md:p-8">
              <div className="mb-6 space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Bảng điều hành FleetOps
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-slate-900">Đăng nhập điều hành</h2>
                  <p className="text-sm text-muted-foreground">Chỉ dành cho tài khoản nội bộ được ủy quyền.</p>
                </div>
              </div>

              {errorMessage ? (
                <div
                  className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700"
                  aria-live="polite"
                >
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden />
                  <p>{errorMessage}</p>
                </div>
              ) : null}

              <form action={authenticate} className="space-y-4">
                <input type="hidden" name="redirectTo" value={redirectTo} />

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-slate-800">
                    Email đăng nhập
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="dispatch@fleetops.vn"
                    className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-medium text-slate-800">
                      Mật khẩu
                    </label>
                    <Link href="mailto:it@fleetops.vn" className="text-[11px] font-medium text-accent hover:underline">
                      Liên hệ IT nếu quên mật khẩu
                    </Link>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 placeholder:text-slate-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Đăng nhập
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>© {currentYear} FleetOps</span>
                <Link href="/admin" className="font-medium text-accent hover:underline">
                  Vào dashboard (nếu đã đăng nhập)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
