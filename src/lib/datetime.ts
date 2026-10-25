export const intlLocales = { ko: "ko-KR", ru: "ru-KZ", kk: "kk-KZ" } as const;

// 카자흐어는 브라우저(Chrome 등)에 날짜 이름 데이터가 없어 "2026 M10 25"처럼 나오므로
// 현지에서 흔히 쓰는 숫자 형식(25.10.2026)으로 통일한다. 숫자만 쓰므로 모든 브라우저에 있는 러시아어 형식을 빌린다
const NUMERIC_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const formatLocale = (locale: string) =>
  locale === "kk" ? "ru-KZ" : (intlLocales[locale as keyof typeof intlLocales] ?? locale);

// 알마티 시간으로 날짜·시각 표시
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    timeZone: "Asia/Almaty",
    ...(locale === "kk"
      ? { ...NUMERIC_DATE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { dateStyle: "medium", timeStyle: "short" }),
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    timeZone: "Asia/Almaty",
    ...(locale === "kk" ? NUMERIC_DATE : { dateStyle: "medium" }),
  }).format(new Date(iso));
}

// <input type="datetime-local"> 값 ↔ ISO (브라우저 현지 시간 기준)
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
