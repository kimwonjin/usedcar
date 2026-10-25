// 알마티 중고차 시장에서 많이 거래되는 제조사·모델 (Kolesa.kz 기준 항목·용어 참고)
export const POPULAR_MAKES: Record<string, string[]> = {
  Toyota: ["Camry", "Land Cruiser", "Land Cruiser Prado", "RAV4", "Corolla", "Highlander", "Alphard"],
  Hyundai: ["Accent", "Elantra", "Sonata", "Tucson", "Santa Fe", "Creta", "Palisade"],
  Kia: ["Rio", "K5", "Cerato", "Sportage", "Sorento", "Carnival"],
  Chevrolet: ["Cobalt", "Nexia", "Onix", "Malibu", "Tracker", "Captiva"],
  Lada: ["Granta", "Vesta", "Niva", "Priora", "Largus", "XRAY"],
  Lexus: ["RX", "LX", "ES", "GX", "NX", "LS"],
  "Mercedes-Benz": ["E-Class", "C-Class", "S-Class", "GLE", "GLS", "G-Class"],
  BMW: ["3 Series", "5 Series", "7 Series", "X3", "X5", "X7"],
  Volkswagen: ["Polo", "Passat", "Jetta", "Tiguan", "Touareg"],
  Nissan: ["Qashqai", "X-Trail", "Teana", "Patrol", "Juke"],
  Mitsubishi: ["Outlander", "Pajero", "Lancer", "ASX", "Montero Sport"],
  Audi: ["A4", "A6", "Q5", "Q7"],
  Honda: ["CR-V", "Accord", "Civic", "Odyssey"],
  Mazda: ["6", "CX-5", "3", "CX-9"],
  Subaru: ["Forester", "Outback", "XV"],
  Haval: ["Jolion", "H6", "Dargo"],
  Chery: ["Tiggo 7 Pro", "Tiggo 8 Pro", "Tiggo 4"],
  Geely: ["Coolray", "Monjaro", "Atlas"],
};

export const FUELS = ["petrol", "diesel", "gas", "hybrid", "electric"] as const;
export const TRANSMISSIONS = ["automatic", "manual"] as const;
export const STEERINGS = ["left", "right"] as const;

export type Fuel = (typeof FUELS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type Steering = (typeof STEERINGS)[number];

// S4 촬영 가이드 칸. defect를 뺀 7칸이 필수 (DB start_auction과 같은 규칙)
export const PHOTO_SLOTS = [
  "front",
  "rear",
  "left",
  "right",
  "interior",
  "dashboard",
  "trunk",
  "defect",
] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
export const REQUIRED_SLOTS = PHOTO_SLOTS.filter((slot) => slot !== "defect");
export const MAX_DEFECT_PHOTOS = 4;

export const MIN_YEAR = 1980;
