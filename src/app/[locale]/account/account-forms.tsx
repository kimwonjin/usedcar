"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 이름: 거래 채팅에서 상대에게 보이는 이름
export function NameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", data.user.id);
      if (!error) {
        setSaved(true);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-ink/60">{t("name")}</span>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={50}
          placeholder={t("namePlaceholder")}
          className="h-12 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-subtitle"
        />
        <button
          type="button"
          disabled={busy || name.trim() === initialName.trim()}
          onClick={save}
          className="h-12 shrink-0 rounded-lg bg-navy px-4 text-body font-semibold text-white disabled:opacity-40"
        >
          {saved ? "✓" : t("save")}
        </button>
      </div>
      <span className="text-caption text-ink/50">{t("nameHint")}</span>
    </label>
  );
}

export function LogoutButton() {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className="h-12 rounded-xl border border-ink/15 bg-white text-body text-ink/70"
    >
      {t("logout")}
    </button>
  );
}
