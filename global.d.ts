import type messages from "./messages/ro.json";
import type { Locale } from "./lib/types";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
