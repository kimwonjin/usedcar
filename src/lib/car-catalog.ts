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

export const BODY_TYPES = ["sedan", "suv", "hatchback", "wagon", "minivan", "pickup", "coupe"] as const;
export const COLORS = ["white", "black", "silver", "gray", "blue", "red", "brown", "green", "other"] as const;
export type BodyType = (typeof BODY_TYPES)[number];
export type CarColor = (typeof COLORS)[number];
// VIN: 17자, I·O·Q 없음 (오래된 일본 내수차는 차대번호 형식이 달라 비워 둘 수 있다)
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const FUELS = ["petrol", "diesel", "gas", "hybrid", "electric"] as const;
export const TRANSMISSIONS = ["automatic", "manual"] as const;
export const STEERINGS = ["left", "right"] as const;

export type Fuel = (typeof FUELS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type Steering = (typeof STEERINGS)[number];

// S4 촬영 가이드 칸. 앞 7칸이 필수 (DB start_auction과 같은 규칙), 나머지는 선택
export const REQUIRED_SLOTS = ["front", "rear", "left", "right", "interior", "dashboard", "trunk"] as const;
export const PHOTO_SLOTS = [...REQUIRED_SLOTS, "engine", "tires", "rear_seat", "defect"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
export const isRequiredSlot = (slot: PhotoSlot) => (REQUIRED_SLOTS as readonly string[]).includes(slot);
// 여러 장 올리는 칸 (나머지는 한 장, 다시 찍으면 교체)
export const MULTI_PHOTO_SLOTS: Partial<Record<PhotoSlot, number>> = { tires: 4, defect: 4 };

export const MIN_YEAR = 1980;

// 차량 상태표 (DB cars.options / accident / owners / damage)
export const CAR_OPTIONS = [
  "sunroof",
  "leather",
  "navigation",
  "rear_camera",
  "camera_360",
  "parking_sensors",
  "heated_seats",
  "ventilated_seats",
  "heated_steering",
  "cruise",
  "keyless",
  "awd",
  "third_row",
  "led_lights",
  "autostart",
  "winter_tires",
] as const;
export type CarOption = (typeof CAR_OPTIONS)[number];

export const ACCIDENTS = ["none", "minor", "major"] as const;
export type Accident = (typeof ACCIDENTS)[number];

// 위에서 본 차량 외판 부위. 왼쪽 = 운전석 기준 왼쪽
export const PANELS = [
  "front_bumper",
  "hood",
  "fl_fender",
  "fr_fender",
  "fl_door",
  "fr_door",
  "roof",
  "rl_door",
  "rr_door",
  "rl_quarter",
  "rr_quarter",
  "trunk",
  "rear_bumper",
] as const;
export type Panel = (typeof PANELS)[number];

export const DAMAGE_KINDS = ["scratch", "dent", "painted", "replaced"] as const;
export type DamageKind = (typeof DAMAGE_KINDS)[number];
export type DamageMap = Partial<Record<Panel, DamageKind>>;
