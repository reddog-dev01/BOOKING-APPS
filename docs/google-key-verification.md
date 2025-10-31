# Checklist kiểm tra Google Maps & Places API key

Checklist này giúp xác nhận cặp key mới (`PLACES_API_KEY` cho backend, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` cho frontend) đã được tạo lại, giới hạn đúng phạm vi và nạp vào toàn bộ dịch vụ trong monorepo. Thực hiện tuần tự để tránh HTTP 403/503 khi gọi Google Places.

## 1. Tạo lại hai key hoàn toàn mới

Làm theo mục “Lộ trình tạo mới hai key Google” trong [README](../README.md) để:

- Bật billing + API cần thiết (`maps-backend`, `places`, `geocoding`).
- Sinh key server, giới hạn theo IP và lưu vào biến `PLACES_API_KEY`.
- Sinh key browser, giới hạn referrer (localhost các port dev & domain production) và lưu vào `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

Ghi chú các biến shell `PLACES_KEY_NAME`, `MAPS_JS_KEY_NAME`, `PLACES_KEY`, `MAPS_JS_KEY` (README đã export sẵn) để dùng trong bước xác minh.

<a id="sync-env-files"></a>
## 2. Đồng bộ tất cả file `.env`

```bash
REPO_DIR=~/booking-app # thay đường dẫn nếu cần
cd "$REPO_DIR"

export PLACES_API_KEY="$PLACES_KEY"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$MAPS_JS_KEY"

WEB_PORT=3005 pnpm apply:google-keys
pnpm check:google-keys

# Tuỳ chọn: xoá biến shell sau khi đồng bộ để tránh rò rỉ history
unset PLACES_API_KEY NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

- `apply:google-keys` tự sao chép `.env.example` nếu thiếu và cập nhật giá trị `PLACES_API_KEY`/`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` theo biến shell hiện tại.
- `check:google-keys` đọc `apps/api/.env`, `apps/web/.env*`, `apps/admin/.env.local` (nếu tồn tại) và đảm bảo không còn placeholder.
- Nếu ở bước 3–4 bạn vẫn đang giữ các biến shell `PLACES_KEY`/`MAPS_JS_KEY` hoặc `PLACES_API_KEY`/`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, script sẽ so sánh trực tiếp để chắc chắn mọi file dùng chung một giá trị.
- Khi biết chính xác chuỗi key cũ, export `GOOGLE_KEY_DENYLIST="<KEY_CU_SERVER>,<KEY_CU_BROWSER>"` trước khi chạy để script báo lỗi nếu vô tình sót.

Sau khi các script trả về trạng thái thành công, restart container để nạp key mới:

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

<a id="smoke-test-proxy"></a>
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
