import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE = "admin-auth";
const EIGHT_HOURS_IN_SECONDS = 60 * 60 * 8;

type SearchParams = {
  error?: string;
  redirectTo?: string;
};

// Server action: validate env credentials and issue an HttpOnly cookie scoped to /admin
async function authenticate(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/admin");

  if (!email || !password) {
    redirect(`/admin/login?error=missing&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || email !== adminEmail || password !== adminPassword) {
    redirect(`/admin/login?error=invalid&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // Await cookies() per Next 15 API to set the scoped session flag
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // allow localhost during development
    path: "/admin",
    maxAge: EIGHT_HOURS_IN_SECONDS,
  });

  redirect(redirectTo || "/admin");
}

function getErrorMessage(error?: string) {
  if (error === "missing") return "Vui lòng nhập đầy đủ email và mật khẩu.";
  if (error === "invalid") return "Email hoặc mật khẩu không chính xác.";
  return null;
}

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const redirectTo = searchParams?.redirectTo || "/admin";
  const errorMessage = getErrorMessage(searchParams?.error);
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-slate-50 to-blue-50 px-4 py-12 text-foreground">
      {/* Decorative glows to match brand tint without harming readability */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-[-60px] bottom-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-8 rounded-[26px] border border-slate-200/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur md:grid-cols-[1.1fr,0.9fr] md:p-10">
        {/* Left column: brand narrative */}
        <div className="flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              FleetOps Admin
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">BẢNG ĐIỀU HÀNH FLEETOPS</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Chỉ sử dụng tài khoản do FleetOps cấp. Mọi hoạt động đăng nhập sẽ được ghi log và giám sát để đảm bảo an toàn vận hành.
            </p>
          </div>

          <div className="grid gap-4 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hiệu suất đội xe</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">98.4%</p>
              <p className="mt-1 text-[11px] text-slate-500">Thời gian hoạt động 30 ngày gần nhất.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">SLA xử lý đơn</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">&lt; 45 giây</p>
              <p className="mt-1 text-[11px] text-slate-500">Phản hồi trung bình từ lúc khách tạo chuyến.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giám sát an toàn</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">24/7</p>
              <p className="mt-1 text-[11px] text-slate-500">Phiên đăng nhập đều được log & cảnh báo.</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Bằng việc tiếp tục, bạn đồng ý tuân thủ quy trình vận hành nội bộ và chính sách bảo mật của FleetOps.
          </p>
        </div>

        {/* Right column: login card */}
        <div className="relative">
          <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-blue-100 blur-2xl" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-cyan-100 blur-2xl" />

          <div className="relative rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đăng nhập điều hành</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">FleetOps Admin</h2>
                <p className="text-xs text-slate-500">Chỉ dành cho tài khoản nội bộ được ủy quyền.</p>
              </div>
              <Link
                href="/"
                className="text-[12px] font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline"
              >
                Về trang chủ
              </Link>
            </div>

            {errorMessage ? (
              <div
                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                role="status"
                aria-live="polite"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" action={authenticate}>
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                  Email đăng nhập
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="dispatch@fleetops.vn"
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                    Mật khẩu
                  </label>
                  <Link href="mailto:it@fleetops.vn" className="text-xs font-medium text-blue-600 hover:text-blue-500">
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
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                  />
                  <span className="select-none">Giữ phiên đăng nhập 8 giờ</span>
                </label>
                <Link
                  href="mailto:it@fleetops.vn?subject=Yeu%20cau%20dat%20lai%20mat%20khau%20admin"
                  className="text-[11px] font-medium text-blue-600 underline-offset-2 hover:text-blue-500"
                  prefetch={false}
                >
                  Quên mật khẩu?
                </Link>
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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

            <div className="mt-6 flex items-center justify-between text-[11px] text-slate-500">
              <span>© {currentYear} FleetOps</span>
              <Link href="/admin" className="font-medium text-blue-600 hover:text-blue-500">
                Vào dashboard (nếu đã đăng nhập)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
