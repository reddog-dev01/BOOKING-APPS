import BookingForm from "../components/BookingForm";
import BannerCarousel from "../components/BannerCarousel";

export default function Home() {
  // Ảnh tĩnh (đặt file vào /public/banners như checklist cuối)
  const banners = [
    { src: "/banners/banner-1.jpg", alt: "Xe đưa đón Nội Bài 24/7" },
    { src: "/banners/banner-2.jpg", alt: "Giá trọn gói minh bạch" },
    { src: "/banners/banner-3.jpg", alt: "Tài xế chuyên nghiệp" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4">
      {/* Hero ngắn */}
      <section className="py-6 text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold">Taxi Nội Bài — Giá trọn gói</h1>
        <p className="text-gray-600">Đặt nhanh 24/7 • 1 chiều / 2 chiều • Xuất VAT.</p>
      </section>

      {/* LAYOUT: Trái Form nhỏ, Phải Carousel */}
      <section className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Card form nhỏ bên trái */}
        <div>
          <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 max-w-md">
            <div className="text-xl font-bold mb-3">ĐẶT XE</div>
            <BookingForm />
          </div>
        </div>

        {/* Carousel bên phải */}
        <div>
          <BannerCarousel images={banners} heightClass="h-64 md:h-80" autoplayMs={4000} />
          {/* (tuỳ chọn) danh sách đơn mới đặt */}
          <ul className="mt-6 space-y-4 text-purple-800 font-semibold">
            <li className="flex justify-between">
              <span>K.Hàng: Anh Hưng 086.922.7***</span>
              <span className="text-gray-600 font-normal">vừa đặt xe đi sân bay</span>
            </li>
            <li className="flex justify-between">
              <span>K.Hàng: Mr Dương 097.760.3***</span>
              <span className="text-gray-600 font-normal">vừa đặt xe đi sân bay</span>
            </li>
            <li className="flex justify-between">
              <span>K.Hàng: Quỳnh Anh 094.340.1***</span>
              <span className="text-gray-600 font-normal">vừa đặt xe đi sân bay</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
