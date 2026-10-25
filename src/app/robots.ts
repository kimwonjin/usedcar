import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/integrations/config";

// 로그인 뒤 화면(거래·관리자·내 정보 등)은 검색에 노출하지 않는다
const PRIVATE = ["sell", "dealer", "admin", "account", "notifications", "deals", "support", "payments", "login"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", ...routing.locales.flatMap((l) => PRIVATE.map((p) => `/${l}/${p}`))],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
