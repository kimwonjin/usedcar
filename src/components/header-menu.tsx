"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// 상단 메뉴: 판매·딜러 바로가기, 로그인 상태면 로그아웃
export function HeaderMenu() {
  const t = useTranslations("common");
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-3 text-caption">
      <Link href="/sell" className="text-white/90">
        {t("navSell")}
      </Link>
      <Link href="/dealer" className="text-white/90">
        {t("navDealer")}
      </Link>
      {signedIn && (
        <button type="button" onClick={logout} className="text-white/60">
          {t("logout")}
        </button>
      )}
    </nav>
  );
}
