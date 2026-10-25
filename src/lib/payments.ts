import "server-only";
import { createClient } from "./supabase/server";

export type Payment = {
  id: string;
  purpose: "dealer_fee" | "deposit" | "reservation";
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  description: string | null;
  deal_id: string | null;
  due_at: string | null;
  paid_at: string | null;
  provider: string | null;
  created_at: string;
};

export const isOverdue = (p: Pick<Payment, "status" | "due_at">) =>
  p.status === "pending" && p.due_at !== null && new Date(p.due_at) < new Date();

// 기한이 지난 미납 청구서 (입찰 제한 안내용)
export async function overduePayments(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, due_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("due_at", new Date().toISOString());
  return data ?? [];
}
