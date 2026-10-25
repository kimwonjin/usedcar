import "server-only";
import { cache } from "react";
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

// 로그인한 사용자 id. 세션 토큰을 서버에서 검증만 하므로 DB 왕복이 없다.
// cache: 한 요청 안에서 여러 번 불러도 한 번만 실행
export const getUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, role")
    .eq("id", userId)
    .single();

  return profile as CurrentUser | null;
});

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
  bid_blocked_until: string | null;
};

// 현재 사용자의 딜러 신청서. 신청 전이면 null.
export const getDealer = cache(async (userId: string): Promise<DealerProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dealers")
    .select("id, business_name, bin, address, shop_photo_paths, status, rejection_reason, rating, warning_count, bid_blocked_until")
    .eq("id", userId)
    .maybeSingle();
  return data as DealerProfile | null;
});

// 관리자 페이지 공통: 로그인 안 했으면 로그인으로, 관리자가 아니면 null
export async function requireAdmin(locale: Locale): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/admin", locale });
  return user.role === "admin" ? user : null;
}
