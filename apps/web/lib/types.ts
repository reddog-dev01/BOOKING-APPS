/* ====== FE <-> API DTOs ====== */

export type TripTypeDto = "AIRPORT" | "ROAD";
export type DirectionDto = "to_airport" | "from_airport";

export type QuoteRequestDto = {
  tripType: TripTypeDto;       // "AIRPORT" | "ROAD"
  routeCode?: string;          // mã tuyến ROAD nếu có
  vehicleTypeId: number;
  startAt: string;             // ISO "yyyy-mm-ddTHH:MM"
  roundTrip: boolean;
  withVat: boolean;            // VAT tick: true/false (mức % BE tự quyết theo cấu hình admin)
  vatPct?: number;             // 0|8|10 nếu người dùng chọn cụ thể

  // text + toạ độ (ưu tiên toạ độ để tính km driving)
  fromText: string;
  toText: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  distanceKm?: number;         // FE có thể gửi sẵn nếu biết

  // Airport optional
  airportCode?: string;        // ví dụ "HAN"
  direction?: DirectionDto;    // "to_airport" | "from_airport"

  // Round trip optional
  waitHours?: number;          // >= 0

  // Coupon optional
  couponCode?: string;
  stops?: string[];
};

export type QuoteResponse = {
  id?: string;                 // nếu BE có sinh id cho quote
  vehicleTypeId?: number;
  distanceKm?: number;
  perKmVnd?: number;
  waitMinutes?: number;
  waitRatePerHour?: number;
  priceDistanceVnd?: number;
  priceWaitingVnd?: number;
  subtotalVnd?: number;
  discountVnd?: number;
  vatPct?: number;
  defaultVatPct?: number;
  vatVnd?: number;
  currency?: "VND";
  totalVnd: number;            // tổng tiền (đã gồm VAT nếu withVat = true)
  // có thể bổ sung breakdown nếu BE trả về
};

export type CreateBookingRequestDto = QuoteRequestDto & {
  stops?: string[];            // danh sách điểm dừng
  customerName: string;
  phone: string;               // đã chuẩn hoá 0xxxxxxxx
  quoteId?: string;            // nếu muốn liên kết quote
};

export type CreateBookingResponse = {
  id: string;
  status: "confirmed" | "pending" | "failed";
  totalVnd?: number;
};

/* ====== UI state (BookingForm) ====== */
export type UiStop = { id: string; text: string };

export type UiBookingState = {
  tripType: "airport" | "road";
  routeCode?: string;
  vehicleTypeId: number;
  startAt: string;
  roundTrip: boolean;
  withVat: boolean;
  vatPct?: number;
  fromText: string;
  toText: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  distanceKm?: number;
  airportCode?: string;
  direction?: DirectionDto;
  waitHours?: number;
  couponCode?: string;
  stops?: UiStop[];
};
