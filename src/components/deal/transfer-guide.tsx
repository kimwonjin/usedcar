import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// 명의 이전·서류 안내 + 매매 계약서 인쇄 링크 (판매자·딜러 거래 화면 공통)
export function TransferGuide({ dealId, role }: { dealId: string; role: "seller" | "dealer" }) {
  const t = useTranslations("transfer");
  const bring = role === "seller" ? (["id", "techPassport", "keys", "service"] as const) : (["dealerDocs", "payment"] as const);
  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-body font-semibold">📄 {t("title")}</summary>
      <div className="flex flex-col gap-4 border-t border-ink/10 p-4">
        <div>
          <p className="mb-1 text-caption font-semibold text-ink/60">{t("bringTitle")}</p>
          <ul className="flex flex-col gap-1 text-body">
            {bring.map((key) => (
              <li key={key}>☐ {t(`bring.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-caption font-semibold text-ink/60">{t("stepsTitle")}</p>
          <ol className="flex flex-col gap-1.5 text-body">
            {(["contract", "payment", "handover", "registration", "after"] as const).map((key, i) => (
              <li key={key} className={key === "payment" ? "font-semibold text-danger" : ""}>
                {i + 1}. {t(`steps.${key}`)}
              </li>
            ))}
          </ol>
        </div>
        <Link
          href={`/deals/${dealId}/contract`}
          className="flex h-11 items-center justify-center rounded-lg border border-navy font-semibold text-navy"
        >
          🖨 {t("printContract")}
        </Link>
        <p className="text-caption text-ink/50">{t("disclaimer")}</p>
      </div>
    </details>
  );
}
