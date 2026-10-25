// 이 프로젝트의 공개 접속 정보. anon key는 브라우저에 그대로 노출되는 공개 키라서(권한은 DB의 RLS가 막는다)
// 기본값으로 두어 배포 환경변수가 빠져도 사이트가 멈추지 않게 한다. 다른 Supabase를 쓰려면 환경변수로 덮어쓴다.
const DEFAULT_URL = "https://foynqljwzskskowfvtdq.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZveW5xbGp3enNrc2tvd2Z2dGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzcxNTEsImV4cCI6MjEwODQ1MzE1MX0.wOXla4Nv_kyVTWGBHk9rkJ3H0mXVgQOiV7ABMIFbcCU";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || DEFAULT_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
