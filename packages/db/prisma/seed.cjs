/* prisma/seed.cjs — v2 (for upgraded schema with Airport & typed SiteSetting) */
const { PrismaClient, TripType, TrunkSize } = require("@prisma/client");
const p = new PrismaClient();

/* ==================== Utils ==================== */
async function fixSerialSequence(table, col = "id") {
  await p.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"','${col}'), (SELECT COALESCE(MAX("${col}"),0) FROM "${table}"))`
  );
}
async function upsertOne(model, where, create, update) {
  return p[model].upsert({ where, create, update });
}

/* ==================== Airports (fixed coordinates) ==================== */
async function upsertAirports() {
  const airports = [
    {
      code: "HAN",
      name: "Nội Bài (HAN)",
      address: "Phú Minh, Sóc Sơn, Hà Nội",
      lat: 21.218714,
      lng: 105.804817,
      isActive: true,
    },
    // Thêm sau: HPH (Cát Bi), VDO (Vân Đồn)...
  ];

  for (const a of airports) {
    await p.airport.upsert({
      where: { code: a.code },
      create: a,
      update: {
        name: a.name,
        address: a.address,
        lat: a.lat,
        lng: a.lng,
        isActive: a.isActive,
      },
    });
  }
}

/* ==================== Vehicle Types (with trunkSize) ==================== */
// Giá/km: 4 nhỏ=7000, 4 rộng=8000, 7=9000, 16=10000, 29=11000, 45=12000
async function upsertVehicleTypes() {
  const types = [
    { id: 1, name: "4 chỗ cốp nhỏ", capacity: 4,  img: "/vehicles/4seats.png",  alt: "Xe 4 chỗ cốp nhỏ", trunkSize: TrunkSize.SMALL, isActive: true, perKmVnd: 7000 },
    { id: 2, name: "4 chỗ cốp rộng", capacity: 4,  img: "/vehicles/5seats.png",  alt: "Xe 4 chỗ cốp rộng", trunkSize: TrunkSize.LARGE, isActive: true, perKmVnd: 8000 },
    { id: 3, name: "7 chỗ",          capacity: 7,  img: "/vehicles/7seats.png",  alt: "Xe 7 chỗ",          trunkSize: TrunkSize.LARGE, isActive: true, perKmVnd: 9000 },
    { id: 4, name: "16 chỗ",         capacity: 16, img: "/vehicles/16seats.png", alt: "Xe 16 chỗ",         trunkSize: TrunkSize.LARGE, isActive: true, perKmVnd: 10000 },
    // intentionally skipping id=5 for forward-compat
    { id: 6, name: "29 chỗ",         capacity: 29, img: "/vehicles/29seats.png", alt: "Xe 29 chỗ",         trunkSize: TrunkSize.LARGE, isActive: true, perKmVnd: 11000 },
    { id: 7, name: "45 chỗ",         capacity: 45, img: "/vehicles/45seats.png", alt: "Xe 45 chỗ",         trunkSize: TrunkSize.LARGE, isActive: true, perKmVnd: 12000 },
  ];

  for (const t of types) {
    await p.vehicleType.upsert({
      where: { id: t.id },
      create: t,
      update: {
        name: t.name,
        capacity: t.capacity,
        img: t.img,
        alt: t.alt,
        trunkSize: t.trunkSize,
        isActive: t.isActive,
        perKmVnd: t.perKmVnd,
      },
    });
  }
  await fixSerialSequence("VehicleType", "id");
}

/* ==================== Routes ==================== */
// ROAD dùng distanceKm cố định; AIRPORT chỉ để hiển thị (pricing dùng Directions API)
async function upsertRoutes() {
  const routes = [
    // ROAD
    { code: "HN-QN", tripType: TripType.ROAD, fromLabel: "Hà Nội",     toLabel: "Quảng Ninh",  distanceKm: 155, isActive: true },
    { code: "QN-HN", tripType: TripType.ROAD, fromLabel: "Quảng Ninh", toLabel: "Hà Nội",      distanceKm: 155, isActive: true },

    // (optional) AIRPORT
    { code: "HN-NB", tripType: TripType.AIRPORT, fromLabel: "Hà Nội",          toLabel: "Sân bay Nội Bài", distanceKm: 30,  isActive: true },
    { code: "NB-HN", tripType: TripType.AIRPORT, fromLabel: "Sân bay Nội Bài", toLabel: "Hà Nội",           distanceKm: 30,  isActive: true },
  ];

  for (const r of routes) {
    await p.route.upsert({
      where: { code: r.code },
      create: r,
      update: {
        tripType: r.tripType,
        fromLabel: r.fromLabel,
        toLabel: r.toLabel,
        distanceKm: r.distanceKm,
        isActive: r.isActive,
      },
    });
  }
}

