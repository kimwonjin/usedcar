import "server-only";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";

export type Role = "seller" | "dealer" | "admin";

export type CurrentUser = {
  id: string;
  phone: string | null;
  role: Role;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, role")
    .eq("id", userId)
    .single();

  return profile as CurrentUser | null;
}

export type DealerStatus = "pending" | "approved" | "rejected" | "suspended";

export type DealerProfile = {
  id: string;
  business_name: string;
  bin: string;
  address: string;
  shop_photo_paths: string[];
  status: DealerStatus;
  rejection_reason: string | null;
  rating: number;
  warning_count: number;
};

// 현재 사용자의 딜러 신청서. 신청 전이면 null.
export async function getDealer(userId: string): Promise<DealerProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dealers")
    .select("id, business_name, bin, address, shop_photo_paths, status, rejection_reason, rating, warning_count")
    .eq("id", userId)
    .maybeSingle();
  return data as DealerProfile | null;
}

// 관리자 페이지 공통: 로그인 안 했으면 로그인으로, 관리자가 아니면 null
export async function requireAdmin(locale: Locale): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/admin", locale });
  return user.role === "admin" ? user : null;
}
