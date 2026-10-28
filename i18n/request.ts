import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE, TIME_ZONE, resolveLocale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
