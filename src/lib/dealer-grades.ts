import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealerGrade } from "@/components/dealer-grade";

// 여러 딜러의 등급을 한 번에 (승인 딜러만 돌려준다)
export async function loadDealerGrades(supabase: SupabaseClient, dealerIds: string[]): Promise<Record<string, DealerGrade>> {
  if (dealerIds.length === 0) return {};
  const { data } = await supabase.rpc("dealer_grades", { p_dealer_ids: dealerIds });
  return Object.fromEntries(((data ?? []) as { dealer_id: string; grade: DealerGrade }[]).map((r) => [r.dealer_id, r.grade]));
}

// 딜러별 방문 후 감가 기록 (완료 거래 기준, 승인 딜러만)
export type DealerDepreciation = { deals: number; reduced: number; avgRate: number };

export async function loadDealerDepreciation(
  supabase: SupabaseClient,
  dealerIds: string[],
): Promise<Record<string, DealerDepreciation>> {
  if (dealerIds.length === 0) return {};
  const { data } = await supabase.rpc("dealer_depreciation", { p_dealer_ids: dealerIds });
  return Object.fromEntries(
    ((data ?? []) as { dealer_id: string; deals: number; reduced: number; avg_rate: number }[]).map((r) => [
      r.dealer_id,
      { deals: r.deals, reduced: r.reduced, avgRate: Number(r.avg_rate) },
    ]),
  );
}
