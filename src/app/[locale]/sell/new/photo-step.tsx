"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { MULTI_PHOTO_SLOTS, PHOTO_SLOTS, REQUIRED_SLOTS, isRequiredSlot, type PhotoSlot } from "@/lib/car-catalog";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { PlateMaskEditor } from "./plate-mask-editor";
import { SlotPictogram } from "./slot-pictogram";

// 번호판이 찍히는 칸: 올리기 전에 번호판 가리기 화면을 띄운다
const PLATE_SLOTS: PhotoSlot[] = ["front", "rear"];

export type UploadedPhoto = { id: string; path: string; preview: string };
export type PhotoMap = Partial<Record<PhotoSlot, UploadedPhoto[]>>;

const BUCKET = "car-photos";

export function PhotoStep({
  userId,
  carId,
  photos,
  onChange,
}: {
  userId: string;
  carId: string;
  photos: PhotoMap;
  onChange: (update: (prev: PhotoMap) => PhotoMap) => void;
}) {
  const t = useTranslations("carForm");
  const [uploading, setUploading] = useState<PhotoSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [masking, setMasking] = useState<{ slot: PhotoSlot; blob: Blob } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetSlot = useRef<PhotoSlot>("front");

  const done = REQUIRED_SLOTS.filter((slot) => photos[slot]?.length).length;

  function pick(slot: PhotoSlot) {
    targetSlot.current = slot;
    inputRef.current?.click();
  }

  async function removePhoto(slot: PhotoSlot, photo: UploadedPhoto) {
    const supabase = createClient();
    await supabase.from("car_photos").delete().eq("id", photo.id);
    await supabase.storage.from(BUCKET).remove([photo.path]);
    URL.revokeObjectURL(photo.preview);
    onChange((prev) => ({ ...prev, [slot]: prev[slot]?.filter((p) => p.id !== photo.id) }));
  }

  async function upload(file: File) {
    const slot = targetSlot.current;
    setError(null);
    try {
      const blob = await compressImage(file);
      if (PLATE_SLOTS.includes(slot)) setMasking({ slot, blob });
      else await save(slot, blob);
    } catch {
      setError(t("photos.failed"));
    }
  }

  async function save(slot: PhotoSlot, blob: Blob) {
    setUploading(slot);
    setError(null);
    try {
      const supabase = createClient();
      // 경로의 첫 폴더가 본인 id여야 Storage 정책을 통과한다
      const path = `${userId}/${carId}/${slot}-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("car_photos")
        .insert({ car_id: carId, slot, storage_path: path, sort_order: photos[slot]?.length ?? 0 })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const photo = { id: data.id as string, path, preview: URL.createObjectURL(blob) };
      // 한 장짜리 칸은 다시 찍으면 이전 사진을 지운다
      const multi = slot in MULTI_PHOTO_SLOTS;
      const previous = multi ? [] : (photos[slot] ?? []);
      await Promise.all(previous.map((p) => removePhoto(slot, p)));
      onChange((prev) => ({
        ...prev,
        [slot]: multi ? [...(prev[slot] ?? []), photo] : [photo],
      }));
    } catch {
      setError(t("photos.failed"));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-navy">{t("photos.title")}</h1>
        <p className="text-caption text-ink/70">{t("photos.hint")}</p>
        <p className="price text-caption font-semibold text-steppe">
          {t("photos.progress", { done, total: REQUIRED_SLOTS.length })}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />

      {error && <p className="text-caption text-danger">{error}</p>}

      {masking && (
        <PlateMaskEditor
          blob={masking.blob}
          onCancel={() => setMasking(null)}
          onDone={(blob) => {
            const slot = masking.slot;
            setMasking(null);
            save(slot, blob);
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {PHOTO_SLOTS.map((slot) => {
          const slotPhotos = photos[slot] ?? [];
          const filled = slotPhotos.length > 0;
          const max = MULTI_PHOTO_SLOTS[slot];
          const multi = max !== undefined;
          const canAdd = !multi || slotPhotos.length < max;
          return (
            <div
              key={slot}
              className={`flex flex-col overflow-hidden rounded-xl border bg-white ${
                filled ? "border-success" : "border-ink/10"
              } ${multi ? "col-span-2" : ""}`}
            >
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-body font-semibold">{t(`slots.${slot}.label`)}</span>
                {filled ? (
                  <span className="text-caption font-semibold text-success">
                    ✓{multi && ` ${slotPhotos.length}/${max}`}
                  </span>
                ) : isRequiredSlot(slot) ? (
                  <span className="text-caption text-danger">{t("photos.required")}</span>
                ) : (
                  <span className="text-caption text-ink/50">{t("photos.optional")}</span>
                )}
              </div>

              {filled ? (
                <div className={`grid gap-1 p-2 ${multi ? "grid-cols-4" : ""}`}>
                  {slotPhotos.map((photo) => (
                    <div key={photo.id} className="relative aspect-[4/3]">
                      {/* 업로드 직후 미리보기(blob URL)라 next/image를 쓰지 않는다 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.preview} alt="" className="size-full rounded-lg object-cover" />
                      {multi && (
                        <button
                          type="button"
                          onClick={() => removePhoto(slot, photo)}
                          className="absolute top-1 right-1 rounded bg-ink/70 px-1.5 text-caption text-white"
                        >
                          {t("photos.remove")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 px-3 py-3 text-ink/40">
                  <SlotPictogram slot={slot} />
                  <span className="text-center text-caption text-ink/60">
                    {t(`slots.${slot}.guide`)}
                  </span>
                </div>
              )}

              {canAdd && (
                <button
                  type="button"
                  disabled={uploading !== null}
                  onClick={() => pick(slot)}
                  className="h-11 border-t border-ink/10 text-body font-semibold text-steppe disabled:opacity-40"
                >
                  {uploading === slot
                    ? t("photos.uploading")
                    : filled && !multi
                      ? t("photos.retake")
                      : t("photos.add")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
