import { StatCard } from "@/components/cards/stat-card";

type BookingStatus = "En route" | "Scheduled" | "Completed" | "Delayed";

const stats = [
  {
    title: "Đơn hoàn tất hôm nay",
    value: "312",
    trend: { label: "+9.4% so với hôm qua", variant: "positive" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-accent/10 p-2 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="m9 9 2 2 4-4" />
      </svg>
    ),
    action: (
      <button
        type="button"
        className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
      >
        SLA 98%
      </button>
    ),
  },
  {
    title: "Doanh thu ngày",
    value: "₫864,200,000",
    trend: { label: "+12.7%", variant: "positive" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-emerald-500/10 p-2 text-emerald-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />
      </svg>
    ),
    action: (
      <span className="text-xs font-medium text-muted-foreground">Mục tiêu: ₫1.2B</span>
    ),
  },
  {
    title: "Tài xế đang hoạt động",
    value: "86",
    trend: { label: "8 đang chờ cuốc", variant: "neutral" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-sky-500/10 p-2 text-sky-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10 2 2 7l8 5 8-5-8-5Z" />
        <path d="m2 17 8 5 8-5" />
        <path d="m2 12 8 5 8-5" />
      </svg>
    ),
    action: (
      <span className="text-xs font-medium text-muted-foreground">Online 24h: 132</span>
    ),
  },
  {
    title: "Tỷ lệ đúng giờ",
    value: "96.3%",
    trend: { label: "-0.4 pts", variant: "negative" as const },
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-rose-500/10 p-2 text-rose-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <path d="m7 19 2.75-2.75" />
      </svg>
    ),
    action: (
      <button
        type="button"
        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Xem SLA
      </button>
    ),
  },
] as const;

const quickActions = [
  {
    title: "Tạo đơn thủ công",
    description: "Nhập lịch trình đặc biệt hoặc hợp đồng công ty.",
    hotkey: "C",
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-accent/10 p-2 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    title: "Điều xe nhanh",
    description: "Giao chuyến cho tài xế gần nhất trong 60 giây.",
    hotkey: "D",
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-emerald-500/10 p-2 text-emerald-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m5 12 7-7 7 7" />
        <path d="M5 19h14" />
      </svg>
    ),
  },
  {
    title: "Gửi thông báo khách",
    description: "Broadcast tình trạng chuyến đi qua SMS/Email.",
    hotkey: "B",
    icon: (
      <svg
        className="h-10 w-10 rounded-full bg-amber-500/10 p-2 text-amber-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 3h18v13H3z" />
        <path d="M3 8h18" />
        <path d="m3 21 4-4" />
      </svg>
    ),
  },
] as const;

const latestBookings: Array<{
  bookingId: string;
  rider: string;
  route: string;
  vehicle: string;
  status: BookingStatus;
  pickupTime: string;
  fare: string;
}> = [
  {
    bookingId: "HB-10924",
    rider: "Nguyễn Thảo",
    route: "Sân bay Nội Bài → Keangnam",
    vehicle: "SUV",
    status: "En route",
    pickupTime: "09:30",
    fare: "₫1,050,000",
  },
  {
    bookingId: "HB-10923",
    rider: "Le Minh Tuấn",
    route: "Times City → Nội Bài",
    vehicle: "Sedan",
    status: "Scheduled",
    pickupTime: "10:15",
    fare: "₫620,000",
  },
  {
    bookingId: "HB-10922",
    rider: "Dang Thi Hoa",
    route: "Vinhomes Ocean Park → Nội Bài",
    vehicle: "MPV",
    status: "Completed",
    pickupTime: "08:10",
    fare: "₫780,000",
  },
  {
    bookingId: "HB-10921",
    rider: "Pham Hoang",
    route: "Royal City → Sun Grand City",
    vehicle: "Sedan",
    status: "Delayed",
    pickupTime: "07:55",
    fare: "₫410,000",
  },
  {
    bookingId: "HB-10920",
    rider: "Pham Quynh",
    route: "Sheraton Hanoi → Sân bay Nội Bài",
    vehicle: "Luxury",
    status: "Completed",
    pickupTime: "06:45",
    fare: "₫1,480,000",
  },
];

const operationsFeed = [
  {
    title: "Đặt xe doanh nghiệp",
    description: "Viettel Logistics yêu cầu 2 xe 16 chỗ cho tuyến HN → HP.",
    time: "5 phút trước",
    badge: "Ưu tiên",
  },
  {
    title: "Tài xế cập nhật trạng thái",
    description: "Trần Văn Bảy chuyển sang 'Đang đợi khách' tại Keangnam.",
    time: "12 phút trước",
    badge: "Điều phối",
  },
  {
    title: "Phản hồi 5★",
    description: "Khách hàng Huyền Trân đánh giá tài xế Tuấn Anh 5 sao.",
    time: "30 phút trước",
    badge: "CSKH",
  },
  {
    title: "Cảnh báo kẹt xe",
    description: "Trục Võ Chí Công chậm 18 phút, đề xuất đổi lộ trình.",
    time: "45 phút trước",
    badge: "Cảnh báo",
  },
] as const;

