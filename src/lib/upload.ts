import { compressImage } from "./image";
import { createClient } from "./supabase/client";

// 사진을 줄여서 비공개 버킷에 올리고 저장 경로를 돌려준다.
// folder의 첫 부분은 본인 id여야 Storage 정책을 통과한다.
export async function uploadPhoto(bucket: string, folder: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient()
    .storage.from(bucket)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}
