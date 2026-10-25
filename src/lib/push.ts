"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function detectPushState(): Promise<PushState> {
  const supported = vapidPublicKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // 아이폰 Safari는 홈 화면에 설치한 앱에서만 푸시를 지원한다
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    return isIos && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

// 이 기기의 푸시 알림 상태와 켜기·끄기
export function usePush() {
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    detectPushState().then(setState);
  }, []);

  const enable = useCallback(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return false;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(vapidPublicKey),
    });
    const json = subscription.toJSON();
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: data.user.id, endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      { onConflict: "endpoint" },
    );
    if (error) return false;
    setState("on");
    return true;
  }, []);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
  }, []);

  return { state, enable, disable };
}
