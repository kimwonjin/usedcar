import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { notificationText, type NotificationParams } from "@/lib/notification-text";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

type DispatchBody = {
  locale: string;
  type: string;
  params: NotificationParams;
  url: string | null;
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
};

// Supabase(pg_net)가 알림이 생길 때마다 호출한다. 공유 비밀값으로만 받는다.
export async function POST(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !publicKey || !privateKey) {
    return Response.json({ error: "push not configured" }, { status: 503 });
  }
  if (request.headers.get("x-push-secret") !== secret) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as DispatchBody;
  const { title, body: text } = notificationText(body.locale, body.type, body.params ?? {});
  const payload = JSON.stringify({ title, body: text, url: `/${body.locale}${body.url ?? ""}` });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@satu.kz", publicKey, privateKey);
  const results = await Promise.allSettled(
    body.subscriptions.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        TTL: 60 * 60,
      }),
    ),
  );

  // 404·410은 앱 삭제·권한 해제 등으로 사라진 기기 → DB에서 지운다
  const expired = results.flatMap((result, i) =>
    result.status === "rejected" && [404, 410].includes((result.reason as { statusCode?: number }).statusCode ?? 0)
      ? [body.subscriptions[i].endpoint]
      : [],
  );
  if (expired.length) {
    await createClient(supabaseUrl, supabaseAnonKey).rpc("prune_push_subscriptions", {
      p_secret: secret,
      p_endpoints: expired,
    });
  }

  return Response.json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.length - results.filter((r) => r.status === "fulfilled").length,
    expired: expired.length,
  });
}
