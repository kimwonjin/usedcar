import { useTranslations } from "next-intl";
import { FUELS, STEERINGS, TRANSMISSIONS } from "@/lib/car-catalog";

type Values = {
  make: string | null;
  sort: string;
  yearFrom: number | null;
  yearTo: number | null;
  maxKm: number | null;
  fuel: string | null;
  transmission: string | null;
  steering: string | null;
  noAccident: boolean;
  favorites: boolean;
};

// 상세 필터: 일반 GET 폼이라 자바스크립트 없이도 동작하고, 조건이 주소에 남아 공유·새로고침에 유지된다
export function FilterPanel({ action, values, activeCount }: { action: string; values: Values; activeCount: number }) {
  const t = useTranslations("dealerFilter");
  const tf = useTranslations("carForm");
  const select = "h-10 w-full rounded-lg border border-ink/15 bg-white px-2 text-body";

  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-body font-semibold">
        <span>
          ⚙ {t("title")} {activeCount > 0 && <span className="ml-1 rounded-full bg-navy px-2 text-caption text-white">{activeCount}</span>}
        </span>
        <span className="text-ink/40">⌄</span>
      </summary>
      <form action={action} method="get" className="grid grid-cols-2 gap-3 border-t border-ink/10 p-4">
        {values.make && <input type="hidden" name="make" value={values.make} />}
        {values.favorites && <input type="hidden" name="fav" value="1" />}
        <input type="hidden" name="sort" value={values.sort} />
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("yearFrom")}
          <input name="yearFrom" inputMode="numeric" defaultValue={values.yearFrom ?? ""} placeholder="2015" className={select} />
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {t("yearTo")}
          <input name="yearTo" inputMode="numeric" defaultValue={values.yearTo ?? ""} placeholder="2024" className={select} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-caption text-ink/60">
          {t("maxKm")}
          <select name="maxKm" defaultValue={values.maxKm ?? ""} className={select}>
            <option value="">{t("any")}</option>
            {[30000, 60000, 100000, 150000, 200000].map((km) => (
              <option key={km} value={km}>
                ≤ {km.toLocaleString("ru-RU")} km
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {tf("details.fuel")}
          <select name="fuel" defaultValue={values.fuel ?? ""} className={select}>
            <option value="">{t("any")}</option>
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {tf(`fuel.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink/60">
          {tf("details.transmission")}
          <select name="transmission" defaultValue={values.transmission ?? ""} className={select}>
            <option value="">{t("any")}</option>
            {TRANSMISSIONS.map((v) => (
              <option key={v} value={v}>
                {tf(`transmission.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-caption text-ink/60">
          {tf("details.steering")}
          <select name="steering" defaultValue={values.steering ?? ""} className={select}>
            <option value="">{t("any")}</option>
            {STEERINGS.map((v) => (
              <option key={v} value={v}>
                {tf(`steering.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-body">
          <input type="checkbox" name="noAccident" value="1" defaultChecked={values.noAccident} className="size-5 accent-navy" />
          {t("noAccident")}
        </label>
        <a href={`${action}?sort=${values.sort}`} className="flex h-11 items-center justify-center rounded-lg border border-ink/15 text-body text-ink/70">
          {t("reset")}
        </a>
        <button type="submit" className="h-11 rounded-lg bg-navy text-body font-semibold text-white">
          {t("apply")}
        </button>
      </form>
    </details>
  );
}
