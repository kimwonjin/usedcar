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
  cancel_reason: string | null;
  auction_id: string;
  transfer_due_at: string | null;
  transfer_doc_paths: string[];
  transfer_submitted_at: string | null;
  auctions: {
    cars: {
      id: string;
      make: string;
      model: string;
      year: number;
      plate_number: string;
      vin: string | null;
      registration_doc_paths: string[];
      owner_verified_at: string | null;
      car_photos: { slot: string; storage_path: string }[];
    };
  };
};

// 딜러 현장 점검표 (항목별 정상·문제)
export type Inspection = {
  items: Record<string, "ok" | "issue">;
  note: string | null;
  photo_paths: string[];
  updated_at: string;
  photoUrls: string[];
};

export type ChatMessage = { id: string; sender_id: string; kind: "text" | "phone" | "photo"; body: string; created_at: string };

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
      "id, status, agreed_price, final_price, meeting_at, meeting_place, seller_id, dealer_id, seller_rating, cancel_reason, auction_id, transfer_due_at, transfer_doc_paths, transfer_submitted_at, auctions(cars(id, make, model, year, plate_number, vin, registration_doc_paths, owner_verified_at, car_photos(slot, storage_path)))",
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
  const { data: inspectionRow } = await supabase
    .from("deal_inspections")
    .select("items, note, photo_paths, updated_at")
    .eq("deal_id", dealId)
    .maybeSingle();
  const inspectionPaths = (inspectionRow?.photo_paths as string[] | undefined) ?? [];
  const regDocPaths = deal.auctions.cars.registration_doc_paths ?? [];
  const [urls, transferUrls, regUrls] = await Promise.all([
    signedUrlMap(supabase, "claim-photos", [...rows.flatMap((c) => c.photo_paths), ...inspectionPaths]),
    signedUrlMap(supabase, "transfer-docs", deal.transfer_doc_paths ?? []),
    // 등록증은 거래가 취소되지 않은 딜러·판매자·관리자만 읽힌다 (Storage 정책)
    signedUrlMap(supabase, "car-docs", regDocPaths),
  ]);
  const inspection: Inspection | null = inspectionRow
    ? {
        ...(inspectionRow as Omit<Inspection, "photoUrls">),
        photoUrls: inspectionPaths.map((p) => urls[p]).filter(Boolean),
      }
    : null;
  const claims: Claim[] = rows.map((c) => ({
    ...c,
    photoUrls: c.photo_paths.map((p) => urls[p]).filter(Boolean),
  }));

  const [{ data: messages }, { data: counterpart }] = await Promise.all([
    supabase
      .from("deal_messages")
      .select("id, sender_id, kind, body, created_at")
      .eq("deal_id", dealId)
      .order("created_at")
      .limit(300),
    supabase.rpc("deal_counterpart", { p_deal_id: dealId }),
  ]);

  return {
    deal,
    claims,
    transferDocUrls: (deal.transfer_doc_paths ?? []).map((p) => transferUrls[p]).filter(Boolean),
    regDocUrls: regDocPaths.map((p) => regUrls[p]).filter(Boolean),
    inspection,
    supabase,
    messages: (messages ?? []) as ChatMessage[],
    counterpartName: ((counterpart?.[0] as { name: string | null } | undefined)?.name ?? null) as string | null,
  };
}
