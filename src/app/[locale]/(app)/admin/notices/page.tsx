import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Badge } from "@/components/badge";
import { requireAdmin } from "@/lib/auth";
import { localized, type Announcement } from "@/lib/announcements";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { EndNoticeButton, NoticeForm } from "./notice-form";

// 공지 관리: 새 공지 작성, 게시 중·종료된 공지 목록
export default async function AdminNotices({ params }: PageProps<"/[locale]/admin/notices">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("notices");
  const admin = await requireAdmin(locale);
  if (!admin) return <AdminOnly />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, audience, title, body, link, pinned, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const notices = (data ?? []) as Announcement[];
  const now = new Date();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("adminTitle")}</h1>
      <NoticeForm userId={admin.id} />
      <ul className="flex flex-col gap-2">
        {notices.map((n) => {
          const live = new Date(n.starts_at) <= now && (!n.ends_at || new Date(n.ends_at) > now);
          return (
            <li key={n.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold">
                  {n.pinned && "📌 "}
                  {localized(n.title, locale)}
                </p>
                <p className="text-caption text-ink/60">
                  {t(`audience.${n.audience}`)} · {formatDateTime(n.starts_at, locale)}
                  {n.ends_at && ` ~ ${formatDateTime(n.ends_at, locale)}`} · {Object.keys(n.title).join("/").toUpperCase()}
                </p>
              </div>
              <Badge tone={live ? "verified" : "neutral"}>{t(live ? "live" : "ended")}</Badge>
              {live && <EndNoticeButton id={n.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
