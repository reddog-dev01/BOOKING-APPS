/* ====== FE <-> API DTOs ====== */

export type TripTypeDto = "AIRPORT" | "ROAD";
export type DirectionDto = "to_airport" | "from_airport";

export type QuoteRequestDto = {
  tripType: TripTypeDto;       // "AIRPORT" | "ROAD"
  vehicleTypeId: number;
  startAt: string;             // ISO "yyyy-mm-ddTHH:MM"
  roundTrip: boolean;
  withVat: boolean;            // VAT tick: true/false (mức % BE tự quyết theo cấu hình admin)

  // text + toạ độ (ưu tiên toạ độ để tính km driving)
  fromText: string;
  toText: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;

  // Airport optional
  airportCode?: string;        // ví dụ "HAN"
  direction?: DirectionDto;    // "to_airport" | "from_airport"

  // Round trip optional
  waitHours?: number;          // >= 0

  // Coupon optional
  couponCode?: string;
};

export type QuoteResponse = {
  id?: string;                 // nếu BE có sinh id cho quote
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
};
