import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { formatPhoneInput } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type UserRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  dealers: { business_name: string; status: string; warning_count: number } | null;
};

// 사용자 검색: 전화번호 일부나 이름으로 찾는다
export default async function AdminUsers({ params, searchParams }: PageProps<"/[locale]/admin/users">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const digits = q.replace(/\D/g, "");

  const supabase = await createClient();
  let request = supabase
    .from("profiles")
    .select("id, phone, full_name, role, created_at, dealers!dealers_id_fkey(business_name, status, warning_count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    // 숫자가 4자리 이상이면 번호로, 아니면 이름으로 찾는다 (PostgREST 필터에 쓰지 못할 문자는 뺀다)
    request =
      digits.length >= 4
        ? request.ilike("phone", `%${digits}%`)
        : request.ilike("full_name", `%${q.replace(/[%,()*]/g, "")}%`);
  }
  const { data } = await request.overrideTypes<UserRow[], { merge: false }>();
  const users = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-navy">{t("usersTitle")}</h1>
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className="h-11 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 text-body"
        />
        <button type="submit" className="h-11 rounded-lg bg-navy px-5 font-semibold text-white">
          {t("search")}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-caption">
          <thead className="border-b border-ink/10 text-ink/60">
            <tr>
              <th className="p-3">{t("phone")}</th>
              <th className="p-3">{t("name")}</th>
              <th className="p-3">{t("role")}</th>
              <th className="p-3">{t("dealerInfo")}</th>
              <th className="p-3">{t("joinedAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="price p-3 font-semibold">{u.phone ? formatPhoneInput(u.phone) : "—"}</td>
                <td className="p-3">{u.full_name ?? "—"}</td>
                <td className="p-3">{t(`roles.${u.role}` as Parameters<typeof t>[0])}</td>
                <td className="p-3">
                  {u.dealers ? (
                    <Link href={`/admin/dealers?status=${u.dealers.status}`} className="flex items-center gap-2">
                      {u.dealers.business_name} <StatusBadge kind="dealer" status={u.dealers.status} />
                      {u.dealers.warning_count > 0 && <span className="text-danger">⚠ {u.dealers.warning_count}</span>}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">{formatDateTime(u.created_at, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-8 text-center text-ink/60">{t("emptyList")}</p>}
      </div>
    </div>
  );
}
