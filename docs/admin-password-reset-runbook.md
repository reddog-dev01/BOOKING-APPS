# Runbook: Khôi phục/đặt lại mật khẩu admin dashboard

Quy trình dành cho IT khi tài khoản admin báo quên mật khẩu. Mục tiêu: khôi phục nhanh, tránh lộ mật khẩu, đảm bảo audit đầy đủ.

## Bước 1: Xác minh yêu cầu
- Xác thực người yêu cầu qua kênh công ty (email @fleetops.vn hoặc Slack đã đăng nhập SSO).
- Yêu cầu xác nhận của quản lý trực tiếp hoặc trưởng ca vận hành.
- Ghi nhận ticket/hồ sơ: người yêu cầu, thời gian, kênh liên hệ.

## Bước 2: Sinh mật khẩu mới (không dùng lại mật khẩu cũ)
```bash
# Tạo mật khẩu 20 ký tự ngẫu nhiên, chứa chữ hoa/thường/số/ký tự đặc biệt
openssl rand -base64 30 | tr -d '\n' | head -c 20
```
- Không gửi mật khẩu qua chat công khai; ưu tiên gọi điện hoặc tin nhắn được mã hóa end-to-end.
- Lưu giá trị tạm thời trong trình quản lý mật khẩu (không ghi vào ticket).

## Bước 3: Cập nhật secret cho admin dashboard
Tùy môi trường, cập nhật biến `ADMIN_PASSWORD` và khởi động lại dịch vụ:
- **Docker Compose cục bộ**
  ```bash
  cd /workspace/BOOKING-APPS
  # Cập nhật file .env hoặc apps/admin/.env.local
  echo "ADMIN_PASSWORD=<MAT_KHAU_MOI>" >> apps/admin/.env.local
  docker compose restart admin
  ```
- **Triển khai cloud (Vercel/Docker/K8s)**
  - Cập nhật secret/env `ADMIN_PASSWORD` trong Secret Manager/parameter store.
  - Triggger rollout lại pod/dịch vụ admin (ví dụ `kubectl rollout restart deploy/admin`).

## Bước 4: Xác nhận đăng nhập
- Thử đăng nhập bằng email admin được cấp và mật khẩu mới trên môi trường tương ứng.
- Xóa mọi phiên trình duyệt cũ nếu đăng nhập thất bại (cookie `admin-auth`).

## Bước 5: Hoàn tất & audit
- Ghi log: thời gian hoàn tất, người thực hiện, cách xác minh, hash (SHA-256) của mật khẩu mới để đối chiếu nếu cần.
- Nhắc người dùng đổi mật khẩu tại lần đăng nhập đầu tiên và xác nhận đã lưu ở trình quản lý mật khẩu cá nhân.

## Phòng ngừa
- Bật cảnh báo đăng nhập bất thường trên log dashboard.
- Định kỳ quay vòng `ADMIN_PASSWORD` (30-60 ngày) và lưu lịch trong lịch vận hành.
