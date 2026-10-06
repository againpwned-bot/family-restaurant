import type messages from "./messages/ro.json";
import type { Locale } from "./lib/supabase/database.types";

// Typed translation keys: a missing or misspelled key is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
