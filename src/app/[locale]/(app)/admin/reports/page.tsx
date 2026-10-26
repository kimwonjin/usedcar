import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Badge } from "@/components/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatPhoneInput } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { ReportActions } from "./report-actions";

const STATUSES = ["open", "resolved", "dismissed"] as const;

type ReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  deal_id: string | null;
  reporter: { phone: string | null; role: string } | null;
  target: { phone: string | null; role: string } | null;
};

// 신고 처리: 거래 당사자가 상대를 신고한 건을 확인하고 처리·기각
export default async function AdminReports({ params, searchParams }: PageProps<"/[locale]/admin/reports">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tr = await getTranslations("report");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const status = STATUSES.find((s) => s === query.status) ?? "open";

  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, reason, detail, status, admin_note, created_at, deal_id, reporter:profiles!reports_reporter_id_fkey(phone, role), target:profiles!reports_target_id_fkey(phone, role)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "open" })
    .overrideTypes<ReportRow[], { merge: false }>();
  const reports = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("reportsTitle")}</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              s === status ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {t(`reportStatus.${s}`)}
          </Link>
        ))}
      </div>

      {reports.length === 0 && <p className="py-8 text-center text-ink/60">{t("emptyList")}</p>}
      {reports.map((r) => (
        <article key={r.id} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="warning">{tr(`reasons.${r.reason}` as Parameters<typeof tr>[0])}</Badge>
            <span className="text-caption text-ink/50">{formatDateTime(r.created_at, locale)}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
            <dt className="text-ink/60">{t("reporter")}</dt>
            <dd className="price">
              {r.reporter?.phone ? formatPhoneInput(r.reporter.phone) : "—"} · {t(`roles.${r.reporter?.role ?? "seller"}` as Parameters<typeof t>[0])}
            </dd>
            <dt className="text-ink/60">{t("reported")}</dt>
            <dd className="price">
              {r.target?.phone ? formatPhoneInput(r.target.phone) : "—"} · {t(`roles.${r.target?.role ?? "seller"}` as Parameters<typeof t>[0])}
            </dd>
          </dl>
          {r.detail && <p className="rounded-lg bg-surface p-3 text-body whitespace-pre-line">{r.detail}</p>}
          {r.status === "open" ? (
            <ReportActions reportId={r.id} />
          ) : (
            r.admin_note && <p className="text-caption text-ink/70">{t("note")}: {r.admin_note}</p>
          )}
        </article>
      ))}
    </div>
  );
}
