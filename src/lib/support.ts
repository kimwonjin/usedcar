import "server-only";
import { createClient } from "./supabase/server";

export const SUPPORT_CATEGORIES = ["account", "selling", "buying", "payment", "bug", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportStatus = "open" | "answered" | "closed";

export type SupportTicket = {
  id: string;
  user_id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = { id: string; sender_id: string; from_admin: boolean; body: string; created_at: string };

// 문의 한 건과 대화. 본인·관리자만 RLS로 읽힌다.
export async function loadTicket(id: string) {
  const supabase = await createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, user_id, category, subject, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<SupportTicket, { merge: false }>(),
    supabase
      .from("support_messages")
      .select("id, sender_id, from_admin, body, created_at")
      .eq("ticket_id", id)
      .order("created_at")
      .overrideTypes<SupportMessage[], { merge: false }>(),
  ]);
  if (!ticket) return null;
  return { ticket, messages: messages ?? [] };
}
