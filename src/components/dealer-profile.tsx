"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import { Stars } from "./stars";

export type DealerProfileData = {
  business_name: string;
  rating: number;
  completed_deals: number;
  review_count: number;
  approved_at: string | null;
  dealer_cancellations: number;
};

export type DealerReview = { rating: number; review: string | null; car: string; reviewed_at: string };

// 딜러 거래 실적 요약 (판매자 선택 화면·딜러 본인 활동 화면 공통)
export function DealerStats({ profile }: { profile: DealerProfileData }) {
  const t = useTranslations("dealerProfile");
  const locale = useLocale();
  const items: [string, string, boolean][] = [
    [t("completed"), String(profile.completed_deals), false],
    [t("reviews"), String(profile.review_count), false],
    [t("since"), profile.approved_at ? formatDate(profile.approved_at, locale) : "—", false],
    [t("cancellations"), String(profile.dealer_cancellations), profile.dealer_cancellations > 0],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map(([label, value, bad]) => (
        <div key={label} className="rounded-lg bg-surface p-3">
          <dt className="text-caption text-ink/60">{label}</dt>
          <dd className={`price text-body font-semibold ${bad ? "text-danger" : ""}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewList({ reviews }: { reviews: DealerReview[] }) {
  const t = useTranslations("dealerProfile");
  const locale = useLocale();
  if (reviews.length === 0) return <p className="py-4 text-center text-body text-ink/60">{t("noReviews")}</p>;
  return (
    <ul className="flex flex-col divide-y divide-ink/10">
      {reviews.map((r, i) => (
        <li key={i} className="flex flex-col gap-1 py-3">
          <div className="flex items-center justify-between gap-2 text-caption text-ink/60">
            <span className="flex items-center gap-2">
              <span className="text-gold">{"★".repeat(r.rating)}</span>
              <span className="text-ink/30">{"★".repeat(5 - r.rating)}</span>
              <span className="truncate">{r.car}</span>
            </span>
            <span className="shrink-0">{formatDate(r.reviewed_at, locale)}</span>
          </div>
          <p className={`text-body ${r.review ? "" : "text-ink/50"}`}>{r.review ?? t("ratingOnly")}</p>
        </li>
      ))}
    </ul>
  );
}

// 판매자가 판매할 딜러를 고를 때 여는 프로필·후기 시트
export function DealerProfileButton({ dealerId, dealerName }: { dealerId: string; dealerName: string }) {
  const t = useTranslations("dealerProfile");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ profile: DealerProfileData | null; reviews: DealerReview[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    const supabase = createClient();
    Promise.all([
      supabase.rpc("dealer_profile", { p_dealer_id: dealerId }),
      supabase.rpc("dealer_reviews", { p_dealer_id: dealerId, p_limit: 20 }),
    ]).then(([p, r]) => {
      if (p.error || r.error) setFailed(true);
      else
        setData({
          profile: ((p.data ?? []) as DealerProfileData[])[0] ?? null,
          reviews: (r.data ?? []) as DealerReview[],
        });
    });
  }, [open, data, dealerId]);

  // 시트가 열려 있는 동안 뒤 화면 스크롤을 막는다
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-caption font-semibold text-steppe">
        {t("open")} ›
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dealerName}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 pb-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-title font-bold text-navy">{dealerName}</h2>
                {data?.profile && <Stars rating={data.profile.rating} />}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="p-1 text-ink/50">
                ✕
              </button>
            </div>
            {failed && <p className="text-body text-danger">{t("failed")}</p>}
            {!data && !failed && <p className="py-6 text-center text-body text-ink/50">{t("loading")}</p>}
            {data?.profile && <DealerStats profile={data.profile} />}
            {data && (
              <section>
                <h3 className="mb-1 text-subtitle font-semibold">{t("reviewsTitle")}</h3>
                <ReviewList reviews={data.reviews} />
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
