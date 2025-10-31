# Monorepo Nền tảng Đặt chỗ

> Monorepo pnpm quản lý toàn bộ dịch vụ đặt chỗ (Next.js web + admin, NestJS API, Prisma). Tài liệu này tập trung vào việc đồng bộ Google Maps/Places API key và kiểm chứng rằng tính năng nhập địa chỉ đang gọi đúng endpoint Google.

## ⚡ Checklist Google Maps/Places sau khi xoay key

| Biến | Công dụng | File cần cập nhật |
| --- | --- | --- |
| `PLACES_API_KEY` | Key server dùng cho proxy REST `/api/places/*` và API NestJS | `apps/api/.env`, `apps/web/.env*`, `apps/admin/.env.local` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Key browser dùng tải Maps JavaScript SDK & Autocomplete widget | `apps/web/.env.local*`, `apps/admin/.env.local*`, biến môi trường khi build web/admin |
| `GOOGLE_MAPS_REFERER` | Origin dev hiện tại để build script gán đúng referrer | `apps/web/.env.local*` (script tự cập nhật theo port)

> [!IMPORTANT]
> Sau khi nhận cặp key mới, luôn đi hết checklist dưới đây **trước** khi bàn giao cho người khác để tránh lỗi 403/503.

### 1. Nhận key từ DevOps và export vào shell

Đợt này đã cấp sẵn 2 key để test đồng bộ:

```bash
export PLACES_API_KEY="AIzaSyDGGWT-KId7wbuqbq9apUaXRUutjrJOkWI" # server proxy Places
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyCSEvFUuxU-eDiKIoOSCUpplHk-03JAbPo" # browser Maps SDK
```

> [!NOTE]
> Nếu DevOps gửi key mới, chỉ cần thay chuỗi tương ứng rồi chạy tiếp các bước bên dưới. Không cần tự tạo thêm key mới.

### 2. Đồng bộ mọi file `.env`

```bash
REPO_DIR=~/booking-app # sửa lại nếu bạn clone repo ở vị trí khác
cd "$REPO_DIR"

# WEB_PORT = port Next.js dev thực tế (mặc định 3005, fallback 3000/3008)
WEB_PORT=3005 pnpm apply:google-keys
pnpm check:google-keys

# Tuỳ chọn: xoá biến shell sau khi đồng bộ để tránh rò rỉ history
unset PLACES_API_KEY NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

- `apply:google-keys` tự sao chép `.env.example` nếu thiếu, cập nhật tất cả `PLACES_API_KEY`/`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`GOOGLE_MAPS_REFERER` theo biến shell hiện tại.
- `check:google-keys` đảm bảo không còn placeholder và mọi file `.env` đều mang cùng giá trị với biến shell. Nếu muốn ngăn việc dùng lại key cũ, export thêm `GOOGLE_KEY_DENYLIST="<KEY_CU_SERVER>,<KEY_CU_BROWSER>"` trước khi chạy.

Xác thực nhanh bằng grep (không in ra toàn bộ key):

```bash
rg -n "PLACES_API_KEY" apps/api/.env apps/web/.env.local apps/admin/.env.local 2>/dev/null
rg -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/web/.env.local apps/admin/.env.local 2>/dev/null
```

### 3. Smoke test proxy Google Places

```bash
pnpm --filter web dev &
sleep 5
WEB_PORT=3005 # thay bằng port dev đang log ra
curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

Kết quả mong đợi:

- HTTP 200 + JSON chứa `predictions` → OK.
- HTTP 503 cùng thông điệp tiếng Việt → thiếu/sai `PLACES_API_KEY` hoặc billing chưa bật (proxy cache lỗi billing 10 phút).
- HTTP 403 `BILLING_DISABLED` → bật billing rồi restart dev server sau vài phút.

### 4. Kiểm tra widget `AddressInput`

`AddressInput` (Next.js client component) nằm tại [`apps/web/components/AddressInput.tsx`](apps/web/components/AddressInput.tsx). Khi người dùng gõ, component:

1. Debounce input 250ms.
2. Gọi nội bộ `/api/places/autocomplete` cùng `sessionToken` (tạo bằng `crypto.randomUUID`).
3. Endpoint server (`apps/web/lib/server/googlePlacesRest.ts`) forward sang Google Places v1 với header `X-Goog-Api-Key: <PLACES_API_KEY>`.

Để xác nhận UI đang dùng key đúng:

1. Mở trang chứa `AddressInput`.
2. Gõ một địa điểm ("Ho Chi Minh City").
3. Mở DevTools → tab **Network** → filter `places`. Bạn sẽ thấy:
   - `POST /api/places/autocomplete` trả 200.
   - Request kế tiếp từ server tới `https://places.googleapis.com/v1/places:autocomplete` (xem server log nếu cần) dùng đúng key server.
4. Chọn một gợi ý, component sẽ phát `onChange` với `formattedAddress` và toạ độ.
5. Nếu không có gợi ý:
   - Xem tab **Console**: thông báo tiếng Việt báo thiếu key/billing.
   - Với lỗi `RefererNotAllowedMapError`, cập nhật restriction cho key browser (bước 1).

### 5. Xác minh restriction trên Google Cloud

Nếu có quyền Cloud Console, mô tả key theo tên do DevOps gửi (ví dụ `places-server-dev`, `maps-js-browser-dev`).

```bash
PROJECT_ID="inbound-object-476110-d5" # đổi lại nếu team cập nhật
gcloud config set project "$PROJECT_ID"

gcloud services api-keys describe "<TEN_KEY_SERVER>" \
  --format='get(restrictions.serverKeyRestrictions.allowedIps)'

gcloud services api-keys describe "<TEN_KEY_BROWSER>" \
  --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'
```

