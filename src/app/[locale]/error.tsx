"use client";

import { useTranslations } from "next-intl";

// 화면을 그리다 오류가 나면 앱 전체가 멈추지 않도록 여기서 받는다
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errors");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-[48px]">⚠️</p>
      <h1 className="text-title font-bold text-navy">{t("errorTitle")}</h1>
      <p className="text-body text-ink/60">{t("errorBody")}</p>
      <button type="button" onClick={() => retry()} className="mt-2 rounded-xl bg-navy px-5 py-3 font-semibold text-white">
        {t("retry")}
      </button>
    </div>
  );
}
