import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { Countdown } from "@/components/countdown";
import { SetupNotice } from "@/components/setup-notice";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatKm } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type LiveAuction = {
  id: string;
  ends_at: string;
  cars: { make: string; model: string; year: number; mileage_km: number; steering: string };
};

// D2 딜러 경매 목록: 한 줄에 차량명·연식·주행거리·남은 시간 고정 배치
export default async function DealerAuctions({ params }: PageProps<"/[locale]/dealer">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("dealer");
  if (!isSupabaseConfigured) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });
  if (user.role !== "dealer" && user.role !== "admin") {
    // D1 가입 신청 화면은 다음 작업에서 구현
    return <p className="rounded-xl bg-white p-4">{t("pending")}</p>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("auctions")
    .select("id, ends_at, cars(make, model, year, mileage_km, steering)")
    .eq("status", "live")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .overrideTypes<LiveAuction[], { merge: false }>();
  const auctions = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      {auctions.length === 0 && <p className="text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col divide-y divide-ink/10 rounded-xl bg-white">
        {auctions.map((auction) => (
          <li key={auction.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 p-3">
            <span className="truncate text-subtitle font-semibold">
              {auction.cars.make} {auction.cars.model}
            </span>
            <Countdown endsAt={auction.ends_at} />
            <span className="text-caption text-ink/60">
              {t("year", { year: auction.cars.year })} · {formatKm(auction.cars.mileage_km)}
            </span>
            {auction.cars.steering === "right" && <Badge tone="warning">RHD</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}
