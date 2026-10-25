export const intlLocales = { ko: "ko-KR", ru: "ru-KZ", kk: "kk-KZ" } as const;

// 알마티 시간으로 날짜·시각 표시
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocales[locale as keyof typeof intlLocales] ?? locale, {
    timeZone: "Asia/Almaty",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocales[locale as keyof typeof intlLocales] ?? locale, {
    timeZone: "Asia/Almaty",
    dateStyle: "medium",
  }).format(new Date(iso));
}

// <input type="datetime-local"> 값 ↔ ISO (브라우저 현지 시간 기준)
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
