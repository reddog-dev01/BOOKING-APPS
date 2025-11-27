# Booking Platform Monorepo

Monorepo pnpm vận hành toàn bộ sản phẩm đặt chỗ (Next.js web, NestJS API, Prisma/Postgres). Tài liệu này mô tả trọn vẹn quy trình onboarding: clone mã nguồn, khởi chạy hạ tầng cục bộ, tạo mới Google Cloud project cho Places API và đồng bộ cặp Google Maps key sạch vào mọi dịch vụ.

---

## 1. Kiến trúc & thư mục

| Thư mục | Mô tả |
| --- | --- |
| `apps/web` | Frontend Next.js (Route Handlers + Server Actions) phục vụ khách đặt chỗ. |
| `apps/api` | API NestJS (booking, pricing, routes) dùng Prisma để truy vấn Postgres. |
| `apps/admin` | Bảng điều khiển quản trị Next.js. |
| `packages/db` | Prisma schema, migration, seed idempotent. |
| `packages/ui` | Thư viện UI chia sẻ giữa web & admin. |
| `infra`, `scripts`, `docs` | Công cụ DevOps, terraform/thủ tục vận hành, runbook. |

**Stack:** TypeScript strict + ESM, pnpm workspace, ESLint + Prettier. Mọi thay đổi phải giữ nguyên convention DTO/service/module, backup DB trước khi tạo migration, và log JSON (pino).

---

## 2. Yêu cầu hệ thống

- Node.js 20 LTS
- pnpm 8+
- Docker & Docker Compose (Postgres, reverse proxy)
- Quyền truy cập Google Cloud (Project Creator hoặc được ủy quyền tạo project con trong folder tổ chức)

---

## 3. Thiết lập monorepo lần đầu

```bash
# Clone
 git clone <REPO_URL>
 cd BOOKING-APPS

# Cài đặt phụ thuộc
 pnpm install

# Khởi động hạ tầng mặc định (Postgres, Caddy)
 docker compose up -d
```

### 3.1. Khởi tạo biến môi trường

```bash
cp -n .env.example .env
pnpm exec turbo run generate:env --filter=web --filter=api 2>/dev/null || true
```

Sau khi có Google key (mục 5), cập nhật các file:

- `./.env`
- `apps/api/.env`
- `apps/web/.env.local`
- `apps/admin/.env.local`

### 3.2. Tài khoản đăng nhập admin

- Sinh file env mẫu cho dashboard quản trị và cập nhật thông tin đăng nhập nội bộ:

  ```bash
  cp -n apps/admin/.env.local.example apps/admin/.env.local
  # Thay đổi ADMIN_EMAIL/ADMIN_PASSWORD cho từng môi trường, không prefix NEXT_PUBLIC
  ```

- Với bản dựng Docker/Vercel, khai báo cặp `ADMIN_EMAIL` + `ADMIN_PASSWORD` trong biến môi trường runtime để server action đăng nhập hợp lệ.
- Quên mật khẩu: IT cần xác minh danh tính qua kênh nội bộ (email công ty/Slack + xác nhận từ quản lý), tạo mật khẩu mới 16 ký tự ngẫu nhiên, cập nhật `ADMIN_PASSWORD` trong secret manager (hoặc `.env`/biến runtime) và **khởi động lại** dịch vụ admin. Ghi lại thời gian, người yêu cầu, và người thực hiện vào sổ log bảo mật.

---

## 4. Tạo mới Google Cloud project `GGMAPS`

> **Thông tin dự án đã cấp:** `Project name: GGMAPS`, `Project ID: ggmaps-476813`, `Project number: 886636766361`.

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/). Đăng nhập bằng tài khoản công ty.
2. `IAM & Admin → Manage resources` → **Create Project**.
   - **Project name:** `GGMAPS`
   - **Project ID:** `ggmaps-476813` (đảm bảo khớp, nếu trùng hãy chọn biến thể gần nhất và cập nhật toàn repo).
   - **Location:** folder/organization được phép tạo (ví dụ `Bookings`).
3. Gắn billing: `Billing → Link a billing account → billingAccounts/01FD8D-35134C-2995E8`.
4. Phân quyền tối thiểu:
   - Cho nhóm DevOps: `Project → IAM → Grant Access` với `roles/serviceusage.apiKeysAdmin`, `roles/viewer`.
   - Cho ứng dụng CI/CD (nếu cần): tạo service account với `roles/iam.serviceAccountTokenCreator`.
5. Đặt ngân sách/quota: `Billing → Budgets & alerts` → tạo budget `<GGMAPS Places>` với threshold 80%/100%.

### 4.1. Bật API cần dùng

`APIs & Services → Library` và enable lần lượt:

- **Maps JavaScript API**
- **Places API (New)**
- **Geocoding API** (bật để hỗ trợ reverse geocode)

Kiểm tra lại trong tab **Enabled APIs & Services** để chắc chắn cả ba đều ở trạng thái `ENABLED`.

### 4.2. Khoá project không dùng được key cũ

Tại `APIs & Services → Credentials`:

- Xoá mọi API key mặc định Google tạo ra khi sinh project mới.
- Xác nhận không còn key nào xuất hiện trước khi tạo key sạch ở mục 5.

---

## 5. Sinh cặp Google Maps/Places API key sạch

Tại `APIs & Services → Credentials`.

### 5.1. Server key (`PLACES_API_KEY`)