const serviceInsights = [
  {
    title: "Thời gian chờ trung bình",
    value: "7.4 phút",
    trend: "-1.6 phút",
    context: "Mục tiêu < 8 phút",
    variant: "positive" as const,
  },
  {
    title: "Chỉ số CSAT",
    value: "4.84 / 5",
    trend: "+0.12",
    context: "Dựa trên 328 đánh giá tuần này",
    variant: "positive" as const,
  },
  {
    title: "Đơn cần hỗ trợ",
    value: "6",
    trend: "3 mới",
    context: "Đội CSKH đang xử lý",
    variant: "negative" as const,
  },
] as const;

const driverAvailability = {
  active: 86,
  total: 120,
  utilizationLabel: "72%",
  utilizationClass: "w-[72%]",
  hotspots: [
    { area: "Nội Bài", eta: "3 phút", supply: "12 xe" },
    { area: "Kim Mã", eta: "6 phút", supply: "8 xe" },
    { area: "Mỹ Đình", eta: "4 phút", supply: "11 xe" },
  ],
} as const;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-foreground">Dashboard</span>
        <span aria-hidden>/</span>
        <span className="text-muted-foreground">Realtime booking control</span>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-3">
        {quickActions.map((action) => (
          <button
            key={action.title}
            type="button"
            className="group flex items-center gap-4 rounded-2xl border border-dashed border-accent/30 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
          >
            {action.icon}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
              ⌘{action.hotkey}
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Đơn mới nhất</h2>
              <p className="text-sm text-muted-foreground">Theo dõi hành trình và trạng thái realtime.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Xuất Excel
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-semibold">Mã đơn</th>
                  <th className="px-6 py-3 font-semibold">Khách hàng</th>
                  <th className="px-6 py-3 font-semibold">Lộ trình</th>
                  <th className="px-6 py-3 font-semibold">Loại xe</th>
                  <th className="px-6 py-3 font-semibold">Trạng thái</th>
                  <th className="px-6 py-3 font-semibold">Giờ đón</th>
                  <th className="px-6 py-3 font-semibold">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latestBookings.map((booking) => (
                  <tr key={booking.bookingId} className="transition hover:bg-muted/40">
                    <td className="px-6 py-3 font-medium text-foreground">{booking.bookingId}</td>
                    <td className="px-6 py-3 text-muted-foreground">{booking.rider}</td>
                    <td className="px-6 py-3 text-muted-foreground">{booking.route}</td>
                    <td className="px-6 py-3 text-muted-foreground">{booking.vehicle}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          booking.status === "Completed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : booking.status === "En route"
                              ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                              : booking.status === "Scheduled"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{booking.pickupTime}</td>
                    <td className="px-6 py-3 text-muted-foreground">{booking.fare}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Hoạt động gần đây</h2>
            <p className="text-sm text-muted-foreground">Cập nhật điều phối và phản hồi khách hàng.</p>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {operationsFeed.map((activity) => (
              <div key={activity.title} className="relative rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="absolute -left-6 top-5 hidden h-3 w-3 rounded-full bg-accent lg:block" aria-hidden />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{activity.description}</p>
                <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  {activity.badge}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {serviceInsights.map((insight) => (
          <article
            key={insight.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{insight.context}</p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">{insight.title}</h3>
            <p className="mt-4 text-3xl font-semibold text-foreground">{insight.value}</p>
            <p
              className={`mt-2 text-sm font-semibold ${
                insight.variant === "positive"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : insight.variant === "negative"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
              }`}
            >
              {insight.trend}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Dự báo nhu cầu 24h</h2>
              <p className="text-sm text-muted-foreground">Kết nối BI để hiển thị heatmap nhu cầu theo quận.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Tải dữ liệu CSV
            </button>
          </div>
          <div className="h-64 rounded-xl border border-dashed border-border bg-muted/40" aria-hidden>
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart placeholder (kết nối Superset/Metabase)
            </p>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tài xế & khu vực nóng</h2>
            <p className="text-sm text-muted-foreground">Theo dõi cung - cầu theo thời gian thực.</p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tài xế đang chạy</p>
              <p className="text-2xl font-semibold text-foreground">
                {driverAvailability.active}
                <span className="ml-2 text-sm text-muted-foreground">/ {driverAvailability.total}</span>
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tỷ lệ sử dụng</p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className={`h-2 rounded-full bg-accent ${driverAvailability.utilizationClass}`} aria-hidden />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Sử dụng hiện tại {driverAvailability.utilizationLabel} (mục tiêu ≥ 70%).</p>
            </div>
            <div className="space-y-2">
              {driverAvailability.hotspots.map((spot) => (
                <div
                  key={spot.area}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{spot.area}</p>
                    <p className="text-xs text-muted-foreground">{spot.supply}</p>
                  </div>
                  <span className="text-xs font-semibold text-accent">ETA {spot.eta}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
