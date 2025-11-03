# Sổ tay CORS localhost & build Prisma

_Lần rà soát gần nhất: 2025-11-03 (Asia/Bangkok)_

## Tổng quan

Tài liệu này mô tả cách API kiểm soát CORS trong môi trường localhost và các chiến lược build khi runner CI/CD bị chặn truy cập CDN Prisma.

## Kiến trúc CORS

- Plugin Fastify tại `apps/api/src/plugins/cors.ts` chuẩn hóa (normalize) mọi giá trị `Origin`, phản hồi lại origin hợp lệ và chặn phần còn lại bằng `onRequest`, trả về JSON `403` thay vì lỗi `500`.
- Danh sách cho phép mặc định bao gồm `http/https://localhost|127.0.0.1:3000-3008`; có thể mở rộng qua biến môi trường `CORS_ORIGINS`.
- Đặt `CORS_ORIGINS=*` sẽ bật chế độ wildcard (vẫn hỗ trợ cookie vì plugin phản chiếu Origin yêu cầu).
- Origin bị chặn sẽ sinh log có cấu trúc (`blocked CORS origin`, `blocked request by CORS policy`) để dễ truy vết.

## Ma trận build khi không tải được Prisma engines

### ✅ Build chuẩn (runner có Internet)

```bash
pnpm install
pnpm approve-builds prisma
pnpm -w prisma:generate
pnpm --filter api build
```

### ✅ Chiến lược A — Docker multi-stage (khuyến nghị)

Generate Prisma Client/engine ở stage build có Internet, rồi copy artefact sang image runtime.

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /app
COPY pnpm-*.yaml package.json pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm approve-builds prisma
COPY . .
RUN pnpm -w prisma:generate \
  && pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/node_modules/@prisma/client ./apps/api/node_modules/@prisma/client
EXPOSE 3006
CMD ["node", "apps/api/dist/main.js"]
```

### ✅ Chiến lược B — Mirror Prisma nội bộ

1. Mirror `https://binaries.prisma.sh` vào object storage nội bộ.
2. Cấu hình runner:

```bash
export PRISMA_ENGINES_MIRROR=https://artifacts.internal.example.com/prisma/
pnpm -w prisma:generate
```

Tham khảo: [Prisma engine mirror docs (kiểm tra 2025-11-03)](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/configuring-prisma-client-environment#using-a-custom-engine-binary).

### ✅ Chiến lược C — Cache artefact đã generate

1. Cache giữa các job: `node_modules/.prisma/`, `apps/api/node_modules/@prisma/client/`, và pnpm store.
2. Bỏ qua bước generate khi đã có cache:

```bash
export PRISMA_SKIP_POSTINSTALL_GENERATE=1
pnpm --filter api build
```

## Smoke test

```bash
curl -i -X OPTIONS 'http://127.0.0.1:3006/pricing/quote' \
  -H 'Origin: http://localhost:3008' \
  -H 'Access-Control-Request-Method: POST'
```

Nếu nhận `204` kèm header `Access-Control-Allow-Origin: http://localhost:3008` nghĩa là cấu hình đã đúng.

> ℹ️ Endpoint `/pricing/quote` chỉ hỗ trợ `POST`. Gọi trực tiếp bằng trình duyệt (GET) sẽ trả `404` — hành vi bình thường.

## Quan sát & giám sát

- Theo dõi log Fastify với message `blocked CORS origin` và `blocked request by CORS policy`.
- Đặt SLO tối thiểu 99.5% thành công cho các request `OPTIONS /pricing/quote`.
- Cảnh báo khi `403 CORS_ORIGIN_BLOCKED` tăng đột biến từ những origin được kỳ vọng.

## Xử lý sự cố

- Nếu trình duyệt báo `Not allowed by CORS`, kiểm tra log API xem có dòng `blocked request by CORS policy` hay không. Đảm bảo origin nằm trong `CORS_ORIGINS` (phân tách bằng dấu phẩy, không có khoảng trắng) hoặc thuộc nhóm localhost mặc định.
- Khi chạy `pnpm --filter api dev`, cần chắc chắn Prisma engines đã được generate trước đó (theo các chiến lược build ở trên); nếu thiếu, `pnpm exec prisma generate` sẽ lỗi và Fastify không khởi động.
