# Checklist kiểm tra Google Maps & Places API key

Checklist này giúp xác nhận cặp key mới (`PLACES_API_KEY` cho backend, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` cho frontend) đã được tạo lại, giới hạn đúng phạm vi và nạp vào toàn bộ dịch vụ trong monorepo. Thực hiện tuần tự để tránh HTTP 403/503 khi gọi Google Places.

## 1. Tạo lại hai key hoàn toàn mới

Làm theo mục “Lộ trình tạo mới hai key Google” trong [README](../README.md) để:

- Bật billing + API cần thiết (`maps-backend`, `places`, `geocoding`).
- Sinh key server, giới hạn theo IP và lưu vào biến `PLACES_API_KEY`.
- Sinh key browser, giới hạn referrer (localhost các port dev & domain production) và lưu vào `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

Ghi chú các biến shell `PLACES_KEY_NAME`, `MAPS_JS_KEY_NAME`, `PLACES_KEY`, `MAPS_JS_KEY` (README đã export sẵn) để dùng trong bước xác minh.

## 2. Đồng bộ tất cả file `.env`

```bash
rg --no-heading --line-number "PLACES_API_KEY" apps/api/.env apps/web/.env apps/web/.env.local apps/admin/.env.local
grep -n "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" apps/web/.env.local apps/admin/.env.local docker-compose.yml
```

Mỗi file phải chứa đúng chuỗi vừa tạo. Sau khi ghi đè `.env`, chạy lại:

```bash
docker compose up -d --force-recreate api web
```

## 3. Kiểm tra restriction trực tiếp từ Google Cloud

```bash
gcloud services api-keys describe "$PLACES_KEY_NAME" \
  --project="$PROJECT_ID" \
  --format='get(restrictions.serverKeyRestrictions.allowedIps)'

gcloud services api-keys describe "$MAPS_JS_KEY_NAME" \
  --project="$PROJECT_ID" \
  --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'
```

- IP outbound (khi chạy Docker dev) phải nằm trong danh sách `allowedIps`.
- Origin dev phổ biến (`http://localhost:3005/*`, `http://127.0.0.1:3005/*`, fallback `http://localhost:3000/*`, `http://127.0.0.1:3000/*`, `http://localhost:3008/*`, `http://127.0.0.1:3008/*`, cùng domain production) phải có trong `allowedReferrers`.

Nếu thiếu, cập nhật ngay bằng `gcloud beta services api-keys update "$PLACES_KEY_NAME" ...` hoặc `... "$MAPS_JS_KEY_NAME" ...` rồi đợi vài phút để Google đồng bộ.

## 4. Smoke test backend proxy

```bash
pnpm --filter web dev &
sleep 5
WEB_PORT=3005 # thay bằng port Next.js dev đang chạy (3005 mặc định, có thể fallback 3000/3008)
curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

- HTTP 200 + `predictions` → OK.
- HTTP 503 với thông điệp tiếng Việt → thiếu/sai `PLACES_API_KEY` hoặc billing chưa bật.
- HTTP 403 `BILLING_DISABLED` → quay lại bước billing.

## 5. Kiểm tra widget Places phía client

1. Nhúng script Maps JS SDK bằng browser key (đã mô tả trong README) và render input Autocomplete.
2. Mở DevTools → tab Network, xác nhận request `maps/api/js?...libraries=places` trả HTTP 200.
3. Nếu gặp `RefererNotAllowedMapError`, bổ sung origin hiện tại vào `allowedReferrers`.

## 6. (Tuỳ chọn) So sánh hash giá trị

```bash
printf '%s' "$PLACES_KEY" | sha256sum
docker compose exec web sh -lc 'printf "%s" "$PLACES_API_KEY"' | sha256sum
docker compose exec web sh -lc 'printf "%s" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"' | sha256sum
```

Hash trùng khớp cho thấy container và `.env` đều đang dùng credential giống với Google Cloud mà không cần lộ chuỗi thật.
