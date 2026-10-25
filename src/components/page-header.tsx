import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export function PageHeader({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {backHref && (
        <Link href={backHref} className="text-body text-ink/70">
          ← {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title font-bold text-navy">{title}</h1>
        {children}
      </div>
    </div>
  );
}
