# Checklist kiểm tra Google Maps & Places API key

Checklist này đảm bảo hai key `PLACES_API_KEY` (server) và `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser) khớp nhau trên mọi entry point (API, web khách hàng, admin, Docker Compose) để proxy Places không còn trả `503` vì nhầm biến môi trường. Tài liệu cũng giải thích cách xử lý lỗi Google trả về:

```
Google Places yêu cầu bật Billing cho dự án chứa API key. Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.
```

Nếu gặp payload đó từ `/api/places/*`, hãy làm theo bước 4 để bật billing cho dự án sở hữu cả hai key.

## Chuỗi key bắt buộc

- **Gọi Google Places phía server** → `PLACES_API_KEY`
- **Maps JavaScript SDK phía trình duyệt** → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Cả hai được tạo từ dự án Google Cloud đã bật billing và đã điền vào `.env.example` nên Docker và runner cục bộ chia sẻ credential ngay lập tức. Nếu key bị xóa, xem mục “Tạo key Places + Maps mới” trong [README gốc](../README.md) để cấp lại trước khi tiếp tục. Luôn giữ restriction đúng origin/IP cho phép (xem screenshot trong ticket) và cập nhật file nếu Google rotate chuỗi key.

> [!TIP]
> Proxy Places trong Next.js vẫn fallback đọc `PLACES_API_KEY` từ `.env` (`apps/web/.env.local`, `apps/api/.env`...) khi biến môi trường trống. Hãy export biến trong shell/IDE để process đang chạy, container và test cùng giá trị.

## 1. Đồng bộ file `.env`

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
```

Kiểm tra lại key trong file vừa copy (giờ phải chứa credential thật, không còn placeholder):

```bash
rg --no-heading --line-number "PLACES_API_KEY" apps/api/.env apps/web/.env apps/web/.env.local apps/admin/.env.local
grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/web/.env.local apps/admin/.env.local docker-compose.yml
```

## 2. Xác nhận wiring trong Docker Compose

`docker-compose.yml` đã inject cả hai key cho container API và web. File này fallback về giá trị trong `.env` nên Compose không còn fail khi shell của bạn trống. Trước khi deploy hoặc chia sẻ stack, overwrite mặc định bằng key **thật** đã bật billing (bước 1). Mỗi lần đổi key, rebuild service để container và runtime nạp giá trị mới:

```bash
docker compose up -d --force-recreate api web
```

## 3. Kiểm tra container đang chạy nhận đúng giá trị

Dùng lệnh sau để so sánh hash key trong container mà không in chuỗi thật. Kết quả hash phải trùng nhau giữa các service.

```bash
docker compose exec api sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
```

Với admin (chạy ngoài Docker khi dev), xác nhận `.env.local` chứa cùng giá trị:

```bash
grep -n "PLACES_API_KEY" apps/admin/.env.local
grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/admin/.env.local
```

Nếu sau này đưa admin vào container, thêm environment tương tự service `web` trong `docker-compose.yml`.

## 4. Smoke test proxy Places

Khởi động web app và gọi route proxy để chắc chắn API key truyền đúng đầu-cuối:

```bash
pnpm --filter web dev
curl -i http://localhost:3000/api/places/autocomplete \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

Nếu cấu hình ổn, response trả HTTP 200 kèm JSON `predictions`. HTTP 403 báo vấn đề billing hoặc restriction. Khi body upstream chứa `This API method requires billing to be enabled`, proxy sẽ rewrite thành thông điệp tiếng Việt ở đầu tài liệu—hãy bật billing rồi thử lại. HTTP 503 nghĩa là `PLACES_API_KEY` thiếu hoặc lệch—lặp lại các bước trên để tìm vị trí sai.

## 5. Xác thực widget Places phía client

Browser key phải load thành công Maps JavaScript SDK với `libraries=places` từ mọi referrer hợp lệ. Chạy web app, mở DevTools và kiểm tra Network xem request `https://maps.googleapis.com/maps/api/js?key=<NEXT_PUBLIC_GOOGLE_MAPS_API_KEY>&libraries=places` tải thành công, không có `RefererNotAllowedMapError`.

Khi render input autocomplete (ví dụ component `LocationAutocomplete` trong README), chọn một gợi ý sẽ gọi handler của bạn mà không xuất hiện lỗi Google bổ sung. Nếu script không tải được, cập nhật danh sách HTTP referrer cho browser key khớp scheme/host/port trong request DevTools.

## 6. Khởi động lại toàn bộ khi thay đổi giá trị

Mỗi lần thay key hoặc sửa allow-list IP/referrer, rebuild container và restart dev server để mọi process lấy giá trị mới:

```bash
docker compose down
docker compose up --build -d
pnpm --filter web dev
pnpm --filter admin dev
```

Tuân thủ checklist này sẽ giúp API, web và admin luôn đồng bộ credential Google, tránh việc giá trị lệch nhau kích hoạt cơ chế circuit breaker 503.
