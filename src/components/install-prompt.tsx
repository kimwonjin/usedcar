"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "satu-install-dismissed";

// 홈 화면에 앱 설치 안내. 안드로이드는 설치 버튼, 아이폰은 Safari 공유 → 홈 화면에 추가 안내
// (아이폰은 설치해야 푸시 알림을 받을 수 있다). 이미 설치했거나 닫았으면 보이지 않는다.
export function InstallPrompt() {
  const t = useTranslations("install");
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    // 외부 이벤트를 받아 표시 여부를 정하는 것이라 effect 안에서 상태를 바꾼다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setMode("hidden");
    setEvent(null);
  }

  return (
    <section className="flex items-start gap-3 rounded-xl border border-navy/15 bg-white p-4 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">{t("title")}</p>
        {mode === "ios" ? (
          <p className="text-caption text-ink/70">
            {t.rich("ios", {
              share: () => (
                <svg viewBox="0 0 24 24" className="mx-0.5 inline size-4 align-text-bottom text-steppe" fill="none" stroke="currentColor" strokeWidth={2} aria-label="share">
                  <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              b: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
            })}
          </p>
        ) : (
          <p className="text-caption text-ink/70">{t("android")}</p>
        )}
        {mode === "android" && (
          <button type="button" onClick={install} className="mt-2 rounded-lg bg-navy px-3 py-2 text-caption font-bold text-white">
            {t("install")}
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label={t("close")} className="-mt-1 -mr-1 p-1 text-ink/40">
        ✕
      </button>
    </section>
  );
}