async function getRouteIdByCode(code) {
  const r = await p.route.findUnique({ where: { code } });
  if (!r) throw new Error(`Route ${code} not found — hãy seed tuyến trước`);
  return r.id;
}

async function getVehicleTypeIdByName(name) {
  const vt = await p.vehicleType.findFirst({ where: { name } });
  if (!vt) throw new Error(`VehicleType ${name} not found`);
  return vt.id;
}

/* ==================== Price Policies (ROAD compat) ==================== */
const POLICY_EFFECTIVE_FROM = new Date("2025-01-01T00:00:00.000Z");

async function upsertPolicies() {
  const HN_QN = await getRouteIdByCode("HN-QN");
  const QN_HN = await getRouteIdByCode("QN-HN");

  const VT_4_SMALL = await getVehicleTypeIdByName("4 chỗ cốp nhỏ");
  const VT_4_WIDE  = await getVehicleTypeIdByName("4 chỗ cốp rộng");
  const VT_7       = await getVehicleTypeIdByName("7 chỗ");
  const VT_16      = await getVehicleTypeIdByName("16 chỗ");
  const VT_29      = await getVehicleTypeIdByName("29 chỗ");
  const VT_45      = await getVehicleTypeIdByName("45 chỗ");

  const mk = (routeId, items) =>
    items.map(({ vt, base }) => ({
      routeId,
      vehicleTypeId: vt,
      basePriceVnd: base,
      roundTripPct: 100,
      nightPct: 20,
      vatPctDefault: 10,
      effectiveFrom: POLICY_EFFECTIVE_FROM,
    }));

  const data = [
    ...mk(HN_QN, [
      { vt: VT_4_SMALL, base: 1_200_000 },
      { vt: VT_4_WIDE,  base: 1_400_000 },
      { vt: VT_7,       base: 1_700_000 },
      { vt: VT_16,      base: 2_300_000 },
      { vt: VT_29,      base: 3_000_000 },
      { vt: VT_45,      base: 3_800_000 },
    ]),
    ...mk(QN_HN, [
      { vt: VT_4_SMALL, base: 1_200_000 },
      { vt: VT_4_WIDE,  base: 1_400_000 },
      { vt: VT_7,       base: 1_700_000 },
      { vt: VT_16,      base: 2_300_000 },
      { vt: VT_29,      base: 3_000_000 },
      { vt: VT_45,      base: 3_800_000 },
    ]),
  ];

  await p.pricePolicy.createMany({ data, skipDuplicates: true });
}

/* ==================== Banners ==================== */
async function upsertBanners() {
  const banners = [
    { src: "/banners/banner-1.jpg", alt: "Xe đưa đón Nội Bài 24/7", sortOrder: 1, isActive: true },
    { src: "/banners/banner-2.jpg", alt: "Giá trọn gói minh bạch",   sortOrder: 2, isActive: true },
    { src: "/banners/banner-3.jpg", alt: "Tài xế chuyên nghiệp",     sortOrder: 3, isActive: true },
  ];
  for (const b of banners) {
    await p.banner.upsert({
      where: { src_sortOrder: { src: b.src, sortOrder: b.sortOrder } }, // @@unique([src, sortOrder])
      create: b,
      update: { alt: b.alt, isActive: b.isActive },
    });
  }
}

/* ==================== Site Setting (typed) ==================== */
async function upsertSiteSettingTyped() {
  await p.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      vatOptions: [0, 8, 10],
      defaultVatPct: 10,
      waitRatePerHour: 30000, // 60k/h — admin chỉnh được
      roundTripWaitMinutes: 90,
      mapProvider: "google",
    },
    update: {
      vatOptions: [0, 8, 10],
      defaultVatPct: 10,
      waitRatePerHour: 30000,
      roundTripWaitMinutes: 90,
      mapProvider: "google",
    },
  });
}

/* ==================== Main ==================== */
async function main() {
  await upsertAirports();
  await upsertVehicleTypes();
  await upsertRoutes();
  await upsertPolicies();       // ROAD compat
  await upsertBanners();
  await upsertSiteSettingTyped();

  console.log("✅ Seed v2 (upgraded schema) DONE");
}

main()
  .catch((e) => {
    console.error("❌ Seed v2 failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
