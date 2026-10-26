import type { Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { SetupNotice } from "@/components/setup-notice";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { PhotoSlot } from "@/lib/car-catalog";
import { signedUrlMap } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { almatyYear } from "@/lib/time";
import { CarWizard, type WizardInitial } from "./car-wizard";

type DraftCar = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel: WizardInitial["draft"]["fuel"] | null;
  transmission: WizardInitial["draft"]["transmission"] | null;
  steering: WizardInitial["draft"]["steering"];
  customs_cleared: boolean;
  body_type: WizardInitial["draft"]["bodyType"] | null;
  color: WizardInitial["draft"]["color"] | null;
  engine_volume: number | null;
  vin: string | null;
  accident: WizardInitial["draft"]["accident"] | null;
  owners: number | null;
  damage: WizardInitial["draft"]["damage"] | null;
  frame_damage: WizardInitial["draft"]["frameDamage"] | null;
  options: WizardInitial["draft"]["options"] | null;
  defects: string | null;
  spare_key: boolean | null;
  tire_state: WizardInitial["draft"]["tireState"] | null;
  wheel_scratches: number | null;
  panel_scratches: WizardInitial["draft"]["panelScratches"] | null;
  repair_needed: boolean | null;
  pros: string | null;
  desired_price: number | null;
  car_photos: { id: string; slot: PhotoSlot; storage_path: string; sort_order: number }[];
  registration_doc_paths: string[];
  review_status: string | null;
  auctions: { id: string; status: string }[];
};

// S3~S5 차량 등록. ?car=id 이면 작성 중이던 차량을 이어서 등록한다.
export default async function NewCarPage({ params, searchParams }: PageProps<"/[locale]/sell/new">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { car: carId, make, model, year } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    // 시세 조회에서 왔으면 로그인 뒤에도 미리 채운 등록 화면으로 돌아온다
    const query = new URLSearchParams(
      Object.entries({ make, model, year }).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
    ).toString();
    const next = query ? `/sell/new?${query}` : "/sell";
    return redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  }
  let initial: WizardInitial | undefined;
  if (typeof carId === "string") {
    const supabase = await createClient();
    const { data: car } = await supabase
      .from("cars")
      .select(
        "id, plate_number, make, model, year, mileage_km, fuel, transmission, steering, customs_cleared, body_type, color, engine_volume, vin, accident, owners, damage, frame_damage, options, defects, spare_key, tire_state, wheel_scratches, panel_scratches, repair_needed, pros, desired_price, car_photos(id, slot, storage_path, sort_order), registration_doc_paths, review_status, auctions(id, status)",
      )
      .eq("id", carId)
      .eq("seller_id", user.id)
      .maybeSingle()
      .overrideTypes<DraftCar, { merge: false }>();
    // 진행 중이거나 팔린 경매가 있는 차, 검수 중인 차는 고칠 수 없다 (반려된 신청은 고쳐서 다시 신청)
    const locked = car?.auctions.some((a) => ["live", "ended", "accepted"].includes(a.status)) || car?.review_status === "pending";
    if (!car || locked) return redirect({ href: "/sell", locale });

    const urls = await signedUrlMap(supabase, "car-photos", car.car_photos.map((p) => p.storage_path));
    const photos: WizardInitial["photos"] = {};
    for (const photo of [...car.car_photos].sort((a, b) => a.sort_order - b.sort_order)) {
      (photos[photo.slot] ??= []).push({ id: photo.id, path: photo.storage_path, preview: urls[photo.storage_path] ?? "" });
    }
    const docUrls = await signedUrlMap(supabase, "car-docs", car.registration_doc_paths);
    initial = {
      carId: car.id,
      photos,
      docs: car.registration_doc_paths.map((path) => ({ path, preview: docUrls[path] ?? "" })),
      draft: {
        plate: car.plate_number,
        make: car.make,
        model: car.model,
        year: String(car.year),
        mileage: String(car.mileage_km),
        fuel: car.fuel ?? "petrol",
        transmission: car.transmission ?? "automatic",
        steering: car.steering,
        customsCleared: car.customs_cleared,
        bodyType: car.body_type ?? "",
        color: car.color ?? "",
        engineVolume: car.engine_volume ? String(car.engine_volume) : "",
        vin: car.vin ?? "",
        accident: car.accident ?? "",
        owners: car.owners ? String(Math.min(car.owners, 4)) : "",
        damage: car.damage ?? {},
        frameDamage: car.frame_damage ?? {},
        options: car.options ?? [],
        defects: car.defects ?? "",
        spareKey: car.spare_key === null ? "" : car.spare_key ? "yes" : "no",
        tireState: car.tire_state ?? "",
        wheelScratches: car.wheel_scratches === null ? "" : String(car.wheel_scratches),
        panelScratches: car.panel_scratches ?? "",
        repairNeeded: car.repair_needed === null ? "" : car.repair_needed ? "yes" : "no",
        pros: car.pros ?? "",
        desiredPrice: car.desired_price ? String(car.desired_price) : "",
      },
    };
  }

  // 시세 조회에서 넘어오면 제조사·모델·연식을 미리 채운다
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const prefill = {
    make: text(make, 40),
    model: text(model, 40),
    year: /^\d{4}$/.test(text(year, 4)) ? text(year, 4) : "",
  };

  // 경매 검수가 켜져 있으면 마지막 버튼을 "검수 신청"으로 보여준다
  const { data: reviewSetting } = await (await createClient())
    .from("app_settings")
    .select("value")
    .eq("key", "auction_review")
    .maybeSingle();
  const reviewOn = (reviewSetting?.value ?? "on") === "on";

  return (
    <CarWizard userId={user.id} currentYear={almatyYear()} initial={initial} prefill={prefill} reviewOn={reviewOn} />
  );
}
