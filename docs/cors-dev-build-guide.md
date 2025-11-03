# Runbook triển khai CORS & Prisma cho apps/api (Tiếng Việt)

_Cập nhật lần cuối: 2025-11-03 (Asia/Bangkok)_

Tài liệu này đóng vai trò runbook chuẩn cho đội DevOps/Backend khi build và triển khai API Fastify (`apps/api`). Mục tiêu:

- Giải thích kiến trúc plugin CORS mới và biến môi trường điều khiển.
- Chuẩn hóa quy trình cài đặt/generate Prisma để tránh lỗi `prisma engine not found`.
- Cung cấp ba lộ trình triển khai phổ biến (Helm/Kubernetes, Docker Compose, Node trực tiếp) với bước lệnh rõ ràng.
- Đưa ra checklist smoke test, rollback, giám sát, bảo mật và tối ưu chi phí.

---

## 1️⃣ Kiến trúc tổng quan

- `apps/api` là service NestJS chạy trên Fastify; ORM dùng Prisma. Monorepo quản lý bằng pnpm.
- Plugin CORS (`apps/api/src/plugins/cors.ts`) chuẩn hóa `Origin`, so sánh với allow-list localhost (http/https, host `localhost|127.0.0.1`, port 3000–3008) và các origin bổ sung từ `CORS_ORIGINS` (CSV). `origin()` **không ném lỗi** – chỉ trả `true/false` để Fastify preflight không trả `500`. `onRequest` chặn request thật và trả JSON `403 CORS_ORIGIN_BLOCKED` để log/alert rõ ràng. Nếu `CORS_ORIGINS=*` ➜ bật wildcard.
- Origin hợp lệ được phản chiếu lại (giữ cookie/session); origin bị chặn tạo lỗi `CORS_ORIGIN_BLOCKED`, trả JSON `403` và log cảnh báo.
- Prisma Client/engines phải được generate **trước** mọi lệnh `pnpm --filter api build|dev`. Thiếu client ➜ build/dev fail.

---

## 2️⃣ Chuẩn bị bắt buộc (mọi lộ trình)

Thực hiện ở thư mục gốc repo (`/workspace/BOOKING-APPS`). Nếu trước đó đã cài, cứ chạy lại các lệnh dưới để đồng bộ; pnpm sẽ bỏ qua phần đã có.

- [ ] **Làm sạch cache & bật build scripts cho pnpm**

  ```bash
  find . -type d -name node_modules -prune -exec rm -rf {} +
  export PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
  pnpm install --frozen-lockfile
  ```

  > Nếu đã lỡ `pnpm approve-builds` mà không chọn gì, pnpm đánh dấu "ignored". Thiết lập biến môi trường trước `pnpm install` để Prisma/sharp build lại đầy đủ.

- [ ] **Ghi nhớ cấu hình trong `package.json`**

  ```json
  {
    "pnpm": {
      "overrides": {
        "prisma": "6.18.0",
        "@prisma/client": "6.18.0",
        "@nestjs/testing": "^11.0.0",
        "@nestjs/throttler": "^6.0.0"
      },
      "ignoredBuiltDependencies": ["@nestjs/core"],
      "onlyBuiltDependencies": [
        "@prisma/client",
        "@prisma/engines",
        "prisma",
        "sharp",
        "@tailwindcss/oxide"
      ]
    }
  }
  ```

  > Cấu hình này giúp mọi môi trường (dev/CI/Docker) tự bật postinstall cần thiết và ép version NestJS thống nhất.

- [ ] **Đồng bộ phụ thuộc Prisma**

  ```bash
  pnpm add -wD prisma                             # Cài Prisma CLI ở workspace (devDependency)
  pnpm --filter api add @prisma/client            # Bổ sung Prisma Client cho apps/api
  pnpm install --frozen-lockfile                  # Đồng bộ node_modules sau khi thêm package
  ```

  > Nếu thấy cảnh báo `node_modules is present`, xoá thư mục `node_modules` rồi chạy lại `pnpm install --frozen-lockfile` để sạch cache: `rm -rf node_modules && pnpm install --frozen-lockfile`.

- [ ] **Generate Prisma Client trước build**

  ```bash
  pnpm -w prisma:generate                         # Dùng schema mặc định ở packages/db/prisma
  # Hoặc generate thủ công với schema cụ thể:
  pnpm exec prisma generate --schema packages/db/prisma/schema.prisma
  ```

  > Các runner offline nên cache thư mục `node_modules/.prisma` và `apps/api/node_modules/@prisma/client` để tránh phải tải engine lại.

