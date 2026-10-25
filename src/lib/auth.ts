import "server-only";
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
