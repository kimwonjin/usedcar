import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "cars",
  "dealers",
  "dealer_penalties",
  "auctions",
  "deals",
  "depreciation_claims",
  "payments",
  "referral_rewards",
  "app_settings",
  "fee_bands",
  "announcements",
  "reports",
  "profiles",
  "deal_inspections",
] as const;

type AuditRow = {
  id: number;
  op: "INSERT" | "UPDATE" | "DELETE";
  target_table: (typeof TABLES)[number];
  target_id: string | null;
  changes: Record<string, [unknown, unknown]>;
  created_at: string;
  profiles: { full_name: string | null; phone: string | null } | null;
};

const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "string" ? v : JSON.stringify(v));

// 관리자 작업 기록: 누가 언제 무엇을 바꿨는지 (수정·삭제 불가)
export default async function AdminAudit({ params, searchParams }: PageProps<"/[locale]/admin/audit">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("adminAudit");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const table = TABLES.find((x) => x === query.table);
  const supabase = await createClient();
  let request = supabase
    .from("admin_audit")
    .select("id, op, target_table, target_id, changes, created_at, profiles!admin_audit_admin_id_fkey(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (table) request = request.eq("target_table", table);
  const { data } = await request.overrideTypes<AuditRow[], { merge: false }>();
  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <p className="text-caption text-ink/60">{t("hint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${!table ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"}`}
        >
          {t("all")}
        </Link>
        {TABLES.map((x) => (
          <Link
            key={x}
            href={`/admin/audit?table=${x}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${x === table ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"}`}
          >
            {t(`tables.${x}`)}
          </Link>
        ))}
      </div>

      {rows.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-1.5 rounded-xl bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
              <span className="text-ink/60">{formatDateTime(row.created_at, locale)}</span>
              <span className="font-semibold">
                {row.profiles?.full_name ?? "—"} <span className="price font-normal text-ink/60">{row.profiles?.phone ?? ""}</span>
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 font-semibold">
                {t(`tables.${row.target_table}`)} · {t(`ops.${row.op}`)}
              </span>
              {row.target_id && <span className="price text-ink/40">{row.target_id}</span>}
            </div>
            <dl className="grid gap-x-3 gap-y-0.5 text-caption md:grid-cols-[minmax(8rem,auto)_1fr]">
              {Object.entries(row.changes).map(([key, [before, after]]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-ink/60">{key}</dt>
                  <dd className="break-all">
                    {row.op === "UPDATE" ? (
                      <>
                        <span className="text-ink/50 line-through">{show(before)}</span> → <span className="font-semibold">{show(after)}</span>
                      </>
                    ) : (
                      show(row.op === "DELETE" ? before : after)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
