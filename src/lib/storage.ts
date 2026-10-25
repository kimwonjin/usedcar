import type { SupabaseClient } from "@supabase/supabase-js";

// 비공개 버킷 사진을 1시간짜리 서명 URL로 바꾼다. { 경로: URL }
export async function signedUrlMap(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
