import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { SupportStatusBadge } from "@/components/support-status";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatPhoneInput } from "@/lib/phone";
import type { SupportTicket } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["open", "answered", "closed"] as const;

type AdminTicket = SupportTicket & { profiles: { phone: string | null; full_name: string | null; role: string } | null };

// 1:1 문의 처리: 답변 대기 → 답변 완료 → 종료
export default async function AdminSupport({ params, searchParams }: PageProps<"/[locale]/admin/support">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("support");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const status = STATUSES.find((s) => s === query.status) ?? "open";

  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, user_id, category, subject, status, created_at, updated_at, profiles(phone, full_name, role)")
    .eq("status", status)
    // 답변 대기는 오래 기다린 순
    .order("updated_at", { ascending: status === "open" })
    .limit(100)
    .overrideTypes<AdminTicket[], { merge: false }>();
  const tickets = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("adminTitle")}</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/support?status=${s}`}
            className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
              s === status ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
            }`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>
      {tickets.length === 0 && <p className="py-8 text-center text-ink/60">{t("adminEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link href={`/admin/support/${ticket.id}`} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold">{ticket.subject}</p>
                <p className="text-caption text-ink/60">
                  {t(`categories.${ticket.category}`)} · {ticket.profiles?.full_name ?? "—"}{" "}
                  {ticket.profiles?.phone ? formatPhoneInput(ticket.profiles.phone) : ""} · {formatDateTime(ticket.updated_at, locale)}
                </p>
              </div>
              <SupportStatusBadge status={ticket.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
