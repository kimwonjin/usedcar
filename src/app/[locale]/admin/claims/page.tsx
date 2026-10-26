import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { ConditionSummary, type CarCondition } from "@/components/condition-summary";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { ClaimReview } from "./claim-review";

const STATUSES = ["submitted", "approved", "rejected"] as const;

type AdminClaim = {
  id: string;
  amount: number;
  reason: string;
  photo_paths: string[];
  status: string;
  seller_comment: string | null;
  admin_note: string | null;
  created_at: string;
  dealers: { business_name: string } | null;
  deals: {
    agreed_price: number;
    auctions: {
      cars: CarCondition & { make: string; model: string; year: number; defects: string | null; car_photos: { slot: string; storage_path: string }[] };
    };
  };
};

// A4 감가 심사: 낙찰가 대비 감가, 판매자 사진과 딜러 사진 비교, 승인·거절
export default async function AdminClaims({ params, searchParams }: PageProps<"/[locale]/admin/claims">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const ts = await getTranslations("status");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const status = STATUSES.find((s) => s === query.status) ?? "submitted";

  const supabase = await createClient();
  const { data } = await supabase
    .from("depreciation_claims")
    .select(
      "id, amount, reason, photo_paths, status, seller_comment, admin_note, created_at, dealers(business_name), deals(agreed_price, auctions(cars(make, model, year, defects, options, accident, owners, damage, spare_key, tire_state, wheel_scratches, panel_scratches, repair_needed, pros, car_photos(slot, storage_path))))",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "submitted" })
    .overrideTypes<AdminClaim[], { merge: false }>();
  const claims = data ?? [];

  const [sellerUrls, dealerUrls] = await Promise.all([
    signedUrlMap(supabase, "car-photos", claims.flatMap((c) => c.deals.auctions.cars.car_photos.map((p) => p.storage_path))),
    signedUrlMap(supabase, "claim-photos", claims.flatMap((c) => c.photo_paths)),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("claimsTitle")}</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/claims?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              s === status ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {ts(`claim.${s}`)}
          </Link>
        ))}
      </div>

      {claims.length === 0 && <p className="py-8 text-center text-ink/60">{t("emptyList")}</p>}
      {claims.map((claim) => {
        const car = claim.deals.auctions.cars;
        const percent = ((claim.amount / claim.deals.agreed_price) * 100).toFixed(1);
        return (
          <article key={claim.id} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-subtitle font-semibold">
                  {car.make} {car.model} · {car.year}
                </h2>
                <p className="text-caption text-ink/60">
                  {claim.dealers?.business_name} · {formatDateTime(claim.created_at, locale)}
                </p>
              </div>
              <StatusBadge kind="claim" status={claim.status} />
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-caption text-ink/60">{t("agreedPrice")}</dt>
                <dd className="price font-semibold">{formatTenge(claim.deals.agreed_price)}</dd>
              </div>
              <div className="rounded-lg bg-danger/5 p-2">
                <dt className="text-caption text-ink/60">{t("claimAmount")}</dt>
                <dd className="price font-semibold text-danger">
                  −{formatTenge(claim.amount)} ({percent}%)
                </dd>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <dt className="text-caption text-ink/60">{t("afterClaim")}</dt>
                <dd className="price font-semibold">{formatTenge(claim.deals.agreed_price - claim.amount)}</dd>
              </div>
            </dl>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <p className="text-caption font-semibold">{t("dealerReason")}</p>
                <p className="text-body whitespace-pre-line">{claim.reason}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-caption font-semibold">{t("sellerSide")}</p>
                <p className="text-body">
                  {t("sellerDefects")}: {car.defects || "—"}
                </p>
                {claim.seller_comment && (
                  <p className="text-body">
                    {t("sellerComment")}: {claim.seller_comment}
                  </p>
                )}
              </div>
            </div>

            <details>
              <summary className="cursor-pointer text-caption font-semibold text-steppe">{t("sellerCondition")}</summary>
              <div className="mt-2">
                <ConditionSummary condition={car} />
              </div>
            </details>

            <div className="grid gap-3 md:grid-cols-2">
              <PhotoStrip title={t("sellerPhotos")} urls={car.car_photos.map((p) => sellerUrls[p.storage_path]).filter(Boolean)} />
              <PhotoStrip title={t("dealerPhotos")} urls={claim.photo_paths.map((p) => dealerUrls[p]).filter(Boolean)} />
            </div>

            {claim.status === "submitted" ? (
              <ClaimReview claimId={claim.id} />
            ) : (
              claim.admin_note && <p className="text-caption text-ink/70">{t("note")}: {claim.admin_note}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PhotoStrip({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-semibold">{title}</p>
      <div className="grid grid-cols-4 gap-1">
        {urls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="size-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
