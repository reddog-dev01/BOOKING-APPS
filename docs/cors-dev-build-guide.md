# Sổ tay CORS localhost & build Prisma (bản tiếng Việt)

_Cập nhật lần cuối: 2025-11-03 (Asia/Bangkok)_

Tài liệu này đóng vai trò “runbook” cho đội DevOps & Backend khi vận hành API `apps/api` trong monorepo pnpm. Mục tiêu:

- Hiểu kiến trúc CORS mới (Fastify plugin) và cách tinh chỉnh `CORS_ORIGINS`.
- Khắc phục triệt để lỗi build do Prisma CLI/engine không tải được trên runner bị giới hạn mạng.
- Chọn và triển khai 1 trong 3 lộ trình build & redeploy phổ biến (Kubernetes/Helm, Docker Compose, hoặc chạy Node trực tiếp).
- Nắm checklist giám sát, bảo mật và quy trình rollback.

## 1. Kiến trúc tổng quan (CORS + Prisma)

- Ứng dụng API chạy bằng Fastify + NestJS, sử dụng Prisma làm ORM. Code chính nằm ở `apps/api`.
- Plugin CORS tại `apps/api/src/plugins/cors.ts` chuẩn hóa mọi `Origin`, đối chiếu với allow-list rồi phản chiếu lại origin hợp lệ (giữ được cookie/session). Origin bị chặn sẽ tạo lỗi có mã `CORS_ORIGIN_BLOCKED` và trả JSON `403`.
- Allow-list mặc định: mọi tổ hợp `http|https://localhost|127.0.0.1:3000-3008`. Có thể mở rộng qua biến môi trường `CORS_ORIGINS` (CSV hoặc `*`).
- Prisma Client/engines phải được generate **trước khi** `tsc` chạy; nếu thiếu, mọi lệnh `pnpm --filter api dev|build` đều lỗi vì không tìm thấy binary.

## 2. Chuẩn bị bắt buộc (áp dụng cho mọi lộ trình)

- [ ] Cài Prisma CLI và client đúng scope:

  ```bash
  pnpm add -wD prisma                             # CLI ở workspace
  pnpm --filter api add @prisma/client            # runtime dependency cho API
  ```

- [ ] Generate Prisma Client trước build (đảm bảo runner offline vẫn dùng artefact mới nhất):

  ```bash
  pnpm -w prisma:generate
  # hoặc khi cần override schema thủ công:
  pnpm exec prisma generate --schema packages/db/prisma/schema.prisma
  ```

- [ ] Kiểm tra scripts trong `apps/api/package.json`:

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

  > Nếu pipeline đã chạy `prisma generate` thủ công, có thể bỏ `prebuild`. Tuy nhiên, giữ cả hai giúp giảm rủi ro khi quên bước generate.

- [ ] Cấu hình môi trường (ví dụ `.env`, values Helm, Compose file):

  ```env
  NODE_ENV=production
  PORT=8080
  CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3008
  ```

## 3. Ba lộ trình build & redeploy (chọn 1)

### 3.1 Lộ trình A — Kubernetes/Helm (khuyến nghị cho production)

**Dockerfile (apps/api/Dockerfile)**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

# Sao chép metadata pnpm trước để cache install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/tsconfig*.json apps/api/
COPY packages/db/prisma packages/db/prisma
# Nếu API dùng shared packages, copy thêm các thư mục con cần thiết trong `packages/`

RUN pnpm install --frozen-lockfile

# Generate Prisma client ở stage có Internet
RUN pnpm -w prisma:generate

# Copy code nguồn rồi build
COPY apps/api apps/api
# Copy source code (điều chỉnh để chỉ mang theo thư viện thực sự cần cho API)
COPY packages packages
RUN pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1

# Chỉ copy artefact cần thiết
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]
```

**Build & push image**

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/<org>/<api-name>:<git-sha> .
docker push ghcr.io/<org>/<api-name>:<git-sha>
```

**Helm values tối thiểu**

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

**Triển khai**

```bash
helm upgrade --install api charts/api -f charts/api/values.yaml
# hoặc
kubectl rollout restart deploy/api
```

### 3.2 Lộ trình B — Docker Compose (staging/dev)

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

```bash
docker compose build api
docker compose up -d api
```

### 3.3 Lộ trình C — Chạy thẳng bằng Node (máy dev/runner CI)

