import { getUserId } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { dealerFee, loadFeeBands } from "@/lib/fees";
import { createClient } from "@/lib/supabase/server";

type Car = { make: string; model: string; year: number; plate_number: string | null; vin: string | null; mileage_km: number };
type Deal = {
  id: string;
  auction_id: string;
  status: string;
  agreed_price: number;
  final_price: number | null;
  created_at: string;
  completed_at: string | null;
  transfer_submitted_at: string | null;
  auctions: { cars: Car };
};
type Row = Deal & { fee: number | null; note: string | null };

// 딜러 매입 장부 CSV: 내 낙찰·거래 전체 (차량, 가격, 수수료, 내 메모, 명의 이전 여부)
export async function GET() {
  const userId = await getUserId();
  if (!userId) return new Response("forbidden", { status: 403 });

  const supabase = await createClient();
  const [{ data, error }, bands, { data: notes }] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, auction_id, status, agreed_price, final_price, created_at, completed_at, transfer_submitted_at, auctions(cars(make, model, year, plate_number, vin, mileage_km))",
      )
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<Deal[], { merge: false }>(),
    loadFeeBands(supabase),
    supabase.from("dealer_notes").select("auction_id, body").eq("dealer_id", userId),
  ]);
  if (error) return new Response(error.message, { status: 500 });
  const noteOf = new Map((notes ?? []).map((n) => [n.auction_id as string, n.body as string]));

  const rows: Row[] = (data ?? []).map((d) => ({
    ...d,
    fee: d.status === "cancelled" ? null : dealerFee(d.final_price ?? d.agreed_price, bands),
    note: noteOf.get(d.auction_id) ?? null,
  }));
  const car = (r: Row) => r.auctions?.cars;

  return csvResponse<Row>("purchases", [
    ["deal_id", (r) => r.id],
    ["status", (r) => r.status],
    ["car", (r) => [car(r)?.make, car(r)?.model, car(r)?.year].filter(Boolean).join(" ")],
    ["plate", (r) => car(r)?.plate_number],
    ["vin", (r) => car(r)?.vin],
    ["mileage_km", (r) => car(r)?.mileage_km],
    ["agreed_price", (r) => r.agreed_price],
    ["final_price", (r) => r.final_price],
    ["fee", (r) => r.fee],
    ["note", (r) => r.note],
    ["created_at", (r) => r.created_at],
    ["completed_at", (r) => r.completed_at],
    ["transfer_submitted_at", (r) => r.transfer_submitted_at],
  ], rows);
}
