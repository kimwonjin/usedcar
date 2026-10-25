"use client";

import { Link, usePathname } from "@/i18n/navigation";

// 상단 탭. 현재 경로와 앞부분이 같으면 선택 상태
export function TabsNav({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-2 flex gap-1 overflow-x-auto border-b border-ink/10 px-4">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-body font-semibold ${
              active ? "border-navy text-navy" : "border-transparent text-ink/50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
