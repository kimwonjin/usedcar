"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { INSPECTION_ITEMS, type InspectionItem } from "@/lib/car-catalog";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

type Items = Partial<Record<InspectionItem, "ok" | "issue">>;
const MAX_PHOTOS = 6;

// 딜러: 만남 현장에서 항목별로 점검하고 저장한다. 문제 항목이 있어야 감가를 청구할 수 있다
export function InspectionForm({
  dealId,
  userId,
  initial,
}: {
  dealId: string;
  userId: string;
  initial: { items: Items; note: string | null; photo_paths: string[]; photoUrls: string[] } | null;
}) {
  const t = useTranslations("inspection");
  const router = useRouter();
  const [items, setItems] = useState<Items>(initial?.items ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [paths, setPaths] = useState<string[]>(initial?.photo_paths ?? []);
  const [previews, setPreviews] = useState<string[]>(initial?.photoUrls ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const complete = INSPECTION_ITEMS.every((item) => items[item]);
  const issues = INSPECTION_ITEMS.filter((item) => items[item] === "issue");

  async function addPhoto(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("claim-photos", `${userId}/${dealId}`, file);
      setPaths((prev) => [...prev, path]);
      setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
      setSaved(false);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    setError(false);
    const { error } = await createClient()
      .from("deal_inspections")
      .upsert({ deal_id: dealId, dealer_id: userId, items, note: note.trim() || null, photo_paths: paths }, { onConflict: "deal_id" });
    setBusy(false);
    if (error) {
      setError(true);
      return;
    }
    setSaved(true);
    startRefresh(() => router.refresh());
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-subtitle font-semibold">🔍 {t("title")}</h2>
        <p className="text-caption text-ink/60">{t("hint")}</p>
      </div>
      <ul className="flex flex-col divide-y divide-ink/5">
        {INSPECTION_ITEMS.map((item) => (
          <li key={item} className="flex items-center justify-between gap-2 py-2">
            <span className="text-body">{t(`items.${item}`)}</span>
            <span className="flex shrink-0 gap-1.5">
              {(["ok", "issue"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={items[item] === value}
                  onClick={() => {
                    setItems((prev) => ({ ...prev, [item]: value }));
                    setSaved(false);
                  }}
                  className={`h-9 rounded-lg border px-3 text-caption font-semibold ${
                    items[item] === value
                      ? value === "ok"
                        ? "border-success bg-success text-white"
                        : "border-danger bg-danger text-white"
                      : "border-ink/15 bg-white text-ink/70"
                  }`}
                >
                  {t(value)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder={issues.length ? t("notePlaceholderIssue") : t("notePlaceholder")}
        rows={3}
        maxLength={1000}
        className="rounded-lg border border-ink/15 p-3 text-body"
      />
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) addPhoto(file);
        }}
      />
      {paths.length < MAX_PHOTOS && (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="h-10 rounded-lg border border-ink/15 text-caption font-semibold text-steppe disabled:opacity-40"
        >
          📷 {t("addPhoto")} ({paths.length}/{MAX_PHOTOS})
        </button>
      )}
      {!complete && <p className="text-caption text-ink/60">{t("answerAll")}</p>}
      {error && <p className="text-caption text-danger">{t("failed")}</p>}
      <button
        type="button"
        disabled={!complete || busy || refreshing}
        onClick={save}
        className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40"
      >
        {saved ? `✓ ${t("saved")}` : initial ? t("update") : t("save")}
      </button>
    </section>
  );
}

// 판매자·관리자·지난 거래: 읽기 전용
export function InspectionView({
  inspection,
}: {
  inspection: { items: Items; note: string | null; photoUrls: string[]; updated_at: string };
}) {
  const t = useTranslations("inspection");
  const issues = INSPECTION_ITEMS.filter((item) => inspection.items[item] === "issue");
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">🔍 {t("viewTitle")}</h2>
      <p className={`text-body font-semibold ${issues.length ? "text-danger" : "text-success"}`}>
        {issues.length ? t("issuesFound", { count: issues.length }) : t("allOk")}
      </p>
      <ul className="grid grid-cols-2 gap-1.5 text-caption">
        {INSPECTION_ITEMS.filter((item) => inspection.items[item]).map((item) => (
          <li
            key={item}
            className={`flex justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
              inspection.items[item] === "issue" ? "bg-danger/10 text-danger" : "bg-surface"
            }`}
          >
            <span>{t(`items.${item}`)}</span>
            <span className="font-semibold">{t(inspection.items[item]!)}</span>
          </li>
        ))}
      </ul>
      {inspection.note && <p className="text-body whitespace-pre-line">{inspection.note}</p>}
      {inspection.photoUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {inspection.photoUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-16 w-20 rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
