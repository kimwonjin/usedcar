import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { formatKm, formatTenge } from "@/lib/format";
import { loadOgFonts } from "@/lib/og-fonts";
import { loadPublicSale } from "@/lib/public-sale";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 판매 결과 공유 링크의 미리보기 이미지 (메신저·SNS에 보이는 카드)
export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : "ru";
  const t = await getTranslations({ locale, namespace: "sold" });
  const sale = await loadPublicSale(id);
  const car = sale ? `${sale.make} ${sale.model} · ${sale.year}` : "Satu";
  const price = sale ? formatTenge(sale.price) : "";
  const meta = sale ? formatKm(sale.mileage_km) : "";
  const competed = sale ? t("competed", { count: sale.bidders }) : "";
  const badge = t("badge");
  const { fonts, fontFamily } = await loadOgFonts(["Satu", "Almaty", "🎉", badge, car, price, meta, competed].join(""));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: "#14213D",
          color: "#FFFFFF",
          fontFamily,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#00A3C4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>Satu</div>
          <div style={{ display: "flex", fontSize: 28, color: "#FFFFFF99", marginLeft: 6 }}>Almaty</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 30, color: "#FFFFFFB3" }}>{badge}</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{car}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#FFFFFF99" }}>{meta}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "#F5B700", whiteSpace: "nowrap" }}>{price}</div>
          <div
            style={{
              display: "flex",
              padding: "14px 26px",
              borderRadius: 999,
              background: "#FFFFFF14",
              fontSize: 30,
              whiteSpace: "nowrap",
            }}
          >
            {competed}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
