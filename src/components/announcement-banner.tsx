"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { localized, type Announcement } from "@/lib/announcements";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "satu-dismissed-notices";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

// 상단 공지 배너: 게시 중인 고정 공지 중 이 화면 대상(딜러 화면 → 딜러, 그 외 → 판매자)이고 닫지 않은 최신 1건
export function AnnouncementBanner() {
  const t = useTranslations("notices");
  const locale = useLocale();
  const pathname = usePathname();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("announcements")
      .select("id, audience, title, body, link, pinned, starts_at, ends_at, created_at")
      .eq("pinned", true)
      .order("starts_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return;
        setItems((data ?? []) as Announcement[]);
        setDismissed(readDismissed());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pathname.startsWith("/admin")) return null;
  const audience = pathname.startsWith("/dealer") ? "dealers" : "sellers";
  const notice = items.find((n) => (n.audience === "all" || n.audience === audience) && !dismissed.includes(n.id));
  if (!notice) return null;

  function dismiss(id: string) {
    const next = [...readDismissed(), id].slice(-50);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
    setDismissed(next);
  }

  const title = localized(notice.title, locale);
  return (
    <div className="border-b border-steppe/20 bg-steppe/10 print:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <span aria-hidden>📢</span>
        <Link href={notice.link ?? `/notices#${notice.id}`} className="min-w-0 flex-1 truncate text-caption font-semibold text-navy">
          {title}
        </Link>
        <button type="button" onClick={() => dismiss(notice.id)} aria-label={t("dismiss")} className="shrink-0 p-1 text-ink/40">
          ✕
        </button>
      </div>
    </div>
  );
}
