import { ArrowUpRight, BadgeCheck, BellRing, Car, GaugeCircle, MapPin, MoveRight, ShieldCheck, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";

type BookingStatus = "En route" | "Scheduled" | "Completed" | "Delayed";

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
  title: string;
  description: string;
  hotkey?: string;
};

type TrendVariant = "positive" | "negative" | "neutral";

type PerformanceInsight = {
  label: string;
  value: string;
  trend: string;
  trendVariant: TrendVariant;
};

const STAT_CARDS = [
  {
    title: "Chuyến đi hôm nay",
    value: "1.248",
    trend: { label: "+12.4% so với hôm qua", variant: "positive" as const },
    icon: <GaugeCircle className="h-5 w-5" />,
  },
  {
    title: "Đơn đang hoạt động",
    value: "184",
    trend: { label: "98 đang trên đường đón khách", variant: "neutral" as const },
    icon: <Car className="h-5 w-5" />,
  },
  {
    title: "Đội xe online",
    value: "312",
    trend: { label: "24 tài xế idle cần gợi ý chuyến", variant: "neutral" as const },
    icon: <BadgeCheck className="h-5 w-5" />,
  },
  {
    title: "Khiếu nại 24h",
    value: "7",
    trend: { label: "-38% vs tuần trước", variant: "positive" as const },
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const QUICK_ACTIONS = [
  {
    title: "Điều xe nhanh",
    description: "Giao chuyến cho tài xế gần nhất trong 60 giây.",
    hotkey: "D",
    icon: <MoveRight className="h-4 w-4" />,
  },
  {
    title: "Tối ưu ghép chuyến",
    description: "Tối ưu nhiều đơn trên cùng tuyến, giảm km rỗng.",
    hotkey: "R",
    icon: <ArrowUpRight className="h-4 w-4" />,
  },
  {
    title: "Chế độ giờ cao điểm",
    description: "Ưu tiên tài xế gần sân bay, bến xe giờ cao điểm.",
    hotkey: "M",
    icon: <BellRing className="h-4 w-4" />,
  },
];

const LATEST_BOOKINGS: LatestBooking[] = [
  {
    bookingId: "#FO-28491",
    rider: "Nguyễn Văn A",
    route: "Q1 → Tân Sơn Nhất",
    vehicle: "Sedan · TX-102",
    status: "En route",
    pickupTime: "10:24",
    fare: "185.000đ",
  },
  {
    bookingId: "#FO-28490",
    rider: "Trần Thị B",
    route: "Thủ Đức → Q1",
    vehicle: "Bike · TX-214",
    status: "Completed",
    pickupTime: "10:18",
    fare: "42.000đ",
  },
  {
    bookingId: "#FO-28489",
    rider: "Lê Minh C",
    route: "Q7 → Phú Nhuận",
    vehicle: "SUV · TX-078",
    status: "Scheduled",
    pickupTime: "10:45",
    fare: "215.000đ",
  },
  {
    bookingId: "#FO-28488",
    rider: "Phạm D",
    route: "Bình Thạnh → Q3",
    vehicle: "Sedan · TX-301",
    status: "Delayed",
    pickupTime: "10:05",
    fare: "96.000đ",
  },
];

const PERFORMANCE: PerformanceInsight[] = [
  { label: "Tài xế online", value: "176/210", trend: "+12 so với giờ trước", trendVariant: "positive" },
  { label: "Tỷ lệ nhận chuyến", value: "92.4%", trend: "-1.1 pts", trendVariant: "negative" },
  { label: "Thời gian chờ", value: "6.8 phút", trend: "Ổn định", trendVariant: "neutral" },
  { label: "Đơn cần hỗ trợ", value: "14", trend: "+3 trong 30 phút", trendVariant: "negative" },
];

const INSIGHTS: Insight[] = [
  {
    title: "Tối ưu phân bổ đội xe",
    description: "Tăng 18% tỷ lệ gộp chuyến trong giờ cao điểm sáng & tối.",
    hotkey: "O",
  },
  {
    title: "Giảm thời gian đón khách",
    description: "Cụm Q1–Q3 đang giữ SLA 4 phút, có thể hạ còn 3 phút.",
    hotkey: "S",
  },
  {
    title: "Theo dõi tài xế rủi ro",
    description: "4 tài xế có ≥ 3 chuyến bị khiếu nại trong 7 ngày gần nhất.",
    hotkey: "R",
  },
];

const HOTSPOTS = [
  { area: "Sân bay Nội Bài", demand: "Cầu tăng +18%", supply: "Thiếu 12 xe", eta: "8 phút" },
  { area: "Vinhomes Smart City", demand: "Cầu tăng +9%", supply: "Thiếu 4 xe", eta: "5 phút" },
  { area: "Times City", demand: "Cầu tăng +6%", supply: "Thiếu 3 xe", eta: "6 phút" },
];

function getStatusBadgeClasses(status: BookingStatus): string {
  switch (status) {
    case "En route":
      return "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20";
    case "Scheduled":
      return "bg-sky-500/10 text-sky-600 ring-sky-500/20";
    case "Completed":
      return "bg-slate-100 text-slate-700 ring-slate-400/30";
    case "Delayed":
    default:
      return "bg-rose-500/10 text-rose-600 ring-rose-500/20";
  }
}

function trendTone(variant: TrendVariant): string {
  if (variant === "positive") return "text-emerald-600";
  if (variant === "negative") return "text-rose-600";
  return "text-muted-foreground";
}

export default function Page() {
  return (
    <main className="space-y-10">
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
        {STAT_CARDS.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.title}
            type="button"
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">{action.icon}</div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground">⌘{action.hotkey}</span>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-border bg-card shadow-soft">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Chuyến đi gần đây</h2>
              <p className="text-xs text-muted-foreground">Top 20 chuyến phát sinh trong 24 giờ gần nhất.</p>
            </div>
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              defaultValue="24h"
              aria-label="Lọc thời gian"
            >
              <option value="24h">24h gần nhất</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
            </select>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-y-1 text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Mã</th>
                  <th className="px-4 py-2">Khách</th>
                  <th className="px-4 py-2">Tuyến</th>
                  <th className="px-4 py-2">Xe</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2 text-right">Giờ đón</th>
                  <th className="px-4 py-2 text-right">Giá cước</th>
                </tr>
              </thead>
              <tbody>
                {LATEST_BOOKINGS.map((booking) => (
                  <tr
                    key={booking.bookingId}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 text-slate-800 shadow-sm [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
                  >
                    <td className="px-4 py-2 font-mono text-[11px] font-semibold text-slate-700">{booking.bookingId}</td>
                    <td className="px-4 py-2">{booking.rider}</td>
                    <td className="px-4 py-2 text-slate-600">{booking.route}</td>
                    <td className="px-4 py-2 text-slate-600">{booking.vehicle}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${getStatusBadgeClasses(
                          booking.status,
                        )}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{booking.pickupTime}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{booking.fare}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
          <header className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Hiệu suất đội xe</h2>
            <p className="text-xs text-muted-foreground">Tổng quan tải cung ứng và chất lượng vận hành.</p>
          </header>
          <div className="space-y-4">
            {PERFORMANCE.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <span className={`text-xs font-semibold ${trendTone(item.trendVariant)}`}>{item.trend}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Dự báo nhu cầu 24h</h2>
              <p className="text-xs text-muted-foreground">Kết nối BI để hiển thị heatmap nhu cầu theo quận.</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent"
            >
              Tải dữ liệu CSV
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-64 rounded-xl border border-dashed border-border bg-muted/40">
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chart placeholder (kết nối Superset/Metabase)
            </p>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Điểm nóng cần theo dõi</h2>
              <p className="text-xs text-muted-foreground">Khu vực ưu tiên điều phối để cân bằng cung - cầu.</p>
            </div>
            <MapPin className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-3">
            {HOTSPOTS.map((spot) => (
              <div key={spot.area} className="flex items-start justify-between rounded-xl border border-border bg-background/70 p-4">
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

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Insights vận hành</h2>
            <p className="text-xs text-muted-foreground">Gợi ý tối ưu từ dữ liệu 7 ngày gần đây.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
            AI assist
          </span>
        </header>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {INSIGHTS.map((insight) => (
            <li
              key={insight.title}
              className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/60 p-4 text-xs shadow-sm"
            >
              <div className="space-y-1">
                <p className="text-[13px] font-semibold text-foreground">{insight.title}</p>
                <p className="text-[11px] text-muted-foreground">{insight.description}</p>
              </div>
              {insight.hotkey ? (
                <span className="inline-flex h-7 w-min items-center rounded-full bg-card px-3 text-[10px] font-medium text-muted-foreground shadow-sm">
                  {insight.hotkey}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
