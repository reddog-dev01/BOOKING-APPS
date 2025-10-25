export type Airport = {
  code: string;
  text: string; // label hiển thị
  lat: number;
  lng: number;
};

// Sân bay Nội Bài – cố định cho tab "Sân bay"
export const AIRPORTS: Record<string, Airport> = {
  HAN: {
    code: "HAN",
    text: "Sân bay Nội Bài",
    lat: 21.214184,  // toạ độ tham khảo nhà ga T2
    lng: 105.802971,
  },
};
