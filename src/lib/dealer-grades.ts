import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealerGrade } from "@/components/dealer-grade";

// 여러 딜러의 등급을 한 번에 (승인 딜러만 돌려준다)
export async function loadDealerGrades(supabase: SupabaseClient, dealerIds: string[]): Promise<Record<string, DealerGrade>> {
  if (dealerIds.length === 0) return {};
  const { data } = await supabase.rpc("dealer_grades", { p_dealer_ids: dealerIds });
  return Object.fromEntries(((data ?? []) as { dealer_id: string; grade: DealerGrade }[]).map((r) => [r.dealer_id, r.grade]));
}
