import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link, redirect } from "@/i18n/navigation";
import { getUserId } from "@/lib/auth";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Договор купли-продажи · Satu", robots: { index: false } };

type ContractDeal = {
  id: string;
  seller_id: string;
  dealer_id: string;
  agreed_price: number;
  final_price: number | null;
  auctions: { cars: { make: string; model: string; year: number; plate_number: string; vin: string | null; mileage_km: number } };
  dealers: { business_name: string; bin: string; address: string } | null;
};

// 자동차 매매 계약서 (러시아어, 인쇄용). 카자흐스탄에서 일반적으로 쓰는 항목으로 만든 초안이며,
// 개인정보(이름·신분증 번호)는 서버에 저장하지 않고 종이에 직접 쓴다.
export default async function ContractPage({ params }: PageProps<"/[locale]/deals/[id]/contract">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("transfer");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login", locale });

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, seller_id, dealer_id, agreed_price, final_price, auctions(cars(make, model, year, plate_number, vin, mileage_km)), dealers(business_name, bin, address)",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<ContractDeal, { merge: false }>();
  if (!deal || (deal.seller_id !== userId && deal.dealer_id !== userId)) notFound();

  const car = deal.auctions.cars;
  const dealer = deal.dealers;
  const price = deal.final_price ?? deal.agreed_price;
  const backHref = deal.seller_id === userId ? `/sell/deals/${id}` : `/dealer/deals/${id}`;
  const blank = <span className="inline-block min-w-48 border-b border-ink/60">&nbsp;</span>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm print:hidden">
        <Link href={backHref} className="text-body text-ink/70">
          ← {t("back")}
        </Link>
        <p className="text-body">{t("contractIntro")}</p>
        <p className="text-caption text-ink/60">{t("disclaimer")}</p>
        <PrintButton label={t("print")} />
      </div>

      <article className="contract rounded-xl bg-white p-6 text-[14px] leading-relaxed text-black shadow-sm print:rounded-none print:p-0 print:text-[12.5px] print:leading-normal print:shadow-none">
        <h1 className="text-center text-[17px] font-bold">ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ</h1>
        <div className="mt-3 flex justify-between">
          <span>г. Алматы</span>
          <span>«____» ______________ 20___ г.</span>
        </div>

        <p className="mt-4">
          <b>Продавец:</b> {blank}, ИИН {blank}, удостоверение личности № {blank}, выдано {blank}, проживающий(ая) по адресу: {blank},
          с одной стороны, и
        </p>
        <p className="mt-2">
          <b>Покупатель:</b> {dealer?.business_name ?? blank}, БИН/ИИН {dealer?.bin ?? blank}, адрес: {dealer?.address ?? blank}, в лице{" "}
          {blank}, с другой стороны, заключили настоящий договор о нижеследующем:
        </p>

        <h2 className="mt-4 font-bold">1. Предмет договора</h2>
        <p>1.1. Продавец передаёт в собственность Покупателя, а Покупатель принимает и оплачивает автомобиль:</p>
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {[
              ["Марка, модель", `${car.make} ${car.model}`],
              ["Год выпуска", String(car.year)],
              ["Государственный номер", car.plate_number],
              ["VIN / номер кузова", car.vin ?? ""],
              ["Пробег по одометру, км", car.mileage_km.toLocaleString("ru-RU")],
              ["Цвет", ""],
              ["Свидетельство о регистрации ТС №", ""],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="w-1/2 border border-ink/40 px-2 py-1">{label}</td>
                <td className="border border-ink/40 px-2 py-1">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2">
          1.2. Продавец гарантирует, что автомобиль принадлежит ему на праве собственности, не продан, не заложен, под арестом и запретом
          не состоит, не является предметом спора.
        </p>

        <h2 className="mt-4 font-bold">2. Цена и порядок расчётов</h2>
        <p>
          2.1. Цена автомобиля составляет <b>{formatTenge(price)}</b> (прописью: {blank} тенге).
        </p>
        <p>2.2. Оплата производится безналичным переводом на счёт Продавца при подписании настоящего договора.</p>
        <p>2.3. Цена окончательная и учитывает техническое состояние автомобиля, осмотренного Покупателем.</p>

        <h2 className="mt-4 font-bold">3. Передача автомобиля</h2>
        <p>
          3.1. Автомобиль, ключи (____ шт.) и документы передаются Покупателю после поступления оплаты. Покупатель осмотрел автомобиль,
          претензий к его состоянию не имеет.
        </p>
        <p>3.2. Право собственности переходит к Покупателю с момента подписания настоящего договора и полной оплаты.</p>
        <p>3.3. Покупатель обязуется зарегистрировать автомобиль на своё имя в установленном законодательством Республики Казахстан порядке и сроки.</p>

        <h2 className="mt-4 font-bold">4. Прочие условия</h2>
        <p>4.1. Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из сторон.</p>
        <p>4.2. Споры разрешаются путём переговоров, а при недостижении согласия — в суде по законодательству Республики Казахстан.</p>

        <div className="mt-8 grid grid-cols-2 gap-8">
          {["Продавец", "Покупатель"].map((side) => (
            <div key={side} className="flex flex-col gap-6">
              <b>{side}</b>
              <span className="border-b border-ink/60 pb-1 text-[12px] text-ink/50">ФИО</span>
              <span className="border-b border-ink/60 pb-1 text-[12px] text-ink/50">Подпись</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-ink/50">Satu · {deal.id.slice(0, 8)}</p>
      </article>
    </div>
  );
}
