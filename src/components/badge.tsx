import type { ReactNode } from "react";

const tones = {
  verified: "bg-success/10 text-success",
  review: "bg-steppe/10 text-steppe",
  warning: "bg-danger/10 text-danger",
  gold: "bg-gold text-navy",
};

export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
