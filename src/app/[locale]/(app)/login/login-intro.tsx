import { useTranslations } from "next-intl";

// 로그인 화면 머리말: 어디서 왔는지(판매·딜러)에 따라 왜 번호가 필요한지, 다음에 무엇을 하는지 알려 준다
export function LoginIntro({ next }: { next: string | null }) {
  const t = useTranslations("login");
  const kind = !next ? "default" : next.startsWith("/dealer") ? "dealer" : next.startsWith("/admin") ? "default" : "sell";
  const points =
    kind === "sell"
      ? [t("firstTime"), t("sellPoint1"), t("sellPoint2")]
      : kind === "dealer"
        ? [t("firstTime"), t("dealerPoint1")]
        : [t("firstTime"), t("defaultPoint")];

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-title font-bold text-navy">
        {kind === "sell" ? t("sellTitle") : kind === "dealer" ? t("dealerTitle") : t("title")}
      </h1>
      <ul className="flex flex-col gap-1.5 text-body text-ink/80">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="text-steppe">✓</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
