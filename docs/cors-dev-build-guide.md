# Runbook triển khai apps/api với CORS & Prisma

_Cập nhật lần cuối: 2025-11-03 (Asia/Bangkok)_

Runbook này rút gọn theo đúng luồng build → release → vận hành cho service `apps/api` (NestJS + Fastify + Prisma). Mỗi mục là checklist copy/paste, có đủ smoke test và rollback. Giá trị mặc định:

| Thành phần | Giá trị chuẩn |
| --- | --- |
| Cổng service | `3006` |
| CORS allow-list nội bộ | `http://localhost:3000,http://localhost:3001,http://localhost:3008` |
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Docker base image | `node:20-alpine` |

---

## 1️⃣ Kiến trúc & nguyên tắc

- Fastify bootstrap qua `apps/api/src/main.ts`, mount plugin `apps/api/src/plugins/cors.ts`. Plugin chỉ **allow** origin nằm trong allow-list mặc định + giá trị CSV ở biến `CORS_ORIGINS`. Callback `origin()` trả `true/false` để preflight không crash; middleware `onRequest` trả JSON `403 CORS_ORIGIN_BLOCKED` với log cảnh báo.
- Prisma Client phải được generate trước khi build hoặc start. Thiếu thư mục `node_modules/.prisma` ➜ lỗi `Prisma engine not found`.
- Monorepo sử dụng pnpm. Bất kỳ runner nào cũng phải bật `PNPM_ALLOW_SCRIPTS` để cho phép Prisma/sharp biên dịch.
- Nguyên tắc vận hành: least-privilege, origin nào không nằm trong danh sách là bị chặn; secrets không nằm trong repo.

---

## 2️⃣ Chuẩn bị môi trường (chạy 1 lần mỗi runner)

Thực thi tại `/workspace/BOOKING-APPS`.

- [ ] **Làm sạch và cài deps**

  ```bash
  find . -type d -name node_modules -prune -exec rm -rf {} +      # Reset cache cũ
  export PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
  pnpm install --frozen-lockfile
  ```

- [ ] **Bảo đảm dependency Prisma** (chỉ cần nếu repo mới clone)

  ```bash
  pnpm add -wD prisma
  pnpm --filter api add @prisma/client
  pnpm install --frozen-lockfile
  ```

- [ ] **Generate Prisma Client**

  ```bash
  pnpm -w prisma:generate
  ```

- [ ] **Kiểm tra scripts quan trọng** (`apps/api/package.json`)

  ```json
  {
    "scripts": {
      "prisma:generate": "pnpm -w prisma:generate",
      "prebuild": "pnpm run prisma:generate",
      "build": "pnpm exec tsc -p tsconfig.build.json",
      "start:prod": "NODE_ENV=production node dist/main.js"
    }
  }
  ```

- [ ] **Thiết lập biến môi trường mặc định**

  ```env
  NODE_ENV=production
  PORT=3006
  CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3008
  ```

---

## 3️⃣ Build & phát hành (chọn một lộ trình)

### 3.1 Docker multi-stage (dùng chung cho Helm & Compose)

```dockerfile
# apps/api/Dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/tsconfig*.json apps/api/
COPY packages/db/prisma packages/db/prisma
COPY packages packages

ENV PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
RUN pnpm install --frozen-lockfile
RUN pnpm -w prisma:generate

COPY apps/api apps/api
RUN pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3006 \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

EXPOSE 3006
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] Build & push image

  ```bash
  docker build -f apps/api/Dockerfile -t ghcr.io/<org>/<api-name>:<git-sha> .
  docker push ghcr.io/<org>/<api-name>:<git-sha>
  ```

### 3.2 Triển khai bằng Helm (production)

- [ ] Cập nhật `charts/api/values.yaml`

  ```yaml
  image:
    repository: ghcr.io/<org>/<api-name>
    tag: "<git-sha>"

  env:
    - name: NODE_ENV
      value: production
    - name: PORT
      value: "3006"
    - name: CORS_ORIGINS
      value: "http://localhost:3000,http://localhost:3001,http://localhost:3008"

  service:
    port: 3006

  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
  ```

- [ ] Rollout

  ```bash
  helm upgrade --install api charts/api -f charts/api/values.yaml
  # hoặc
  kubectl rollout restart deploy/api
  ```

### 3.3 Docker Compose (staging/dev)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: "3006"
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:3008"
    ports:
      - "3006:3006"
    restart: unless-stopped
```

```bash
docker compose build api
docker compose up -d api
```

### 3.4 Chạy trực tiếp (CI runner / debug)

```bash
export PNPM_ALLOW_SCRIPTS="@prisma/client @prisma/engines prisma sharp @tailwindcss/oxide"
pnpm install --frozen-lockfile
pnpm -w prisma:generate
pnpm --filter api build

CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:3008" \
PORT=3006 \
NODE_ENV=production \
pnpm --filter api start:prod
```

---

## 4️⃣ Smoke test & kiểm chứng