- [ ] **Kiểm tra scripts trong `apps/api/package.json`**

  ```json
  {
    "scripts": {
      "prisma:generate": "pnpm -w prisma:generate",
      "prebuild": "pnpm run prisma:generate",
      "build": "pnpm exec tsc -p tsconfig.build.json",
      "start": "node dist/main.js",
      "start:prod": "NODE_ENV=production node dist/main.js"
    }
  }
  ```

  > Nếu pipeline tự chạy `pnpm -w prisma:generate` trước, có thể bỏ `prebuild`; tuy nhiên giữ cả hai để tránh sót bước.

- [ ] **Khai báo biến môi trường** (ví dụ `.env`, values.yaml hoặc docker-compose):

  ```env
  NODE_ENV=production
  PORT=8080
  CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3008
  ```

---

## 3️⃣ Lộ trình build & redeploy (chọn 1)

### 3.1 Kubernetes/Helm (khuyến nghị production)

1. **Tạo Dockerfile đa stage** (`apps/api/Dockerfile`):

   ```bash
   cat <<'DOCKERFILE' > apps/api/Dockerfile
   # syntax=docker/dockerfile:1.7
   FROM node:20-alpine AS builder
   WORKDIR /app
   RUN corepack enable

   # Sao chép metadata để tối ưu cache pnpm
   COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
   COPY apps/api/package.json apps/api/package.json
   COPY apps/api/tsconfig*.json apps/api/
   COPY packages/db/prisma packages/db/prisma
   COPY packages packages

   ENV PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
   RUN pnpm install --frozen-lockfile

   # Generate Prisma Client tại stage có Internet
   RUN pnpm -w prisma:generate

   # Sao chép mã nguồn API và build
   COPY apps/api apps/api
   RUN pnpm --filter api build

   FROM node:20-alpine AS runtime
   WORKDIR /app
   ENV NODE_ENV=production \
       PORT=8080 \
       PRISMA_SKIP_POSTINSTALL_GENERATE=1

   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/apps/api/dist ./apps/api/dist
   COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
   COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

   EXPOSE 8080
   CMD ["node", "apps/api/dist/main.js"]
   DOCKERFILE
   ```

2. **Build & push image**

   ```bash
   docker build -f apps/api/Dockerfile -t ghcr.io/<org>/<api-name>:<git-sha> .
   docker push ghcr.io/<org>/<api-name>:<git-sha>
   ```

3. **Cập nhật Helm values** (ví dụ `charts/api/values.yaml`):

   ```yaml
   image:
     repository: ghcr.io/<org>/<api-name>
     tag: "<git-sha>"

   env:
     - name: NODE_ENV
       value: production
     - name: PORT
       value: "8080"
     - name: CORS_ORIGINS
       value: "http://localhost:3000,http://localhost:3001,http://localhost:3008"

   service:
     port: 8080

   resources:
     requests:
       cpu: 100m
       memory: 128Mi
     limits:
       cpu: 500m
       memory: 512Mi
   ```

4. **Triển khai/rolling update**

   ```bash
   helm upgrade --install api charts/api -f charts/api/values.yaml
   # hoặc
   kubectl rollout restart deploy/api
   ```

### 3.2 Docker Compose (staging/dev)

1. **Đảm bảo dùng cùng Dockerfile ở trên.**
2. **docker-compose.yml** (ví dụ):

   ```yaml
   services:
     api:
       build:
         context: .
         dockerfile: apps/api/Dockerfile
       environment:
         NODE_ENV: production
         PORT: "8080"
         CORS_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:3008"
       ports:
         - "8080:8080"
       restart: unless-stopped
   ```

3. **Build & chạy**

   ```bash
   docker compose build api
   docker compose up -d api
   ```

### 3.3 Chạy trực tiếp bằng Node (dev/runner CI)

```bash
export PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
pnpm install --frozen-lockfile
pnpm -w prisma:generate
pnpm --filter api build

CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3008" \
PORT=8080 \
NODE_ENV=production \
pnpm --filter api start:prod
```

---

## 4️⃣ Smoke test CORS

```bash
curl -i -X OPTIONS "http://127.0.0.1:3006/pricing/quote" \
  -H "Origin: http://localhost:3008" \
  -H "Access-Control-Request-Method: POST"
```

Kỳ vọng tối thiểu:

- HTTP `204` (hoặc `200` nếu tắt `strictPreflight`).
- Header `Access-Control-Allow-Origin: http://localhost:3008`.
- Header `Access-Control-Allow-Credentials: true`.

