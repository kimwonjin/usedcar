import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SupportStatusBadge } from "@/components/support-status";
import { Link, redirect } from "@/i18n/navigation";
import { getUserId } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import type { SupportTicket } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { NewTicketForm } from "./new-ticket-form";

// 고객센터: 내 문의 목록 + 새 문의
export default async function SupportPage({ params }: PageProps<"/[locale]/support">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("support");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login?next=/support", locale });

  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, user_id, category, subject, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .overrideTypes<SupportTicket[], { merge: false }>();
  const tickets = data ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <p className="text-caption text-ink/60">{t("intro")}</p>
        <Link href="/faq" className="text-caption font-semibold text-steppe">
          {t("checkFaq")} →
        </Link>
      </div>

      {tickets.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-subtitle font-semibold">{t("myTickets")}</h2>
          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/support/${ticket.id}`} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold">{ticket.subject}</p>
                    <p className="text-caption text-ink/60">
                      {t(`categories.${ticket.category}`)} · {formatDate(ticket.updated_at, locale)}
                    </p>
                  </div>
                  <SupportStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewTicketForm userId={userId} />
    </div>
  );
}
