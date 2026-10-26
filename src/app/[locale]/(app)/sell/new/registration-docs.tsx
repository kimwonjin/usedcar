"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

export type DocPhoto = { path: string; preview: string };
const MAX_DOCS = 2; // 앞·뒷면

// 차량등록증(техпаспорт) 사진: 소유자 확인용. 관리자와 거래가 정해진 딜러만 볼 수 있다 (선택)
export function RegistrationDocs({
  userId,
  carId,
  docs,
  onChange,
}: {
  userId: string;
  carId: string;
  docs: DocPhoto[];
  onChange: (docs: DocPhoto[]) => void;
}) {
  const t = useTranslations("carForm.ownerDocs");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function save(next: DocPhoto[]) {
    const { error } = await createClient()
      .from("cars")
      .update({ registration_doc_paths: next.map((d) => d.path) })
      .eq("id", carId);
    if (error) throw error;
    onChange(next);
  }

  async function add(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("car-docs", `${userId}/${carId}`, file);
      await save([...docs, { path, preview: URL.createObjectURL(file) }]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function remove(doc: DocPhoto) {
    setBusy(true);
    setError(false);
    try {
      await save(docs.filter((d) => d.path !== doc.path));
      await createClient().storage.from("car-docs").remove([doc.path]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-steppe/50 bg-white p-4">
      <p className="text-body font-semibold">🪪 {t("title")}</p>
      <p className="text-caption text-ink/60">{t("hint")}</p>
      {docs.length > 0 && (
        <div className="flex gap-2">
          {docs.map((doc) => (
            <div key={doc.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.preview} alt={t("alt")} className="h-20 w-28 rounded-lg object-cover" />
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(doc)}
                aria-label={t("remove")}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-caption text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) add(file);
        }}
      />
      {docs.length < MAX_DOCS && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-11 rounded-lg border border-ink/15 font-semibold text-steppe disabled:opacity-40"
        >
          📷 {docs.length === 0 ? t("add") : t("addBack")}
        </button>
      )}
      {error && <p className="text-caption text-danger">{t("failed")}</p>}
    </section>
  );
}
