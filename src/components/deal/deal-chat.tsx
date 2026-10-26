"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { uploadPhoto } from "@/lib/upload";
import type { ChatMessage } from "@/lib/deals";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime";

// 거래 채팅: 실제 번호는 숨기고 앱 안에서 대화한다. 통화가 필요하면 본인이 번호를 보낸다.
export function DealChat({
  dealId,
  myId,
  counterpartName,
  initialMessages,
  open,
  notificationUrl,
}: {
  dealId: string;
  myId: string;
  counterpartName: string;
  initialMessages: ChatMessage[];
  open: boolean;
  notificationUrl: string;
}) {
  const t = useTranslations("chat");
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 사진 메시지의 서명 URL (경로 → URL)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    // 이 거래의 새 메시지 알림은 화면을 연 것으로 읽음 처리
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("type", "new_message")
      .eq("url", notificationUrl)
      .is("read_at", null)
      .then(() => {});

    const append = (incoming: ChatMessage[]) =>
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = incoming.filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    authorizeRealtime(supabase).then(() => {
      if (closed) return;
      channel = supabase
        .channel(`deal-chat-${dealId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "deal_messages", filter: `deal_id=eq.${dealId}` },
          (payload) => append([payload.new as ChatMessage]),
        )
        .subscribe();
    });

    // 실시간 연결이 끊겨도 놓친 메시지를 10초마다 따라잡는다
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("deal_messages")
        .select("id, sender_id, kind, body, created_at")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) append((data as ChatMessage[]).reverse());
    }, 10_000);

    return () => {
      clearInterval(poll);
      closed = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [dealId, notificationUrl]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  // 새로 보인 사진 메시지의 서명 URL을 받아 온다 (거래 당사자만 읽을 수 있는 비공개 버킷)
  useEffect(() => {
    const missing = messages.filter((m) => m.kind === "photo" && !photoUrls[m.body]).map((m) => m.body);
    if (missing.length === 0) return;
    createClient()
      .storage.from("chat-photos")
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (!data) return;
        setPhotoUrls((prev) => {
          const next = { ...prev };
          for (const item of data) if (item.path && item.signedUrl) next[item.path] = item.signedUrl;
          return next;
        });
      });
  }, [messages, photoUrls]);

  async function sendPhoto(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("chat-photos", `${myId}/${dealId}`, file);
      const { data, error } = await createClient()
        .from("deal_messages")
        .insert({ deal_id: dealId, sender_id: myId, kind: "photo", body: path })
        .select("id, sender_id, kind, body, created_at")
        .single();
      if (error) throw error;
      setPhotoUrls((prev) => ({ ...prev, [path]: URL.createObjectURL(file) }));
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(false);
    const { data, error } = await createClient()
      .from("deal_messages")
      .insert({ deal_id: dealId, sender_id: myId, body })
      .select("id, sender_id, kind, body, created_at")
      .single();
    setBusy(false);
    if (error) {
      setError(true);
      return;
    }
    setText("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
  }

  async function sharePhone() {
    if (!confirm(t("sharePhoneConfirm"))) return;
    const { error } = await createClient().rpc("share_my_phone", { p_deal_id: dealId });
    if (error) setError(true);
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <div>
          <p className="text-subtitle font-semibold">💬 {counterpartName}</p>
          <p className="text-caption text-ink/50">{t("privacy")}</p>
        </div>
        {open && (
          <button type="button" onClick={sharePhone} className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-caption font-semibold">
            📞 {t("sharePhone")}
          </button>
        )}
      </div>

      <div ref={listRef} className="flex max-h-80 min-h-32 flex-col gap-2 overflow-y-auto bg-surface p-3">
        {messages.length === 0 && <p className="m-auto text-caption text-ink/50">{t("empty")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              {m.kind === "phone" ? (
                <a
                  href={`tel:${m.body}`}
                  className={`max-w-[80%] rounded-2xl border-2 border-steppe bg-white px-3 py-2 text-body ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}
                >
                  <span className="block text-caption text-ink/60">{mine ? t("myPhoneSent") : t("theirPhone")}</span>
                  <span className="price font-bold text-steppe">📞 {m.body}</span>
                </a>
              ) : m.kind === "photo" ? (
                photoUrls[m.body] ? (
                  <a href={photoUrls[m.body]} target="_blank" rel="noreferrer" className="max-w-[70%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrls[m.body]} alt={t("photoAlt")} className="max-h-56 rounded-2xl object-cover" />
                  </a>
                ) : (
                  <span className="h-32 w-40 animate-pulse rounded-2xl bg-ink/10" />
                )
              ) : (
                <p
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-body whitespace-pre-line ${
                    mine ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-white"
                  }`}
                >
                  {m.body}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {open ? (
        <form onSubmit={send} className="flex gap-2 border-t border-ink/10 p-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) sendPhoto(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-label={t("sendPhoto")}
            className="h-11 w-11 shrink-0 rounded-lg border border-ink/15 text-subtitle disabled:opacity-40"
          >
            📷
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={t("placeholder")}
            className="h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-body"
          />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 shrink-0 rounded-lg bg-navy px-4 text-body font-semibold text-white disabled:opacity-40">
            {t("send")}
          </button>
        </form>
      ) : (
        <p className="border-t border-ink/10 p-3 text-center text-caption text-ink/50">{t("closed")}</p>
      )}
      {error && <p className="px-3 pb-2 text-caption text-danger">{t("failed")}</p>}
    </section>
  );
}
