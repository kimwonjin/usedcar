import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/status-badge";
import type { Claim } from "@/lib/deals";
import { formatTenge } from "@/lib/format";
import type { ReactNode } from "react";

// 감가 청구 한 건: 금액·사유·딜러 사진·판매자 의견·관리자 결정
export function ClaimCard({ claim, agreedPrice, children }: { claim: Claim; agreedPrice: number; children?: ReactNode }) {
  const t = useTranslations("deal");
  const percent = ((claim.amount / agreedPrice) * 100).toFixed(1);
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-danger/20 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="price text-subtitle font-bold text-danger">
          −{formatTenge(claim.amount)} <span className="text-caption font-normal text-ink/60">({percent}%)</span>
        </span>
        <StatusBadge kind="claim" status={claim.status} />
      </div>
      <p className="text-body whitespace-pre-line">{claim.reason}</p>
      {claim.photoUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {claim.photoUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="size-20 shrink-0 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {claim.seller_comment && (
        <p className="rounded-lg bg-surface p-2 text-caption">
          <span className="font-semibold">{t("sellerComment")}:</span> {claim.seller_comment}
        </p>
      )}
      {claim.admin_note && (
        <p className="rounded-lg bg-steppe/5 p-2 text-caption">
          <span className="font-semibold">{t("adminNote")}:</span> {claim.admin_note}
        </p>
      )}
      {children}
    </article>
  );
}
