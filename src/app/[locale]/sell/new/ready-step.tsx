"use client";

import { useTranslations } from "next-intl";
import { REQUIRED_SLOTS } from "@/lib/car-catalog";
import { SlotPictogram } from "./slot-pictogram";

const TIMELINE = ["photos", "auction", "decision", "visit", "transfer"] as const;

// 차량 정보 입력을 마친 뒤 사진 촬영 전에 보여주는 안내 (헤이딜러처럼):
// 이제 사진만 올리면 경매가 시작된다는 것, 필요한 사진, 앞으로의 진행 과정
export function ReadyStep({ car }: { car: string }) {
  const t = useTranslations("carForm.ready");
  const tf = useTranslations("carForm");
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl bg-navy p-5 text-white">
        <p className="text-caption text-white/70">👏 {t("done", { car })}</p>
        <h1 className="text-title font-bold leading-snug">{t("title")}</h1>
        <div className="grid grid-cols-4 gap-2 rounded-xl bg-white/10 p-3">
          {REQUIRED_SLOTS.map((slot) => (
            <div key={slot} className="flex flex-col items-center gap-1 text-white/90">
              <SlotPictogram slot={slot} />
              <span className="text-center text-[11px] leading-tight">{tf(`slots.${slot}.label`)}</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-white/80">{t("photosHint", { count: REQUIRED_SLOTS.length })}</p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-subtitle font-semibold">{t("timelineTitle")}</h2>
        <ol className="flex flex-col">
          {TIMELINE.map((step, i) => (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 size-3 shrink-0 rounded-full ${i === 0 ? "bg-steppe ring-4 ring-steppe/20" : "bg-ink/20"}`}
                />
                {i < TIMELINE.length - 1 && <span className="w-px flex-1 border-l border-dashed border-ink/20" />}
              </div>
              <div className="pb-4">
                <p className={`text-body font-semibold ${i === 0 ? "text-navy" : "text-ink/70"}`}>
                  {t(`steps.${step}.title`)}
                  {i === 0 && <span className="ml-2 text-caption font-normal text-steppe">{t("now")}</span>}
                </p>
                <p className="text-caption text-ink/60">{t(`steps.${step}.desc`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
