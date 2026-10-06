import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Browser client (singleton). Session lives in cookies shared with the server. */
export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
