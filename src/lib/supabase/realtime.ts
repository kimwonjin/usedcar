import type { SupabaseClient } from "@supabase/supabase-js";

// Realtime 채널은 로그인 토큰이 붙은 뒤에 열어야 RLS를 통과한 변경을 받는다.
// 페이지가 열리자마자 구독하면 익명으로 붙어 이벤트를 못 받는 경우가 있어 토큰을 먼저 넣는다.
export async function authorizeRealtime(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
}
