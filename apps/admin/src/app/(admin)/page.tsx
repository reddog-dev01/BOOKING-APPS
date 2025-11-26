import { StatCard } from "@/components/cards/stat-card";

type BookingStatus = "En route" | "Scheduled" | "Completed" | "Delayed";
type TrendVariant = "positive" | "negative" | "neutral";

type LatestBooking = {
  bookingId: string;
  rider: string;
  route: string;
  vehicle: string;
  status: BookingStatus;
  pickupTime: string;
  fare: string;
};

type Insight = {
  label: string;
  value: string;
  trend: string;
  trendVariant: TrendVariant;
};

type Hotspot = {
  area: string;
  demand: string;
  supply: string;
  eta: string;
};

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
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4-5" />
      </svg>
    ),
  },
  {
    title: "Doanh thu ngày",
    value: "₫864,200,000",
    trend: { label: "+12.7%", variant: "positive" as const },
    action: <span className="text-xs font-medium text-muted-foreground">Mục tiêu: ₫1.2B</span>,
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
        <path d="M12 2v20" />
        <path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 1 1 0 7H7" />
      </svg>
    ),
  },
  {
    title: "Tài xế đang hoạt động",
    value: "148",
    trend: { label: "24 tài xế đang idle", variant: "neutral" as const },
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
        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5" />
        <path d="M3 22a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
  {
    title: "Tỷ lệ đúng giờ",
    value: "96.3%",
    trend: { label: "-0.4 pts", variant: "negative" as const },
    action: (
      <button
        type="button"
        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Xem SLA chi tiết
      </button>
    ),
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
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
] as const;

const quickActions = [
  {
    title: "Điều xe nhanh",
    description: "Giao chuyến cho tài xế gần nhất trong 60 giây.",
    hotkey: "D",
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
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    ),
  },
  {
    title: "Tối ưu ghép chuyến",
    description: "Tối ưu nhiều đơn trên cùng tuyến, giảm km rỗng.",
    hotkey: "R",
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
        <path d="M21 16V8" />
        <path d="m3 12 6 6v-4a9 9 0 0 1 9-9h3" />
      </svg>
    ),
  },
  {
    title: "Chế độ giờ cao điểm",
    description: "Ưu tiên tài xế gần sân bay, bến xe giờ cao điểm.",
    hotkey: "M",
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
        <path d="M12 2v20" />
        <path d="M5 12h14" />
        <path d="M5 7h14" />
        <path d="M5 17h14" />
      </svg>
    ),
  },
] as const;

const latestBookings: LatestBooking[] = [
  {
    bookingId: "HB-21098",
    rider: "Nguyễn Thảo",
    route: "Sân bay Nội Bài → Keangnam",
    vehicle: "SUV",
    status: "En route",
    pickupTime: "09:30",
    fare: "₫1,050,000",
  },
  {
    bookingId: "HB-21097",
    rider: "Lê Minh Tuấn",
    route: "Times City → Nội Bài",
    vehicle: "Sedan",
    status: "Scheduled",
    pickupTime: "10:15",
    fare: "₫620,000",
  },
  {
    bookingId: "HB-21096",
    rider: "Đặng Thị Hoa",
    route: "Vinhomes Ocean Park → Nội Bài",
    vehicle: "MPV",
    status: "Completed",
    pickupTime: "08:10",
    fare: "₫780,000",
  },
  {
    bookingId: "HB-21095",
    rider: "Phạm Hoàng",
    route: "Royal City → Sun Grand City",
    vehicle: "Sedan",
    status: "Delayed",
    pickupTime: "07:55",
    fare: "₫410,000",
  },
  {
    bookingId: "HB-21094",
    rider: "Phạm Quỳnh",
    route: "Sheraton Hanoi → Sân bay Nội Bài",
    vehicle: "Luxury",
    status: "Completed",
    pickupTime: "06:45",
    fare: "₫1,480,000",
  },
  {
    bookingId: "HB-21093",
    rider: "Hoàng Trí",
    route: "Văn Miếu → Ciputra",
    vehicle: "Hatchback",
    status: "Scheduled",
    pickupTime: "06:10",
    fare: "₫320,000",
  },
];

const insights: Insight[] = [
  {
    label: "Tài xế online",
    value: "176/210",
    trend: "+12 so với giờ trước",
    trendVariant: "positive",
  },
  {
    label: "Tỷ lệ nhận chuyến",
    value: "92.4%",
    trend: "-1.1 pts",
    trendVariant: "negative",
  },
  {
    label: "Thời gian chờ trung bình",
    value: "6.8 phút",
    trend: "Ổn định",
    trendVariant: "neutral",
  },
  {
    label: "Đơn yêu cầu hỗ trợ",
    value: "14",
    trend: "+3 trong 30 phút",
    trendVariant: "negative",
  },
];

const hotspots: Hotspot[] = [
  { area: "Sân bay Nội Bài", demand: "Cầu tăng +18%", supply: "Thiếu 12 xe", eta: "8 phút" },
  { area: "Vinhomes Smart City", demand: "Cầu tăng +9%", supply: "Thiếu 4 xe", eta: "5 phút" },
  { area: "Times City", demand: "Cầu tăng +6%", supply: "Thiếu 3 xe", eta: "6 phút" },
  { area: "Bến xe Mỹ Đình", demand: "Cầu tăng +14%", supply: "Thiếu 7 xe", eta: "7 phút" },
];

const trendColorMap: Record<TrendVariant, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

function renderStatusBadge(status: BookingStatus): string {
  if (status === "Completed") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  }
  if (status === "En route") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200";
  }
  if (status === "Scheduled") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100";
  }
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100";
}

export default function Page() {
  return (
    <main className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground">FleetOps</span>
          <span aria-hidden>/</span>
          <span className="text-foreground">Operations</span>
          <span aria-hidden>/</span>
          <span className="text-muted-foreground">Realtime booking control</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Hệ thống điều hành chuyến xe</h1>
          <p className="text-sm text-muted-foreground">
            Giám sát trạng thái đơn, tài xế và nhu cầu theo thời gian thực.
          </p>
        </div>
      </header>

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
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
          >
            {action.icon}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">
              ⌘{action.hotkey}
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Đơn mới nhất</h2>
              <p className="text-sm text-muted-foreground">Theo dõi các đơn vừa tạo gần đây.</p>
            </div>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              defaultValue="24h"
              aria-label="Lọc thời gian đơn mới nhất"
            >
              <option value="24h">24h gần nhất</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
            </select>
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
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${renderStatusBadge(booking.status)}`}
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

        <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Hiệu suất đội xe</h2>
            <p className="text-sm text-muted-foreground">Tổng quan tải cung ứng và chất lượng vận hành.</p>
          </header>
          <div className="space-y-4">
            {insights.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <span className={`text-xs font-semibold ${trendColorMap[item.trendVariant]}`}>
                    {item.trend}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
          <div className="h-64 rounded-xl border border-dashed border-border bg-muted/40">
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart placeholder (kết nối Superset/Metabase)
            </p>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Điểm nóng cần theo dõi</h2>
            <p className="text-sm text-muted-foreground">Khu vực ưu tiên điều phối để cân bằng cung - cầu.</p>
          </div>
          <div className="space-y-3">
            {hotspots.map((spot) => (
              <div
                key={spot.area}
                className="flex items-start justify-between rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{spot.area}</p>
                  <p className="text-xs text-muted-foreground">{spot.demand} • {spot.supply}</p>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">ETA {spot.eta}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
