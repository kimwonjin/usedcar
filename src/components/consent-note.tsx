import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// "시작하면 이용약관·개인정보처리방침에 동의" 문구 (로그인, 딜러 가입)
export function ConsentNote({ kind = "login" }: { kind?: "login" | "dealer" }) {
  const t = useTranslations("legal");
  return (
    <p className="text-center text-caption text-ink/60">
      {t.rich(kind === "login" ? "consentLogin" : "consentDealer", {
        terms: (chunks: ReactNode) => (
          <Link href="/terms" className="underline" target="_blank">
            {chunks}
          </Link>
        ),
        privacy: (chunks: ReactNode) => (
          <Link href="/privacy" className="underline" target="_blank">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
