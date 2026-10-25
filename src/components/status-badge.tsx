import { useTranslations } from "next-intl";
import { Badge } from "./badge";

type Kind = "auction" | "deal" | "claim" | "dealer";

const tones: Record<string, "verified" | "review" | "warning" | "gold"> = {
  live: "review",
  ended: "warning",
  accepted: "gold",
  scheduled: "review",
  depreciation_review: "warning",
  completed: "verified",
  submitted: "warning",
  approved: "verified",
  pending: "warning",
};

export function StatusBadge({ kind, status }: { kind: Kind; status: string }) {
  const t = useTranslations("status");
  return (
    // 상태 값은 DB enum이라 번역 키와 1:1로 맞춰 두었다
    <Badge tone={tones[status] ?? "neutral"}>{t(`${kind}.${status}` as Parameters<typeof t>[0])}</Badge>
  );
}
