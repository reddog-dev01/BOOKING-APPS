# Monorepo Nền tảng Đặt chỗ

Kho mã này chứa toàn bộ dịch vụ của nền tảng đặt chỗ:

- `apps/api` – API NestJS xử lý giá, đặt chỗ, cấu hình và quản lý phương tiện.
- `apps/web` – Frontend Next.js phục vụ khách hàng.
- `apps/admin` – Bảng điều khiển quản trị (chạy bằng pnpm).
- `packages/db` – Schema Prisma và script seed dùng chung.

Tất cả package dùng chung TypeScript và pnpm workspaces.

## Cài đặt phụ thuộc

```bash
pnpm install
```

> [!NOTE]
> pnpm v10 chặn các package có postinstall/build script cho tới khi được whitelist rõ ràng. `.npmrc` của workspace đã cho phép các bước build Prisma, NestJS, Sharp... để `pnpm install` và quá trình build Docker có thể chạy `prisma generate` và các bước chuẩn bị cần thiết tự động.

## Khởi động nhanh kiểu production bằng Docker

Repository cung cấp `docker-compose.yml` đa dịch vụ và Dockerfile riêng cho API/web. Kiến trúc này phản ánh môi trường production: mỗi service build qua multi-stage Dockerfile, chạy bằng user không phải root và được phối hợp cùng Postgres + Caddy.

