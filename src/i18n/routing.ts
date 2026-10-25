import { defineRouting } from "next-intl/routing";

// 한국어로 먼저 개발하고 러시아어·카자흐어 번역을 채운다.
export const routing = defineRouting({
  locales: ["ko", "ru", "kk"],
  defaultLocale: "ko",
});

export type Locale = (typeof routing.locales)[number];