> `/pricing/quote` chỉ hỗ trợ `POST`. Nếu gọi `GET`, Fastify trả `404 (Cannot GET /pricing/quote)` — không phải lỗi CORS.

---

## 5️⃣ Rollback plan

- [ ] **Helm/Kubernetes**: `helm rollback api <revision>` hoặc `kubectl rollout undo deploy/api`.
- [ ] **Docker Compose**: `docker compose down api && docker compose up -d api` với tag image ổn định.
- [ ] **Node trực tiếp**: `git checkout <commit_cũ>`, chạy lại bước build và `pnpm --filter api start:prod`.
- [ ] Sau rollback, lặp lại smoke test ở mục 4 để xác nhận hành vi.

---

## 6️⃣ Monitor & alert

- [ ] Theo dõi log `blocked CORS origin` và `blocked request by CORS policy`; nếu origin hợp lệ vẫn xuất hiện, rà soát `CORS_ORIGINS`.
- [ ] Thiết lập SLO ≥ 99.5% cho `OPTIONS /pricing/quote`. Metric gợi ý: `http_requests_total{route="/pricing/quote",method="OPTIONS"}`.
- [ ] Alert khi tỷ lệ `403 CORS_ORIGIN_BLOCKED` > 1% trong 5 phút.
- [ ] Ghi log có `request-id`/`correlation-id` để dễ truy vết (khuyến nghị OpenTelemetry/structured logging).

---

## 7️⃣ Security checklist

- [ ] CORS ở chế độ least-privilege; wildcard `*` chỉ bật khi đã đánh giá rủi ro.
- [ ] Không commit secret; dùng Secret Manager/K8s Secret/Compose env file.
- [ ] Bật HTTPS ở production (ingress/controller). Tham khảo [Fastify HTTPS](https://fastify.dev/docs/latest/Guides/HTTPS/) _(checked: 2025-11-03, Asia/Bangkok)_.
- [ ] Prisma migration chỉ chạy có kiểm soát; tránh migration tự động ở runtime.
- [ ] Bảo vệ pipeline: runner cần quyền đọc repo, push image; hạn chế IAM tối thiểu.

---

## 8️⃣ Cost notes

- Không phát sinh workload mới; chi phí chủ yếu nằm ở container chạy API hiện hữu.
- Multi-stage Dockerfile giảm kích thước image ➜ tiết kiệm băng thông lưu trữ.
- Cache `.prisma` và pnpm store giúp rút ngắn CI, giảm chi phí thời gian chạy runner.

---

## 9️⃣ Xử lý sự cố nhanh

- `pnpm --filter api build` báo thiếu Prisma engine ➜ kiểm tra lại mục 2 (đã cài CLI + chạy generate chưa). Với runner không Internet, copy thư mục `.prisma` từ artefact build hoặc dùng mirror qua `PRISMA_ENGINES_MIRROR` (tham khảo [Prisma docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/configuring-prisma-client-environment#using-a-custom-engine-binary), checked: 2025-11-03).
- Khi tạo Dockerfile, **đừng** dán trực tiếp vào shell (tránh lỗi `FROM: command not found`). Dùng `cat <<'DOCKERFILE' > apps/api/Dockerfile` như hướng dẫn.
- Nếu thấy cảnh báo peer dependency (`@nestjs/core` vs `@nestjs/throttler`), kiểm tra phiên bản thực tế; cảnh báo không chặn build nhưng cần ghi nhận khi nâng cấp NestJS.
- Tuyệt đối không `throw` trong callback `origin` của `@fastify/cors`; trả `false` để preflight phản hồi `403` thay vì `500`.
- Sau khi thay đổi `CORS_ORIGINS`, luôn redeploy service và chạy lại smoke test.

---

##  🔟 Checklist cuối cùng trước khi triển khai

- [ ] Đã chạy `pnpm add -wD prisma` & `pnpm --filter api add @prisma/client` và `pnpm install --frozen-lockfile`.
- [ ] Đã generate Prisma Client (`pnpm -w prisma:generate`).
- [ ] Đã build (`pnpm --filter api build`) thành công trên runner có Prisma engine.
- [ ] Đã tạo/cập nhật artefact (Docker image hoặc dist + node_modules/.prisma).
- [ ] Đã cấu hình `CORS_ORIGINS` đúng môi trường.
- [ ] Đã deploy và chạy smoke test (mục 4).
- [ ] Đã cập nhật giám sát/log cảnh báo.

---

> Ghi chú: Tài liệu này chuẩn hóa mọi bước triển khai CORS + Prisma cho API. Mọi pull request thay đổi CORS hoặc pipeline build phải cập nhật lại runbook để tránh drift.
