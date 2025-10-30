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
   > Hai key Places (server) và Maps JavaScript (browser) đã được chèn sẵn vào `.env.example` phục vụ dev. Hãy giữ restriction trong Google Cloud Console khớp với origin dev thực tế (ví dụ `http://localhost:3005/*`, `http://127.0.0.1:3005/*`, `http://localhost:3007/*`). Khi xoay vòng credential, cập nhật các file ngay để Docker và runner nhận giá trị mới.

   **Vị trí tiêu thụ các biến**

   - `apps/web/lib/server/googlePlacesRest.ts` gắn `PLACES_API_KEY` vào header `X-Goog-Api-Key` cho REST call `/api/places/autocomplete` và `/api/places/details`.
   - `apps/web/Dockerfile` expose `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` cho bundle trình duyệt để load Maps JavaScript SDK.
   - `apps/api/src/infra/maps/map.util.ts` tái sử dụng server key cho các luồng NestJS gọi trực tiếp Google.

   Nếu các file trên lấy sai key, hãy kiểm tra lại `.env` hoặc override trong Docker Compose.

   ### Tải Maps JavaScript SDK để dùng widget Places phía client

   Proxy `/api/places/*` chỉ xử lý request server-to-server. Để chạy widget Places Autocomplete trực tiếp trên trình duyệt, bạn phải nạp Maps JavaScript SDK với `libraries=places` bằng `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, rồi bind widget vào input.

   ```tsx
   // apps/web/app/layout.tsx (hoặc client component được render toàn site)
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

   Sau khi script tải xong, khởi tạo widget ở input mong muốn. Đoạn mã dưới giả định component là client component để truy cập `google.maps` toàn cục:

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
         // TODO: lưu dữ liệu place vào form hoặc gọi API
       });

       return () => {
         google.maps.event.clearInstanceListeners(autocomplete);
       };
     }, []);

     return <input ref={inputRef} {...props} />;
   }
   ```

   Đảm bảo browser key allow-list bao phủ mọi origin dev bạn dùng (`http://localhost:3005`, `http://127.0.0.1:3005`, các port fallback như `3000`/`3008`, cùng domain production). Nếu gặp `RefererNotAllowedMapError` trong console, cập nhật restriction rồi thử lại.

   `docker-compose.yml` yêu cầu các key phải được set (qua biến shell hoặc `apps/api/.env`) trước khi stack khởi động. Sau khi xoay key, rebuild container để runtime nạp giá trị mới.

   Khi sửa `.env`, restart dịch vụ để Docker cập nhật biến:

   ```bash
   docker compose up -d --force-recreate api web
   ```

   Xuất trước các biến dự án và tên resource để mọi lệnh có đủ ngữ cảnh. `gcloud beta billing projects describe` sẽ báo lỗi `could not parse resource []` nếu thiếu `PROJECT_ID`, nên hãy kiểm tra kỹ trước khi chạy tiếp.

   ```bash
   export PROJECT_ID="inbound-object-476110-d5"
   export PLACES_KEY_NAME="projects/339756545616/locations/global/keys/649d7705-6472-4b48-8605-09230a504b41"
   export MAPS_JS_KEY_NAME="projects/339756545616/locations/global/keys/3ee1a3b8-875b-4a07-b25d-c6154a06657d"
   ```

   Nếu key cũ đã bị xóa, tạo credential hoàn toàn mới trước khi populate `.env`. Các bước dưới giả định dự án đã liên kết billing.

   ```bash
   # Bật các API cần thiết
   gcloud services enable \
     maps-backend.googleapis.com \
     places.googleapis.com \
     geocoding-backend.googleapis.com \
     --project="$PROJECT_ID"

   # Tạo server key cho Places backend
   PLACES_KEY_NAME=$(gcloud beta services api-keys create \
     --project="$PROJECT_ID" \
     --display-name="places-server-dev" \
     --api-target="service=places.googleapis.com" \
     --format="value(name)")

   # Tạo browser key cho Maps JavaScript SDK (kèm Places)
   MAPS_JS_KEY_NAME=$(gcloud beta services api-keys create \
     --project="$PROJECT_ID" \
     --display-name="maps-js-browser-dev" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com" \
     --format="value(name)")

   # Lấy key string để điền vào .env
   PLACES_KEY=$(gcloud beta services api-keys get-key-string "$PLACES_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")
   MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")

   echo "Server key (PLACES_API_KEY): $PLACES_KEY"
   echo "Browser key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY): $MAPS_JS_KEY"
   ```

   Áp restriction tối thiểu trước khi dùng với Docker/dev server:

   ```bash
   ALLOWED_IPS="<thay-bang-IP-cong-khai-cua-ban>/32"

   # Giới hạn server key theo Places API và IP outbound của bạn
   gcloud beta services api-keys update "$PLACES_KEY_NAME" \
     --project="$PROJECT_ID" \
     --allowed-ips="$ALLOWED_IPS" \
     --api-target="service=places.googleapis.com"

   # Cho phép browser key dùng từ các origin localhost đáng tin
   gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
     --project="$PROJECT_ID" \
     --allowed-referrers="http://localhost:3005/*,http://127.0.0.1:3005/*,http://localhost:3007/*" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com"
   ```

   Để lấy key có sẵn của dự án `inbound-object-476110-d5` và áp restriction chính xác, chạy:

   ```bash
   # Đảm bảo đã cài component beta
   gcloud components install beta --quiet

   # Lấy key string
   PLACES_KEY=$(gcloud beta services api-keys get-key-string "$PLACES_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")
   MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
     --project="$PROJECT_ID" \
     --format="value(keyString)")

   echo "Server key (PLACES_API_KEY): $PLACES_KEY"
   echo "Browser key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY): $MAPS_JS_KEY"

   ALLOWED_IPS="<thay-bang-IP-cong-khai-cua-ban>/32"

   # Áp restriction IP cho server key
   gcloud beta services api-keys update "$PLACES_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-ips="$ALLOWED_IPS" \
     --api-target="service=places.googleapis.com"

   # Áp restriction referrer cho browser key
   gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
     --project=inbound-object-476110-d5 \
     --allowed-referrers="http://localhost:3005/*,http://127.0.0.1:3005/*,https://<ten-mien-cua-ban>/*" \
     --api-target="service=maps-backend.googleapis.com" \
     --api-target="service=places.googleapis.com"

   # (Tuỳ chọn) Kiểm tra restriction của key hiện tại
   gcloud beta services api-keys lookup --key-string="$PLACES_KEY"
   gcloud beta services api-keys lookup --key-string="$MAPS_JS_KEY"

   # Ghi server key cho backend (NestJS + Next.js server components)
   cat <<EOF > apps/api/.env
   PORT=3006
   CORS_ORIGINS=http://localhost:3005,http://127.0.0.1:3005,http://localhost:3007,http://127.0.0.1:3007
   RL_MAX=120
   RL_WINDOW=1 minute
   RL_ALLOWLIST=
   PLACES_API_KEY=$PLACES_KEY
   DATABASE_URL=postgresql://booking:secret@db:5432/booking?schema=public
   EOF

   cat <<EOF > apps/web/.env
   PLACES_API_KEY=$PLACES_KEY
   GOOGLE_MAPS_REFERER=http://localhost:3005/
   EOF

   # Ghi browser key (bị giới hạn referrer) cho bundle frontend
   cat <<EOF > apps/web/.env.local
   PLACES_API_KEY=$PLACES_KEY
   GOOGLE_MAPS_REFERER=http://localhost:3005/
   NEXT_PUBLIC_API_BASE=http://127.0.0.1:3006
   INTERNAL_API_BASE=http://127.0.0.1:3006
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$MAPS_JS_KEY
   NEXT_PUBLIC_QUOTE_PATH=/pricing/quote
   NEXT_PUBLIC_BOOKINGS_PATH=/bookings
   EOF
   ```

   Thay `<ten-mien-cua-ban>` bằng hostname production. Nếu cần xoay key, tạo lại mới.

   > 💡 Google Places yêu cầu bật billing cho dự án chứa key. Nếu gặp thông điệp `This API method requires billing to be enabled`, hãy vào [Google Cloud Billing](https://console.cloud.google.com/billing) để liên kết dự án rồi thử lại. Đồng thời rà soát allow-list IP/referrer nếu vẫn nhận HTTP 403. Proxy Places cache lỗi billing trong 10 phút; hãy restart dev server hoặc đợi cache hết hạn sau khi bật billing.

   ### Xác minh key và xử lý 403/503

   1. **Kiểm tra restriction trong Google Cloud Console**

      - Server key (`PLACES_API_KEY`): Application restriction = `IP addresses`; thêm IP outbound của bạn (với Docker Compose là IP máy host). API restriction = `Places API`.
      - Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Application restriction = `Websites`; thêm origin dev như `http://localhost:3005/*` và domain production. API restriction = `Maps JavaScript API` + `Places API`.

      Nếu chạy web app trên origin khác (ví dụ `http://localhost:3000` hoặc HTTPS), cập nhật allow-list khớp chính xác scheme/host/port, nếu không Google sẽ trả `403 PERMISSION_DENIED`.

      ```bash
      # Xem danh sách referrer hiện tại của browser key
      gcloud services api-keys describe "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'

      # Thêm/thay referrer để khớp dev server, ví dụ localhost:3000
      gcloud beta services api-keys update "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --allowed-referrers="http://localhost:3000/*,https://localhost:3000/*" \
        --api-target="service=maps-backend.googleapis.com" \
        --api-target="service=places.googleapis.com"
      ```

   2. **Đảm bảo billing đang hoạt động**

      ```bash
      gcloud beta billing projects describe inbound-object-476110-d5 \
        --project=inbound-object-476110-d5 \
        --format='value(billingAccountName)'
      ```

      Lệnh phải trả về ID tài khoản thanh toán. Nếu trống, bật billing trong Console trước khi gọi API.

   3. **Nhận diện thông báo 503 từ `/api/places/autocomplete`**

      Next.js route sẽ chuyển lỗi `FAILED_PRECONDITION` của Google thành HTTP 503 với nội dung tiếng Việt như trên. Sau khi bật billing, restart dev server (hoặc chờ 10 phút cache xoá) rồi gọi lại.

   4. **Smoke test proxy Places**

      ```bash
      # Terminal 1 – chạy web app để route handler hoạt động
      pnpm --filter web dev

      # Terminal 2 – gọi thử autocomplete proxy
      curl -i http://localhost:3000/api/places/autocomplete \
        -H 'content-type: application/json' \
        -d '{"input":"ho chi"}'
      ```

      Nếu cấu hình đúng sẽ nhận HTTP 200 cùng JSON gợi ý. HTTP 403 báo billing chưa bật hoặc restriction sai. Nếu body gốc chứa `This API method requires billing to be enabled`, hãy bật billing theo hướng dẫn rồi thử lại. HTTP 503 báo thiếu/sai `PLACES_API_KEY`—hãy kiểm tra lại các bước trên.

   5. **Kiểm tra log server** – Next.js log event `places.autocomplete_failed` kèm HTTP status thực tế từ Google. Dùng log để lần ra request thất bại tương ứng restriction nào.

   6. **(Tuỳ chọn) So sánh hash giá trị** – Nếu cần chứng minh container hoặc `.env` chứa cùng key với Console mà không lộ key:

      ```bash
      export MAPS_JS_KEY=$(gcloud beta services api-keys get-key-string "$MAPS_JS_KEY_NAME" \
        --project="$PROJECT_ID" \
        --format='value(keyString)')

      # Hash từ Google Cloud
      printf '%s' "$MAPS_JS_KEY" | sha256sum

      # Hash từ container web đang chạy
      docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
      ```

      Hash khớp chứng tỏ wiring chính xác mà không lộ secret.

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
