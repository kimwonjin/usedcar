import { useTranslations } from "next-intl";

const STEPS = ["listed", "auction", "decision", "handover", "transfer"] as const;
export type SaleStep = (typeof STEPS)[number] | "done";

// 판매 진행 단계 표시: 지금 어디까지 왔는지, 다음은 무엇인지
export function SaleProgress({ current }: { current: SaleStep }) {
  const t = useTranslations("saleProgress");
  const index = current === "done" ? STEPS.length : STEPS.indexOf(current);
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm" aria-label={t("label")}>
      <ol className="grid grid-cols-5 gap-1">
        {STEPS.map((step, i) => {
          const state = i < index ? "done" : i === index ? "now" : "next";
          return (
            <li key={step} className="flex flex-col items-center gap-1 text-center" aria-current={state === "now" ? "step" : undefined}>
              <span
                className={`flex size-7 items-center justify-center rounded-full text-caption font-bold ${
                  state === "done" ? "bg-steppe text-white" : state === "now" ? "bg-navy text-white ring-4 ring-navy/15" : "bg-ink/10 text-ink/40"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={`text-[11px] leading-tight hyphens-auto break-words ${state === "now" ? "font-bold text-navy" : "text-ink/50"}`}>
                {t(`steps.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>
      {current !== "done" && <p className="mt-3 text-caption text-ink/70">👉 {t(`next.${current}`)}</p>}
    </section>
  );
}
