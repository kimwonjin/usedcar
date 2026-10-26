import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicSale = {
  make: string;
  model: string;
  year: number;
  mileage_km: number;
  price: number;
  bidders: number;
  completed_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 공유 링크로 보는 판매 결과 (페이지·미리보기 이미지·메타데이터가 한 요청에서 같이 쓴다)
export const loadPublicSale = cache(async (dealId: string): Promise<PublicSale | null> => {
  const supabase = createPublicClient();
  if (!supabase || !UUID.test(dealId)) return null;
  const { data } = await supabase.rpc("public_sale", { p_deal_id: dealId }, { get: true });
  return ((data as PublicSale[] | null) ?? [])[0] ?? null;
});
