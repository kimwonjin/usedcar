"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// 판매 완료 후 결과 공유: 휴대폰 공유 창(카톡·WhatsApp·Telegram 등), 안 되면 링크 복사
export function ShareSale({ dealId, car, price, bidders }: { dealId: string; car: string; price: string; bidders: number }) {
  const t = useTranslations("sold");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/${locale}/sold/${dealId}`;
    const text = t("shareText", { car, price, count: bidders });
    if (navigator.share) {
      try {
        await navigator.share({ title: t("title", { car }), text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 사용자가 공유 창을 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("copyPrompt"), url);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <p className="text-body font-semibold">🎉 {t("shareTitle")}</p>
      <p className="text-caption text-ink/60">{t("shareHint")}</p>
      <button type="button" onClick={share} className="h-12 rounded-xl bg-steppe font-bold text-white">
        {copied ? `✓ ${t("copied")}` : t("shareButton")}
      </button>
    </section>
  );
}
