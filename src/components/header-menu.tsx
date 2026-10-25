"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// 상단 메뉴: 판매·딜러 바로가기, 알림(안 읽은 수), 로그아웃
export function HeaderMenu() {
  const t = useTranslations("common");
  const tn = useTranslations("notificationCenter");
  const locale = useLocale();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    // 푸시 알림 문구를 사용자 언어로 보내기 위해 현재 언어를 저장한다
    supabase.from("profiles").update({ locale }).eq("id", userId).neq("locale", locale).then(() => {});

    const refresh = () =>
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .then(({ count }) => setUnread(count ?? 0));
    refresh();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, locale]);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-2.5 text-caption whitespace-nowrap">
      <Link href="/sell" className="text-white/90">
        {t("navSell")}
      </Link>
      <Link href="/dealer" className="text-white/90">
        {t("navDealer")}
      </Link>
      {userId && (
        <>
          <Link href="/notifications" aria-label={tn("bell")} className="relative text-[18px] leading-none">
            🔔
            {unread > 0 && (
              <span className="price absolute -top-1.5 -right-2 min-w-4 rounded-full bg-gold px-1 text-center text-[10px] leading-4 font-bold text-navy">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          {/* 러시아어·카자흐어는 글자가 길어 좁은 화면에서 넘치므로 아이콘으로 둔다 */}
          <button type="button" onClick={logout} aria-label={t("logout")} title={t("logout")} className="text-white/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </>
      )}
    </nav>
  );
}
