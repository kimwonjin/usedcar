import type { SupabaseClient } from "@supabase/supabase-js";

// 딜러 낙찰 수수료 구간표. 실제 값은 DB fee_bands(관리자 설정 화면)에서 읽고, 못 읽으면 기본값을 쓴다.
// 청구서 금액은 DB calc_dealer_fee 가 같은 표로 계산한다.
export type FeeBand = { max_price: number | null; fee: number };

export const DEFAULT_FEE_BANDS: FeeBand[] = [
  { max_price: 3_000_000, fee: 50_000 },
  { max_price: 7_000_000, fee: 80_000 },
  { max_price: 15_000_000, fee: 120_000 },
  { max_price: null, fee: 180_000 },
];

export async function loadFeeBands(supabase: SupabaseClient): Promise<FeeBand[]> {
  const { data } = await supabase.from("fee_bands").select("max_price, fee").order("max_price", { nullsFirst: false });
  return data?.length ? (data as FeeBand[]) : DEFAULT_FEE_BANDS;
}

export function dealerFee(price: number, bands: FeeBand[] = DEFAULT_FEE_BANDS): number {
  const band = bands.find((b) => b.max_price === null || price <= b.max_price) ?? bands[bands.length - 1];
  return band.fee;
}
