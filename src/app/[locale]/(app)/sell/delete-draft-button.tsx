"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 작성 중인 차량 삭제: 올린 사진 파일까지 지운다
export function DeleteDraftButton({ carId }: { carId: string }) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(t("deleteDraftConfirm"))) return;
    setBusy(true);
    const supabase = createClient();
    const { data: photos } = await supabase.from("car_photos").select("storage_path").eq("car_id", carId);
    if (photos?.length) await supabase.storage.from("car-photos").remove(photos.map((p) => p.storage_path as string));
    await supabase.from("cars").delete().eq("id", carId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={remove} className="text-caption text-ink/40 underline disabled:opacity-40">
      {t("deleteDraft")}
    </button>
  );
}
