import { getCurrentUser } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

// 관리자 CSV 내보내기: /api/admin/export?type=deals|payments|users
const EXPORTS: Record<string, { select: string; table: string; order: string; columns: [string, (r: Row) => unknown][] }> = {
  deals: {
    table: "deals",
    select:
      "id, status, agreed_price, final_price, cancel_reason, seller_rating, created_at, completed_at, auctions(cars(make, model, year, plate_number)), dealers(business_name, bin)",
    order: "created_at",
    columns: [
      ["deal_id", (r) => r.id],
      ["status", (r) => r.status],
      ["car", (r) => car(r)],
      ["plate", (r) => nested(r, "auctions", "cars", "plate_number")],
      ["dealer", (r) => nested(r, "dealers", "business_name")],
      ["dealer_bin", (r) => nested(r, "dealers", "bin")],
      ["agreed_price", (r) => r.agreed_price],
      ["final_price", (r) => r.final_price],
      ["cancel_reason", (r) => r.cancel_reason],
      ["seller_rating", (r) => r.seller_rating],
      ["created_at", (r) => r.created_at],
      ["completed_at", (r) => r.completed_at],
    ],
  },
  payments: {
    table: "payments",
    select: "id, purpose, amount, currency, status, description, provider, provider_ref, due_at, paid_at, created_at, deal_id, profiles(phone, full_name)",
    order: "created_at",
    columns: [
      ["payment_id", (r) => r.id],
      ["purpose", (r) => r.purpose],
      ["status", (r) => r.status],
      ["amount", (r) => r.amount],
      ["currency", (r) => r.currency],
      ["description", (r) => r.description],
      ["payer_phone", (r) => nested(r, "profiles", "phone")],
      ["payer_name", (r) => nested(r, "profiles", "full_name")],
      ["deal_id", (r) => r.deal_id],
      ["provider", (r) => r.provider],
      ["provider_ref", (r) => r.provider_ref],
      ["due_at", (r) => r.due_at],
      ["paid_at", (r) => r.paid_at],
      ["created_at", (r) => r.created_at],
    ],
  },
  users: {
    table: "profiles",
    select: "id, role, full_name, phone, locale, created_at, deleted_at",
    order: "created_at",
    columns: [
      ["user_id", (r) => r.id],
      ["role", (r) => r.role],
      ["name", (r) => r.full_name],
      ["phone", (r) => r.phone],
      ["locale", (r) => r.locale],
      ["created_at", (r) => r.created_at],
      ["deleted_at", (r) => r.deleted_at],
    ],
  },
};

function nested(row: Row, ...keys: string[]): unknown {
  let value: unknown = row;
  for (const key of keys) {
    if (Array.isArray(value)) value = value[0];
    value = value && typeof value === "object" ? (value as Row)[key] : null;
  }
  return value;
}

function car(row: Row) {
  return ["make", "model", "year"].map((k) => nested(row, "auctions", "cars", k)).filter(Boolean).join(" ");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("forbidden", { status: 403 });

  const type = new URL(request.url).searchParams.get("type") ?? "";
  const spec = EXPORTS[type];
  if (!spec) return new Response("unknown type", { status: 400 });

  const supabase = await createClient();
  const rows: Row[] = [];
  // 1000행씩 나눠 받는다 (PostgREST 기본 한도)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(spec.table)
      .select(spec.select)
      .order(spec.order, { ascending: false })
      .range(from, from + 999);
    if (error) return new Response(error.message, { status: 500 });
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  return csvResponse(type, spec.columns, rows);
}