1. **Create Credentials → API key**.
2. Đặt tên: `places-server-dev`.
3. **Application restrictions:** chọn `IP addresses` → add IP outbound của môi trường dev/bastion.
4. **API restrictions:** `Restrict key` → chọn `Places API (New)` và `Geocoding API`.
5. Lưu lại giá trị, copy vào biến shell `PLACES_API_KEY`.

### 5.2. Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

1. **Create Credentials → API key**.
2. Đặt tên: `maps-browser-dev`.
3. **Application restrictions:** `HTTP referrers` → thêm:
   - `http://localhost:3005/*`
   - `http://127.0.0.1:3005/*`
   - fallback dev: `http://localhost:3000/*`, `http://localhost:3008/*` (và biến thể `127.0.0.1`).
   - domain staging/production thực tế.
4. **API restrictions:** `Maps JavaScript API`, `Places API (New)`.
5. Lưu giá trị vào biến `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### 5.3. Ghi nhận metadata key

| Biến môi trường | Giá trị hiện tại |
| --- | --- |
| `PROJECT_ID` | `ggmaps-476813` |
| `PLACES_KEY_NAME` | `places-server-dev` |
| `MAPS_JS_KEY_NAME` | `maps-browser-dev` |
| `PLACES_API_KEY` | `AIzaSyDyUEQLWkuU_r7UlaaXGrkwCvH1zqxbfJw` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AlzaSyDQW8cofv1VFEttUe43e_uBpSgyPULXxAY` |

```bash
export PROJECT_ID="ggmaps-476813"
export PLACES_KEY_NAME="places-server-dev"
export MAPS_JS_KEY_NAME="maps-browser-dev"
export PLACES_API_KEY="AIzaSyDyUEQLWkuU_r7UlaaXGrkwCvH1zqxbfJw"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AlzaSyDQW8cofv1VFEttUe43e_uBpSgyPULXxAY"
```

Dùng `gcloud` để double-check restriction:

```bash
gcloud config set project "$PROJECT_ID"

gcloud services api-keys describe "$PLACES_KEY_NAME" \
  --format='get(restrictions.serverKeyRestrictions.allowedIps)'

gcloud services api-keys describe "$MAPS_JS_KEY_NAME" \
  --format='get(restrictions.browserKeyRestrictions.allowedReferrers)'
```

Đảm bảo danh sách không trống và chỉ chứa IP/referrer mong muốn.

---

## 6. Đồng bộ key vào repo

Script `scripts/google-keys.mjs` (được wrap qua npm script) sẽ tự sao chép `.env.example` nếu thiếu và cập nhật đồng bộ cho tất cả dịch vụ.

```bash
cd /workspace/BOOKING-APPS

# Export giá trị mới (nếu đã export ở bước 5.3 thì có thể bỏ qua)
export PLACES_API_KEY="AIzaSyDyUEQLWkuU_r7UlaaXGrkwCvH1zqxbfJw"
export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AlzaSyDQW8cofv1VFEttUe43e_uBpSgyPULXxAY"

# Áp key vào toàn bộ .env
WEB_PORT=3005 pnpm apply:google-keys

# Kiểm tra lại giá trị
pnpm check:google-keys

# Xoá biến shell để tránh lộ history
unset PLACES_API_KEY NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

Các file được cập nhật: `./.env`, `apps/api/.env`, `apps/web/.env.local`, `apps/admin/.env.local`. Nếu có key cũ cần chặn, export thêm `GOOGLE_KEY_DENYLIST="<KEY_CU_SERVER>,<KEY_CU_BROWSER>"` trước khi chạy.

---

## 7. Smoke test Google Places proxy

```bash
pnpm --filter web dev
```

Tab khác:

```bash
WEB_PORT=3005
curl -i "http://localhost:${WEB_PORT}/api/places/autocomplete" \
  -H 'content-type: application/json' \
  -d '{"input":"ho chi"}'
```

- HTTP 200 + mảng `predictions` → thành công.
- HTTP 503 (tiếng Việt) → thiếu/sai `PLACES_API_KEY` hoặc billing chưa bật.
- HTTP 403 `BILLING_DISABLED` → quay lại bước billing hoặc chờ Google đồng bộ 5-10 phút.

Frontend:

1. Mở trang chứa component `apps/web/components/AddressInput.tsx`.
2. Gõ "Ho Chi Minh City" → kiểm tra DevTools Network đảm bảo request `places:autocomplete` trả 200.
3. Nếu lỗi `RefererNotAllowedMapError`, cập nhật lại danh sách referrer cho browser key.

---

## 8. Xoay key định kỳ

1. Lặp lại mục 5 để sinh cặp key mới (không reuse key cũ).
2. Chạy lại script đồng bộ (mục 6).
3. Ghi chú hash phục vụ đối chiếu, gửi cho team:

```bash
printf '%s' "$PLACES_API_KEY" | sha256sum
printf '%s' "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" | sha256sum
```

4. Restart dịch vụ đang chạy:

```bash
docker compose up -d --force-recreate api web
```

---

## 9. Tài liệu tham khảo

- [docs/google-key-verification.md](docs/google-key-verification.md): checklist xác minh restriction và smoke test chi tiết.
- [docs/places-troubleshooting-runbook.md](docs/places-troubleshooting-runbook.md): runbook khi API trả lỗi 4xx/5xx.
- [docs/jest-troubleshooting-vi.md](docs/jest-troubleshooting-vi.md): fix unit test khi cập nhật key.

