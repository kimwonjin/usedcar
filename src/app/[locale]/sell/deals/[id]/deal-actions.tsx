"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 거래 완료 / 거래 취소
export function DealActions({ dealId, status }: { dealId: string; status: string }) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run(fn: "complete_deal" | "cancel_deal", message: string) {
    if (!confirm(message)) return;
    setBusy(true);
    setError(false);
    const { error } = await createClient().rpc(fn, { p_deal_id: dealId });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  if (status !== "scheduled" && status !== "depreciation_review") return null;
  return (
    <div className="flex flex-col gap-2">
      {status === "depreciation_review" && <p className="text-caption text-ink/60">{t("waitReview")}</p>}
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
      <button
        type="button"
        disabled={busy || status !== "scheduled"}
        onClick={() => run("complete_deal", t("completeConfirm"))}
        className="h-14 rounded-xl bg-success text-subtitle font-bold text-white disabled:opacity-40"
      >
        {t("complete")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run("cancel_deal", t("cancelConfirm"))}
        className="h-11 text-body text-ink/50"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

// 감가 청구에 판매자 의견 남기기 (관리자 심사에 참고)
export function ClaimComment({ claimId }: { claimId: string }) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("comment_claim", { p_claim_id: claimId, p_comment: comment.trim() });
    setBusy(false);
    if (!error) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder={t("commentPlaceholder")}
        className="rounded-lg border border-ink/15 bg-white p-2 text-body"
      />
      <button
        type="button"
        disabled={!comment.trim() || busy}
        onClick={save}
        className="h-10 rounded-lg border border-navy text-body font-semibold text-navy disabled:opacity-40"
      >
        {t("sendComment")}
      </button>
    </div>
  );
}

// 거래 완료 후 딜러 평가 (1~5점)
export function RatingForm({ dealId }: { dealId: string }) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await createClient().rpc("rate_dealer", {
      p_deal_id: dealId,
      p_rating: rating,
      p_review: review.trim() || null,
    });
    setBusy(false);
    if (!error) router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">{t("rateTitle")}</h2>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n}`}
            className={`text-[36px] ${n <= rating ? "text-gold" : "text-ink/20"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        rows={2}
        placeholder={t("reviewPlaceholder")}
        className="rounded-lg border border-ink/15 bg-white p-2 text-body"
      />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="h-12 rounded-xl bg-navy text-body font-bold text-white disabled:opacity-40"
      >
        {t("submitRating")}
      </button>
    </section>
  );
}
