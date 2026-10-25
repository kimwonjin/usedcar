import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const FILTERS = ["overdue", "pending", "done"] as const;

type TransferRow = {
  id: string;
  completed_at: string | null;
  transfer_due_at: string | null;
  transfer_submitted_at: string | null;
  transfer_doc_paths: string[];
  auctions: { cars: { make: string; model: string; year: number; plate_number: string } };
  dealers: { business_name: string } | null;
};

// 명의 이전 확인: 기한 초과 → 딜러에게 연락, 제출된 증빙 사진 확인
export default async function AdminTransfers({ params, searchParams }: PageProps<"/[locale]/admin/transfers">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const filter = FILTERS.find((f) => f === query.filter) ?? "overdue";
  const now = new Date().toISOString();

  const supabase = await createClient();
  let request = supabase
    .from("deals")
    .select(
      "id, completed_at, transfer_due_at, transfer_submitted_at, transfer_doc_paths, auctions(cars(make, model, year, plate_number)), dealers(business_name)",
    )
    .eq("status", "completed");
  if (filter === "done") request = request.not("transfer_submitted_at", "is", null).order("transfer_submitted_at", { ascending: false });
  else if (filter === "overdue") request = request.is("transfer_submitted_at", null).lt("transfer_due_at", now).order("transfer_due_at");
  else request = request.is("transfer_submitted_at", null).gte("transfer_due_at", now).order("transfer_due_at");
  const { data } = await request.limit(100).overrideTypes<TransferRow[], { merge: false }>();
  const rows = data ?? [];
  const urls = filter === "done" ? await signedUrlMap(supabase, "transfer-docs", rows.flatMap((r) => r.transfer_doc_paths)) : {};

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("transfersTitle")}</h1>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/transfers?filter=${f}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              f === filter ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {t(`transferFilter.${f}`)}
          </Link>
        ))}
      </div>
      {rows.length === 0 && <p className="py-8 text-center text-ink/60">{t("transfersEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const car = row.auctions.cars;
          return (
            <li key={row.id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body font-semibold">
                  {car.make} {car.model} · {car.year} · <span className="price">{car.plate_number}</span>
                </p>
                <p className="text-caption text-ink/60">{row.dealers?.business_name}</p>
              </div>
              <p className={`text-caption ${filter === "overdue" ? "font-semibold text-danger" : "text-ink/60"}`}>
                {t("transferDue")}: {row.transfer_due_at ? formatDate(row.transfer_due_at, locale) : "—"}
                {row.transfer_submitted_at && ` · ${t("transferSubmitted")}: ${formatDate(row.transfer_submitted_at, locale)}`}
              </p>
              {filter === "done" && (
                <div className="flex gap-2 overflow-x-auto">
                  {row.transfer_doc_paths
                    .map((p) => urls[p])
                    .filter(Boolean)
                    .map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-20 w-28 rounded-lg object-cover" />
                      </a>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
