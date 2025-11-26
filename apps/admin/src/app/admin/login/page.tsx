import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "admin-auth";
const EIGHT_HOURS_IN_SECONDS = 60 * 60 * 8;

type SearchParams = {
  error?: string;
  redirectTo?: string;
};

// Server action: validates credentials against env secrets, issues a scoped session cookie, then redirects.
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
    secure: process.env.NODE_ENV === "production",
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
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirectTo || "/admin";
  const errorType = resolvedSearchParams?.error;

  let errorMessage: string | null = null;
  if (errorType === "missing") {
    errorMessage = "Vui lòng nhập đầy đủ email và mật khẩu.";
  } else if (errorType === "invalid") {
    errorMessage = "Email hoặc mật khẩu không chính xác.";
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-x-10 top-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-10 bottom-24 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-5xl rounded-[28px] border border-white/5 bg-white/5 p-6 shadow-2xl shadow-black/50 backdrop-blur-3xl md:p-8">
        <div className="grid gap-8 md:grid-cols-[1.1fr,1fr]">
          <div className="hidden flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-inner shadow-black/30 md:flex">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                FLEETOPS ADMIN
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-50">Đăng nhập bảng điều hành</h1>
                <p className="text-sm text-slate-300/85">
                  Chỉ sử dụng tài khoản do FleetOps cấp. Mọi hoạt động đăng nhập sẽ được ghi log và kiểm tra quyền truy cập.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-200/90">
              <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 shadow-inner shadow-black/15">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                <div>
                  <p className="font-medium">Giám sát đơn & đội xe</p>
                  <p className="text-xs text-slate-300/80">Theo dõi trạng thái đơn, vị trí tài xế và SLA theo thời gian thực.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 shadow-inner shadow-black/15">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden />
                <div>
                  <p className="font-medium">Cảnh báo & ưu tiên</p>
                  <p className="text-xs text-slate-300/80">Nhận cảnh báo chậm trễ, tắc đường và ưu tiên tuyến quan trọng.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 shadow-inner shadow-black/15">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
                <div>
                  <p className="font-medium">Bảo mật & phân quyền</p>
                  <p className="text-xs text-slate-300/80">Chỉ admin nội bộ được cấp quyền, mọi phiên đăng nhập được ghi nhật ký.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-[11px] text-slate-400">
              <span>© {currentYear} FleetOps</span>
              <Link href="/" className="font-medium text-slate-300 hover:text-slate-100 hover:underline">
                Về trang chủ
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-[460px] rounded-3xl border border-white/10 bg-slate-950/85 p-6 shadow-xl shadow-black/40 backdrop-blur-2xl md:p-8">
              <div className="mb-6 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Bảng điều hành FleetOps
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-slate-50">Đăng nhập điều hành</h2>
                  <p className="text-sm text-slate-400">Chỉ dành cho tài khoản nội bộ được ủy quyền.</p>
                </div>
              </div>

              {errorMessage ? (
                <div
                  className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100"
                  aria-live="polite"
                >
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-rose-300" aria-hidden />
                  <p>{errorMessage}</p>
                </div>
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-50 shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-slate-500"
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-50 shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-slate-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Đăng nhập
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400">
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
