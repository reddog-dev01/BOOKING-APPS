# Booking Platform Monorepo

> Monorepo pnpm quản lý toàn bộ dịch vụ đặt chỗ (Next.js web, NestJS API, Prisma). Tài liệu này giúp bạn khởi động dự án nhanh chóng và đảm bảo Google Maps/Places API key luôn sạch, đúng restriction.

## 1. Tổng quan kiến trúc

| Thư mục | Mô tả |
| --- | --- |
| `apps/web` | Frontend Next.js cho khách hàng (Route Handlers + Server Actions, AddressInput sử dụng Google Places Autocomplete). |
| `apps/api` | API NestJS (pricing, booking, phương tiện). |
| `apps/admin` | Trang quản trị Next.js. |
| `packages/db` | Prisma schema + migration/seed. |
| `packages/ui` | Thư viện UI dùng chung. |
| `infra`, `scripts`, `docs` | Hạ tầng, tooling, tài liệu vận hành. |

Cấu hình TypeScript strict + ESM, pnpm workspace, ESLint + Prettier.

## 2. Yêu cầu hệ thống

- Node.js 20 LTS
- pnpm 8+
- Docker & Docker Compose (chạy Postgres và reverse proxy)
- Google Cloud project `GGMAPS` (`ID: ggmaps-476813`, `Number: 886636766361`)

## 3. Thiết lập lần đầu

```bash
# Clone repo
 git clone <REPO_URL>
 cd BOOKING-APPS

# Cài đặt phụ thuộc
 pnpm install

# Khởi chạy hạ tầng cơ bản (Postgres, Caddy)
 docker compose up -d
```

### 3.1. Tạo file môi trường

Chạy script để tạo bản sao `.env.example` nếu chưa có:

```bash
cp -n .env.example .env
pnpm exec turbo run generate:env --filter=web --filter=api 2>/dev/null || true
```

Các file cần cập nhật thủ công sau khi có key:

- `./.env`
- `apps/web/.env.local`
- `apps/admin/.env.local`
- `apps/api/.env`

## 4. Tạo Google Maps/Places API key mới

### 4.1. Chuẩn bị dự án Google Cloud

1. Đăng nhập Google Cloud Console bằng tài khoản công ty.
2. Chọn project **GGMAPS** (ID `ggmaps-476813`). Nếu chưa thấy, yêu cầu DevOps cấp quyền Viewer + API Keys Admin.
3. Đảm bảo billing account đã gắn, nếu chưa hãy kích hoạt trước khi tạo key (tab **Billing**).

### 4.2. Bật dịch vụ cần thiết

Trong Cloud Console → **APIs & Services** → **Enabled APIs & Services**:

- Maps JavaScript API
- Places API (New)
- Geocoding API (tuỳ chọn nếu cần reverse geocode)

### 4.3. Tạo key server sạch

1. Vào **APIs & Services → Credentials** → **Create Credentials → API key**.
2. Đổi tên: `places-server-dev` (hoặc theo convention team).
3. **Restrict key**:
   - **Application restrictions**: `IP addresses`. Thêm danh sách IP outbound dev/bastion.
   - **API restrictions**: hạn chế `Places API (New)` và các API REST cần thiết.
4. Lưu lại key → gán cho biến `PLACES_API_KEY`.

### 4.4. Tạo key browser sạch

1. **Create Credentials → API key** lần nữa.
2. Đổi tên: `maps-browser-dev`.
3. **Application restrictions**: `HTTP referrers`. Thêm:
   - `http://localhost:3005/*`
   - `http://127.0.0.1:3005/*`
   - Domain staging/production (nếu có).
4. **API restrictions**: chọn `Maps JavaScript API`, `Places API (New)`.
5. Lưu lại key → gán `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### 4.5. Kiểm tra billing & quota

```bash
gcloud config set project ggmaps-476813
gcloud services api-keys describe "places-server-dev" \
  --format='value(restrictions.serverKeyRestrictions.allowedIps)'
```

Đảm bảo output không trống và không có IP lạ. Lặp lại với key browser để kiểm tra referrer.

## 5. Đồng bộ key vào repo

Sau khi có cặp key mới, xuất biến tạm trong shell rồi dùng script tự động cập nhật tất cả `.env`:

```bash
export PLACES_API_KEY="<KEY_SERVER_MOI>"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="<KEY_BROWSER_MOI>"

# Port dev thực tế (mặc định 3005, fallback 3000/3008)
WEB_PORT=3005 pnpm apply:google-keys
pnpm check:google-keys

unset PLACES_API_KEY NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Script `apply:google-keys` sẽ:

- Sao chép `.env.example` nếu thiếu
- Cập nhật `PLACES_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_REFERER`
- Đồng bộ file gốc `./.env`

`check:google-keys` xác nhận tất cả file `.env` khớp giá trị bạn vừa export. Nếu muốn chặn key cũ bị dùng lại, export thêm `GOOGLE_KEY_DENYLIST` trước khi chạy.

## 6. Smoke test

```bash
# Chạy web dev (foreground)
pnpm --filter web dev
```

Mở terminal khác:

```bash
WEB_PORT=3005
curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

- HTTP 200 + JSON `predictions` → OK
- HTTP 503 tiếng Việt → thiếu/sai `PLACES_API_KEY` hoặc billing chưa bật
- HTTP 403 `BILLING_DISABLED` → bật billing, chờ cache 10 phút rồi restart

## 7. Kiểm tra AddressInput UI

1. Mở trang chứa component `AddressInput` (`apps/web/components/AddressInput.tsx`).
2. Nhập "Ho Chi Minh City".
3. DevTools → **Network** filter `places` để xác nhận `POST /api/places/autocomplete` trả 200 và backend forward tới `https://places.googleapis.com/v1/places:autocomplete`.
4. Nếu gặp `RefererNotAllowedMapError`, cập nhật restriction cho key browser.

## 8. Quy trình xoay key định kỳ

1. Tạo hai key mới theo mục 4.
2. Cập nhật restriction và kiểm tra billing/quota.
3. Chạy script ở mục 5 để đồng bộ `.env`.
4. Commit thay đổi `.env` (nếu được phép) và thông báo cho team. Nếu không commit `.env`, gửi hash SHA-256 của key để mọi người đối chiếu:

```bash
printf '%s' "$PLACES_API_KEY" | sha256sum
printf '%s' "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" | sha256sum
```

5. Gỡ hoặc revoke key cũ sau khi mọi dịch vụ xác nhận hoạt động.

## 9. Chạy toàn bộ stack phát triển

```bash
pnpm run dev
```

Lệnh trên khởi chạy song song các workspace theo cấu hình `turbo.json`. Xem log từng app bằng `pnpm --filter <app> dev`.

## 10. Tài liệu bổ sung

- [docs/places-troubleshooting-runbook.md](./docs/places-troubleshooting-runbook.md) – Runbook xử lý sự cố Google Places.
- `infra/` – Manifest cơ sở hạ tầng (Terraform, Kubernetes).
- `scripts/` – Script hỗ trợ DevOps (sao lưu DB, rotate key).

Giữ README này cập nhật sau mỗi lần thay đổi quy trình Google Maps/Places để đảm bảo mọi người có thể tạo key sạch và deploy an toàn.
