// 알마티는 2024년부터 UTC+5 고정 (서머타임 없음). Vercel 서버는 UTC로 돈다.
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfAlmatyDay(now: number = Date.now()): Date {
  return new Date(Math.floor((now + ALMATY_OFFSET_MS) / DAY_MS) * DAY_MS - ALMATY_OFFSET_MS);
}
