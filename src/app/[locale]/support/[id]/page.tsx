import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SupportStatusBadge } from "@/components/support-status";
import { SupportThread } from "@/components/support-thread";
import { redirect } from "@/i18n/navigation";
import { getUserId } from "@/lib/auth";
import { loadTicket } from "@/lib/support";

export default async function SupportTicketPage({ params }: PageProps<"/[locale]/support/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("support");

  const userId = await getUserId();
  if (!userId) return redirect({ href: `/login?next=/support/${id}`, locale });
  const loaded = await loadTicket(id);
  if (!loaded || loaded.ticket.user_id !== userId) notFound();
  const { ticket, messages } = loaded;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={ticket.subject} backHref="/support" backLabel={t("title")}>
        <SupportStatusBadge status={ticket.status} />
      </PageHeader>
      <p className="text-caption text-ink/60">{t(`categories.${ticket.category}`)}</p>
      {ticket.status === "open" && <p className="rounded-xl bg-steppe/5 p-3 text-caption text-ink/70">{t("waitingHint")}</p>}
      <SupportThread
        ticketId={ticket.id}
        userId={userId}
        messages={messages}
        viewer="user"
        canReply={ticket.status !== "closed"}
        notificationUrl={`/support/${ticket.id}`}
      />
    </div>
  );
}
