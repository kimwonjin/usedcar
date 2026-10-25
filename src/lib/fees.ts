// 딜러 낙찰 수수료 (임시 구간표). 실제 정책이 정해지면 이 표만 바꾼다.
const FEE_BANDS: [maxPrice: number, fee: number][] = [
  [3_000_000, 50_000],
  [7_000_000, 80_000],
  [15_000_000, 120_000],
  [Infinity, 180_000],
];

export function dealerFee(price: number): number {
  return FEE_BANDS.find(([max]) => price <= max)![1];
}
