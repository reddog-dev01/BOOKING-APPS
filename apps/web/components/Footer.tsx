export default function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="max-w-6xl mx-auto px-4 py-8 grid sm:grid-cols-2 gap-6 text-sm text-gray-600">
        <div>
          <div className="font-semibold text-black mb-2">Đặt xe sân bay</div>
          <p>Giá trọn gói, đặt nhanh 24/7, hỗ trợ VAT, 1 chiều/2 chiều.</p>
        </div>
        <div>
          <div className="font-semibold text-black mb-2">Liên hệ</div>
          <p>Hotline: 0969 xxxx xx</p>
          <p>Email: support@example.com</p>
        </div>
      </div>
      <div className="text-center text-xs text-gray-500 pb-6">© {new Date().getFullYear()} Booking</div>
    </footer>
  );
}