```bash
pnpm install --frozen-lockfile
pnpm -w prisma:generate
pnpm --filter api build

CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3008" \
PORT=8080 \
NODE_ENV=production \
pnpm --filter api start:prod
```

## 4. Smoke test CORS

```bash
curl -i -X OPTIONS "http://127.0.0.1:3006/pricing/quote" \
  -H "Origin: http://localhost:3008" \
  -H "Access-Control-Request-Method: POST"
```

Kỳ vọng (tối thiểu):

- HTTP `204` (hoặc `200` nếu disable `strictPreflight`).
- Header `Access-Control-Allow-Origin: http://localhost:3008`.
- Header `Access-Control-Allow-Credentials: true`.

> Lưu ý: `/pricing/quote` chỉ hỗ trợ `POST`. Nếu gọi `GET`, Fastify trả `404` (`Cannot GET /pricing/quote`) — không phải lỗi CORS.

## 5. Rollback

- [ ] Kubernetes/Helm: `helm rollback api <revision>` hoặc `kubectl rollout undo deploy/api`.
- [ ] Docker Compose: dừng container, khởi động lại với image tag cũ (`docker compose up -d api` với version ổn định).
- [ ] Node trực tiếp: `git checkout <commit_cũ>`, chạy lại bước build + `pnpm --filter api start:prod`.

Sau rollback, chạy lại smoke test ở mục 4 để chắc chắn hành vi đã quay về trạng thái trước.

## 6. Monitor & alert

- [ ] Theo dõi log `blocked CORS origin` và `blocked request by CORS policy`. Nếu các origin hợp lệ (ví dụ `http://localhost:3008`) vẫn xuất hiện, kiểm tra lại cấu hình `CORS_ORIGINS`.
- [ ] Đặt SLO ≥ 99.5% cho tỷ lệ thành công `OPTIONS /pricing/quote`. Có thể dùng metric Prometheus dạng `http_requests_total{route="/pricing/quote",method="OPTIONS"}`.
- [ ] Tạo alert khi `403 CORS_ORIGIN_BLOCKED` > 1% trong 5 phút đối với route `/pricing/quote`.
- [ ] Ghi log có `request-id`/`correlation-id` để dễ truy dấu khi cần debug xuyên dịch vụ.

## 7. Security checklist

- [ ] CORS luôn ở chế độ least-privilege: chỉ localhost matrix hoặc danh sách cụ thể qua `CORS_ORIGINS`. Wildcard `*` chỉ bật khi thực sự cần.
- [ ] Không đưa secret vào Dockerfile; dùng Kubernetes Secret/Compose env file bảo mật.
- [ ] Bật `credentials: true` nhưng chỉ phản chiếu origin hợp lệ, tránh lộ cookie cho domain lạ.
- [ ] Prisma schema và migrations được quản lý trong repo; không chạy migration tự động ở runtime nếu không kiểm soát.
- [ ] Đảm bảo HTTPS/TLS ở môi trường production (ngay cả khi API nội bộ).

## 8. Cost notes

- Tất cả thay đổi đều nằm trong cùng workload Node.js; không phát sinh dịch vụ mới.
- Chi phí bổ sung chủ yếu từ storage khi cache `.prisma` hoặc mirror engine nội bộ. Có thể dọn cache định kỳ hoặc dùng lifecycle policy.
- Multi-stage build giúp image nhỏ hơn, giảm bandwidth khi deploy.

## 9. Xử lý sự cố nhanh

- Nếu `curl` preflight vẫn 500: kiểm tra log xem có lỗi `Not allowed by CORS`. Xác nhận `evaluateOrigin` nhận đúng giá trị (`CORS_ORIGINS` có phân tách bằng dấu phẩy, không có khoảng trắng thừa).
- Nếu `pnpm --filter api dev` lỗi `prisma generate`: chạy lại bước generate trong mục 2, hoặc kiểm tra biến `PRISMA_SKIP_POSTINSTALL_GENERATE` có bị bật nhầm ở môi trường dev không.
- Khi cần cho phép domain mới: thêm vào `CORS_ORIGINS`, redeploy, rồi chạy smoke test lại.

> Tham khảo chính thức:
> - Fastify CORS Plugin — @fastify/cors (kiểm tra 2025-11-03): https://github.com/fastify/fastify-cors
> - Prisma Custom Engine Mirror (kiểm tra 2025-11-03): https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/configuring-prisma-client-environment#using-a-custom-engine-binary
