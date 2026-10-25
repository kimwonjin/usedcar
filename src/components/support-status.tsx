import { useTranslations } from "next-intl";
import { Badge } from "./badge";

const tones = { open: "review", answered: "verified", closed: "neutral" } as const;

export function SupportStatusBadge({ status }: { status: keyof typeof tones }) {
  const t = useTranslations("support.status");
  return <Badge tone={tones[status]}>{t(status)}</Badge>;
}