1. **Chuẩn bị file môi trường**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   cp apps/web/.env.local.example apps/web/.env.local
   cp apps/admin/.env.local.example apps/admin/.env.local
   ```

   Cập nhật các file này bằng secret thật (API key, DATABASE_URL...). API và web container đều đọc `apps/api/.env`, vì vậy Google Places key dùng cho **server** (`PLACES_API_KEY`) được chia sẻ giữa NestJS và server component của Next.js. Với frontend, dùng **riêng** một key bị giới hạn HTTP referrer cho `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` trong `apps/web/.env.local` và `apps/admin/.env.local`.

   Proxy Places trong web app sẽ fallback về các file `.env` nếu biến môi trường tiến trình trống, giúp tránh `503 Service Unavailable` khi quên `export PLACES_API_KEY` trước khi chạy `pnpm --filter web dev`. Tuy nhiên hãy giữ biến shell đồng bộ để Docker, script cục bộ và test runner đều lấy đúng credential. Nếu proxy trả về `503` với nội dung `Google Places yêu cầu bật Billing cho dự án chứa API key`, nghĩa là dự án Google Cloud chưa bật billing—làm theo phần xử lý sự cố bên dưới rồi đợi hết khoảng 10 phút circuit breaker.

  Checklist trong [`docs/google-key-verification.md`](docs/google-key-verification.md) hướng dẫn xác thực rằng mọi service (.env, Docker Compose, container đang chạy) đều nhận cùng một key.

  > [!IMPORTANT]
  > Sau khi xóa key cũ, bạn **phải** tạo hai key mới hoàn toàn (server & browser) rồi cập nhật vào tất cả file `.env`. Mục dưới đây mô tả chi tiết từng bước bằng tiếng Việt.

  ### Lộ trình tạo mới hai key Google (server & browser)

  1. **Chuẩn bị dự án Google Cloud**

     ```bash
     export PROJECT_ID="<project-id-cua-ban>"
     gcloud config set project "$PROJECT_ID"

     # Đảm bảo dự án đã liên kết billing trước khi tiếp tục.
     gcloud beta billing projects describe "$PROJECT_ID" \
       --format='value(billingAccountName)'
     ```

     Nếu lệnh cuối trả về rỗng, hãy vào [Google Cloud Billing](https://console.cloud.google.com/billing/projects) và gán dự án với tài khoản thanh toán rồi chạy lại.

  2. **Bật các API cần thiết**

     ```bash
     gcloud services enable \
       maps-backend.googleapis.com \
       places.googleapis.com \
       geocoding-backend.googleapis.com \
       --project="$PROJECT_ID"
     ```

  3. **Tạo key server cho backend (`PLACES_API_KEY`)**

     ```bash
     gcloud beta services api-keys create \
       --project="$PROJECT_ID" \
       --display-name="places-server-dev" \
       --api-target="service=places.googleapis.com"

     export PLACES_KEY_NAME=$(gcloud services api-keys list \
       --project="$PROJECT_ID" \
       --filter='displayName=places-server-dev' \
       --sort-by='~createTime' \
       --limit=1 \
       --format='value(name)')

     export PLACES_KEY=$(gcloud services api-keys get-key-string "$PLACES_KEY_NAME" \
       --project="$PROJECT_ID" \
       --format='value(keyString)')
     echo "PLACES_API_KEY=$PLACES_KEY"
     ```

     `PLACES_KEY_NAME` có dạng `projects/<PROJECT_ID>/locations/global/keys/<uid>` và là giá trị bạn dùng cho mọi lệnh describe/upd
ate. Nếu tạo nhiều key cùng display name, hãy xoá key cũ để tránh nhầm lẫn.

     Giới hạn key theo IP outbound của server/dev box:

     ```bash
     ALLOWED_IPS="<ip-cong-khai-cua-ban>/32"
     gcloud beta services api-keys update "$PLACES_KEY_NAME" \
       --project="$PROJECT_ID" \
       --allowed-ips="$ALLOWED_IPS" \
       --api-target="service=places.googleapis.com"
     ```

  4. **Tạo key browser cho Maps JavaScript (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)**

     ```bash
     gcloud beta services api-keys create \
       --project="$PROJECT_ID" \
       --display-name="maps-js-browser-dev" \
       --api-target="service=maps-backend.googleapis.com" \
       --api-target="service=places.googleapis.com"

     export MAPS_JS_KEY_NAME=$(gcloud services api-keys list \
       --project="$PROJECT_ID" \
       --filter='displayName=maps-js-browser-dev' \
       --sort-by='~createTime' \
       --limit=1 \
       --format='value(name)')

     export MAPS_JS_KEY=$(gcloud services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
       --project="$PROJECT_ID" \
       --format='value(keyString)')
     echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY"
     ```

     Giới hạn referrer khớp với origin dev & production bạn dùng:

     ```bash
     gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
       --project="$PROJECT_ID" \
       --allowed-referrers="http://localhost:3005/*,http://127.0.0.1:3005/*,http://localhost:3000/*,http://127.0.0.1:3000/*,http://localhost:3008/*,http://127.0.0.1:3008/*,https://<domain-production>/*" \
       --api-target="service=maps-backend.googleapis.com" \
       --api-target="service=places.googleapis.com"
     ```

  5. **Ghi key vào các file `.env`**

     Điền hai giá trị vừa tạo vào toàn bộ entry point:

     ```bash
     cat <<EOF > apps/api/.env
     PORT=3006
     CORS_ORIGINS=http://localhost:3005,http://127.0.0.1:3005
     RL_MAX=120
     RL_WINDOW=1 minute
     RL_ALLOWLIST=
     PLACES_API_KEY=$PLACES_KEY
     DATABASE_URL=postgresql://booking:secret@db:5432/booking?schema=public
     EOF

     cat <<EOF > apps/web/.env
     PLACES_API_KEY=$PLACES_KEY
     EOF

     cat <<EOF > apps/web/.env.local
     PLACES_API_KEY=$PLACES_KEY
     NEXT_PUBLIC_API_BASE=http://127.0.0.1:3006
     INTERNAL_API_BASE=http://127.0.0.1:3006
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY
     NEXT_PUBLIC_QUOTE_PATH=/pricing/quote
     NEXT_PUBLIC_BOOKINGS_PATH=/bookings
     EOF

     cat <<EOF > apps/admin/.env.local
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY
     EOF
     ```

     Sau khi cập nhật, restart các service để container/process nạp giá trị mới:

     ```bash
     docker compose up -d --force-recreate api web
     pnpm --filter web dev
     ```

  6. **Nạp Maps JavaScript SDK và khởi tạo widget Autocomplete**

     Ở layer frontend, nhúng script ngay trong layout (hoặc component gốc) với browser key vừa tạo:

     ```tsx
     // apps/web/app/layout.tsx
     import Script from "next/script";

     export default function RootLayout({ children }: { children: React.ReactNode }) {
       return (
         <html lang="vi">
           <body>
             <Script
               id="google-maps"
               strategy="afterInteractive"
               src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&language=vi`}
             />
             {children}
           </body>
         </html>
       );
     }
     ```

     Khi script có mặt, tạo widget trong client component:

     ```tsx
     // apps/web/components/LocationAutocomplete.tsx
     "use client";

     import { useEffect, useRef } from "react";

     export function LocationAutocomplete(props: React.InputHTMLAttributes<HTMLInputElement>) {
       const inputRef = useRef<HTMLInputElement | null>(null);

       useEffect(() => {
         if (!inputRef.current || typeof window === "undefined" || !window.google?.maps?.places) {
           return;
         }

         const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
           fields: ["place_id", "formatted_address", "geometry", "name"],
           componentRestrictions: { country: ["vn"] },
         });

         autocomplete.addListener("place_changed", () => {
           const place = autocomplete.getPlace();
           // TODO: xử lý dữ liệu place (ví dụ set form state hoặc gọi API)
         });

         return () => {
           google.maps.event.clearInstanceListeners(autocomplete);
         };
       }, []);

       return <input ref={inputRef} {...props} />;
     }
     ```

     Nếu Chrome DevTools hiển thị `RefererNotAllowedMapError`, mở Google Cloud Console và bổ sung origin vừa dùng vào danh sách referrer ở bước 4.

  7. **Smoke test cả proxy lẫn widget**

     - Proxy REST: mở terminal mới, thay `WEB_PORT` bằng port Next.js dev log in ra (mặc định 3005, fallback 3000/3008):

       ```bash
       WEB_PORT=3005
       curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
         -H 'content-type: application/json' \
         -d '{"input":"ho chi"}'
       ```

       HTTP 200 nghĩa là server key hoạt động. HTTP 503 với thông báo tiếng Việt → thiếu billing hoặc sai `PLACES_API_KEY`.

     - Widget: truy cập trang có `LocationAutocomplete`, nhập một địa điểm và chọn gợi ý. Nếu không xuất hiện gợi ý, kiểm tra tab Network (request `maps/api/js`) và Console để xem restriction referrer.

  Các bước trên đảm bảo cả backend (`PLACES_API_KEY`) lẫn frontend (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) cùng hoạt động với credential mới. Khi rotate key trong tương lai, lặp lại toàn bộ quy trình để tránh sót restriction.

  **Vị trí tiêu thụ các biến**

  - `apps/web/lib/server/googlePlacesRest.ts` gắn `PLACES_API_KEY` vào header `X-Goog-Api-Key` cho REST call `/api/places/autocomplete` và `/api/places/details`.
  - `apps/web/Dockerfile` expose `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` cho bundle trình duyệt để load Maps JavaScript SDK.
  - `apps/api/src/infra/maps/map.util.ts` tái sử dụng server key cho các luồng NestJS gọi trực tiếp Google.

  Nếu các file trên lấy sai key, hãy kiểm tra lại `.env` hoặc override trong Docker Compose.

  > 💡 Google Places yêu cầu bật billing cho dự án chứa key. Nếu gặp thông điệp `This API method requires billing to be enabled`, hãy vào [Google Cloud Billing](https://console.cloud.google.com/billing) để liên kết dự án rồi thử lại. Proxy Places cache lỗi billing trong 10 phút; hãy restart dev server hoặc đợi cache hết hạn sau khi bật billing.

  ### Xác minh key và xử lý 403/503

  1. **Restriction khớp môi trường đang chạy** – Trong Google Cloud Console hoặc qua CLI:

     ```bash
     gcloud services api-keys describe "$PLACES_KEY_NAME" \
       --project="$PROJECT_ID" \
       --format='get(restrictions.serverKeyRestrictions.allowedIps)'

     gcloud services api-keys describe "$MAPS_JS_KEY_NAME" \
       --project="$PROJECT_ID" \
       --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'
     ```

     Đảm bảo IP dev box và toàn bộ origin dev (`http://localhost:3005/*`, `http://127.0.0.1:3005/*`, các port fallback bạn dùng như `3000`, `3008`) đã nằm trong allow-list.

  2. **Billing đang bật** – Nếu billing chưa liên kết, Google trả HTTP 403 `BILLING_DISABLED`:

     ```bash
     gcloud beta billing projects describe "$PROJECT_ID" \
       --format='value(billingAccountName)'
     ```

     Lệnh phải trả về ID tài khoản thanh toán. Nếu rỗng, hãy liên kết billing rồi chờ tối đa 10 phút.

  3. **Kiểm tra proxy server-to-server** – Lặp lại lệnh `curl` ở bước 7. HTTP 200 chứng tỏ `PLACES_API_KEY` hợp lệ. HTTP 503 với thông điệp tiếng Việt nghĩa là thiếu/sai key hoặc billing chưa bật.

  4. **Kiểm tra widget client-side** – Mở trang có Autocomplete, quan sát Network request tới `maps/api/js` và console. `RefererNotAllowedMapError` hoặc `Google has disabled use of the Places API for this application` → cập nhật restriction ở bước 1.

  5. **(Tuỳ chọn) Hash so sánh** – Dùng hash để xác nhận container nhận đúng key mà không cần in giá trị thật:

     ```bash
     printf '%s' "$PLACES_KEY" | sha256sum
     docker compose exec web sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
     docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
     ```

2. **Build container**

   ```bash
docker compose build api web
   ```

3. **Khởi động stack**

   ```bash
docker compose up -d db api web
   ```

   API sẽ lắng nghe `http://127.0.0.1:3006`, frontend tại `http://127.0.0.1:3005`. Nếu cần reverse proxy hợp nhất trên port 80, chạy thêm Caddy:

   ```bash
docker compose up -d caddy
   ```

   Caddy lắng nghe `http://127.0.0.1:80` và `https://127.0.0.1:443`, forward `/api/*` tới NestJS, còn lại gửi tới Next.js.

4. **Kiểm tra health**

   ```bash
   curl -i http://127.0.0.1:3006/healthz
   curl -I http://127.0.0.1:3005
   ```

5. **(Tuỳ chọn) Bật HTTPS qua Caddy**

   Nếu public stack hoặc cần test HTTPS, giữ Caddy chạy và cập nhật `NEXT_PUBLIC_API_BASE`, `CORS_ORIGINS` sang domain HTTPS khi đi qua proxy.
