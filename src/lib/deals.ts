import "server-only";
import { signedUrlMap } from "./storage";
import { createClient } from "./supabase/server";

export type DealDetail = {
  id: string;
  status: "scheduled" | "depreciation_review" | "completed" | "cancelled";
  agreed_price: number;
  final_price: number | null;
  meeting_at: string | null;
  meeting_place: string | null;
  seller_id: string;
  dealer_id: string;
  seller_rating: number | null;
  auction_id: string;
  auctions: {
    cars: {
      id: string;
      make: string;
      model: string;
      year: number;
      plate_number: string;
      car_photos: { slot: string; storage_path: string }[];
    };
  };
};

export type Claim = {
  id: string;
  amount: number;
  reason: string;
  photo_paths: string[];
  status: "submitted" | "approved" | "rejected";
  seller_comment: string | null;
  admin_note: string | null;
  created_at: string;
  photoUrls: string[];
};

// 거래 상세 + 감가 청구(사진 서명 URL 포함). 당사자·관리자만 RLS로 읽힌다.
export async function loadDeal(dealId: string) {
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, status, agreed_price, final_price, meeting_at, meeting_place, seller_id, dealer_id, seller_rating, auction_id, auctions(cars(id, make, model, year, plate_number, car_photos(slot, storage_path)))",
    )
    .eq("id", dealId)
    .maybeSingle()
    .overrideTypes<DealDetail, { merge: false }>();
  if (!deal) return null;

  const { data: claimRows } = await supabase
    .from("depreciation_claims")
    .select("id, amount, reason, photo_paths, status, seller_comment, admin_note, created_at")
    .eq("deal_id", dealId)
    .order("created_at");
  const rows = (claimRows ?? []) as Omit<Claim, "photoUrls">[];
  const urls = await signedUrlMap(supabase, "claim-photos", rows.flatMap((c) => c.photo_paths));
  const claims: Claim[] = rows.map((c) => ({
    ...c,
    photoUrls: c.photo_paths.map((p) => urls[p]).filter(Boolean),
  }));

  return { deal, claims, supabase };
}
