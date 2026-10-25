"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; from_admin: boolean; body: string; created_at: string };

// 1:1 문의 대화. 사용자 화면과 관리자 화면이 같이 쓴다 (viewer로 말풍선 방향을 정함)
export function SupportThread({
  ticketId,
  userId,
  messages,
  viewer,
  canReply,
  notificationUrl,
}: {
  ticketId: string;
  userId: string;
  messages: Message[];
  viewer: "user" | "admin";
  canReply: boolean;
  notificationUrl: string;
}) {
  const t = useTranslations("support");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // 이 문의의 알림은 화면을 연 것으로 읽음 처리
  useEffect(() => {
    createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("url", notificationUrl)
      .is("read_at", null)
      .then(() => {});
  }, [notificationUrl]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(false);
    const { error } = await createClient()
      .from("support_messages")
      .insert({ ticket_id: ticketId, sender_id: userId, body: text.trim() });
    setBusy(false);
    if (error) setError(true);
    else {
      setText("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {messages.map((m) => {
          const mine = viewer === "admin" ? m.from_admin : !m.from_admin;
          return (
            <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <span className="text-caption text-ink/50">
                {m.from_admin ? t("operator") : viewer === "admin" ? t("customer") : t("me")} · {formatDateTime(m.created_at, locale)}
              </span>
              <p
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-body whitespace-pre-line ${
                  mine ? "bg-navy text-white" : m.from_admin ? "border border-steppe/30 bg-steppe/5" : "bg-white shadow-sm"
                }`}
              >
                {m.body}
              </p>
            </li>
          );
        })}
      </ul>
      {canReply ? (
        <form onSubmit={send} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={viewer === "admin" ? t("replyPlaceholderAdmin") : t("replyPlaceholder")}
            className="rounded-lg border border-ink/15 p-3 text-body"
          />
          {error && <p className="text-caption text-danger">{t("failed")}</p>}
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-lg bg-navy font-semibold text-white disabled:opacity-40">
            {t("send")}
          </button>
        </form>
      ) : (
        <p className="text-center text-caption text-ink/60">{t("closedHint")}</p>
      )}
    </div>
  );
}