- [ ] **Preflight OPTIONS**

  ```bash
  curl -i -X OPTIONS "http://127.0.0.1:3006/pricing/quote" \
    -H "Origin: http://localhost:3008" \
    -H "Access-Control-Request-Method: POST"
  ```

  Kỳ vọng: HTTP 204/200, header `Access-Control-Allow-Origin` đúng origin, có `Access-Control-Allow-Credentials: true`. GET vào endpoint này trả 404 là đúng thiết kế.

- [ ] **POST quote thực tế**

  ```bash
  now=$(date -Iseconds)
  curl -i "http://127.0.0.1:3006/pricing/quote" \
    -H "Origin: http://localhost:3008" \
    -H "content-type: application/json" \
    --data @- <<JSON
  {
    "tripType": "AIRPORT",
    "airportCode": "HAN",
    "direction": "IN",
    "vehicleTypeId": 1,
    "startAt": "$now",
    "roundTrip": false,
    "withVat": true,
    "vatPct": 10,
    "fromText": "Noi Bai",
    "toText": "Hoan Kiem",
    "fromLat": 21.214,
    "fromLng": 105.806,
    "toLat": 21.033,
    "toLng": 105.851
  }
  JSON
  ```

  Bắt buộc có `direction` (`IN|OUT`) khi `tripType=AIRPORT`, thiếu sẽ nhận 400 với thông báo validation. Với `tripType=ROAD`, đổi sang `routeCode` và trường tương ứng.

---

## 5️⃣ Rollback nhanh

- [ ] **Helm**: `helm rollback api <revision>` hoặc `kubectl rollout undo deploy/api`.
- [ ] **Compose**: chỉnh tag image về bản ổn định rồi `docker compose up -d api`.
- [ ] **Node trực tiếp**: `git checkout <commit_cu>`, chạy lại bước build + start.
- [ ] **Bắt buộc** chạy lại smoke test mục 4 sau rollback.

---

## 6️⃣ Monitor & alert

- [ ] Log structured hai trường hợp: `blocked CORS origin`, `blocked request by CORS policy`.
- [ ] Metric Prometheus đề xuất: `http_requests_total{route="/pricing/quote",method="OPTIONS"}` với SLO ≥ 99.5% thành công.
- [ ] Alert nếu `403 CORS_ORIGIN_BLOCKED` > 1% trong 5 phút.
- [ ] Đính kèm `request-id`/`trace-id` trong log để correlating request; khuyến nghị bật OpenTelemetry.

---

## 7️⃣ Security checklist

- [ ] Allow-list origin thật; tuyệt đối không để `*` ở production.
- [ ] Secret đặt trong Secret Manager/K8s Secret/Compose env file, không commit.
- [ ] Bật HTTPS tại ingress/controller (tham khảo [Fastify HTTPS](https://fastify.dev/docs/latest/Guides/HTTPS/) — checked: 2025-11-03, Asia/Bangkok).
- [ ] Prisma migration chạy có kiểm soát, không tự động lúc container start.
- [ ] Runner CI chỉ có quyền cần thiết (pull repo, push image), không cấp quyền cluster production nếu không cần.

---

## 8️⃣ Cost notes

- Multi-stage Dockerfile giữ image nhỏ, tiết kiệm storage/bandwidth.
- Cache `node_modules/.prisma` và pnpm store trên CI để giảm thời gian runner.
- Không có workload bổ sung ngoài service hiện có.

---

## 9️⃣ Xử lý sự cố

- Thiếu Prisma engine ➜ chạy lại mục 2 (generate + copy `.prisma` vào artefact nếu runner offline). Tham khảo [Prisma docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/configuring-prisma-client-environment#using-a-custom-engine-binary) _(checked: 2025-11-03, Asia/Bangkok)._
- Dockerfile lỗi `FROM: command not found` ➜ tạo file bằng heredoc như ví dụ, không paste trực tiếp vào shell.
- Cảnh báo peer dependency NestJS ➜ kiểm tra version thực tế; cảnh báo không chặn build nhưng cần note trước khi nâng cấp.
- Sau khi đổi `CORS_ORIGINS`, luôn redeploy và chạy lại smoke test mục 4.

---

## 🔟 Checklist cuối cùng trước khi deploy

- [ ] `pnpm add -wD prisma` & `pnpm --filter api add @prisma/client` (nếu repo mới).
- [ ] `pnpm install --frozen-lockfile` + `pnpm -w prisma:generate` chạy OK.
- [ ] `pnpm --filter api build` pass.
- [ ] Docker image/artefact đã cập nhật và push thành công.
- [ ] Env chứa `PORT=3006` + `CORS_ORIGINS` đúng origin.
- [ ] Smoke test OPTIONS + POST pass.
- [ ] Monitor & alert bật, có log structured.

---

> Mọi thay đổi liên quan CORS, Prisma hoặc pipeline build cần cập nhật lại runbook này để tránh drift cấu hình.
