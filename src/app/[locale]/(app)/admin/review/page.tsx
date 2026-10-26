import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { ConditionSummary, type CarCondition } from "@/components/condition-summary";
import { PhotoStrip } from "@/components/photo-strip";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatKm, formatTenge } from "@/lib/format";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { ReviewActions, VerifyOwnerButton } from "./review-actions";

type ReviewCar = CarCondition & {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  mileage_km: number;
  vin: string | null;
  desired_price: number | null;
  defects: string | null;
  submitted_at: string | null;
  registration_doc_paths: string[];
  owner_verified_at: string | null;
  profiles: { phone: string | null; full_name: string | null } | null;
  car_photos: { slot: string; storage_path: string; sort_order: number }[];
  auctions: { id: string; status: string }[];
};

const SELECT =
  "id, plate_number, make, model, year, mileage_km, vin, desired_price, defects, submitted_at, registration_doc_paths, owner_verified_at, options, accident, owners, damage, frame_damage, spare_key, tire_state, wheel_scratches, panel_scratches, repair_needed, pros, profiles!cars_seller_id_fkey(phone, full_name), car_photos(slot, storage_path, sort_order), auctions(id, status)";

// 경매 검수: 판매자가 신청한 매물의 사진·정보를 확인하고 승인(경매 시작) 또는 반려. 소유자 확인도 여기서
export default async function AdminReview({ params }: PageProps<"/[locale]/admin/review">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("adminReview");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const supabase = await createClient();
  const [{ data: pendingRows }, { data: docRows }, { data: setting }] = await Promise.all([
    supabase
      .from("cars")
      .select(SELECT)
      .eq("review_status", "pending")
      .order("submitted_at", { ascending: true })
      .overrideTypes<ReviewCar[], { merge: false }>(),
    // 등록증을 올렸지만 아직 확인하지 않은 차 (검수를 끈 경우·경매 중에 올린 경우)
    supabase
      .from("cars")
      .select(SELECT)
      .is("owner_verified_at", null)
      .neq("registration_doc_paths", "{}")
      .or("review_status.is.null,review_status.neq.pending")
      .order("created_at", { ascending: false })
      .limit(30)
      .overrideTypes<ReviewCar[], { merge: false }>(),
    supabase.from("app_settings").select("value").eq("key", "auction_review").maybeSingle(),
  ]);
  const pending = pendingRows ?? [];
  // 진행 중 경매가 있는 차만 소유자 확인 대기에 보여준다
  const docsWaiting = (docRows ?? []).filter((car) => car.auctions.some((a) => ["live", "ended", "accepted"].includes(a.status)));
  const all = [...pending, ...docsWaiting];
  const [photoUrls, docUrls] = await Promise.all([
    signedUrlMap(supabase, "car-photos", pending.flatMap((c) => c.car_photos.map((p) => p.storage_path))),
    signedUrlMap(supabase, "car-docs", all.flatMap((c) => c.registration_doc_paths)),
  ]);
  const reviewOn = (setting?.value ?? "on") === "on";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <p className="text-caption text-ink/60">{reviewOn ? t("onHint") : t("offHint")}</p>
      </div>

      {pending.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      {pending.map((car) => (
        <article key={car.id} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-subtitle font-semibold">
                {car.make} {car.model} · {car.year}
              </h2>
              <p className="price text-caption text-ink/60">
                {car.plate_number} · {formatKm(car.mileage_km)} · VIN {car.vin ?? "—"}
                {car.desired_price ? ` · ${t("desired")} ${formatTenge(car.desired_price)}` : ""}
              </p>
              <p className="text-caption text-ink/60">
                {t("seller")}: {car.profiles?.full_name ?? "—"} · <span className="price">{car.profiles?.phone ?? "—"}</span>
                {car.submitted_at && ` · ${t("submittedAt")} ${formatDateTime(car.submitted_at, locale)}`}
                {car.auctions.length > 0 && ` · ${t("relist", { count: car.auctions.length })}`}
              </p>
            </div>
          </div>

          <PhotoStrip
            title={t("photos", { count: car.car_photos.length })}
            urls={[...car.car_photos].sort((a, b) => a.sort_order - b.sort_order).map((p) => photoUrls[p.storage_path]).filter(Boolean)}
            cols={6}
          />
          {car.registration_doc_paths.length > 0 ? (
            <PhotoStrip title={`🪪 ${t("docs")}`} urls={car.registration_doc_paths.map((p) => docUrls[p]).filter(Boolean)} />
          ) : (
            <p className="text-caption text-ink/60">🪪 {t("noDocs")}</p>
          )}
          {car.defects && (
            <p className="text-body">
              <span className="text-caption text-ink/60">{t("defects")}: </span>
              {car.defects}
            </p>
          )}
          <details>
            <summary className="cursor-pointer text-caption font-semibold text-steppe">{t("condition")}</summary>
            <div className="mt-2">
              <ConditionSummary condition={car} />
            </div>
          </details>
          <ReviewActions carId={car.id} hasDocs={car.registration_doc_paths.length > 0} />
        </article>
      ))}

      {docsWaiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitle font-semibold">🪪 {t("ownerTitle")}</h2>
          {docsWaiting.map((car) => (
            <article key={car.id} className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">
                  {car.make} {car.model} · {car.year}
                </p>
                <p className="price text-caption text-ink/60">
                  {car.plate_number} · VIN {car.vin ?? "—"} · {car.profiles?.full_name ?? "—"}
                </p>
              </div>
              <div className="w-64">
                <PhotoStrip title={t("docs")} urls={car.registration_doc_paths.map((p) => docUrls[p]).filter(Boolean)} />
              </div>
              <VerifyOwnerButton carId={car.id} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
