import { createTranslator } from "next-intl";
import kk from "../../messages/kk.json";
import ko from "../../messages/ko.json";
import ru from "../../messages/ru.json";
import { formatDateTime } from "./datetime";
import { formatTenge } from "./format";

const messages = { ko, ru, kk };

export type NotificationType = keyof (typeof ko)["notifications"];
export type NotificationParams = { car?: string; amount?: number; name?: string; text?: string; rank?: number; at?: string; place?: string };

// DB에 저장된 type·params를 사용자 언어의 제목·본문으로 바꾼다 (푸시와 알림함 공용)
export function notificationText(locale: string, type: string, params: NotificationParams) {
  const lang = (locale in messages ? locale : "ko") as keyof typeof messages;
  const t = createTranslator({ locale: lang, messages: messages[lang], namespace: "notifications" });
  const key = (type in ko.notifications ? type : null) as NotificationType | null;
  if (!key) return { title: type, body: "" };
  const values = {
    car: params.car ?? "",
    name: params.name ?? "",
    text: params.text ?? "",
    amount: params.amount != null ? formatTenge(params.amount) : "",
    rank: params.rank ?? 0,
    at: params.at ? formatDateTime(params.at, lang) : "",
    place: params.place ? ` · ${params.place}` : "",
  };
  return {
    title: t(`${key}.title`, values),
    body: t(`${key}.body`, values),
  };
}
