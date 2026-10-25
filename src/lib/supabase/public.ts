import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

// 로그인과 무관한 공개 데이터용 클라이언트 (쿠키를 읽지 않아 정적 페이지에서도 쓸 수 있다)
export function createPublicClient() {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
}
