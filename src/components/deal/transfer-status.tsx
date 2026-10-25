"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";
import { Badge } from "../badge";

const MAX_DOCS = 6;

// 거래 완료 후 명의 이전 확인. 딜러는 재등록 증빙 사진을 올리고, 판매자는 완료 여부를 본다
export function TransferStatus({
  dealId,
  userId,
  role,
  dueAt,
  submittedAt,
  docUrls,
}: {
  dealId: string;
  userId: string;
  role: "seller" | "dealer";
  dueAt: string | null;
  submittedAt: string | null;
  docUrls: string[];
}) {
  const t = useTranslations("transferStatus");
  const locale = useLocale();
  const router = useRouter();
  const [paths, setPaths] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 기한 비교는 렌더 중 Date.now() 대신 서버가 준 날짜끼리만 한다
  const [overdue] = useState(() => !submittedAt && dueAt !== null && new Date(dueAt).getTime() < Date.now());

  async function addPhoto(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("transfer-docs", `${userId}/${dealId}`, file);
      setPaths((prev) => [...prev, path]);
      setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  // 제출 전에는 잘못 찍은 사진을 저장소에서도 지운다
  async function removePhoto(index: number) {
    setBusy(true);
    setError(false);
    const { error } = await createClient().storage.from("transfer-docs").remove([paths[index]]);
    if (error) setError(true);
    else {
      URL.revokeObjectURL(previews[index]);
      setPaths((prev) => prev.filter((_, i) => i !== index));
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    }
    setBusy(false);
  }

  async function submit() {
    setBusy(true);
    setError(false);
    const { error } = await createClient().rpc("submit_transfer_docs", { p_deal_id: dealId, p_paths: paths });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  return (
    <section className={`flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ${overdue ? "ring-2 ring-danger/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-subtitle font-semibold">🪪 {t("title")}</h2>
        {submittedAt ? (
          <Badge tone="verified">✓ {t("done")}</Badge>
        ) : overdue ? (
          <Badge tone="warning">{t("overdue")}</Badge>
        ) : (
          <Badge tone="review">{t("pending")}</Badge>
        )}
      </div>

      {submittedAt ? (
        <p className="text-body text-ink/70">{t(role === "seller" ? "doneSeller" : "doneDealer", { date: formatDate(submittedAt, locale) })}</p>
      ) : (
        <p className={`text-body ${overdue ? "text-danger" : "text-ink/70"}`}>
          {role === "seller"
            ? t(overdue ? "overdueSeller" : "pendingSeller", { date: dueAt ? formatDate(dueAt, locale) : "—" })
            : t(overdue ? "overdueDealer" : "pendingDealer", { date: dueAt ? formatDate(dueAt, locale) : "—" })}
        </p>
      )}

      {docUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {docUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={t("docAlt")} className="h-24 w-32 rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}

      {role === "dealer" && !submittedAt && (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink/60">{t("uploadHint")}</p>
          {previews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {previews.map((src, i) => (
                <div key={src} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-24 rounded-lg object-cover" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removePhoto(i)}
                    aria-label={t("removePhoto")}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-caption text-white"
                  >
                    ✕
                  </button>
                </div>
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
          <button
            type="button"
            disabled={busy || paths.length >= MAX_DOCS}
            onClick={() => fileRef.current?.click()}
            className="h-11 rounded-lg border border-ink/15 font-semibold text-steppe disabled:opacity-40"
          >
            📷 {t("addPhoto")} {paths.length > 0 && `(${paths.length}/${MAX_DOCS})`}
          </button>
          <button
            type="button"
            disabled={busy || paths.length === 0}
            onClick={submit}
            className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40"
          >
            {t("submit")}
          </button>
        </div>
      )}
      {error && <p className="text-caption text-danger">{t("failed")}</p>}
    </section>
  );
}
