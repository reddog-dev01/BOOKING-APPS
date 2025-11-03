# Hướng dẫn khắc phục lỗi Jest trong apps/web

Tài liệu này giải thích vì sao `pnpm --filter web test -- googlePlacesRest` có thể báo `jest: not found`, đồng thời hướng dẫn cài đặt đúng devDependencies và cấu hình cho workspace `apps/web`.

## 1. Quy trình CLI (copy/paste)

```bash
# 1) Cài deps test cho gói apps/web
pnpm --filter web add -D jest ts-jest @types/jest \
  jest-environment-jsdom @testing-library/react @testing-library/jest-dom

# (Nếu Jest yêu cầu ts-node trên Node 20+)
pnpm --filter web add -D ts-node

# 2) Đảm bảo tồn tại config + setup (repo đã cung cấp sẵn)
#    apps/web/jest.config.ts
#    apps/web/jest.setup.ts

# 3) Thêm script test (đã có sẵn trong apps/web/package.json)
#    "test": "jest"
#    "test:watch": "jest --watch"

# 4) Cập nhật lockfile
pnpm install

# 5) Chạy test đích danh
debug=jest pnpm --filter web test -- googlePlacesRest
```

> [!TIP]
> Nếu registry npm chặn truy cập, đặt `npm_config_registry=https://registry.npmjs.org/` rồi chạy lại các lệnh `pnpm add`. Repository đã bật `node-linker=hoisted` nên binary `jest` sẽ xuất hiện ở `apps/web/node_modules/.bin/jest` sau khi cài thành công.

## 2. Kiến trúc test

- **Test runner**: Jest 29 + `ts-jest` (transpile TypeScript on-the-fly). Không cần Babel cho Node 20.
- **Environment**: `jest-environment-jsdom` để giả lập DOM cho component test.
- **Thư viện hỗ trợ**: React Testing Library (`@testing-library/react`) và matcher mở rộng (`@testing-library/jest-dom`).
- **Alias**: `@/` trỏ về gốc `apps/web` (map trong `jest.config.ts`).
- **Mocking**: Thư mục `apps/web/test/__mocks__` chứa stub cho `server-only` và các module Next.js đặc thù.

## 3. Triển khai trong repository

1. `apps/web/jest.config.ts`
   - `preset: "ts-jest"`, `testEnvironment: "jest-environment-jsdom"`.
   - `testMatch` bao phủ cả `*.spec.ts(x)` lẫn `*.test.ts(x)` bên trong `__tests__/`.
   - `setupFilesAfterEnv` trỏ tới `jest.setup.ts` và ánh xạ alias `@/`.
2. `apps/web/jest.setup.ts`
   - Thử nạp `@testing-library/jest-dom` (log cảnh báo nhẹ nếu chưa cài – giúp unit test vẫn chạy được trên môi trường CI tối giản).
   - Polyfill `TextEncoder/TextDecoder` bằng Node `util` để tránh lỗi trên Node 18/20.
3. `apps/web/package.json`
   - Script `pnpm --filter web test -- <pattern>` kích hoạt Jest CLI.
   - `test:watch` dành cho loop local.
4. `__tests__/googlePlacesRest.test.ts`
   - Ví dụ unit test server utilities (mock `global.fetch`, sử dụng fake timers).

## 4. Lưu ý khi chạy trong CI/Docker

- **Không cài sai scope**: Luôn dùng `pnpm --filter web add ...` để tránh install devDeps ở root.
- **Cache pnpm**: Nếu dùng CI, lưu `~/.local/share/pnpm/store` để tái sử dụng binary Jest.
- **TextEncoder**: Nếu vẫn gặp lỗi liên quan tới `TextEncoder`, kiểm tra rằng CI không override `NODE_OPTIONS=--experimental-global-webcrypto` (có thể xung đột với polyfill).
- **Mock fetch**: Với test server-side, dùng `global.fetch = jest.fn()` như trong ví dụ; tránh gọi network thật.

## 5. Khi nào cần xoá node_modules

Nếu `pnpm install` báo thiếu quyền ghi hoặc lockfile lệch phiên bản:

```bash
rm -rf node_modules apps/*/node_modules
pnpm install
```

Sau đó chạy lại lệnh test. Jest sẽ tự sinh lại cache trong `.jest/cache` nếu có.

---

Giữ tài liệu này bên cạnh README giúp dev mới nhanh chóng sửa lỗi Jest và hiểu cấu trúc test của frontend.
