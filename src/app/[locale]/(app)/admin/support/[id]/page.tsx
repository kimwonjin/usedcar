import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { PageHeader } from "@/components/page-header";
import { SupportStatusBadge } from "@/components/support-status";
import { SupportThread } from "@/components/support-thread";
import { requireAdmin } from "@/lib/auth";
import { formatPhoneInput } from "@/lib/phone";
import { loadTicket } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { CloseTicketButton } from "./close-button";

export default async function AdminSupportTicket({ params }: PageProps<"/[locale]/admin/support/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("support");
  const admin = await requireAdmin(locale);
  if (!admin) return <AdminOnly />;

  const loaded = await loadTicket(id);
  if (!loaded) notFound();
  const { ticket, messages } = loaded;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("profiles")
    .select("phone, full_name, role, locale")
    .eq("id", ticket.user_id)
    .maybeSingle();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={ticket.subject} backHref="/admin/support" backLabel={t("adminTitle")}>
        <SupportStatusBadge status={ticket.status} />
      </PageHeader>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 text-caption shadow-sm">
        <span>
          {t(`categories.${ticket.category}`)} · {customer?.full_name ?? "—"} ·{" "}
          {customer?.phone ? formatPhoneInput(customer.phone) : "—"} · {customer?.role}
          {customer?.locale ? ` · ${String(customer.locale).toUpperCase()}` : ""}
        </span>
        <CloseTicketButton ticketId={ticket.id} closed={ticket.status === "closed"} />
      </div>
      <SupportThread
        ticketId={ticket.id}
        userId={admin.id}
        messages={messages}
        viewer="admin"
        canReply
        notificationUrl={`/admin/support/${ticket.id}`}
      />
    </div>
  );
}
