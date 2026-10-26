import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { loadOgFonts } from "@/lib/og-fonts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "ru", namespace: "meta" });
  return [{ id: "share", alt: t("ogAlt"), size, contentType }];
}

// 링크 공유 미리보기 이미지 (언어별)
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : "ru";
  const t = await getTranslations({ locale, namespace: "meta" });
  const tl = await getTranslations({ locale, namespace: "landing" });
  const headline = tl("headline");
  const points = [t("ogPoint1"), t("ogPoint2"), t("ogPoint3")];
  const allText = ["Satu", "Almaty", headline, ...points, "✓"].join("");
  const { fonts, fontFamily } = await loadOgFonts(allText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#14213D",
          color: "#FFFFFF",
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#00A3C4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>Satu</div>
          <div style={{ display: "flex", fontSize: 30, color: "#FFFFFF99", marginLeft: 8 }}>Almaty</div>
        </div>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.2, maxWidth: 1050 }}>{headline}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {points.map((point) => (
            <div
              key={point}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 22px",
                borderRadius: 999,
                background: "#FFFFFF14",
                fontSize: 26,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#00A3C4", fontWeight: 700 }}>✓</span>
              {point}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
