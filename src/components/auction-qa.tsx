"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";

type Qa = { id: string; question: string; answer: string | null; answered_at: string | null; created_at: string; mine: boolean };

// 경매 문의: 딜러가 묻고 판매자가 답한다. 질문한 딜러 이름은 보이지 않는다
export function AuctionQa({
  auctionId,
  role,
  canAsk = false,
  canAnswer = false,
}: {
  auctionId: string;
  role: "dealer" | "seller";
  canAsk?: boolean;
  canAnswer?: boolean;
}) {
  const t = useTranslations("qa");
  const locale = useLocale();
  const [items, setItems] = useState<Qa[] | null>(null);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("auction_qa", { p_auction_id: auctionId });
    setItems((data ?? []) as Qa[]);
  }, [auctionId]);

  useEffect(() => {
    // 처음 한 번 불러온다 (응답이 온 뒤에 상태를 바꾼다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("auction_questions")
      .insert({ auction_id: auctionId, dealer_id: user.user?.id, question: question.trim() });
    setBusy(false);
    if (error) {
      setError(error.message.includes("too many") ? t("tooMany") : t("failed"));
      return;
    }
    setQuestion("");
    load();
  }

  async function answer(id: string) {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("answer_question", { p_question_id: id, p_answer: answers[id] ?? "" });
    setBusy(false);
    if (error) setError(t("failed"));
    else load();
  }

  if (items === null) return null;
  const unanswered = items.filter((q) => !q.answer).length;

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-subtitle font-semibold">💬 {t("title", { count: items.length })}</h2>
        {role === "seller" && unanswered > 0 && <span className="text-caption font-semibold text-danger">{t("unanswered", { count: unanswered })}</span>}
      </div>
      <p className="text-caption text-ink/60">{t(role === "seller" ? "sellerHint" : "dealerHint")}</p>

      {items.length === 0 && <p className="text-body text-ink/50">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {items.map((q) => (
          <li key={q.id} className="flex flex-col gap-1.5 border-t border-ink/10 pt-3 first:border-t-0 first:pt-0">
            <p className="text-body">
              <span className="mr-1 font-bold text-steppe">Q.</span>
              {q.question}
              {q.mine && <span className="ml-1 text-caption text-ink/50">({t("mine")})</span>}
            </p>
            <p className="text-caption text-ink/40">{formatDateTime(q.created_at, locale)}</p>
            {q.answer ? (
              <p className="rounded-lg bg-surface p-2.5 text-body">
                <span className="mr-1 font-bold text-navy">A.</span>
                {q.answer}
              </p>
            ) : canAnswer ? (
              <div className="flex gap-2">
                <input
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  maxLength={1000}
                  placeholder={t("answerPlaceholder")}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-ink/15 px-3 text-body"
                />
                <button
                  type="button"
                  disabled={busy || !(answers[q.id] ?? "").trim()}
                  onClick={() => answer(q.id)}
                  className="shrink-0 rounded-lg bg-navy px-4 font-semibold text-white disabled:opacity-40"
                >
                  {t("answer")}
                </button>
              </div>
            ) : (
              <p className="text-caption text-ink/50">{t("waiting")}</p>
            )}
          </li>
        ))}
      </ul>

      {canAsk && (
        <form onSubmit={ask} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder={t("askPlaceholder")}
            className="h-11 min-w-0 flex-1 rounded-lg border border-ink/15 px-3 text-body"
          />
          <button
            type="submit"
            disabled={busy || question.trim().length < 2}
            className="shrink-0 rounded-lg bg-navy px-4 font-semibold text-white disabled:opacity-40"
          >
            {t("ask")}
          </button>
        </form>
      )}
      {error && <p className="text-caption text-danger">{error}</p>}
    </section>
  );
}