- IP outbound (Docker dev, bastion…) phải nằm trong `allowedIps`.
- Origin dev phổ biến (`http://localhost:3005/*`, `http://127.0.0.1:3005/*`, fallback `3000`/`3008`, domain production) phải có trong `allowedReferrers`.

### 6. (Tuỳ chọn) So sánh hash để chắc chắn container nhận đúng key

```bash
printf '%s' "$PLACES_API_KEY" | sha256sum
docker compose exec web sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
```

Hash giống nhau nghĩa là key trong container khớp với giá trị bạn vừa export mà không cần lộ chuỗi thật.

## Kiến trúc Google Places trong repo

- `apps/web/lib/server/googlePlacesRest.ts` tải `PLACES_API_KEY` từ biến môi trường hoặc các file `.env` (có cache, cảnh báo placeholder, circuit-breaker 10 phút cho lỗi billing) rồi forward request sang Google Places v1.
- `apps/web/app/api/places/autocomplete/route.ts` & `.../details/route.ts` sử dụng helper trên.
- `apps/web/components/AddressInput.tsx` gọi `/api/places/autocomplete` và render danh sách gợi ý.
- `apps/api/src/infra/maps/map.util.ts` tái sử dụng key server cho nhu cầu NestJS khác.

Nếu bất kỳ bước nào dùng key cũ, chạy lại `pnpm apply:google-keys` và `pnpm check:google-keys` sau khi export biến shell mới.

## Tổng quan repository

- `apps/api` – API NestJS xử lý giá, đặt chỗ, cấu hình phương tiện.
- `apps/web` – Frontend Next.js cho khách hàng.
- `apps/admin` – Bảng điều khiển quản trị.
- `packages/db` – Schema Prisma + seed.
- `packages/ui` – Component dùng chung.

Tất cả sử dụng TypeScript strict + pnpm workspaces.

### Cổng dịch vụ mặc định

| Service | Host local | Cổng process/container | Ghi chú |
| --- | --- | --- | --- |
| Postgres (`db`) | `5432` | `5432` | Chỉ mở trong dev. |
| API NestJS (`api`) | `3006` | `3006` | Next.js gọi qua `http://127.0.0.1:3006`. |
| Next.js web (`web`) | `3005` | `3000` | Script dev fallback 3000/3008 nếu 3005 bận → nhớ cập nhật `GOOGLE_MAPS_REFERER`. |
| Admin (`admin`) | `3007` | `3000` | Chỉ khi chạy `pnpm --filter admin dev`. |
| Caddy proxy | `80`, `443` | `80`, `443` | Gom API/web để test HTTPS. |

> [!TIP]
> Khi Next.js dev tự động chuyển port, chạy lại `WEB_PORT=<port> pnpm apply:google-keys` để cập nhật `GOOGLE_MAPS_REFERER` và danh sách referrer trên Google Cloud.

## Cài đặt phụ thuộc

```bash
pnpm install
```

`.npmrc` của workspace đã whitelist các postinstall cần thiết (Prisma, NestJS build, Sharp…), vì vậy `pnpm install` và quá trình build Docker có thể chạy `prisma generate` tự động.

## Test frontend (Jest)

Nếu `pnpm --filter web test -- googlePlacesRest` báo `jest: not found`, cài devDeps đầy đủ cho workspace web:

```bash
pnpm --filter web add -D jest ts-jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
pnpm --filter web add -D ts-node # chỉ khi Jest yêu cầu
pnpm install
```

- `apps/web/jest.config.ts` đặt preset `ts-jest`, alias `@/`, nạp `jest.setup.ts` (đã có sẵn).
- `apps/web/jest.setup.ts` nạp `@testing-library/jest-dom` và polyfill `TextEncoder/TextDecoder`.
- Nếu gặp `TextEncoder is not defined`, mở rộng `jest.setup.ts` (repo đã xử lý sẵn).

Tham khảo thêm tại [`docs/jest-troubleshooting-vi.md`](docs/jest-troubleshooting-vi.md).

## Khởi động production-like bằng Docker

1. **Chuẩn bị file môi trường**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   cp apps/web/.env.local.example apps/web/.env.local
   cp apps/admin/.env.local.example apps/admin/.env.local
   ```

   Điền secret thật cho `PLACES_API_KEY` (server) và `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser). Docker Compose yêu cầu cả hai biến này, thiếu sẽ lỗi ngay.

2. **Build container**

   ```bash
   docker compose build api web
   ```

3. **Khởi động stack**

   ```bash
   docker compose up -d db api web
   ```

   API: `http://127.0.0.1:3006`, frontend: `http://127.0.0.1:3005`. Nếu cần HTTPS nội bộ:

   ```bash
   docker compose up -d caddy
   ```

   Caddy forward `/api/*` tới NestJS, còn lại tới Next.js.

4. **Kiểm tra health**

   ```bash
   curl -i http://127.0.0.1:3006/healthz
   curl -I http://127.0.0.1:3005
   ```

## Tài liệu liên quan

- [`docs/google-key-verification.md`](docs/google-key-verification.md) – Checklist chi tiết xác minh key ở nhiều môi trường.
- [`docs/jest-troubleshooting-vi.md`](docs/jest-troubleshooting-vi.md) – Ghi chú cấu hình Jest.
- Prisma/DB, workflow CI/CD, guideline NestJS… sẽ được mô tả riêng trong thư mục `docs/` tương ứng.
