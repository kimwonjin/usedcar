import type { SupabaseClient } from "@supabase/supabase-js";

// 이동할 곳 없이 로그인한 경우(상단 "로그인"): 관리자 → 관리자 화면, 딜러 → 딜러 화면, 나머지 → 내 차 팔기
export async function homeFor(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ data: profile }, { data: dealer }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("dealers").select("id").eq("id", userId).maybeSingle(),
  ]);
  if (profile?.role === "admin") return "/admin";
  return dealer ? "/dealer" : "/sell";
}
