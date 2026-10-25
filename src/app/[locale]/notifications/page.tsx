import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InstallPrompt } from "@/components/install-prompt";
import { PushToggle } from "@/components/push-toggle";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { notificationText, type NotificationParams } from "@/lib/notification-text";
import { createClient } from "@/lib/supabase/server";
import { MarkAllRead } from "./mark-all-read";

type NotificationRow = {
  id: string;
  type: string;
  params: NotificationParams;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

// 알림함: 최근 알림 50개. 열면 모두 읽음 처리한다.
export default async function NotificationsPage({ params }: PageProps<"/[locale]/notifications">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("notificationCenter");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login", locale });

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, params, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<NotificationRow[], { merge: false }>();
  const notifications = data ?? [];
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      <InstallPrompt />
      <PushToggle />
      {hasUnread && <MarkAllRead />}

      {notifications.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col divide-y divide-ink/10 overflow-hidden rounded-xl bg-white shadow-sm">
        {notifications.map((n) => {
          const { title, body } = notificationText(locale, n.type, n.params);
          const content = (
            <div className="flex gap-3 p-4">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-steppe"}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-body ${n.read_at ? "" : "font-semibold"}`}>{title}</p>
                {body && <p className="text-caption text-ink/70">{body}</p>}
                <p className="mt-1 text-caption text-ink/40">{formatDateTime(n.created_at, locale)}</p>
              </div>
            </div>
          );
          return (
            <li key={n.id} className={n.read_at ? "" : "bg-steppe/5"}>
              {n.url ? <Link href={n.url}>{content}</Link> : content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
